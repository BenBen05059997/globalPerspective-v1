#!/usr/bin/env node
'use strict';

/**
 * predictions/settle-correct.js — the operator's dispute path (decision 0034).
 *
 * Verdicts are written by the newsPredictionResolver Lambda itself; nothing waits for a human. A wrong
 * verdict is a bug in the algorithm: correct it here (with a reason), then fix the algorithm.
 *
 * Usage:
 *   node predictions/settle-correct.js --list [--today YYYY-MM-DD]      # read-only: due / drafted / settled this week
 *   node predictions/settle-correct.js --correct <qid> <yes|no|void> "<reason>" [--url <u> --quote "<q>"]
 *
 * --correct invokes the Lambda action {action:'correct'}, which appends the next Q#<qid>/VERDICT#<n>
 * (confirmedBy 'operator'); the public board reads the highest n. --list reads only Q# rows (no probability).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TABLE = 'GlobalPerspectivePredictionLog';
const REGION = 'ap-northeast-1';
const FUNCTION = 'newsPredictionResolver';

function unmarshal(av) {
  if (av == null) return null;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('L' in av) return av.L.map(unmarshal);
  if ('M' in av) { const o = {}; for (const k of Object.keys(av.M)) o[k] = unmarshal(av.M[k]); return o; }
  return av;
}

const aws = (args) => execFileSync('aws', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
const day = (s) => String(s || '').slice(0, 10);

// Q# rows only: SAMPLED, DRAFT#…, VERDICT…
function scanQuestionRows() {
  const items = [];
  let token = null;
  for (;;) {
    const args = ['dynamodb', 'scan', '--table-name', TABLE, '--region', REGION,
      '--filter-expression', 'begins_with(PK, :p)', '--expression-attribute-values', '{":p":{"S":"Q#"}}', '--output', 'json'];
    if (token) args.push('--starting-token', token);
    const page = JSON.parse(aws(args));
    items.push(...(page.Items || []).map((it) => unmarshal({ M: it })));
    if (!page.NextToken) break;
    token = page.NextToken;
  }
  return items;
}

function group(rows) {
  const by = new Map();
  for (const r of rows) {
    const qid = String(r.PK).slice(2);
    const g = by.get(qid) || { qid, sampled: null, drafts: [], verdicts: [] };
    if (r.SK === 'SAMPLED') g.sampled = r;
    else if (String(r.SK).startsWith('DRAFT#')) g.drafts.push(r);
    else if (String(r.SK).startsWith('VERDICT')) g.verdicts.push(r);
    by.set(qid, g);
  }
  return [...by.values()];
}

// The newest verdict row (a correction wins over the original; the board uses the same rule).
const latestVerdict = (g) => g.verdicts.slice().sort((a, b) => String(a.SK).localeCompare(String(b.SK), 'en', { numeric: true })).pop() || null;

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// due = sampled, deadline passed, no verdict (drafted or not); settled = latest verdict decided in the last 7 days.
function listing(groups, today) {
  const weekAgo = addDays(today, -7);
  const sampled = groups.filter((g) => g.sampled);
  const byDeadline = (a, b) => String(a.sampled.deadline).localeCompare(String(b.sampled.deadline));
  const due = sampled.filter((g) => !g.verdicts.length && day(g.sampled.deadline) <= today).sort(byDeadline);
  const settled = sampled.map((g) => ({ g, v: latestVerdict(g) })).filter((x) => x.v && day(x.v.decidedAt) >= weekAgo);
  return { due, settled };
}

function printListing({ due, settled }) {
  console.log(`Due (deadline passed, no verdict): ${due.length}   drafted: ${due.filter((g) => g.drafts.length).length}`);
  for (const g of due) {
    const last = g.drafts.slice().sort((a, b) => String(a.SK).localeCompare(String(b.SK))).pop();
    console.log(`  ${g.qid}  ${day(g.sampled.deadline)}  ${(last ? last.verdict : 'no draft').padEnd(12)} ${String(g.sampled.question).slice(0, 80)}`);
  }
  console.log(`Settled in the last 7 days: ${settled.length}`);
  for (const { g, v } of settled) {
    console.log(`  ${g.qid}  ${String(v.verdict).padEnd(4)} ${v.SK.padEnd(10)} by ${v.confirmedBy || v.decidedBy || '?'}  ${String(g.sampled.question).slice(0, 70)}${v.reason ? `  [${v.reason}]` : ''}`);
  }
}

// Same invoke pattern as the other operator scripts: payload via a temp file, response read back.
function invoke(payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settle-correct-'));
  const inFile = path.join(dir, 'in.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(inFile, JSON.stringify(payload), { mode: 0o600 });
  try {
    aws(['lambda', 'invoke', '--function-name', FUNCTION, '--region', REGION, '--cli-binary-format', 'raw-in-base64-out',
      '--payload', `fileb://${inFile}`, outFile]);
    return JSON.parse(fs.readFileSync(outFile, 'utf8'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function correctionPayload(args) {
  const i = args.indexOf('--correct');
  const [qid, verdict, reason] = args.slice(i + 1);
  const flag = (n) => { const k = args.indexOf(n); return k >= 0 ? args[k + 1] : undefined; };
  if (!qid || !['yes', 'no', 'void'].includes(verdict) || !reason || reason.startsWith('--')) {
    throw new Error('usage: --correct <qid> <yes|no|void> "<reason>" [--url <u> --quote "<q>"]');
  }
  const url = flag('--url');
  const quote = flag('--quote');
  return { action: 'correct', qid, verdict, reason, ...(url || quote ? { evidence: { url, quote } } : {}) };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    const k = args.indexOf('--today');
    printListing(listing(group(scanQuestionRows()), k >= 0 ? args[k + 1] : new Date().toISOString().slice(0, 10)));
  } else if (args.includes('--correct')) {
    const res = invoke(correctionPayload(args));
    if (res.corrected) console.log(`written: ${res.corrected.sk} = ${res.corrected.verdict} (${res.corrected.qid})`);
    else { console.error(`not written: ${(res.errors || [res.errorMessage || 'unknown']).join('; ')}`); process.exit(1); }
  } else {
    console.log('usage: settle-correct.js --list | --correct <qid> <yes|no|void> "<reason>" [--url <u> --quote "<q>"]');
    process.exit(2);
  }
}

module.exports = { group, listing, latestVerdict, correctionPayload };
if (require.main === module) { try { main(); } catch (e) { console.error(e.message); process.exit(1); } }
