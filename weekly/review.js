#!/usr/bin/env node
'use strict';

/**
 * weekly/review.js — one-click human approval for the Weekly Intelligence Brief.
 *
 * newsWeeklyBrief writes a `status:'draft'` WEEKLY_BRIEF#{weekKey} record. This script
 * lets the operator review the draft and publish it (status → 'published', which is what
 * the public weekly_brief action + the email will serve), or hold/reject. No public auth
 * surface — AWS CLI, no npm deps. Mirrors breaking/review.js + predictions/review.js.
 *
 * Usage:
 *   node weekly/review.js            # interactive: walk draft briefs
 *   node weekly/review.js --list     # just list drafts
 */

const { execSync } = require('child_process');
const readline = require('readline');

const TABLE = 'SummarizeAndPredict';
const REGION = 'ap-northeast-1';
const LIST_ONLY = process.argv.includes('--list');

function aws(args) { return execSync(`aws ${args}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }

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

function scanDrafts() {
  const items = [];
  let token = '';
  for (;;) {
    const tk = token ? `--starting-token '${token}'` : '';
    const out = aws(
      `dynamodb scan --table-name ${TABLE} --region ${REGION} ` +
      `--filter-expression "SK = :sk AND #s = :d" ` +
      `--expression-attribute-names '{"#s":"status"}' ` +
      `--expression-attribute-values '{":sk":{"S":"WEEKLY_BRIEF"},":d":{"S":"draft"}}' ` +
      `--output json ${tk}`,
    );
    const page = JSON.parse(out);
    items.push(...(page.Items || []).map((it) => unmarshal({ M: it })));
    if (!page.NextToken) break;
    token = page.NextToken;
  }
  return items.sort((a, b) => String(b.weekOf).localeCompare(String(a.weekOf)));
}

function setStatus(pk, status) {
  const now = new Date().toISOString();
  aws(
    `dynamodb update-item --table-name ${TABLE} --region ${REGION} ` +
    `--key '{"PK":{"S":"${pk}"},"SK":{"S":"WEEKLY_BRIEF"}}' ` +
    `--update-expression "SET #s = :v, reviewedAt = :t" ` +
    `--expression-attribute-names '{"#s":"status"}' ` +
    `--expression-attribute-values '{":v":{"S":"${status}"},":t":{"S":"${now}"}}'`,
  );
}

function show(b) {
  console.log('\n════════════════════════════════════════════');
  console.log(`Weekly Signals Brief — week of ${b.weekOf}   [${b.status}]   model: ${b.model}`);
  console.log('────────────────────────────────────────────');
  if (Array.isArray(b.signals)) {
    b.signals.forEach((s, i) => {
      const tag = s.kind === 'development' ? 'DEVELOPMENT' : `${(s.riskLevel || 'n/a').toUpperCase()} RISK`;
      console.log(`\n${i + 1}. ${s.lede}   [${tag}]`);
      console.log(`   ${s.region || '—'} · as of ${s.asOf || '—'}`);
      console.log(`   FACT: ${s.fact}`);
      if (s.soWhat) console.log(`   SO WHAT: ${s.soWhat}`);
      const src = (s.sources || []).map((x) => x.source || x.title).filter(Boolean).join(', ');
      console.log(`   SOURCES: ${src || '(none)'}`);
    });
    if (Array.isArray(b.watch) && b.watch.length) {
      console.log('\n── What to watch ──');
      b.watch.forEach((w, i) => console.log(`  ${i + 1}. ${w.event}${w.date ? ` (${w.date})` : ''} — ${w.stake || ''}`));
    }
  } else {
    // older prose format
    console.log(`HEADLINE: ${b.headline || ''}`);
    if (b.dek) console.log(`DEK: ${b.dek}`);
    console.log('\n' + (b.brief || '(no body)'));
  }
  console.log('\n════════════════════════════════════════════');
}

async function main() {
  const drafts = scanDrafts();
  if (!drafts.length) { console.log('No draft weekly briefs awaiting review. ✓'); return; }
  console.log(`${drafts.length} draft brief(s) awaiting review.`);

  if (LIST_ONLY) { for (const b of drafts) console.log(`  [draft] week of ${b.weekOf} — ${(b.keyDevelopments || []).length} developments`); return; }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  for (const b of drafts) {
    show(b);
    const ans = (await ask('\n[p]=publish  r=reject  s=skip  q=quit > ')).trim().toLowerCase();
    if (ans === 'q') break;
    if (ans === 's' || ans === '') continue;
    if (ans === 'p') { setStatus(b.PK, 'published'); console.log('  → published (will be served + sent).'); }
    else if (ans === 'r') { setStatus(b.PK, 'rejected'); console.log('  → rejected.'); }
    else console.log('  (unrecognized — skipped)');
  }
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
