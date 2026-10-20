// API-key providers. URLs checked against each provider's official site on
// 2026-10-20 (endpoints answered 401/403 without a key; key pages loaded).
// Billing is documented, never assumed: every provider starts "unknown / not
// verified" for this account until a real call or the provider says otherwise.
import { getSecret } from './secrets.mjs';
import { STATUS } from './providers.mjs';

const base = (id, url) => process.env[`ARKA_API_BASE_${id.toUpperCase()}`] || url;

export const API_PROVIDERS = [
  {
    id: 'gemini_api', name: 'Google Gemini API', kind: 'api',
    keyUrl: 'https://aistudio.google.com/apikey', usageUrl: 'https://aistudio.google.com/usage', pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    billingNote: 'Free tier with rate limits exists per Google\'s pricing page; paid tier applies if billing is enabled on the Google Cloud project. Not verified for your key.',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    async call({ key, model, prompt, maxTokens = 400 }) {
      const r = await fetch(`${base('gemini_api', 'https://generativelanguage.googleapis.com')}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      const j = await r.json().catch(() => ({}));
      return { http: r.status, text: j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '', model, error: j.error?.message, headers: r.headers };
    },
  },
  {
    id: 'groq', name: 'Groq', kind: 'api', openai: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys', usageUrl: 'https://console.groq.com/settings/billing', pricingUrl: 'https://console.groq.com/docs/rate-limits',
    billingNote: 'Groq documents a free plan with per-model rate limits and a paid developer tier. Not verified for your account.',
    models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'], // preference order; checked against Groq's live /models list (2026-10-20)
  },
  {
    id: 'mistral', name: 'Mistral', kind: 'api', openai: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys', usageUrl: 'https://admin.mistral.ai/organization/usage', pricingUrl: 'https://mistral.ai/pricing',
    billingNote: 'Mistral offers an experiment plan and pay-as-you-go; terms depend on your workspace plan. Not verified for your account.',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
  },
  {
    id: 'openrouter', name: 'OpenRouter', kind: 'api', openai: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/settings/keys', usageUrl: 'https://openrouter.ai/settings/credits', pricingUrl: 'https://openrouter.ai/docs/api-reference/limits',
    billingNote: 'Pay-as-you-go credits; models ending in ":free" have daily request limits. Key limit and usage are read from the provider when the key is validated.',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.5-flash', 'anthropic/claude-haiku-4.5'],
    async keyInfo(key) {
      const r = await fetch(`${base('openrouter', 'https://openrouter.ai/api/v1')}/key`, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) return null;
      const d = (await r.json()).data || {};
      return { usage: d.usage ?? null, limit: d.limit ?? null, limit_remaining: d.limit_remaining ?? null, is_free_tier: d.is_free_tier ?? null };
    },
  },
  {
    id: 'cloudflare', name: 'Cloudflare Workers AI', kind: 'api', needsAccountId: true,
    keyUrl: 'https://dash.cloudflare.com/profile/api-tokens', usageUrl: 'https://dash.cloudflare.com/?to=/:account/ai/workers-ai', pricingUrl: 'https://developers.cloudflare.com/workers-ai/platform/pricing/',
    billingNote: 'Cloudflare documents a daily free allocation of Neurons, then paid usage on the Workers Paid plan. Not verified for your account.',
    models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'],
    async call({ key, model, prompt, accountId, maxTokens = 400 }) {
      const r = await fetch(`${base('cloudflare', 'https://api.cloudflare.com/client/v4')}/accounts/${encodeURIComponent(accountId || '')}/ai/run/${model}`, {
        method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens }),
      });
      const j = await r.json().catch(() => ({}));
      return { http: r.status, text: j.result?.response || '', model, error: j.errors?.[0]?.message, headers: r.headers };
    },
  },
];

// Live model discovery from each provider's own /models endpoint (no guessing).
const NON_CHAT = /whisper|orpheus|tts|guard|embed|moderation|audio|transcrib|image|vision-only|rerank/i;
export async function listModels(p, key, accountId) {
  const get = async (url, headers) => { const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) }); return r.ok ? r.json() : null; };
  try {
    if (p.id === 'gemini_api') {
      const j = await get(`${base('gemini_api', 'https://generativelanguage.googleapis.com')}/v1beta/models?pageSize=200`, { 'x-goog-api-key': key });
      return (j?.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, '')).filter((id) => !NON_CHAT.test(id));
    }
    if (p.id === 'cloudflare') {
      if (!accountId) return null;
      const j = await get(`${base('cloudflare', 'https://api.cloudflare.com/client/v4')}/accounts/${encodeURIComponent(accountId)}/ai/models/search?task=Text%20Generation&per_page=100`, { Authorization: `Bearer ${key}` });
      return (j?.result || []).map((m) => m.name).filter(Boolean);
    }
    const j = await get(`${base(p.id, p.openai)}/models`, { Authorization: `Bearer ${key}` });
    let rows = (j?.data || []).filter((m) => m.active !== false);
    if (p.id === 'mistral') rows = rows.filter((m) => m.capabilities?.completion_chat !== false);
    return rows.map((m) => m.id).filter((id) => !NON_CHAT.test(id)).sort();
  } catch { return null; }
}

// OpenAI-compatible chat call (Groq, Mistral, OpenRouter).
async function openaiCall(p, { key, model, prompt, maxTokens = 400 }) {
  const r = await fetch(`${base(p.id, p.openai)}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0 }),
  });
  const j = await r.json().catch(() => ({}));
  return { http: r.status, text: j.choices?.[0]?.message?.content || '', model: j.model || model, error: j.error?.message || j.message, headers: r.headers };
}

export function apiStatusFromHttp(http, error = '') {
  if (http >= 200 && http < 300) return STATUS.AVAILABLE;
  if (http === 401 || http === 403) return 'invalid_key';
  if (http === 429 || /quota|rate limit|credits/i.test(error)) return STATUS.QUOTA;
  if (http === 402) return STATUS.QUOTA; // payment required / out of credits
  if (http >= 500 || http === 0) return STATUS.TEMP;
  if (http === 400 || http === 404) return 'error';
  return STATUS.UNKNOWN;
}

const rateInfo = (h) => {
  if (!h?.get) return null;
  const pick = (k) => h.get(k);
  const o = { remaining_requests: pick('x-ratelimit-remaining-requests'), remaining_tokens: pick('x-ratelimit-remaining-tokens'), reset_requests: pick('x-ratelimit-reset-requests') };
  return Object.values(o).some(Boolean) ? o : null;
};

/** One provider call. Returns { status, text, model, http, error, rate } — never the key. */
export async function callApi(p, { prompt, model, accountId }) {
  const key = getSecret(p.id);
  if (!key) return { status: 'key_missing', text: '', http: null, error: 'No API key saved' };
  if (p.needsAccountId && !accountId) return { status: 'account_id_missing', text: '', http: null, error: 'Add your account ID before testing' };
  const fn = p.call ? p.call.bind(p) : (args) => openaiCall(p, args);
  try {
    const r = await fn({ key, model: model || p.models[0], prompt, accountId });
    const status = apiStatusFromHttp(r.http, r.error || '');
    return { status, text: r.text, model: r.model, http: r.http, error: r.error ? String(r.error).replaceAll(key, '••••').slice(0, 300) : null, rate: rateInfo(r.headers) };
  } catch (e) {
    return { status: STATUS.TEMP, text: '', http: 0, error: String(e.message || e).replaceAll(key, '••••').slice(0, 300) };
  }
}
