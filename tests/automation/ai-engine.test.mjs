// Fixture tests: fake provider executables simulate success, quota exhaustion,
// auth failure and invalid output. No real provider is called and nothing is billed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const state = mkdtempSync(join(tmpdir(), 'arka-ai-'));
process.env.ARKA_AI_STATE = state;
process.env.ANTHROPIC_API_KEY = 'sk-test-should-never-reach-children';
const { runTask, savePolicy, DEFAULT_POLICY, providerStatus } = await import('../../automation/ai-engine/engine.mjs');
const { classify, STATUS } = await import('../../automation/ai-engine/providers.mjs');

const bins = join(state, 'bin');
const calls = join(state, 'calls.log');
function fake(name, body) {
  const p = join(state, `${name}.sh`);
  writeFileSync(p, `#!/bin/sh\necho "${name} $*" >> "${calls}"\nif [ "$1" = "--version" ]; then echo "${name} 0.0-test"; exit 0; fi\nif [ "$1" = "auth" ]; then echo '{"loggedIn": true, "authMethod": "claude.ai", "subscriptionType": "pro"}'; exit 0; fi\nif [ "$1" = "login" ]; then echo "Logged in using ChatGPT"; exit 0; fi\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}
const ok = 'echo "key=${ANTHROPIC_API_KEY:-none}" >&2; echo \'{"ok": true, "word": "arka"}\'';
const quota = 'echo "Claude usage limit reached. Your limit will reset at 7pm" >&2; exit 1';
const authFail = 'echo "Not logged in. Please run /login" >&2; exit 1';
const badJson = 'echo "sure! here is the answer: ok"';
const schema = { type: 'object', required: ['ok', 'word'], properties: { ok: { type: 'boolean' }, word: { type: 'string', enum: ['arka'] } } };
const countCalls = (name) => (existsSync(calls) ? readFileSync(calls, 'utf8').split('\n').filter((l) => l.startsWith(`${name} -p`) || l.startsWith(`${name} exec`)).length : 0);
const policy = (order, enabled = order) => (rmSync(join(state, 'health.json'), { force: true }), savePolicy({ ...DEFAULT_POLICY, providers: Object.fromEntries(['claude', 'codex', 'antigravity', 'gemini', 'qwen', 'hermes'].map((id) => [id, { enabled: enabled.includes(id) }])), order: { default: order } }));
let n = 0; const task = () => ({ type: 'test', input: { n: ++n }, prompt: 'json please', schema });

test('preferred provider is used when available', async () => {
  policy(['claude', 'codex']);
  const r = await runTask(task(), { bins: { claude: fake('claude', ok), codex: fake('codex', ok) } });
  assert.equal(r.status, 'done'); assert.equal(r.provider, 'claude');
});

test('quota exhaustion on the primary falls back to the next eligible provider', async () => {
  policy(['claude', 'codex']);
  const r = await runTask(task(), { bins: { claude: fake('claude', quota), codex: fake('codex', ok) } });
  assert.equal(r.provider, 'codex');
  assert.equal(r.attempts[0].failed, STATUS.QUOTA);
});

test('a provider with a confirmed quota failure is skipped on the next task', async () => {
  policy(['claude', 'codex']);
  const b = { claude: fake('claude', quota), codex: fake('codex', ok) };
  await runTask(task(), { bins: b });
  const st = providerStatus({ bins: b }).find((p) => p.id === 'claude');
  const r = await runTask(task(), { bins: b });
  assert.ok(r.attempts.some((a) => a.provider === 'claude' && a.skipped === STATUS.QUOTA));
  assert.equal(st.status, STATUS.QUOTA);
});

test('a successful task is served from cache and not repeated', async () => {
  policy(['codex']);
  const t = { type: 'test', input: { fixed: 1 }, prompt: 'json please', schema };
  const b = { codex: fake('codex', ok) };
  const before = countCalls('codex');
  const first = await runTask(t, { bins: b });
  const second = await runTask(t, { bins: b });
  assert.equal(first.status, 'done'); assert.equal(second.status, 'cached');
  assert.equal(countCalls('codex') - before, 1);
});

test('invalid structured output is rejected and the next provider is tried', async () => {
  policy(['claude', 'codex']);
  const r = await runTask(task(), { bins: { claude: fake('claude', badJson), codex: fake('codex', ok) } });
  assert.ok(r.attempts.some((a) => a.retried === 'invalid_json')); assert.ok(r.attempts.some((a) => a.failed === 'invalid_json')); assert.equal(r.provider, 'codex');
});

test('authentication failures are classified, and all-failed tasks are reported, not faked', async () => {
  policy(['claude']);
  const r = await runTask(task(), { bins: { claude: fake('claude', authFail) } });
  assert.equal(r.status, 'failed'); assert.equal(r.attempts[0].failed, STATUS.AUTH_REQUIRED);
});

test('with no enabled provider the task is deferred (kept for later), never fabricated', async () => {
  policy(['claude'], []);
  const r = await runTask(task(), { bins: { claude: fake('claude', ok) } });
  assert.equal(r.status, 'deferred');
});

test('API keys in the parent environment never reach provider processes', async () => {
  policy(['claude']);
  await runTask(task(), { bins: { claude: fake('claude', ok) } });
  // the fake writes key=... to stderr; engine discards stderr on success, so check via a dedicated probe
  const probe = fake('claude', 'echo "{\\"ok\\": true, \\"word\\": \\"arka\\", \\"k\\": \\"${ANTHROPIC_API_KEY:-none}\\"}"');
  const r = await runTask({ type: 'test', input: { probe: 1 }, prompt: 'x', schema }, { bins: { claude: probe } });
  assert.equal(r.result.k, 'none');
});

test('error classification only trusts explicit messages', () => {
  assert.equal(classify('rate limit exceeded (429)'), STATUS.QUOTA);
  assert.equal(classify('ECONNRESET'), STATUS.TEMP);
  assert.equal(classify('something odd happened'), STATUS.UNKNOWN);
});
