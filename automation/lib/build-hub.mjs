#!/usr/bin/env node
// Builds the single place to look: the master job tracker (CSV), the daily
// report (Markdown) and the hub page (HTML). Zero tokens; reads files only.
// Usage: node build-hub.mjs <career-ops dir> <run-status.json> <followups.json>
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, resolve, relative } from 'path';
import { getProfilePath } from '../../path-resolver.mjs';
import { read, trackerRows, reportUrl, packInfo, outreachRows } from './tracker-lib.mjs';

const root = resolve(process.argv[2] || '.');
const runPath = process.argv[3];
const fuPath = process.argv[4];
const today = new Date().toISOString().slice(0, 10);
const candidate = (() => { try { return (readFileSync(getProfilePath(root), 'utf8').match(/full_name:\s*["']?([^"'\n]+)/) || [])[1]?.trim() || ''; } catch { return ''; } })();
const run = runPath && existsSync(runPath) ? JSON.parse(readFileSync(runPath, 'utf8')) : { stages: [] };
let followups = { entries: [] };
try { followups = JSON.parse(read(fuPath) || '{"entries":[]}'); } catch {}

const norm = (u) => String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

// ---- jobs from the pipeline inbox
const jobs = new Map();
let section = '';
for (const line of read(join(root, 'data/pipeline.md')).split('\n')) {
  if (/^##\s/.test(line)) section = line.replace(/^##\s*/, '').trim();
  const m = line.match(/^- \[( |x)\] (.+)$/);
  if (!m) continue;
  const parts = m[2].split(' | ');
  const url = parts[0].trim();
  const get = (k) => (parts.find((p) => p.startsWith(k)) || '').replace(k, '').trim();
  const rank = (get('rank:').match(/^([0-9.]+)/) || [])[1] || '';
  jobs.set(norm(url), {
    url, company: (parts[1] || '').trim(), role: (parts[2] || '').trim(), location: (parts[3] || '').trim(),
    posted: get('posted:'), comp: parts.find((p) => /\d{2,}.*(INR|AED|USD|SGD|LPA|₹|\$)/i.test(p)) || '',
    rank, rank_reason: (get('rank:').split('—')[1] || '').trim(), stage: m[1] === 'x' ? 'processed' : 'discovered',
    score: '', status: 'Discovered', report: '', resume: '', cover: '', answers: '', contact: '', outreach: '', outreach_status: '', next_followup: '',
  });
}

// ---- first-seen dates from scan history
const firstSeen = new Map();
for (const l of read(join(root, 'data/scan-history.tsv')).split('\n').slice(1)) {
  const c = l.split('\t');
  if (c[0]) firstSeen.set(norm(c[0]), c[1]);
}

// ---- evaluations, packs
for (const r of trackerRows(root)) {
  const url = r.report ? reportUrl(root, r.report) : '';
  const key = norm(url) || `tracker-${r.num}`;
  const j = jobs.get(key) || { url, company: r.company, role: r.role, location: '', posted: '', comp: '', rank: '', rank_reason: '' };
  const p = packInfo(root, r);
  if (!j.location && r.report) j.location = (read(join(root, r.report)).match(/^posting_location:\s*"?([^"\n]+)"?/m) || [])[1] || '';
  Object.assign(j, {
    stage: 'evaluated', score: r.score ?? '', status: r.status, report: r.report,
    resume: p.pack?.cv_pdf || '', cover: p.pack?.cover_pdf || '', answers: p.pack?.answers || '',
    tracker_num: r.num,
  });
  jobs.set(key, j);
}

// ---- outreach drafts (dedupe by job + contact; flag repeat contacts)
const seenPair = new Set(); const contactJobs = new Map(); const outreachDupes = [];
for (const o of outreachRows(root)) {
  const pair = `${norm(o.job_url)}|${(o.contact_name || '').toLowerCase()}`;
  if (seenPair.has(pair)) { outreachDupes.push(o); continue; }
  seenPair.add(pair);
  const c = (o.contact_name || '').toLowerCase();
  if (c && c !== 'none found') contactJobs.set(c, (contactJobs.get(c) || 0) + 1);
  const j = jobs.get(norm(o.job_url));
  if (j) Object.assign(j, { contact: [o.contact_name, o.contact_title].filter(Boolean).join(', '), outreach: o.message_draft, outreach_status: o.status });
}
const repeatContacts = [...contactJobs].filter(([, n]) => n > 1).map(([c]) => c);

// ---- follow-ups
for (const e of followups.entries || []) {
  const date = e.nextFollowupDate || e.next_followup || e.nextDate || '';
  for (const j of jobs.values()) {
    if (j.tracker_num && String(j.tracker_num) === String(e.num ?? e.appNum)) j.next_followup = date;
  }
}

for (const [k, j] of jobs) j.first_seen = firstSeen.get(k) || '';

// ---- master tracker CSV
const cols = ['first_seen', 'company', 'role', 'location', 'posted', 'comp', 'url', 'rank', 'score', 'status', 'report', 'resume', 'cover', 'answers', 'contact', 'outreach', 'outreach_status', 'next_followup'];
const csvq = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const all = [...jobs.values()].sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)) || (Number(b.rank || 0) - Number(a.rank || 0)));
mkdirSync(join(root, 'data/hub'), { recursive: true });
writeFileSync(join(root, 'data/hub/master-tracker.csv'), [cols.join(','), ...all.map((j) => cols.map((c) => csvq(j[c])).join(','))].join('\n') + '\n');

// ---- daily report
const newToday = all.filter((j) => j.first_seen === today);
const packsToday = all.filter((j) => j.resume || j.cover);
const pending = all.filter((j) => j.stage === 'discovered');
const fuDue = all.filter((j) => j.next_followup && j.next_followup <= today);
const stageLine = (s) => `| ${s.name} | ${s.status} | ${String(s.detail || '').replace(/\|/g, '/')} |`;
const report = [
  `# Job search daily report — ${today}`, '',
  `Run started ${run.started || '?'}, finished ${run.finished || '?'}.`, '',
  '## Pipeline health', '', '| Stage | Result | Detail |', '|---|---|---|', ...(run.stages || []).map(stageLine), '',
  `## New roles found today (${newToday.length})`, '',
  ...(newToday.length ? newToday.slice(0, 40).map((j) => `- ${j.company} — ${j.role} — ${j.location}${j.rank ? ` — rank ${j.rank}` : ''} — ${j.url}`) : ['None.']), '',
  `## Evaluated roles and application packs (${packsToday.length} packs)`, '',
  ...all.filter((j) => j.stage === 'evaluated').map((j) => `- ${j.company} — ${j.role} — score ${j.score} — ${j.status} — resume: ${j.resume || 'none'} — cover: ${j.cover || 'none'}`), '',
  '## Waiting for you', '',
  `- ${all.filter((j) => j.outreach_status && /draft/i.test(j.outreach_status)).length} outreach drafts to review (nothing is sent automatically)`,
  `- ${all.filter((j) => j.resume && !/applied/i.test(j.status)).length} application packs ready for your review`,
  `- ${pending.length} discovered roles not yet evaluated`,
  ...(repeatContacts.length ? [`- Same contact drafted for several roles: ${repeatContacts.join(', ')}`] : []),
  ...(outreachDupes.length ? [`- ${outreachDupes.length} duplicate outreach rows ignored`] : []), '',
  `## Follow-ups due (${fuDue.length})`, '', ...(fuDue.length ? fuDue.map((j) => `- ${j.company} — ${j.role} — due ${j.next_followup}`) : ['None.']), '',
];
mkdirSync(join(root, 'data/daily-reports'), { recursive: true });
const reportPath = join(root, 'data/daily-reports', `${today}.md`);
writeFileSync(reportPath, report.join('\n'));

// ---- hub page
const hubDir = join(root, 'output/hub');
mkdirSync(hubDir, { recursive: true });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (p, label) => (p ? `<a href="${esc(relative(hubDir, join(root, p)))}">${esc(label || p.split('/').pop())}</a>` : '');
const rows = all.map((j) => `<tr><td>${esc(j.first_seen)}</td><td>${esc(j.company)}</td><td><a href="${esc(j.url)}">${esc(j.role)}</a></td><td>${esc(j.location)}</td><td>${esc(j.rank)}</td><td>${esc(j.score)}</td><td>${esc(j.status)}</td><td>${link(j.report, 'report')}</td><td>${link(j.resume, 'resume')}</td><td>${link(j.cover, 'cover')}</td><td>${esc(j.contact)}</td><td>${esc(j.outreach)}</td><td>${esc(j.outreach_status)}</td><td>${esc(j.next_followup)}</td></tr>`).join('\n');
const reports = readdirSync(join(root, 'data/daily-reports')).filter((f) => f.endsWith('.md')).sort().reverse().slice(0, 14);
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job Search Hub</title>
<style>body{font:14px -apple-system,system-ui,sans-serif;margin:24px;color:#222;background:#fafafa}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #ddd;padding:6px;vertical-align:top;text-align:left}th{background:#f0f0f0;position:sticky;top:0}td:nth-child(12){max-width:260px}.ok{color:#127a3a}.bad{color:#b42318}</style></head><body>
<h1>Job Search Hub${candidate ? ` — ${esc(candidate)}` : ''}</h1><p>Updated ${esc(new Date().toLocaleString())}. Nothing on this page has been sent or submitted.</p>
<h2>Last run</h2><ul>${(run.stages || []).map((s) => `<li class="${/fail|auth/.test(s.status) ? 'bad' : 'ok'}"><b>${esc(s.name)}</b>: ${esc(s.status)} ${esc(s.detail || '')}</li>`).join('')}</ul>
<h2>Daily reports</h2><ul>${reports.map((f) => `<li>${link('data/daily-reports/' + f, f)}</li>`).join('')}</ul>
<h2>Jobs (${all.length})</h2><table><tr><th>First seen</th><th>Company</th><th>Role</th><th>Location</th><th>Rank</th><th>Score</th><th>Status</th><th>Report</th><th>Resume</th><th>Cover</th><th>Contact</th><th>Outreach draft</th><th>Outreach status</th><th>Follow-up</th></tr>
${rows}</table></body></html>`;
writeFileSync(join(hubDir, 'index.html'), html);
console.log(JSON.stringify({ jobs: all.length, new_today: newToday.length, evaluated: all.filter((j) => j.stage === 'evaluated').length, packs: packsToday.length, report: relative(root, reportPath), hub: 'output/hub/index.html' }));
