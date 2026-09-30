#!/usr/bin/env node
'use strict';

/**
 * predictions/settle-review.js — the operator's weekly confirm step (Batch 4 phase B).
 *
 * For every sampled question that is past its deadline and has no verdict yet, it shows the
 * question, deadline, named source, the agent's DRAFT (verdict + verbatim quote + URL) and asks you
 * to confirm or override. Your answer is written as an immutable `Q#<qid>/VERDICT` row.
 *
 * It reads ONLY the `Q#…` rows (SAMPLED + DRAFT#), which carry no probability, so it cannot show `p`.
 * Nothing is public until you confirm.
 *
 * Usage:
 *   node predictions/settle-review.js --list        # what is due / drafted, no prompts, no writes
 *   node predictions/settle-review.js               # interactive review
 *   node predictions/settle-review.js --dry-run     # interactive, prints what it would write
 *   node predictions/settle-review.js --today YYYY-MM-DD   # override "today" (testing)
 *
 * Keys: y accept the draft | n override (yes / no / void + reason) | o open the URL | s skip | q quit
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const TABLE = 'GlobalPerspectivePredictionLog';
const REGION = 'ap-northeast-1';
const VOID_REASONS = ['ambiguous_criterion', 'source_unavailable', 'event_moot', 'duplicate', 'criterion_met_at_issue'];
const GRACE_DAYS = 3;

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
function marshal(v) {
  if (v === null || v === undefined) return { NULL: true };
  if (typeof v === 'string') return { S: v };
  if (typeof v === 'number') return { N: String(v) };
  if (typeof v === 'boolean') return { BOOL: v };
  if (Array.isArray(v)) return { L: v.map(marshal) };
  if (typeof v === 'object') { const M = {}; for (const k of Object.keys(v)) M[k] = marshal(v[k]); return { M }; }
  return { S: String(v) };
}

const aws = (args) => execFileSync('aws', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });

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

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Due = sampled, deadline passed, no verdict. Sorted oldest deadline first. latestDraft = newest DRAFT row.
function dueForReview(groups, today) {
  return groups
    .filter((g) => g.sampled && g.verdicts.length === 0 && String(g.sampled.deadline).slice(0, 10) <= today)
    .map((g) => ({ ...g, latestDraft: g.drafts.slice().sort((a, b) => String(b.SK).localeCompare(String(a.SK)))[0] || null }))
    .sort((a, b) => String(a.sampled.deadline).localeCompare(String(b.sampled.deadline)));
}

function canConcludeNo(deadline, today) { return today >= addDays(String(deadline).slice(0, 10), GRACE_DAYS); }

function verdictRow(g, verdict, opts, now) {
  const row = {
    PK: `Q#${g.qid}`, SK: 'VERDICT', qid: g.qid, verdict, decidedAt: now, decidedBy: 'operator',
    draftRef: g.latestDraft ? g.latestDraft.SK : null,
    evidence: verdict === 'void' ? null : { url: opts.url || (g.latestDraft && g.latestDraft.url) || null, quote: opts.quote || (g.latestDraft && g.latestDraft.quote) || null },
  };
  if (verdict === 'void') row.voidReason = opts.voidReason;
  return row;
}

function putOnce(row) {
  const tmp = path.join(os.tmpdir(), `verdict-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(marshal(row).M), { mode: 0o600 });
  try {
    aws(['dynamodb', 'put-item', '--table-name', TABLE, '--region', REGION, '--item', `file://${tmp}`,
      '--condition-expression', 'attribute_not_exists(PK) AND attribute_not_exists(SK)']);
    return true;
  } catch (e) {
    if (/ConditionalCheckFailed/.test(String(e.stderr || e.message))) return false;
    throw e;
  } finally { fs.unlinkSync(tmp); }
}

function show(g, i, n) {
  const s = g.sampled;
  const d = g.latestDraft;
  console.log(`\n[${i}/${n}] ${s.storyTitle || ''}`);
  console.log(`  QUESTION : ${s.question}`);
  console.log(`  DEADLINE : ${s.deadline}    SOURCE: ${s.resolutionSource || '(none named)'}`);
  if (!d) console.log('  DRAFT    : (no agent draft yet)');
  else {
    console.log(`  DRAFT    : ${String(d.verdict).toUpperCase()}${d.voidReason ? ` (${d.voidReason})` : ''}${d.note ? `  [${d.note}]` : ''}`);
    if (d.quote) console.log(`  QUOTE    : "${d.quote}"`);
    if (d.url) console.log(`  URL      : ${d.url}`);
    if (d.why) console.log(`  WHY      : ${d.why}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n, def) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
  const today = flag('--today', new Date().toISOString().slice(0, 10));
  const LIST = args.includes('--list');
  const DRY = args.includes('--dry-run');

  const due = dueForReview(group(scanQuestionRows()), today);
  console.log(`Due for review (deadline passed, no verdict): ${due.length}   (drafted: ${due.filter((g) => g.latestDraft).length})`);
  if (LIST) {
    for (const g of due) console.log(`  ${g.sampled.deadline}  ${(g.latestDraft ? g.latestDraft.verdict : 'no draft').padEnd(12)} ${String(g.sampled.question).slice(0, 90)}`);
    return;
  }
  if (!due.length) { console.log('Nothing to confirm.'); return; }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  let done = 0;
  let voids = 0;
  const started = Date.now();
  for (let i = 0; i < due.length; i++) {
    const g = due[i];
    show(g, i + 1, due.length);
    for (;;) {
      const a = (await ask('  [y] accept  [n] override  [o] open URL  [s] skip  [q] quit > ')).trim().toLowerCase();
      if (a === 'q') { i = due.length; break; }
      if (a === 's') break;
      if (a === 'o') { if (g.latestDraft && g.latestDraft.url) { try { execFileSync('open', [g.latestDraft.url]); } catch { console.log('  (could not open)'); } } else console.log('  (no URL)'); continue; }
      let verdict = null; let opts = {};
      if (a === 'y') {
        const d = g.latestDraft;
        if (!d || !['yes', 'no', 'void'].includes(d.verdict)) { console.log('  The draft is not a verdict (yes / no / void). Use [n] to decide.'); continue; }
        if (d.verdict === 'no' && !canConcludeNo(g.sampled.deadline, today)) { console.log('  NO is not allowed before deadline + 3 days. Skip it.'); continue; }
        verdict = d.verdict; opts = { voidReason: d.voidReason };
      } else if (a === 'n') {
        const v = (await ask('  decide [yes / no / void] > ')).trim().toLowerCase();
        if (!['yes', 'no', 'void'].includes(v)) { console.log('  not a verdict'); continue; }
        if (v === 'no' && !canConcludeNo(g.sampled.deadline, today)) { console.log('  NO is not allowed before deadline + 3 days.'); continue; }
        verdict = v;
        if (v === 'void') {
          const r = (await ask(`  reason [${VOID_REASONS.join(' / ')}] > `)).trim();
          if (!VOID_REASONS.includes(r)) { console.log('  not a valid reason'); continue; }
          opts = { voidReason: r };
        } else if (v === 'yes') {
          const url = (await ask('  evidence URL > ')).trim();
          const quote = (await ask('  evidence quote > ')).trim();
          if (!/^https?:\/\//.test(url) || !quote) { console.log('  a YES needs an http(s) URL and a quote'); continue; }
          opts = { url, quote };
        }
      } else { continue; }
      const row = verdictRow(g, verdict, opts, new Date().toISOString());
      if (DRY) console.log(`  (dry-run) would write ${row.PK} ${row.SK} = ${verdict}`);
      else if (putOnce(row)) console.log(`  written: ${verdict}`);
      else console.log('  a verdict already exists for this question; nothing written');
      done++; if (verdict === 'void') voids++;
      break;
    }
  }
  rl.close();
  const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
  console.log(`\nConfirmed ${done} (void ${voids}) in about ${minutes} min${DRY ? ' [dry-run: nothing written]' : ''}.`);
  if (!DRY && done > 0) {
    const now = new Date().toISOString();
    const week = (() => { const t = new Date(`${today}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); const y0 = Date.UTC(t.getUTCFullYear(), 0, 1); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0')}`; })();
    putOnce({ PK: `SETTLE#${week}`, SK: `REVIEW#${now}`, at: now, confirmed: done, voided: voids, minutes });
  }
}

module.exports = { group, dueForReview, canConcludeNo, verdictRow, VOID_REASONS };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
