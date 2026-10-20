#!/usr/bin/env node
// Print (one JSON per line) the evaluated roles that qualify for an
// application pack and do not have one yet. Zero tokens.
// Usage: node select-for-pack.mjs <career-ops dir> <max> <min-score>
import { join } from 'path';
import { existsSync } from 'fs';
import { trackerRows, reportUrl, packInfo, packDirName } from './tracker-lib.mjs';

const [root, maxArg = '2', minArg = '4.0'] = process.argv.slice(2);
const max = Number(maxArg), min = Number(minArg);
const skip = /discard|rejected|skip|applied|interview|offer|closed/i;

const picks = trackerRows(root)
  .filter((r) => r.score !== null && r.score >= min && !skip.test(r.status))
  .filter((r) => r.report && existsSync(join(root, r.report)))
  .filter((r) => !packInfo(root, r).pack) // no finished pack yet
  .sort((a, b) => b.score - a.score)
  .slice(0, max);

for (const r of picks) {
  console.log(JSON.stringify({
    num: r.num, company: r.company, role: r.role, score: r.score,
    report: r.report, url: reportUrl(root, r.report),
    pack_dir: join('output/packs', packDirName(r)),
  }));
}
