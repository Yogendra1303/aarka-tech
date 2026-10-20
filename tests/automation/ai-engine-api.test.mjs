// API-provider tests against a local mock server: no real provider is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'arka-api-'));
const server = createServer((req, res) => {
  const auth = req.headers.authorization || '';
  res.setHeader('Content-Type', 'application/json');
  if (auth.endsWith('bad-key-123456')) { res.statusCode = 401; return res.end(JSON.stringify({ error: { message: 'Invalid API Key bad-key-123456' } })); }
  if (auth.endsWith('limited-key-1234')) { res.statusCode = 429; return res.end(JSON.stringify({ error: { message: 'Rate limit reached' } })); }
  res.setHeader('x-ratelimit-remaining-requests', '999');
  res.end(JSON.stringify({ model: 'llama-3.1-8b-instant', choices: [{ message: { content: '{"ok": true, "word": "arka"}' } }] }));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const env = { ...process.env, ARKA_AI_STATE: join(dir, 'state'), ARKA_SECRETS_FILE: join(dir, 'secrets.json'), ARKA_API_BASE_GROQ: `http://127.0.0.1:${server.address().port}` };
// async child so the in-process mock server keeps answering
const cli = (args, input) => new Promise((resolve) => {
  const c = execFile(process.execPath, [new URL('../../automation/ai-engine/cli.mjs', import.meta.url).pathname, ...args], { env, encoding: 'utf8' }, (e, stdout, stderr) => {
    if (e) resolve({ ok: false, err: String(stderr || e.message), code: e.code }); else resolve({ ok: true, out: JSON.parse(stdout) });
  });
  if (input !== undefined) c.stdin.end(input); else c.stdin.end();
});
const groq = async () => (await cli(['status'])).out.providers.find((p) => p.id === 'groq');
test.after(() => server.close());

test('no key → key_missing; saved key → saved but untested, never "available"', async () => {
  assert.equal((await groq()).status, 'key_missing');
  await cli(['key-save', 'groq'], 'bad-key-123456');
  assert.equal((await groq()).status, 'key_saved_untested');
});
test('status never returns the key, only a 4-character hint', async () => {
  const s = JSON.stringify((await cli(['status'])).out);
  assert.ok(!s.includes('bad-key-123456')); assert.equal((await groq()).keyHint, '••••3456');
});
test('invalid key → invalid_key, and the key is masked in the error', async () => {
  const r = (await cli(['validate', 'groq'])).out;
  assert.equal(r.status, 'invalid_key'); assert.ok(!String(r.error).includes('bad-key-123456'));
});
test('rate-limited key → quota_exhausted', async () => {
  await cli(['key-save', 'groq'], 'limited-key-1234');
  assert.equal((await cli(['validate', 'groq'])).out.status, 'quota_exhausted');
});
test('enabling needs billing acknowledgement and a passing validation', async () => {
  await cli(['key-save', 'groq'], 'good-key-abcdef');
  assert.equal((await cli(['set', 'groq', 'on'])).code, 2); // not acknowledged
  await cli(['ack-billing', 'groq', 'on']);
  assert.equal((await cli(['set', 'groq', 'on'])).code, 2); // not validated yet
  const v = (await cli(['validate', 'groq'])).out;
  assert.equal(v.status, 'available'); assert.equal(v.rate.remaining_requests, '999');
  assert.equal((await cli(['set', 'groq', 'on'])).ok, true);
});
test('order persists across restarts (written to policy.json)', async () => {
  await cli(['order', 'groq,claude']);
  const p = JSON.parse(readFileSync(join(dir, 'state', 'policy.json'), 'utf8'));
  assert.deepEqual(p.order.default.slice(0, 2), ['groq', 'claude']);
});
test('remove deletes the key and disables the provider', async () => {
  await cli(['key-remove', 'groq']);
  const g = (await groq()); assert.equal(g.status, 'key_missing'); assert.equal(g.enabled, false);
});
