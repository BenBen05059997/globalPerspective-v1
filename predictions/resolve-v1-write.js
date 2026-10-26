#!/usr/bin/env node
'use strict';

/**
 * predictions/resolve-v1-write.js — Phase 2 write-back for prediction methodology v1.
 *
 * Takes a verdicts file produced by the agent verification pass and writes each `finalVerdict` back to
 * GlobalPerspectivePredictionLog with `confirmedBy: 'agent-verified'` + the agent's
 * evidence. DRY-RUN by default — prints what would change; pass --commit to write.
 *
 * Safeguards:
 *  - v1-only: refuses to touch a record without `methodologyVersion` (never the legacy backlog).
 *  - idempotent: skips a trigger that already has a `finalVerdict` unless --force.
 *  - `unclear` is allowed (Brier-excluded) and is the safe verdict under doubt.
 *  - a snapshot flips to status `resolved` only once EVERY dated trigger has a finalVerdict.
 *
 * Verdicts file: JSON array of
 *   { pk, sk, triggerId, verdict: "fired"|"not_fired"|"unclear",
 *     confidence?, evidence?: [{url,title,note}], note? }
 *
 * Usage:
 *   node predictions/resolve-v1-write.js verdicts.json           # dry-run (default)
 *   node predictions/resolve-v1-write.js verdicts.json --commit   # actually write
 *   node predictions/resolve-v1-write.js verdicts.json --commit --force  # overwrite existing verdicts
 */

const { execSync } = require('child_process');
const fs = require('fs');

const TABLE = 'GlobalPerspectivePredictionLog';
const REGION = 'ap-northeast-1';
const VALID = new Set(['fired', 'not_fired', 'unclear']);

const args = process.argv.slice(2);
const FILE = args.find(a => !a.startsWith('--'));
const COMMIT = args.includes('--commit');
const FORCE = args.includes('--force');

if (!FILE) { console.error('usage: resolve-v1-write.js verdicts.json [--commit] [--force]'); process.exit(1); }

function aws(a) { return execSync(`aws ${a}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }

function unmarshal(av) {
  if (av == null) return null;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('L' in av) return av.L.map(unmarshal);
  if ('M' in av) { const o = {}; for (const key of Object.keys(av.M)) o[key] = unmarshal(av.M[key]); return o; }
  return av;
}
function marshal(v) {
  if (v === null || v === undefined) return { NULL: true };
  if (typeof v === 'string') return { S: v };
  if (typeof v === 'number') return { N: String(v) };
  if (typeof v === 'boolean') return { BOOL: v };
  if (Array.isArray(v)) return { L: v.map(marshal) };
  if (typeof v === 'object') { const M = {}; for (const key of Object.keys(v)) M[key] = marshal(v[key]); return { M }; }
  return { S: String(v) };
}

function getItem(pk, sk) {
  const key = JSON.stringify({ PK: { S: pk }, SK: { S: sk } });
  const tmp = require('os').tmpdir() + `/predkey-${process.pid}.json`;
  fs.writeFileSync(tmp, key);
  const out = aws(`dynamodb get-item --table-name ${TABLE} --region ${REGION} --key file://${tmp} --output json`);
  fs.unlinkSync(tmp);
  const p = JSON.parse(out || '{}');
  return p.Item ? unmarshal({ M: p.Item }) : null;
}
function putItem(item, n) {
  const tmp = require('os').tmpdir() + `/predput-${process.pid}-${n}.json`;
  fs.writeFileSync(tmp, JSON.stringify(marshal(item).M));
  aws(`dynamodb put-item --table-name ${TABLE} --region ${REGION} --item file://${tmp}`);
  fs.unlinkSync(tmp);
}

function allDatedResolved(item) {
  const dated = (item.scenarios || []).flatMap(s => (s.triggers || []).filter(t => t.deadline));
  return dated.length > 0 && dated.every(t => t.finalVerdict);
}

function main() {
  const verdicts = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(verdicts)) { console.error('verdicts file must be a JSON array'); process.exit(1); }

  // Group by snapshot so each record is read + written once. Key on a JSON [pk,sk] pair —
  // the PK contains spaces ("PRED#Brutal heat wave..."), so a delimiter-split would shatter it.
  const bySnap = new Map();
  for (const v of verdicts) {
    if (!VALID.has(v.verdict)) { console.error(`bad verdict "${v.verdict}" for ${v.pk}/${v.triggerId}`); process.exit(1); }
    const k = JSON.stringify([v.pk, v.sk]);
    if (!bySnap.has(k)) bySnap.set(k, []);
    bySnap.get(k).push(v);
  }

  let applied = 0, skipped = 0, resolvedSnaps = 0, missing = 0, snapN = 0;
  const now = new Date().toISOString();

  for (const [k, vs] of bySnap) {
    const [pk, sk] = JSON.parse(k);
    const item = getItem(pk, sk);
    if (!item) { console.log(`MISSING  ${pk} / ${sk} — snapshot not found`); missing++; continue; }
    if (item.methodologyVersion == null) { console.log(`REFUSE   ${pk} / ${sk} — legacy record (no methodologyVersion), never scored`); skipped += vs.length; continue; }

    let changed = false;
    for (const v of vs) {
      let trg = null;
      for (const s of item.scenarios || []) for (const t of s.triggers || []) if (t.id === v.triggerId) trg = t;
      if (!trg) { console.log(`  no trigger ${v.triggerId} in ${pk}/${sk}`); missing++; continue; }
      if (trg.finalVerdict && !FORCE) { console.log(`  skip ${v.triggerId} — already ${trg.finalVerdict}`); skipped++; continue; }
      console.log(`  ${trg.finalVerdict ? 'OVERWRITE' : 'set'} ${v.triggerId} -> ${v.verdict}  "${String(trg.text).slice(0, 60)}"`);
      trg.finalVerdict = v.verdict;
      trg.confirmedAt = now;
      trg.confirmedBy = 'agent-verified';
      trg.needsConfirm = false;
      trg.agentVerdict = { verdict: v.verdict, confidence: v.confidence ?? null, evidence: v.evidence || [], note: v.note || null, at: now };
      applied++; changed = true;
    }
    if (changed && allDatedResolved(item)) { item.status = 'resolved'; resolvedSnaps++; console.log(`  -> ${pk}/${sk} fully resolved`); }
    if (changed && COMMIT) putItem(item, snapN++);
  }

  console.log(`\n${COMMIT ? 'WROTE' : 'DRY-RUN (no writes; pass --commit)'} — applied ${applied}, skipped ${skipped}, snapshots resolved ${resolvedSnaps}${missing ? `, missing ${missing}` : ''}.`);
}

main();
