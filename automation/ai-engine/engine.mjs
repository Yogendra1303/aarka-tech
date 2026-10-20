// Arka Tech AI engine: policy-ordered provider routing with fallback, result
// cache (idempotency) and output validation. Never sends, submits or contacts
// anyone: providers only receive a prompt and return text.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS, STATUS, RECOVERABLE, detect, classify, safeEnv } from './providers.mjs';
import { API_PROVIDERS, callApi, listModels } from './api-providers.mjs';
import { hasSecret, getSecret, maskKey } from './secrets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = process.env.ARKA_AI_STATE || join(HERE, 'state');
export const POLICY_PATH = join(STATE_DIR, 'policy.json');
const CACHE_DIR = () => join(STATE_DIR, 'cache');
const LOG = () => join(STATE_DIR, 'tasks.jsonl');

export const DEFAULT_POLICY = {
  version: 1,
  paused: false,
  allow_api_key_billing: false, // never switch a subscription CLI to pay-per-token without approval
  max_attempts_per_task: 3,
  timeout_ms: 180000,
  providers: {
    claude: { enabled: true, model: 'claude-haiku-4-5' },
    codex: { enabled: false }, antigravity: { enabled: false }, gemini: { enabled: false },
    qwen: { enabled: false }, hermes: { enabled: false },
    gemini_api: { enabled: false }, groq: { enabled: false }, mistral: { enabled: false }, openrouter: { enabled: false }, cloudflare: { enabled: false },
  },
  order: {
    default: ['claude', 'codex', 'antigravity', 'qwen', 'gemini', 'hermes', 'groq', 'gemini_api', 'mistral', 'openrouter', 'cloudflare'],
  },
};

export function loadPolicy() {
  mkdirSync(STATE_DIR, { recursive: true });
  if (!existsSync(POLICY_PATH)) writeFileSync(POLICY_PATH, JSON.stringify(DEFAULT_POLICY, null, 2));
  const p = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
  const merged = { ...DEFAULT_POLICY, ...p, providers: { ...DEFAULT_POLICY.providers, ...p.providers }, order: { ...DEFAULT_POLICY.order, ...p.order } };
  const all = DEFAULT_POLICY.order.default;
  merged.order.default = [...merged.order.default.filter((id) => all.includes(id)), ...all.filter((id) => !merged.order.default.includes(id))];
  return merged;
}
export function savePolicy(p) { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(POLICY_PATH, JSON.stringify(p, null, 2)); }

// Last-seen health per provider (from real runs), merged into status output.
const HEALTH = () => join(STATE_DIR, 'health.json');
const readHealth = () => { try { return JSON.parse(readFileSync(HEALTH(), 'utf8')); } catch { return {}; } };
function recordHealth(id, patch) { const h = readHealth(); h[id] = { ...(h[id] || {}), ...patch }; writeFileSync(HEALTH(), JSON.stringify(h, null, 2)); }

export function apiStatus(p, policy, health) {
  const h = health[p.id] || {}; const conf = policy.providers[p.id] || {};
  const saved = hasSecret(p.id);
  let status = !saved ? 'key_missing' : p.needsAccountId && !conf.accountId ? 'account_id_missing' : h.lastCheckStatus || 'key_saved_untested';
  return {
    id: p.id, name: p.name, kind: 'api', installed: saved, status, enabled: !!conf.enabled, billingAck: !!conf.billing_ack,
    model: conf.model || p.models[0] || null, models: h.models?.length ? h.models : p.models, accountId: conf.accountId || null, needsAccountId: !!p.needsAccountId,
    keyHint: saved ? maskKey(getSecret(p.id)) : null, billing: conf.billing_ack ? 'possible charges acknowledged' : 'unknown (not verified)', billingNote: p.billingNote,
    keyUrl: p.keyUrl, usageUrl: p.usageUrl, pricingUrl: p.pricingUrl, usage: h.usage || null, rate: h.rate || null,
    tasks: ['job_fit_evaluation', 'resume_tailoring', 'cover_letter', 'application_answers', 'recruiter_message', 'test'], json: true,
    lastSuccessAt: h.lastSuccessAt || null, lastError: h.lastError || null, lastErrorAt: h.lastErrorAt || null, lastCheckAt: h.lastCheckAt || null,
  };
}

