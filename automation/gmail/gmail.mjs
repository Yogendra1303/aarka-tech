#!/usr/bin/env node
// Gmail draft connector for the Job Hunter Agent. DRAFT-ONLY: there is no send code path.
//
// Auth: Google's official OAuth 2.0 for installed apps (loopback redirect + PKCE).
// Scope: https://www.googleapis.com/auth/gmail.compose  (needed for drafts.create/get and
// users.getProfile). Google bundles "send" into this scope; this program never calls send.
//
// Files (outside the repo, never logged):
//   ~/Library/Application Support/careerops/gmail-client.json  OAuth client you download from Google Cloud (Desktop app)
//   ~/Library/Application Support/careerops/gmail-token.json   refresh token, written 0600 by `auth`
//
// Usage:
//   node gmail.mjs auth                 open Google's consent page; you pick the Gmail account
//   node gmail.mjs status               show the connected address (verified with Gmail)
//   node gmail.mjs draft --to a@b.com --subject "..." --body-file body.txt [--attach file.pdf ...] [--job-url URL]
//   node gmail.mjs disconnect           revoke the token at Google and delete it locally
import { isMainModule } from '../../lib/is-main-module.mjs';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync, appendFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, extname, resolve } from 'node:path';
import { execFile } from 'node:child_process';

export const SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const DIR = process.env.CAREEROPS_SECRETS_DIR || join(homedir(), 'Library/Application Support/careerops');
const CLIENT = join(DIR, 'gmail-client.json');
const TOKEN = join(DIR, 'gmail-token.json');
const LOG = join(homedir(), 'career-ops/data/hub/gmail-drafts.tsv');
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_TOTAL_BYTES = 24 * 1024 * 1024; // Gmail limit is 25 MB incl. encoding overhead
const ALLOWED = new Set(['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.txt', '.md']);
const MIME = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain', '.md': 'text/markdown' };

const die = (m) => { console.error(`gmail: ${m}`); process.exit(1); };
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function loadClient() {
  if (!existsSync(CLIENT)) die(`OAuth client file missing: ${CLIENT}\nCreate a "Desktop app" OAuth client in Google Cloud Console and save its JSON there.`);
  const j = JSON.parse(readFileSync(CLIENT, 'utf8'));
  const c = j.installed || j.web || j;
  if (!c.client_id) die('client file has no client_id');
  return { id: c.client_id, secret: c.client_secret, authUri: c.auth_uri || 'https://accounts.google.com/o/oauth2/v2/auth', tokenUri: c.token_uri || 'https://oauth2.googleapis.com/token' };
}
function saveToken(t) { mkdirSync(DIR, { recursive: true, mode: 0o700 }); writeFileSync(TOKEN, JSON.stringify(t), { mode: 0o600 }); chmodSync(TOKEN, 0o600); }

// ---------- attachments (validated before any draft is created)
export function checkAttachment(p) {
  const path = resolve(p);
  if (!existsSync(path)) return { ok: false, path, why: 'file not found' };
  const ext = extname(path).toLowerCase();
  if (!ALLOWED.has(ext)) return { ok: false, path, why: `type ${ext || '(none)'} not allowed` };
  const size = statSync(path).size;
  if (size === 0) return { ok: false, path, why: 'empty file' };
  const buf = readFileSync(path);
  if (ext === '.pdf') {
    if (buf.subarray(0, 5).toString() !== '%PDF-' || !buf.subarray(-1024).toString('latin1').includes('%%EOF')) return { ok: false, path, why: 'not a complete PDF' };
    if (!(buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length) return { ok: false, path, why: 'PDF has no pages' };
  }
  return { ok: true, path, name: basename(path), size, type: MIME[ext], buf };
}

// ---------- RFC 2822 message
export function buildMime({ from, to, subject, body, attachments = [] }) {
  const boundary = `jh_${randomBytes(12).toString('hex')}`;
  const enc = (s) => (/[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=` : s);
  const head = [from ? `From: ${from}` : null, `To: ${to}`, `Subject: ${enc(subject)}`, 'MIME-Version: 1.0'].filter(Boolean);
  if (!attachments.length) return [...head, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(body).toString('base64')].join('\r\n');
  const parts = [`--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(body).toString('base64')];
  for (const a of attachments) {
    parts.push(`--${boundary}`, `Content-Type: ${a.type}; name="${a.name}"`, `Content-Disposition: attachment; filename="${a.name}"`, 'Content-Transfer-Encoding: base64', '', a.buf.toString('base64').replace(/.{76}/g, '$&\r\n'));
  }
  parts.push(`--${boundary}--`, '');
  return [...head, `Content-Type: multipart/mixed; boundary="${boundary}"`, '', ...parts].join('\r\n');
}

// ---------- OAuth
async function accessToken(fetchImpl = fetch) {
  if (!existsSync(TOKEN)) die('not connected; run: node gmail.mjs auth');
  const t = JSON.parse(readFileSync(TOKEN, 'utf8'));
  if (t.access_token && t.expires_at > Date.now() + 60_000) return t.access_token;
  const c = loadClient();
  const r = await fetchImpl(c.tokenUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret || '', refresh_token: t.refresh_token, grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!r.ok) die(`token refresh failed (${j.error || r.status}); run: node gmail.mjs auth`);
  saveToken({ ...t, access_token: j.access_token, expires_at: Date.now() + j.expires_in * 1000 });
  return j.access_token;
}

async function auth() {
  const c = loadClient();
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  const server = createServer();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const url = `${c.authUri}?${new URLSearchParams({ client_id: c.id, redirect_uri: redirect, response_type: 'code', scope: SCOPE, code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent select_account' })}`;
  console.log(`Opening Google's consent page. Choose the Gmail account to use.\nScope requested: ${SCOPE} (drafts; this app never sends).\n${url}`);
  execFile('open', [url]);
  const code = await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('timed out after 5 minutes')), 300_000);
    server.on('request', (req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      if (q.get('state') !== state) { res.end('State mismatch.'); return; }
      res.end(q.get('code') ? 'Gmail connected. You can close this tab.' : `Authorization failed: ${q.get('error')}`);
      clearTimeout(timer); server.close();
      q.get('code') ? ok(q.get('code')) : fail(new Error(q.get('error')));
    });
  });
  const r = await fetch(c.tokenUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret || '', redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }) });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) die(`token exchange failed (${j.error || r.status})`);
  if (!String(j.scope || '').split(' ').includes(SCOPE)) die('Google did not grant the compose scope');
  saveToken({ refresh_token: j.refresh_token, access_token: j.access_token, expires_at: Date.now() + j.expires_in * 1000, scope: j.scope });
  await status();
}

