#!/usr/bin/env node
'use strict';

/**
 * predictions/review.js — human confirmation queue for prediction triggers.
 *
 * Phase 2 of the prediction-calibration pipeline (hybrid resolution):
 * newsPredictionResolver proposes fired/not_fired/unclear verdicts for triggers
 * that have come due; this script lets the operator confirm or override each
 * proposal. The confirmed `finalVerdict` is what the track-record scoring reads.
 *
 * Reads/writes the GlobalPerspectivePredictionLog table via the AWS CLI
 * (assumes CLI is configured — no public auth surface, no npm deps).
 *
 * Usage:
 *   node predictions/review.js              # interactive: walk pending proposals
 *   node predictions/review.js --list       # just list what's awaiting confirmation
 *   node predictions/review.js --accept-all  # accept every proposal as-is (use with care)
 */

const { execSync } = require('child_process');
const readline = require('readline');

const TABLE = 'GlobalPerspectivePredictionLog';
const REGION = 'ap-northeast-1';

const FLAGS = process.argv.slice(2);
const LIST_ONLY = FLAGS.includes('--list');
const ACCEPT_ALL = FLAGS.includes('--accept-all');

function aws(args) {
  return execSync(`aws ${args}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// Scan all open snapshots (full deserialized JSON).
function scanOpen() {
  const items = [];
  let startKey = '';
  for (;;) {
    const skArg = startKey ? `--starting-token '${startKey}'` : '';
    const out = aws(
      `dynamodb scan --table-name ${TABLE} --region ${REGION} ` +
      `--filter-expression "#s = :open" ` +
      `--expression-attribute-names '{"#s":"status"}' ` +
      `--expression-attribute-values '{":open":{"S":"open"}}' ` +
      `--output json ${skArg}`,
    );
    const page = JSON.parse(out);
    items.push(...(page.Items || []).map(it => unmarshal({ M: it })));
    if (!page.NextToken) break;
    startKey = page.NextToken;
  }
  return items;
}

// Minimal DynamoDB unmarshal (S/N/BOOL/NULL/L/M).
function unmarshal(av) {
  if (av == null) return null;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('L' in av) return av.L.map(unmarshal);
  if ('M' in av) {
    const o = {};
    for (const k of Object.keys(av.M)) o[k] = unmarshal(av.M[k]);
    return o;
  }
  return av;
}

function pendingProposals(item) {
  const out = [];
  for (const s of item.scenarios || []) {
    for (const t of s.triggers || []) {
      if (t.proposal && !t.finalVerdict) out.push({ scenario: s, trigger: t });
    }
  }
  return out;
}

function putItem(item) {
  const tmp = require('os').tmpdir() + `/pred-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  require('fs').writeFileSync(tmp, JSON.stringify(marshal(item).M));
  aws(`dynamodb put-item --table-name ${TABLE} --region ${REGION} --item file://${tmp}`);
  require('fs').unlinkSync(tmp);
}

function marshal(v) {
  if (v === null || v === undefined) return { NULL: true };
  if (typeof v === 'string') return { S: v };
  if (typeof v === 'number') return { N: String(v) };
  if (typeof v === 'boolean') return { BOOL: v };
  if (Array.isArray(v)) return { L: v.map(marshal) };
  if (typeof v === 'object') {
    const M = {};
    for (const k of Object.keys(v)) M[k] = marshal(v[k]);
    return { M };
  }
  return { S: String(v) };
}

function finalize(item) {
  // Mark snapshot resolved once every dated trigger has a finalVerdict.
  const dated = (item.scenarios || []).flatMap(s => (s.triggers || []).filter(t => t.deadline));
  if (dated.length && dated.every(t => t.finalVerdict)) item.status = 'resolved';
}

function applyVerdict(trigger, verdict) {
  trigger.finalVerdict = verdict;
  trigger.confirmedAt = new Date().toISOString();
  trigger.confirmedBy = 'human';
  trigger.needsConfirm = false;
}

function fmt(item, p) {
  const pr = p.trigger.proposal;
  const conf = pr.confidence != null ? `${Math.round(pr.confidence * 100)}%` : 'n/a';
  return [
    `\nStory:    ${item.title}`,
    `Scenario: ${p.scenario.label} (p=${p.scenario.probability})`,
    `Trigger:  ${p.trigger.text}`,
    `Due:      ${p.trigger.deadline}`,
    `Proposed: ${pr.verdict.toUpperCase()} (confidence ${conf})`,
    `Why:      ${pr.reasoning || ''}`,
    `Citation: ${pr.citation || ''}`,
    `Sources:  ${(pr.sources || []).map(s => s.source).join(', ') || '(none)'}`,
  ].join('\n');
}

async function main() {
  const open = scanOpen();
  const queue = [];
  for (const item of open) for (const p of pendingProposals(item)) queue.push({ item, ...p });

  if (!queue.length) {
    console.log('Nothing awaiting confirmation. ✓');
    return;
  }
  console.log(`${queue.length} trigger proposal(s) awaiting confirmation.`);

  if (LIST_ONLY) {
    for (const q of queue) console.log(fmt(q.item, q));
    return;
  }

  if (ACCEPT_ALL) {
    const dirty = new Set();
    for (const q of queue) { applyVerdict(q.trigger, q.trigger.proposal.verdict); dirty.add(q.item); }
    for (const item of dirty) { finalize(item); putItem(item); }
    console.log(`Accepted ${queue.length} proposals as-is across ${dirty.size} snapshot(s).`);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(res => rl.question(q, res));
  const dirty = new Set();

  for (const q of queue) {
    console.log(fmt(q.item, q));
    const ans = (await ask('\n[Enter]=accept  f=fired  n=not_fired  u=unclear  s=skip  q=quit > ')).trim().toLowerCase();
    if (ans === 'q') break;
    if (ans === 's') continue;
    let verdict;
    if (ans === '' ) verdict = q.trigger.proposal.verdict;
    else if (ans === 'f') verdict = 'fired';
    else if (ans === 'n') verdict = 'not_fired';
    else if (ans === 'u') verdict = 'unclear';
    else { console.log('  (unrecognized — skipped)'); continue; }
    applyVerdict(q.trigger, verdict);
    dirty.add(q.item);
    console.log(`  → recorded ${verdict}`);
  }
  rl.close();

  for (const item of dirty) { finalize(item); putItem(item); }
  console.log(`\nSaved ${dirty.size} snapshot(s).`);
}

main().catch(err => { console.error(err); process.exit(1); });
