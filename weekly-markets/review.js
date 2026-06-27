#!/usr/bin/env node
'use strict';

/**
 * weekly-markets/review.js — one-click human approval for the Weekly Markets Report.
 *
 * newsWeeklyMarkets writes a `status:'draft'` WEEKLY_MARKETS#{weekKey} record. This script
 * lets the operator review the draft and publish it (status → 'published', which is what the
 * public weekly_markets action serves), or hold/reject. No public auth surface — AWS CLI, no
 * npm deps. Mirrors weekly/review.js + breaking/review.js + predictions/review.js.
 *
 * The human gate is the grounding/verification layer: attributing a weekly price move to a
 * cause is post-hoc, so the operator confirms each mover's note is honest (candidate driver,
 * not invented causation) before it goes public.
 *
 * Usage:
 *   node weekly-markets/review.js            # interactive: walk draft reports
 *   node weekly-markets/review.js --list     # just list drafts
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
      `--expression-attribute-values '{":sk":{"S":"WEEKLY_MARKETS"},":d":{"S":"draft"}}' ` +
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
    `--key '{"PK":{"S":"${pk}"},"SK":{"S":"WEEKLY_MARKETS"}}' ` +
    `--update-expression "SET #s = :v, reviewedAt = :t" ` +
    `--expression-attribute-names '{"#s":"status"}' ` +
    `--expression-attribute-values '{":v":{"S":"${status}"},":t":{"S":"${now}"}}'`,
  );
}

function show(b) {
  console.log('\n════════════════════════════════════════════');
  console.log(`Weekly Markets Report — week of ${b.weekOf}   [${b.status}]   model: ${b.model}`);
  console.log('────────────────────────────────────────────');
  if (Array.isArray(b.movers) && b.movers.length) {
    b.movers.forEach((m, i) => {
      const arrow = m.direction === 'up' ? '▲' : '▼';
      const pct = (m.changePct >= 0 ? '+' : '') + m.changePct + '%';
      // The trust tier is the make-or-break here — show it loudly so the operator can vet it.
      const tier = m.grounding === 'coverage' ? 'OUR COVERAGE'
        : m.grounding === 'web' ? 'WEB CONTEXT (not our analysis)'
          : 'NO DRIVER';
      console.log(`\n${i + 1}. ${m.name} (${m.instrumentId})   ${arrow} ${pct}   [${tier}]`);
      console.log(`   ${m.weekStart} → ${m.weekEnd}`);
      console.log(`   NOTE: ${m.note || '(none)'}`);
      if (Array.isArray(m.coverage) && m.coverage.length) {
        const cov = m.coverage.map((c) => c.headline || c.threadId).filter(Boolean).join(' | ');
        console.log(`   COVERAGE: ${cov}`);
      }
      if (Array.isArray(m.sources) && m.sources.length) {
        const src = m.sources.map((s) => s.title || s.url).filter(Boolean).join(', ');
        console.log(`   SOURCES: ${src}`);
      }
    });
    if (Array.isArray(b.excluded) && b.excluded.length) {
      console.log(`\n── Excluded (history accruing) ── ${b.excluded.map((e) => e.instrumentId).join(', ')}`);
    }
  } else {
    console.log('(no movers in this draft)');
  }
  console.log('\n════════════════════════════════════════════');
}

async function main() {
  const drafts = scanDrafts();
  if (!drafts.length) { console.log('No draft weekly markets reports awaiting review. ✓'); return; }
  console.log(`${drafts.length} draft report(s) awaiting review.`);

  if (LIST_ONLY) { for (const b of drafts) console.log(`  [draft] week of ${b.weekOf} — ${(b.movers || []).length} movers`); return; }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  for (const b of drafts) {
    show(b);
    const ans = (await ask('\n[p]=publish  r=reject  s=skip  q=quit > ')).trim().toLowerCase();
    if (ans === 'q') break;
    if (ans === 's' || ans === '') continue;
    if (ans === 'p') { setStatus(b.PK, 'published'); console.log('  → published (will be served).'); }
    else if (ans === 'r') { setStatus(b.PK, 'rejected'); console.log('  → rejected.'); }
    else console.log('  (unrecognized — skipped)');
  }
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