async function status(fetchImpl = fetch) {
  const r = await fetchImpl(`${API}/profile`, { headers: { Authorization: `Bearer ${await accessToken(fetchImpl)}` } });
  const j = await r.json();
  if (!r.ok) die(`Gmail profile check failed (${r.status})`);
  console.log(JSON.stringify({ connected: true, emailAddress: j.emailAddress, scope: SCOPE, mode: 'draft-only' }));
  return j.emailAddress;
}

export async function createDraft({ to, subject, body, attachPaths = [], jobUrl = '' }, fetchImpl = fetch) {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to || '')) throw new Error('a single valid recipient address is required');
  if (!subject || !body) throw new Error('subject and body are required');
  const checks = attachPaths.map(checkAttachment);
  const bad = checks.filter((c) => !c.ok);
  if (bad.length) throw new Error(`attachment check failed: ${bad.map((b) => `${b.path} (${b.why})`).join('; ')}`);
  const total = checks.reduce((n, c) => n + c.size, 0) * 1.37;
  if (total > MAX_TOTAL_BYTES) throw new Error('attachments exceed the Gmail size limit');
  const token = await accessToken(fetchImpl);
  const raw = b64url(buildMime({ to, subject, body, attachments: checks }));
  const r = await fetchImpl(`${API}/drafts`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw } }) });
  const j = await r.json();
  if (!r.ok || !j.id) throw new Error(`Gmail rejected the draft (${r.status} ${j.error?.message || ''})`);
  // verify: read the draft back from Gmail
  const v = await fetchImpl(`${API}/drafts/${j.id}?format=metadata`, { headers: { Authorization: `Bearer ${token}` } });
  const vj = await v.json();
  const hdr = (n) => (vj.message?.payload?.headers || []).find((h) => h.name.toLowerCase() === n)?.value;
  if (!v.ok || !hdr('to')?.includes(to)) throw new Error('draft created but could not be verified; check Gmail Drafts');
  const rec = { created: new Date().toISOString(), draft_id: j.id, message_id: j.message?.id, to, subject, attachments: checks.map((c) => c.name), job_url: jobUrl, link: `https://mail.google.com/mail/u/0/#drafts?compose=${j.message?.id}` };
  return rec;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === '--help' || cmd === '-h' || rest.includes('--help') || rest.includes('-h')) {
    console.log('usage: gmail.mjs auth | status | draft --to X --subject Y --body-file F [--attach P ...] [--job-url U] | disconnect');
    return;
  }
  if (cmd === 'auth') return auth();
  if (cmd === 'status') return status();
  if (cmd === 'disconnect') {
    if (existsSync(TOKEN)) {
      const t = JSON.parse(readFileSync(TOKEN, 'utf8'));
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token)}`, { method: 'POST' }).catch(() => {});
      unlinkSync(TOKEN);
    }
    console.log('Gmail disconnected (token revoked and deleted).');
    return;
  }
  if (cmd === 'draft') {
    const attachPaths = rest.flatMap((v, i) => (rest[i - 1] === '--attach' ? [v] : []));
    const body = readFileSync(arg('--body-file') || die('--body-file required'), 'utf8');
    try {
      const rec = await createDraft({ to: arg('--to'), subject: arg('--subject'), body, attachPaths, jobUrl: arg('--job-url') || '' });
      if (!existsSync(LOG)) writeFileSync(LOG, 'created\tdraft_id\tto\tsubject\tattachments\tjob_url\tlink\n');
      appendFileSync(LOG, [rec.created, rec.draft_id, rec.to, rec.subject, rec.attachments.join(','), rec.job_url, rec.link].map((x) => String(x).replace(/[\t\n]/g, ' ')).join('\t') + '\n');
      console.log(JSON.stringify(rec));
    } catch (e) { die(e.message); }
    return;
  }
  console.log('usage: gmail.mjs auth | status | draft --to X --subject Y --body-file F [--attach P ...] [--job-url U] | disconnect');
}
if (isMainModule(import.meta.url)) main();