export function providerStatus({ bins = {} } = {}) {
  const policy = loadPolicy(); const health = readHealth();
  const cli = PROVIDERS.map((p) => {
    const d = detect(p, bins[p.id]);
    const h = health[p.id] || {};
    // A recent confirmed quota/auth failure overrides "available" until a later success.
    const status = d.status === STATUS.AVAILABLE && h.lastErrorStatus && (!h.lastSuccessAt || h.lastErrorAt > h.lastSuccessAt) ? h.lastErrorStatus : d.status;
    return { ...d, kind: 'cli', status, enabled: !!policy.providers[p.id]?.enabled, model: policy.providers[p.id]?.model || null, lastSuccessAt: h.lastSuccessAt || null, lastError: h.lastError || null, lastErrorAt: h.lastErrorAt || null };
  });
  return [...cli, ...API_PROVIDERS.map((p) => apiStatus(p, policy, health))];
}

/** Validate a saved API key with one minimal request; records status, models, rate and usage info. */
export async function validateApi(id) {
  const p = API_PROVIDERS.find((x) => x.id === id); if (!p) throw new Error('unknown provider');
  const policy = loadPolicy(); const conf = policy.providers[id] || {};
  const now = new Date().toISOString();
  if (p.needsAccountId && !conf.accountId) {
    const msg = 'Cloudflare account ID is required. Your token cannot list accounts (it needs Account read), so copy the 32-character ID from your dashboard URL (dash.cloudflare.com/<account-id>/...) or the Workers AI page, and save it here.';
    recordHealth(id, { lastCheckStatus: 'error', lastError: msg, lastErrorAt: now, lastCheckAt: now }); return { status: 'error', error: msg };
  }
  // Refresh the model list from the provider; replace a model the key cannot use.
  const live = await listModels(p, getSecret(id), conf.accountId);
  let model = conf.model;
  if (live?.length) {
    recordHealth(id, { models: live });
    const preferred = (p.models || []).find((m) => live.includes(m));
    if (!model || !live.includes(model)) { model = preferred || live[0]; policy.providers[id] = { ...conf, model }; savePolicy(policy); }
  }
  const r = await callApi(p, { prompt: 'Reply with only this JSON: {"ok": true}', model, accountId: conf.accountId });
  let status = r.status;
  if (status === STATUS.AVAILABLE) { try { if (extractJson(r.text).ok !== true) status = 'error'; } catch { status = 'error'; r.error = 'model replied, but not with the expected JSON'; } }
  const patch = { lastCheckStatus: status, lastCheckAt: now, rate: r.rate || null };
  if (status === STATUS.AVAILABLE) Object.assign(patch, { lastSuccessAt: now, lastError: null, lastErrorAt: null, lastModel: r.model });
  else Object.assign(patch, { lastError: r.error || `HTTP ${r.http}`, lastErrorAt: now });
  if (p.keyInfo && status === STATUS.AVAILABLE) { try { patch.usage = await p.keyInfo(getSecret(id)); } catch {} }
  recordHealth(id, patch);
  return { status, http: r.http, model: r.model, error: r.error, rate: r.rate, usage: patch.usage || null };
}

