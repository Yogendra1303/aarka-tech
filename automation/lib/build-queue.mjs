#!/usr/bin/env node
// Writes data/hub/ai-queue.json: what the AI stage would process next.
// Zero tokens. Usage: node build-queue.mjs <career-ops dir> <min-rank> <min-score>
import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { read, trackerRows, reportUrl, packInfo, packDirName } from './tracker-lib.mjs';

const root = resolve(process.argv[2] || '.');
const minRank = Number(process.argv[3] || 4), minScore = Number(process.argv[4] || 4);
const norm = (u) => String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

const evaluated = new Set();
const tracker = trackerRows(root);
for (const r of tracker) if (r.report) evaluated.add(norm(reportUrl(root, r.report)));
for (const m of read(join(root, 'batch/batch-input.tsv')).matchAll(/https?:\/\/\S+/g)) evaluated.add(norm(m[0]));

const needRank = [], needEval = [];
let sec = '';
for (const line of read(join(root, 'data/pipeline.md')).split('\n')) {
  if (/^##\s/.test(line)) sec = line;
  if (!/pending|pendientes/i.test(sec) || !line.startsWith('- [ ] ')) continue;
  const parts = line.slice(6).split(' | ');
  const url = parts[0].trim();
  const rankSeg = parts.find((p) => p.startsWith('rank:'));
  const item = { url, company: parts[1], role: parts[2], location: parts[3] };
  if (!rankSeg) needRank.push(item);
  else {
    const rank = Number((rankSeg.match(/rank:\s*([0-9.]+)/) || [])[1]);
    if (rank >= minRank && !evaluated.has(norm(url))) needEval.push({ ...item, rank });
  }
}
needEval.sort((a, b) => b.rank - a.rank);
const needPack = tracker
  .filter((r) => r.score >= minScore && !/discard|reject|applied|interview|offer|closed/i.test(r.status) && !packInfo(root, r).pack)
  .map((r) => ({ num: r.num, company: r.company, role: r.role, score: r.score, pack_dir: join('output/packs', packDirName(r)) }));

const queue = { built: new Date().toISOString(), need_rank: needRank, need_eval: needEval, need_pack: needPack };
mkdirSync(join(root, 'data/hub'), { recursive: true });
writeFileSync(join(root, 'data/hub/ai-queue.json'), JSON.stringify(queue, null, 2));
console.log(`rank ${needRank.length}, evaluate ${needEval.length}, pack ${needPack.length}`);
