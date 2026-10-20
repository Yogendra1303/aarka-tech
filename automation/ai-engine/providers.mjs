// Arka Tech AI provider registry. Detection only: nothing here installs,
// authenticates or enables a provider. Headless argv mirrors Career-ops'
// own CLI table (web/src/lib/clis.ts) so behaviour stays consistent.
import { execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { homedir } from 'node:os';

export const STATUS = Object.freeze({
  AVAILABLE: 'available', NOT_INSTALLED: 'not_installed', AUTH_REQUIRED: 'authentication_required',
  QUOTA: 'quota_exhausted', TEMP: 'temporarily_unavailable', UNSUPPORTED: 'unsupported', UNKNOWN: 'unknown',
});

export const TASKS = ['job_fit_evaluation', 'resume_tailoring', 'cover_letter', 'application_answers', 'recruiter_message', 'test'];

const SEARCH = [...new Set([...(process.env.PATH || '').split(delimiter), join(homedir(), '.local/bin'), '/usr/local/bin', '/opt/homebrew/bin'])];
export function findBin(bin) {
  for (const d of SEARCH) { const p = join(d, bin); try { accessSync(p, constants.X_OK); return p; } catch {} }
  return null;
}
const run = (bin, args, timeout = 15000) => {
  try { return { ok: true, out: execFileSync(bin, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], env: safeEnv() }) }; }
  catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status }; }
};

// Child env never carries API keys: a subscription CLI must not silently fall
// back to pay-per-token billing because a key happens to be exported.
export const BILLING_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'DASHSCOPE_API_KEY'];
export function safeEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const k of BILLING_KEYS) delete env[k];
  // Do not inherit a parent Claude session's routing (desktop proxy URL, session ids).
  for (const k of Object.keys(env)) if (/^(CLAUDE_CODE_|CLAUDE_AGENT_SDK|CLAUDECODE$|CLAUDE_PID$|CLAUDE_EFFORT$|ANTHROPIC_BASE_URL$)/.test(k)) delete env[k];
  return env;
}