// ---------- cache / idempotency
export function cacheKey(task) {
  const material = JSON.stringify({ type: task.type, promptVersion: task.promptVersion || 1, input: task.input, profileVersion: task.profileVersion || null, schema: task.schema || null });
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
const cachePath = (k) => join(CACHE_DIR(), `${k}.json`);

// ---------- output validation (small JSON-schema subset: type, required, properties, enum, minLength)
export function validate(value, schema) {
  if (!schema) return [];
  const errs = [];
  const walk = (v, s, path) => {
    if (s.type === 'object') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return errs.push(`${path}: expected object`);
      for (const r of s.required || []) if (!(r in v)) errs.push(`${path}.${r}: missing`);
      for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) walk(v[k], sub, `${path}.${k}`);
    } else if (s.type === 'array') {
      if (!Array.isArray(v)) return errs.push(`${path}: expected array`);
      if (s.items) v.forEach((x, i) => walk(x, s.items, `${path}[${i}]`));
    } else if (s.type === 'number') { if (typeof v !== 'number' || Number.isNaN(v)) errs.push(`${path}: expected number`); else { if (s.minimum != null && v < s.minimum) errs.push(`${path}: < ${s.minimum}`); if (s.maximum != null && v > s.maximum) errs.push(`${path}: > ${s.maximum}`); } }
    else if (s.type === 'string') { if (typeof v !== 'string') errs.push(`${path}: expected string`); else if (s.minLength && v.length < s.minLength) errs.push(`${path}: too short`); }
    if (s.enum && !s.enum.includes(v)) errs.push(`${path}: not one of ${s.enum.join(', ')}`);
  };
  walk(value, schema, '$');
  return errs;
}
export function extractJson(text) {
  const t = String(text || '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  const body = fenced ? fenced[1] : t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1);
  return JSON.parse(body);
}

function spawnProvider(p, bin, prompt, policy) {
  const model = policy.providers[p.id]?.model;
  return new Promise((resolve) => {
    let out = '', err = '', done = false;
    const child = spawn(bin, p.argv(prompt, model), { env: safeEnv({ CAREER_OPS_HEADLESS: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { if (!done) { child.kill('SIGTERM'); err += '\ntimed out'; } }, policy.timeout_ms);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { err += e.message; });
    child.on('close', (code) => { done = true; clearTimeout(timer); resolve({ code, out, err }); });
  });
}

/**
 * Run one task. task = { id?, type, prompt, input, schema?, promptVersion?, profileVersion? }
 * Returns { status: 'done'|'cached'|'deferred'|'failed', provider, result, attempts }.
 */
export async function runTask(task, { bins = {} } = {}) {
  const policy = loadPolicy();
  mkdirSync(CACHE_DIR(), { recursive: true });
  const key = cacheKey(task);
  const log = (rec) => appendFileSync(LOG(), JSON.stringify({ at: new Date().toISOString(), task_id: task.id || key, key, type: task.type, ...rec }) + '\n');

  if (existsSync(cachePath(key))) {
    const c = JSON.parse(readFileSync(cachePath(key), 'utf8'));
    log({ status: 'cached', provider: c.provider });
    return { status: 'cached', provider: c.provider, result: c.result, attempts: [] };
  }
  if (policy.paused) { log({ status: 'deferred', reason: 'paused' }); return { status: 'deferred', reason: 'paused', attempts: [] }; }

  const order = policy.order[task.type] || policy.order.default;
  const statuses = Object.fromEntries(providerStatus({ bins }).map((s) => [s.id, s]));
  const attempts = [];
  for (const id of order) {
    if (attempts.length >= policy.max_attempts_per_task) break;
    const s = statuses[id];
    const api = API_PROVIDERS.find((x) => x.id === id);
    if (api && s) {
      if (!policy.providers[id]?.enabled) { attempts.push({ provider: id, skipped: 'disabled' }); continue; }
      if (!policy.providers[id]?.billing_ack) { attempts.push({ provider: id, skipped: 'billing not acknowledged' }); continue; }
      if (s.status !== STATUS.AVAILABLE) { attempts.push({ provider: id, skipped: s.status }); continue; }
      const r = await callApi(api, { prompt: task.prompt, model: s.model, accountId: s.accountId });
      const now = new Date().toISOString();
      if (r.status !== STATUS.AVAILABLE) { recordHealth(id, { lastError: r.error || `HTTP ${r.http}`, lastErrorAt: now, lastCheckStatus: r.status }); attempts.push({ provider: id, failed: r.status, http: r.http }); continue; }
      let result = r.text.trim();
      if (task.schema) {
        try { result = extractJson(result); } catch { attempts.push({ provider: id, failed: 'invalid_json' }); continue; }
        const errs = validate(result, task.schema);
        if (errs.length) { attempts.push({ provider: id, failed: 'schema', errors: errs.slice(0, 5) }); continue; }
      }
      recordHealth(id, { lastSuccessAt: now, lastError: null, lastErrorAt: null, lastCheckStatus: STATUS.AVAILABLE, rate: r.rate || null });
      writeFileSync(cachePath(key), JSON.stringify({ key, provider: id, model: r.model, at: now, type: task.type, input: task.input, result }, null, 2));
      attempts.push({ provider: id, ok: true });
      log({ status: 'done', provider: id, attempts });
      return { status: 'done', provider: id, result, attempts };
    }
    const p = PROVIDERS.find((x) => x.id === id);
    if (!p || !s) continue;
    if (!policy.providers[id]?.enabled) { attempts.push({ provider: id, skipped: 'disabled' }); continue; }
    if (!p.tasks.includes(task.type)) { attempts.push({ provider: id, skipped: 'task not supported' }); continue; }
    if (task.schema && !p.json) { attempts.push({ provider: id, skipped: 'no structured output' }); continue; }
    if (/^api/.test(s.billing) && !policy.allow_api_key_billing) { attempts.push({ provider: id, skipped: 'api-key billing not approved' }); continue; }
    if (/^unknown/.test(s.billing) && !policy.providers[id]?.billing_ack) { attempts.push({ provider: id, skipped: 'billing not acknowledged' }); continue; }
    if (s.status !== STATUS.AVAILABLE && s.status !== STATUS.UNKNOWN) { attempts.push({ provider: id, skipped: s.status }); continue; }

    let r = await spawnProvider(p, s.path, task.prompt, policy);
    // One retry on the same provider when it answered but not in valid JSON (model formatting slip).
    if (r.code === 0 && task.schema) { try { extractJson(r.out); } catch { attempts.push({ provider: id, retried: 'invalid_json' }); r = await spawnProvider(p, s.path, task.prompt, policy); } }
    const now = new Date().toISOString();
    if (r.code !== 0) {
      const st = classify(`${r.err}\n${r.out}`);
      recordHealth(id, { lastError: (r.err || r.out).trim().slice(0, 300), lastErrorAt: now, lastErrorStatus: st === STATUS.UNKNOWN ? null : st });
      attempts.push({ provider: id, failed: st, exit: r.code });
      if (RECOVERABLE.has(st) || st === STATUS.UNKNOWN) continue;
      continue;
    }
    let result = r.out.trim();
    if (task.schema) {
      try { result = extractJson(result); } catch (e) { attempts.push({ provider: id, failed: 'invalid_json' }); recordHealth(id, { lastError: 'invalid JSON output', lastErrorAt: now }); continue; }
      const errs = validate(result, task.schema);
      if (errs.length) { attempts.push({ provider: id, failed: 'schema', errors: errs.slice(0, 5) }); recordHealth(id, { lastError: `schema: ${errs[0]}`, lastErrorAt: now }); continue; }
    }
    recordHealth(id, { lastSuccessAt: now, lastErrorStatus: null, lastError: null, lastErrorAt: null });
    writeFileSync(cachePath(key), JSON.stringify({ key, provider: id, model: policy.providers[id]?.model || null, at: now, type: task.type, input: task.input, result }, null, 2));
    attempts.push({ provider: id, ok: true });
    log({ status: 'done', provider: id, attempts });
    return { status: 'done', provider: id, result, attempts };
  }
  const anyTried = attempts.some((a) => a.failed);
  log({ status: anyTried ? 'failed' : 'deferred', attempts });
  return { status: anyTried ? 'failed' : 'deferred', reason: anyTried ? 'all eligible providers failed' : 'no eligible provider available', attempts };
}
