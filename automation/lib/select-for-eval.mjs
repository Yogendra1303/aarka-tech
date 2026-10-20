#!/usr/bin/env node
// Pick the best-ranked pending roles from data/pipeline.md and queue them in
// batch/batch-input.tsv for a full Career-ops evaluation.
// Zero tokens. Skips anything already queued, evaluated or in the tracker.
//
// Usage: node select-for-eval.mjs <career-ops dir> <max> <min-rank>
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';

const [root, maxArg = '3', minArg = '4.0'] = process.argv.slice(2);
if (!root) { console.error('usage: select-for-eval.mjs <dir> <max> <min-rank>'); process.exit(1); }
const max = Number(maxArg), minRank = Number(minArg);

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const pipeline = read(join(root, 'data/pipeline.md'));
const inputPath = join(root, 'batch/batch-input.tsv');
const input = read(inputPath);
const state = read(join(root, 'batch/batch-state.tsv'));
const tracker = read(join(root, 'data/applications.md'));

const norm = (u) => u.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
const seen = new Set();
for (const text of [input, state, tracker]) {
  for (const m of text.matchAll(/https?:\/\/[^\s|\t)\]]+/g)) seen.add(norm(m[0]));
}

// Location preference: Gurugram / Delhi NCR first, then UAE, then rest of India.
const locBonus = (loc) => {
  const l = loc.toLowerCase();
  if (/gurugram|gurgaon|delhi|ncr|noida/.test(l)) return 0.3;
  if (/dubai|sharjah|uae|united arab emirates|are\b|abu dhabi/.test(l)) return 0.2;
  return 0;
};

const rows = [];
let inPending = false;
for (const line of pipeline.split('\n')) {
  if (/^##\s/.test(line)) inPending = /pending|pendientes/i.test(line);
  if (!inPending || !line.startsWith('- [ ] ')) continue;
  const parts = line.slice(6).split(' | ');
  const url = parts[0].trim();
  const rankSeg = parts.find((p) => p.startsWith('rank:'));
  if (!rankSeg) continue;
  const rank = Number((rankSeg.match(/rank:\s*([0-9.]+)/) || [])[1]);
  if (!(rank >= minRank) || seen.has(norm(url))) continue;
  const company = (parts[1] || '').trim();
  const title = (parts[2] || '').trim();
  const location = (parts[3] || '').trim();
  rows.push({ url, company, title, location, rank, priority: rank + locBonus(location) });
}

rows.sort((a, b) => b.priority - a.priority);
const picked = rows.slice(0, max);

let nextId = 1;
for (const m of (input + '\n' + state).matchAll(/^(\d+)\t/gm)) nextId = Math.max(nextId, Number(m[1]) + 1);
if (!input.trim()) writeFileSync(inputPath, 'id\turl\tsource\tnotes\n');
for (const r of picked) {
  const notes = `${r.company} | ${r.title} | ${r.location} | rank ${r.rank}`.replace(/\t/g, ' ');
  appendFileSync(inputPath, `${nextId++}\t${r.url}\tauto-scan\t${notes}\n`);
}
console.log(JSON.stringify({ eligible: rows.length, picked }, null, 2));