// Provider definitions. `prompt` builds a no-tools, single-shot, text/JSON call.
export const PROVIDERS = [
  {
    id: 'claude', installUrl: 'https://code.claude.com/docs/en/setup', signIn: 'Sign in: claude auth login', name: 'Claude Code', bin: 'claude', tasks: TASKS, json: true,
    version: ['--version'],
    auth(bin) {
      const r = run(bin, ['auth', 'status']);
      try {
        const j = JSON.parse(r.out);
        if (!j.loggedIn) return { status: STATUS.AUTH_REQUIRED, billing: 'none', detail: 'not signed in (run: claude auth login)' };
        const billing = j.authMethod === 'claude.ai' ? `subscription (${j.subscriptionType || 'claude.ai'})` : `api (${j.authMethod})`;
        return { status: STATUS.AVAILABLE, billing, detail: `signed in via ${j.authMethod}` };
      } catch { return { status: STATUS.UNKNOWN, billing: 'unknown', detail: 'auth status unreadable' }; }
    },
    // No tools at all for content tasks; cheapest model by default.
    argv: (prompt, model = 'claude-haiku-4-5') => ['-p', prompt, '--model', model, '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'text'],
  },
  {
    id: 'codex', installUrl: 'https://github.com/openai/codex', signIn: 'Sign in: codex login (choose ChatGPT account)', name: 'OpenAI Codex CLI', bin: 'codex', tasks: TASKS, json: true, version: ['--version'],
    auth(bin) {
      const r = run(bin, ['login', 'status']);
      if (/logged in/i.test(r.out) && /chatgpt/i.test(r.out)) return { status: STATUS.AVAILABLE, billing: 'subscription (ChatGPT)', detail: r.out.trim().split('\n')[0] };
      if (/logged in/i.test(r.out) && /api key/i.test(r.out)) return { status: STATUS.AVAILABLE, billing: 'api key', detail: 'API-key billing: disabled by policy until approved' };
      return { status: STATUS.AUTH_REQUIRED, billing: 'none', detail: 'run: codex login' };
    },
    argv: (prompt) => ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', prompt],
  },
  {
    id: 'antigravity', installUrl: 'https://antigravity.google', signIn: 'Install the Antigravity CLI from the official site, then sign in with your Google account', name: 'Antigravity CLI', bin: 'agy', tasks: TASKS, json: false, version: ['--version'],
    auth: () => ({ status: STATUS.UNKNOWN, billing: 'unknown', detail: 'auth check not documented; run a Test Task to confirm' }),
    argv: (prompt) => ['-p', prompt],
  },
  {
    id: 'gemini', installUrl: 'https://github.com/google-gemini/gemini-cli', signIn: 'Configure a supported enterprise or API-key auth method', name: 'Gemini CLI (enterprise / API key only)', bin: 'gemini', tasks: TASKS, json: true, version: ['--version'],
    auth: () => ({ status: STATUS.UNKNOWN, billing: 'unknown', detail: 'personal-account access not assumed; configure enterprise or API key first' }),
    argv: (prompt) => ['-p', prompt, '--output-format', 'text'],
  },
  {
    id: 'qwen', installUrl: 'https://github.com/QwenLM/qwen-code', signIn: 'Sign in when prompted on first run', name: 'Qwen Code', bin: 'qwen', tasks: TASKS, json: false, version: ['--version'],
    auth: () => ({ status: STATUS.UNKNOWN, billing: 'unknown', detail: 'run a Test Task to confirm sign-in' }),
    argv: (prompt) => ['-p', prompt],
  },
  {
    id: 'hermes', installUrl: 'https://github.com/NousResearch/hermes-agent', signIn: 'hermes model (choose provider); check that provider pricing', name: 'Hermes Agent', bin: 'hermes', tasks: TASKS.filter((t) => t !== 'job_fit_evaluation'), json: false, version: ['--version'],
    auth() {
      const cfg = join(homedir(), '.hermes/config.yaml');
      const provider = existsSync(cfg) ? ((/^model:\s*\n\s+provider:\s*"?([\w-]+)"?/m.exec(readFileSync(cfg, 'utf8')) || [])[1] || 'unknown') : 'unknown';
      return { status: STATUS.UNKNOWN, billing: `unknown (inference provider: ${provider})`, detail: 'billing not verifiable from here; keep disabled until you confirm the cost' };
    },
    argv: (prompt) => ['chat', '-q', prompt, '--oneshot', '-Q', '--no-restore-cwd'],
  },
];

export function detect(p, binOverride) {
  const bin = binOverride || findBin(p.bin);
  if (!bin) return { id: p.id, name: p.name, installUrl: p.installUrl, signIn: p.signIn, tasks: p.tasks, status: STATUS.NOT_INSTALLED, installed: false, path: null, version: null, billing: 'n/a', detail: `${p.bin} not found on PATH` };
  const v = run(bin, p.version);
  const a = p.auth(bin);
  return { id: p.id, name: p.name, installUrl: p.installUrl, signIn: p.signIn, installed: true, path: bin, version: v.ok ? v.out.trim().split('\n')[0] : null, ...a, tasks: p.tasks, json: p.json };
}

// Error classification from EXPLICIT messages only; anything else stays unknown.
const PATTERNS = [
  [STATUS.QUOTA, /usage limit|rate[ -]?limit|quota|limit reached|too many requests|\b429\b|out of credits|insufficient[_ ]quota/i],
  [STATUS.AUTH_REQUIRED, /not (logged|signed) in|please (run )?\/?login|unauthori[sz]ed|\b401\b|invalid api key|authentication/i],
  [STATUS.TEMP, /timed? ?out|ETIMEDOUT|ECONNRESET|ENOTFOUND|\b5\d\d\b|overloaded|service unavailable|network/i],
];
export function classify(text) {
  for (const [s, re] of PATTERNS) if (re.test(text || '')) return s;
  return STATUS.UNKNOWN;
}
export const RECOVERABLE = new Set([STATUS.QUOTA, STATUS.TEMP, STATUS.AUTH_REQUIRED, STATUS.NOT_INSTALLED]);
