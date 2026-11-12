#!/usr/bin/env node
// Job intake for "Add a Job": fetch one posting with the existing extractors and print JSON.
//   node web/scripts/job-intake.mjs fetch <url>
// Known ATS links use the board's public API (fetchJdViaKnownApi). Anything else is opened
// once in the existing headless extractor (browser-extract.mjs, jd mode). Login walls,
// CAPTCHAs and blocked pages are reported as needsPaste; nothing tries to get around them.
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJdViaKnownApi } from '../../browser-extract.mjs';
import { isMainModule } from '../../lib/is-main-module.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOCKED = /(^|\.)(linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+|naukri\.com|instahyre\.com|wellfound\.com|angel\.co)$/i;
const WALL = /(sign in to (view|continue|apply)|log ?in to (view|continue|see)|please (log|sign) in|captcha|are you a (human|robot)|verify you are human|access denied|unusual traffic|enable javascript to|cloudflare ray id|request blocked)/i;

export function wallReason(text, title = '') {
  const t = `${title}\n${text}`.slice(0, 6000);
  if (WALL.test(t)) return 'This page needs a sign-in or a human check, so Aarka Tech will not read it. Copy the job description and paste it instead.';
  if (String(text).trim().length < 300) return 'The page did not show a readable job description. Paste the description instead.';
  return '';
}

function browserExtract(url) {
  return new Promise((resolve) => {
    execFile(process.execPath, [join(ROOT, 'browser-extract.mjs'), url, '--mode', 'jd', '--max-chars', '20000', '--timeout', '20000'],
      { timeout: 45_000, maxBuffer: 4 * 1024 * 1024, cwd: ROOT }, (err, stdout) => {
        try { resolve(JSON.parse(stdout)); } catch { resolve({ error: err ? String(err.message).slice(0, 200) : 'no output' }); }
      });
  });
}

export async function fetchPosting(url) {
  const host = new URL(url).host;
  if (BLOCKED.test(host)) return { ok: false, needsPaste: true, reason: `${host} only shows jobs to signed-in users, so Aarka Tech will not open it. Paste the job description instead.` };
  const api = await fetchJdViaKnownApi(url, 20000, 20000).catch(() => null);
  if (api?.text && api.text.length >= 200) return { ok: true, via: `ats-api:${api.ats}`, title: api.title || '', text: api.text, finalUrl: api.url || url };
  const page = await browserExtract(url);
  if (page?.error || !page?.text) return { ok: false, needsPaste: true, reason: 'The page could not be read (it may be blocked, removed or slow). Paste the job description instead.', detail: page?.error || page?.reason || '' };
  const wall = wallReason(page.text, page.title);
  if (wall) return { ok: false, needsPaste: true, reason: wall };
  return { ok: true, via: 'browser', title: page.title || '', text: page.text, finalUrl: page.url || url };
}

async function main() {
  const [cmd, url] = process.argv.slice(2);
  if (cmd === '--help' || cmd === '-h' || !cmd) { console.log('usage: job-intake.mjs fetch <url>'); return; }
  if (cmd !== 'fetch' || !url) { console.error('usage: job-intake.mjs fetch <url>'); process.exit(2); }
  const out = await fetchPosting(url).catch((e) => ({ ok: false, needsPaste: true, reason: 'The page could not be read. Paste the job description instead.', detail: String(e.message || e).slice(0, 200) }));
  process.stdout.write(JSON.stringify(out));
}
if (isMainModule(import.meta.url)) main();
