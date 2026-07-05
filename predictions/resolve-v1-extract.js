#!/usr/bin/env node
'use strict';

/**
 * predictions/resolve-v1-extract.js — Phase 2 of prediction methodology v1.
 *
 * READ-ONLY. Scans GlobalPerspectivePredictionLog for v1 (`methodologyVersion >= 1`)
 * triggers that have come DUE (deadline <= today) and still lack a `finalVerdict`,
 * and writes an oldest-first worklist the agent verifies. It never writes to DDB.
 *
 * The resolution loop itself is AGENT-RUN (see V1_RESOLUTION_RUNBOOK.md): this
 * script only produces the work-list; independent web-grounded verification is done
 * by the agent, and confirmed verdicts are written back by resolve-v1-write.js.
 *
 * Deliberately excludes the legacy backlog (records with NO methodologyVersion) —
 * those carry the trigger-generation defects the 2026-07-04 pilot found and are
 * kept immutable but unscored (PREDICTION_METHODOLOGY_V1_PLAN.md §2, the era cut).
 *
 * Usage:
 *   node predictions/resolve-v1-extract.js                 # print stats + write worklist.json
 *   node predictions/resolve-v1-extract.js --out FILE      # worklist path (default ./worklist-v1.json)
 *   node predictions/resolve-v1-extract.js --today YYYY-MM-DD   # override "today" (testing)
 *   node predictions/resolve-v1-extract.js --limit N       # cap the worklist (default 200)
 */

const { execSync } = require('child_process');

const TABLE = 'GlobalPerspectivePredictionLog';
const REGION = 'ap-northeast-1';

const FLAGS = process.argv.slice(2);
function flag(name, def) {
  const i = FLAGS.indexOf(name);
  return i >= 0 && FLAGS[i + 1] ? FLAGS[i + 1] : def;
}
const TODAY = flag('--today', new Date().toISOString().slice(0, 10));
const OUT = flag('--out', './worklist-v1.json');
const LIMIT = parseInt(flag('--limit', '200'), 10);

function aws(args) {
  return execSync(`aws ${args}`, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

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

// Scan only v1 records (methodologyVersion present) — filters the legacy backlog out at the source.
function scanV1() {
  const items = [];
  let startKey = '';
  for (;;) {
    const skArg = startKey ? `--starting-token '${startKey}'` : '';
    const out = aws(
      `dynamodb scan --table-name ${TABLE} --region ${REGION} ` +
      `--filter-expression "attribute_exists(methodologyVersion)" ` +
      `--output json ${skArg}`,
    );
    const page = JSON.parse(out);
    items.push(...(page.Items || []).map(it => unmarshal({ M: it })));
    if (!page.NextToken) break;
    startKey = page.NextToken;
  }
  return items;
}

function main() {
  const records = scanV1();
  const work = [];
  let dueOpen = 0, futureTriggers = 0, alreadyResolved = 0, gateEscapes = 0;

  for (const rec of records) {
    const genDay = String(rec.generatedAt || rec.SK || '').slice(0, 10);
    for (const s of rec.scenarios || []) {
      for (const t of s.triggers || []) {
        if (!t.deadline) continue; // undated triggers aren't scoreable
        // Belt-and-braces: a v1 trigger must be forward of generation (gate G2).
        // If one isn't, a gate escaped — surface it, don't resolve it.
        if (t.deadline <= genDay) { gateEscapes++; continue; }
        if (t.finalVerdict) { alreadyResolved++; continue; }
        if (t.deadline > TODAY) { futureTriggers++; continue; }
        dueOpen++;
        work.push({
          pk: rec.PK, sk: rec.SK,
          topicId: rec.topicId, title: rec.title, category: rec.category || null,
          generatedAt: rec.generatedAt, methodologyVersion: rec.methodologyVersion,
          scenarioLabel: s.label, scenarioProbability: s.probability,
          triggerId: t.id, triggerText: t.text, deadline: t.deadline,
        });
      }
    }
  }

  work.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
  const worklist = { generatedAt: new Date().toISOString(), today: TODAY, count: Math.min(LIMIT, work.length), triggers: work.slice(0, LIMIT) };
  require('fs').writeFileSync(OUT, JSON.stringify(worklist, null, 2));

  console.log(`v1 records scanned:        ${records.length}`);
  console.log(`due & open (worklist):     ${dueOpen}${work.length > LIMIT ? ` (capped to ${LIMIT} in ${OUT})` : ''}`);
  console.log(`not yet due (future):      ${futureTriggers}`);
  console.log(`already resolved:          ${alreadyResolved}`);
  if (gateEscapes) console.log(`⚠ gate escapes (deadline<=gen): ${gateEscapes} — a capture gate let a retrodiction through; investigate.`);
  console.log(`\nWorklist → ${OUT} (${worklist.count} triggers, oldest deadline first).`);
  if (!dueOpen) console.log('Nothing due yet — the earliest v1 deadlines are still in the future. Re-run after they pass.');
}

main();
