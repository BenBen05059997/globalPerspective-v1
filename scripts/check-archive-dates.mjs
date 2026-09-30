#!/usr/bin/env node
/**
 * Read-only audit of the daily archive (Batch 3 / phase A).
 * For every archive#YYYY-MM-DD row in NewsCache checks that each entry's `archivedAt` date equals
 * the row's date (a mis-dated stored row would show up here), and counts topicIds that reappear on
 * a later day (legit re-observations, the id is a stable title hash). Also shows the age of the two
 * "day 0" sources readers use (today-archive, latest). Uses the AWS CLI; never writes.
 *
 * Usage: node scripts/check-archive-dates.mjs [--from 2026-07-01] [--to YYYY-MM-DD]
 */
import { execFileSync } from 'node:child_process';

const REGION = 'ap-northeast-1';
const TABLE = process.env.TOPICS_DDB_TABLE || 'NewsCache';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const from = arg('--from', new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10));
const to = arg('--to', new Date().toISOString().slice(0, 10));

const un = (v) => {
  const k = Object.keys(v)[0]; const x = v[k];
  if (k === 'M') return Object.fromEntries(Object.entries(x).map(([a, b]) => [a, un(b)]));
  if (k === 'L') return x.map(un);
  if (k === 'N') return Number(x);
  if (k === 'NULL') return null;
  return x;
};
function getItem(id) {
  try {
    const out = execFileSync('aws', ['dynamodb', 'get-item', '--region', REGION, '--table-name', TABLE,
      '--key', JSON.stringify({ id: { S: id } }), '--output', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.trim() ? un({ M: JSON.parse(out).Item || {} }) : null;
  } catch { return null; }
}

let rows = 0, entries = 0, misdated = 0, repeats = 0; const firstSeen = new Map(); const missing = [];
for (let d = Date.parse(from); d <= Date.parse(to); d += 864e5) {
  const day = new Date(d).toISOString().slice(0, 10);
  const it = getItem(`archive#${day}`);
  if (!it || !Array.isArray(it.entries)) { missing.push(day); continue; }
  rows++;
  for (const e of it.entries) {
    entries++;
    if (String(e.archivedAt || '').slice(0, 10) !== day) { misdated++; console.log(`MISDATED ${day} ${e.topicId} archivedAt=${e.archivedAt}`); }
    if (firstSeen.has(e.topicId) && firstSeen.get(e.topicId) !== day) repeats++; else firstSeen.set(e.topicId, day);
  }
}
console.log(`archive rows ${rows}, entries ${entries}, MIS-DATED ${misdated}, cross-day topicId repeats ${repeats}`);
console.log(`days without a row: ${missing.length} (${missing.slice(0, 40).join(', ')}${missing.length > 40 ? ', …' : ''})`);
for (const id of ['today-archive', 'latest']) {
  const it = getItem(id);
  const at = it && (it.updatedAt || it.activatedAt);
  console.log(`${id}: updatedAt ${at || 'n/a'} (${at ? ((Date.now() - Date.parse(at)) / 36e5).toFixed(1) + ' h old' : ''})`);
}
process.exit(misdated ? 1 : 0);
