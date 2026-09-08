#!/usr/bin/env node
// situations-log.mjs — readable day-by-day digest of the situation tracker's history, for tuning
// the cool/close rule (DATA_STRATEGY.md / MAP_HOME_SITUATION_PLAN.md S2). Read-only.
//
//   node scripts/situations-log.mjs [--days 3] [--shadow]
//
// Reads situations/history/YYYY/MM/DD/HH/HHMM.json (or shadow/situations/history/… with --shadow)
// and prints, per day, the transitions each situation went through (open→raise→spread→cool→close).
// Via the AWS CLI (no SDK dependency — same creds/profile as scripts/errors.mjs).

import { execFileSync } from 'node:child_process';

const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const args = process.argv.slice(2);
const DAYS = Number((args[args.indexOf('--days') + 1]) || 3);
const SHADOW = args.includes('--shadow');
const PREFIX = SHADOW ? 'shadow/situations/history/' : 'situations/history/';

function aws(a) {
  return execFileSync('aws', [...a, '--region', REGION, '--output', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
function listKeys(prefix) {
  const out = JSON.parse(aws(['s3api', 'list-objects-v2', '--bucket', BUCKET, '--prefix', prefix, '--query', 'Contents[].Key']) || 'null');
  return (out || []).filter((k) => k.endsWith('.json'));
}
function getJson(key) {
  const tmp = `/tmp/.sitlog-${Math.random().toString(36).slice(2)}.json`;
  aws(['s3api', 'get-object', '--bucket', BUCKET, '--key', key, tmp]);
  const body = execFileSync('cat', [tmp], { encoding: 'utf8' });
  execFileSync('rm', ['-f', tmp]);
  return JSON.parse(body);
}

const cutoff = Date.now() - DAYS * 86400000;
const keys = listKeys(PREFIX).sort();
const prevState = new Map(); // id → "tier/state"
const byDay = new Map();

for (const key of keys) {
  const m = key.match(/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})(\d{2})\.json$/);
  if (!m) continue;
  const [, Y, Mo, D, H, Mi] = m;
  if (new Date(`${Y}-${Mo}-${D}T${H}:${Mi}:00Z`).getTime() < cutoff) continue;
  const day = `${Y}-${Mo}-${D}`;
  let snap; try { snap = getJson(key); } catch { continue; }
  const seen = new Set();
  for (const s of snap.situations || []) {
    seen.add(s.id);
    const cur = `${s.tier}/${s.state}`;
    if (prevState.get(s.id) !== cur) {
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push({ time: `${H}:${Mi}`, id: s.id, label: s.verb_label, from: prevState.get(s.id) || '—', to: cur, what: s.what_changed });
      prevState.set(s.id, cur);
    }
  }
  for (const id of [...prevState.keys()]) {
    if (!seen.has(id) && prevState.get(id) !== 'gone') {
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push({ time: `${H}:${Mi}`, id, label: id, from: prevState.get(id), to: 'gone' });
      prevState.set(id, 'gone');
    }
  }
}

console.log(`\nSituation transitions — last ${DAYS}d${SHADOW ? ' (SHADOW)' : ''} · ${keys.length} snapshots\n`);
if (!byDay.size) { console.log('  (no history snapshots in range)'); process.exit(0); }
let flaps = 0;
for (const day of [...byDay.keys()].sort()) {
  console.log(`── ${day} ──`);
  for (const e of byDay.get(day)) {
    if (/closed/.test(e.from) && /emerging|escalating/.test(e.to)) flaps++;
    console.log(`  ${e.time}  ${`${e.from} → ${e.to}`.padEnd(26)}  ${e.label}${e.what ? `  · ${e.what}` : ''}`);
  }
  console.log('');
}
console.log(`Tuning: ${flaps} re-open-after-close events` + (flaps ? ' → consider raising CLOSE_AFTER_COOL_CHECKS' : ' (cool/close rule looks stable)'));
