#!/usr/bin/env node
// Release-blocking output check. For every Career-ops report and application
// pack, confirm that each PDF it claims actually exists and is a readable PDF.
// A false "✅" claim is corrected in the report header and the tracker row.
// Usage: node verify-outputs.mjs <career-ops dir> [--fix] [--json]
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(process.argv[2] || '.');
const FIX = process.argv.includes('--fix');
const today = new Date().toISOString().slice(0, 10);

export function pdfCheck(path) {
  if (!path || !existsSync(path)) return { ok: false, why: 'missing' };
  const size = statSync(path).size;
  if (size < 5000) return { ok: false, why: `too small (${size} bytes)` };
  const buf = readFileSync(path);
  if (buf.subarray(0, 5).toString() !== '%PDF-') return { ok: false, why: 'not a PDF' };
  if (!buf.subarray(-1024).toString('latin1').includes('%%EOF')) return { ok: false, why: 'truncated PDF' };
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
  if (pages < 1) return { ok: false, why: 'no pages' };
  return { ok: true, pages, size };
}

const results = [];
const reportsDir = join(root, 'reports');
for (const f of (existsSync(reportsDir) ? readdirSync(reportsDir) : []).filter((x) => /^\d+-.*\.md$/.test(x))) {
  const p = join(reportsDir, f);
  const text = readFileSync(p, 'utf8');
  const m = text.match(/^\*\*PDF:\*\*\s*(.+)$/m);
  if (!m) { results.push({ report: f, claim: 'none', ok: true }); continue; }
  const claim = m[1].trim();
  const claimed = claim.match(/✅\s*(\S+\.pdf)/);
  if (!claimed) { results.push({ report: f, claim: 'no PDF claimed', ok: true }); continue; }
  const chk = pdfCheck(join(root, claimed[1]));
  results.push({ report: f, pdf: claimed[1], ...chk });
  if (!chk.ok && FIX) {
    writeFileSync(p, text.replace(m[0], `**PDF:** ❌ not generated (claimed ${claimed[1]} was ${chk.why}; corrected by verifier ${today})`));
    const tp = join(root, 'data/applications.md');
    const num = String(Number(f.split('-')[0]));
    const lines = readFileSync(tp, 'utf8').split('\n').map((l) => {
      const c = l.split('|');
      if (c.length > 9 && c[1].trim() === num && c[7].includes('✅')) { c[7] = ' ❌ '; return c.join('|'); }
      return l;
    });
    writeFileSync(tp, lines.join('\n'));
  }
}

const packsDir = join(root, 'output/packs');
for (const d of existsSync(packsDir) ? readdirSync(packsDir) : []) {
  const pj = join(packsDir, d, 'pack.json');
  if (!existsSync(pj)) { results.push({ pack: d, ok: false, why: 'pack.json missing' }); continue; }
  let pack; try { pack = JSON.parse(readFileSync(pj, 'utf8')); } catch { results.push({ pack: d, ok: false, why: 'pack.json unreadable' }); continue; }
  for (const key of ['cv_pdf', 'cover_pdf']) {
    if (!pack[key]) { results.push({ pack: d, file: key, ok: true, note: 'not produced' }); continue; }
    results.push({ pack: d, file: pack[key], ...pdfCheck(join(root, pack[key])) });
  }
}

const bad = results.filter((r) => !r.ok);
if (process.argv.includes('--json')) console.log(JSON.stringify({ checked: results.length, failures: bad }, null, 2));
else {
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.report || r.pack}  ${r.pdf || r.file || r.claim || ''}  ${r.ok ? (r.pages ? r.pages + ' pages' : r.note || '') : r.why}`);
  console.log(`${results.length} checked, ${bad.length} failed${FIX && bad.length ? ' (false claims corrected)' : ''}`);
}
process.exit(bad.length ? 1 : 0);
