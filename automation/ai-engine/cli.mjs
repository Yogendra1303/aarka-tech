#!/usr/bin/env node
// Arka Tech AI engine CLI.
//   node cli.mjs status                     provider status as JSON (detection only, no AI call)
//   node cli.mjs policy                     print policy
//   node cli.mjs set <provider> on|off      enable / disable a provider
//   node cli.mjs order a,b,c [taskType]     set fallback order (default or per task type)
//   node cli.mjs pause | resume             stop / allow new AI tasks
//   node cli.mjs test <provider>            tiny, non-destructive JSON task on one provider
import { loadPolicy, savePolicy, providerStatus, runTask, validateApi } from './engine.mjs';
import { PROVIDERS } from './providers.mjs';
import { API_PROVIDERS } from './api-providers.mjs';
import { setSecret, removeSecret } from './secrets.mjs';

const [cmd, a, b] = process.argv.slice(2);
const out = (x) => console.log(JSON.stringify(x, null, 2));
const policy = loadPolicy();
const ALL = [...PROVIDERS, ...API_PROVIDERS];
const isApi = (id) => API_PROVIDERS.some((p) => p.id === id);
const readStdin = async () => { let d = ''; for await (const c of process.stdin) d += c; return d.trim(); };
const conf = (id) => (policy.providers[id] = policy.providers[id] || {});

if (cmd === 'status') out({ policy: { paused: policy.paused, allow_api_key_billing: policy.allow_api_key_billing, order: policy.order }, providers: providerStatus() });
else if (cmd === 'policy') out(policy);
else if (cmd === 'set') {
  if (!ALL.some((p) => p.id === a) || !['on', 'off'].includes(b)) { console.error('usage: set <provider> on|off'); process.exit(1); }
  if (b === 'on' && isApi(a)) {
    const st = providerStatus().find((p) => p.id === a);
    if (!policy.providers[a]?.billing_ack) { console.error('Acknowledge possible charges for this provider first.'); process.exit(2); }
    if (st.status !== 'available') { console.error(`Validate the key first (current status: ${st.status}).`); process.exit(2); }
  }
  policy.providers[a] = { ...(policy.providers[a] || {}), enabled: b === 'on' }; savePolicy(policy); out(policy.providers[a]);
} else if (cmd === 'order') {
  const ids = String(a || '').split(',').filter(Boolean);
  if (!ids.length || ids.some((id) => !ALL.some((p) => p.id === id))) { console.error('usage: order id1,id2,...'); process.exit(1); }
  policy.order[b || 'default'] = ids; savePolicy(policy); out(policy.order);
} else if (cmd === 'pause' || cmd === 'resume') { policy.paused = cmd === 'pause'; savePolicy(policy); out({ paused: policy.paused }); }
else if (cmd === 'key-save') {
  // key arrives on stdin, never argv; saved to the macOS Keychain; status is reset to "saved, untested"
  if (!isApi(a)) { console.error('not an API provider'); process.exit(1); }
  const key = await readStdin(); setSecret(a, key);
  const { writeFileSync, readFileSync } = await import('node:fs'); const { join } = await import('node:path');
  const { STATE_DIR } = await import('./engine.mjs'); const hp = join(STATE_DIR, 'health.json');
  let h = {}; try { h = JSON.parse(readFileSync(hp, 'utf8')); } catch {}
  h[a] = { ...(h[a] || {}), lastCheckStatus: null, lastError: null }; writeFileSync(hp, JSON.stringify(h, null, 2));
  out({ saved: true, provider: a });
} else if (cmd === 'key-remove') {
  if (!isApi(a)) { console.error('not an API provider'); process.exit(1); }
  removeSecret(a); conf(a).enabled = false; savePolicy(policy);
  { const { writeFileSync, readFileSync } = await import('node:fs'); const { join } = await import('node:path'); const { STATE_DIR } = await import('./engine.mjs');
    const hp = join(STATE_DIR, 'health.json'); let h = {}; try { h = JSON.parse(readFileSync(hp, 'utf8')); } catch {} delete h[a]; writeFileSync(hp, JSON.stringify(h, null, 2)); }
  out({ removed: true, provider: a, enabled: false });
} else if (cmd === 'validate') { out(await validateApi(a)); }
else if (cmd === 'model') { if (!ALL.some((p) => p.id === a) || !b) process.exit(1); conf(a).model = b; savePolicy(policy); out({ provider: a, model: b }); }
else if (cmd === 'account') { if (a !== 'cloudflare' || !/^[a-f0-9]{32}$/i.test(b || '')) { console.error('account id must be 32 hex characters'); process.exit(1); } conf(a).accountId = b; savePolicy(policy); out({ provider: a, accountId: b }); }
else if (cmd === 'ack-billing') { if (!ALL.some((p) => p.id === a) || !['on', 'off'].includes(b)) process.exit(1); conf(a).billing_ack = b === 'on'; if (b === 'off') conf(a).enabled = false; savePolicy(policy); out({ provider: a, billing_ack: b === 'on' }); }
else if (cmd === 'test') {
  // Force routing to exactly one provider, bypassing cache with a timestamped input.
  const saved = JSON.parse(JSON.stringify(policy));
  if (isApi(a)) { out(await validateApi(a)); process.exit(0); }
  policy.order = { ...policy.order, test: [a] };
  savePolicy(policy);
  try {
    const r = await runTask({ type: 'test', input: { nonce: Date.now() }, prompt: 'Reply with only this JSON and nothing else: {"ok": true, "word": "arka"}',
      schema: { type: 'object', required: ['ok', 'word'], properties: { ok: { type: 'boolean' }, word: { type: 'string', enum: ['arka'] } } } });
    out(r);
  } finally { savePolicy({ ...saved }); }
} else { console.error('usage: status | policy | set <p> on|off | order a,b,c [task] | pause | resume | test <p>'); process.exit(1); }
