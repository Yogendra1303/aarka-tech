// Shared helpers: read the Career-ops tracker, packs and outreach queue.
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

export const slug = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

// Rows of data/applications.md as objects.
export function trackerRows(root) {
  const rows = [];
  for (const line of read(join(root, 'data/applications.md')).split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    const [num, date, company, role, score, status, pdf, report, notes] = c;
    const reportPath = ((report || '').match(/\(([^)]+)\)/) || [])[1] || '';
    rows.push({
      num: Number(num), date, company, role,
      score: Number(((score || '').match(/[0-9.]+/) || [])[0]) || null,
      status, pdf, notes: notes || '',
      report: reportPath.replace(/^\.\.\//, ''),
    });
  }
  return rows;
}

// Job URL recorded in a report header.
export function reportUrl(root, report) {
  const m = read(join(root, report)).match(/^\*\*URL:\*\*\s*(\S+)/m);
  return m ? m[1] : '';
}

export const packDirName = (r) => `${String(r.num).padStart(3, '0')}-${slug(r.company)}-${slug(r.role)}`;

export function packInfo(root, r) {
  const dir = join('output/packs', packDirName(r));
  const json = read(join(root, dir, 'pack.json'));
  let pack = null;
  try { pack = json ? JSON.parse(json) : null; } catch { pack = { problems: ['pack.json unreadable'] }; }
  return { dir, pack, exists: existsSync(join(root, dir)) };
}

export function outreachRows(root) {
  const out = [];
  for (const line of read(join(root, 'data/outreach-queue.tsv')).split('\n')) {
    if (!line.trim() || line.startsWith('date\t') || line.startsWith('#')) continue;
    const [date, job_url, company, role, contact_name, contact_title, public_source, channel, message_draft, status] = line.split('\t');
    out.push({ date, job_url, company, role, contact_name, contact_title, public_source, channel, message_draft, status });
  }
  return out;
}

export function listDir(p) {
  try { return readdirSync(p); } catch { return []; }
}
