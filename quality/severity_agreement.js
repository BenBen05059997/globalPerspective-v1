#!/usr/bin/env node
'use strict';

/**
 * severity_agreement.js — Phase 3 severity-benchmark agreement baseline.
 * See project-docs/architecture/ONE_TRUTH_EXECUTION_PLAN.md Phase 3 Step 3.3.
 *
 * Reads ONLY quality/severity_gold_set.json (or a path given as the first positional arg, for
 * the toy-example self-check). No live DDB reads — the frozen model_dimensions vs. the
 * operator-filled gold labels is the entire comparison.
 *
 * Refuses to run (and prints a count of incomplete labels) if the gold set is not fully labeled.
 *
 * Computes, per axis and overall:
 *   - exact-band agreement %
 *   - within-one-band agreement %
 *   - worst-axis-match % (does the model's and operator's worst axis agree)
 *   - per-axis n (non-null gold labels)
 *
 * Usage:
 *   node quality/severity_agreement.js                       # real gold set, writes report
 *   node quality/severity_agreement.js path/to/toy.json       # toy/self-test file, writes report there too
 */

const fs = require('fs');
const path = require('path');

const AXES = ['conflict', 'political', 'economic', 'humanitarian'];

const inputPath = process.argv[2] || path.join('quality', 'severity_gold_set.json');

function band(score) {
  if (score == null) return null;
  if (score >= 75) return 'high';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'moderate';
  return 'low';
}

const BAND_ORDER = { low: 0, moderate: 1, elevated: 2, high: 3 };

function bandDistance(a, b) {
  if (a == null || b == null) return null;
  return Math.abs(BAND_ORDER[a] - BAND_ORDER[b]);
}

function worstAxis(scores) {
  // scores: {conflict, political, economic, humanitarian} -> {axis, score} | null
  let best = null;
  for (const axis of AXES) {
    const s = scores[axis];
    if (s == null) continue;
    if (best == null || s > best.score) best = { axis, score: s };
  }
  return best;
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Gold set not found at ${inputPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const records = Array.isArray(raw) ? raw : raw.records;
  if (!Array.isArray(records)) {
    console.error(`${inputPath} does not contain a records array (expected either a bare array or {records:[...]}).`);
    process.exit(1);
  }

  // ── completeness guard ────────────────────────────────────────────────────
  // A gold label is "considered" if it's either a finite number or explicit null (JSON null).
  // It's "unconsidered" only if the key is missing entirely, which shouldn't happen given
  // pick_severity_sample.js always initializes gold to {axis: null, ...} — but check anyway in
  // case a record's gold object was replaced with something partial by hand-editing.
  let incomplete = 0;
  const incompleteIds = [];
  for (const r of records) {
    const gold = r.gold || {};
    let recordIncomplete = false;
    for (const axis of AXES) {
      if (!(axis in gold)) recordIncomplete = true;
    }
    if (recordIncomplete) {
      incomplete++;
      incompleteIds.push(r.id);
    }
  }

  // Additionally: if EVERY gold value across the whole file is still null, the operator almost
  // certainly hasn't started labeling — refuse in that case too, even though structurally each
  // gold object has all 4 keys present (as pick_severity_sample.js writes them).
  const anyNonNullGold = records.some(r => AXES.some(a => (r.gold || {})[a] != null));
  if (!anyNonNullGold) {
    console.error(`Refusing to compute agreement: 0 of ${records.length} records have any non-null gold label. ` +
      `Labeling has not started (or the file was regenerated). Fill in "gold" per SEVERITY_CODEBOOK.md, then re-run.`);
    process.exit(1);
  }

  if (incomplete > 0) {
    console.error(`Refusing to compute agreement: ${incomplete}/${records.length} record(s) have an incomplete ` +
      `gold object (missing one or more of ${AXES.join(', ')}). IDs: ${incompleteIds.slice(0, 10).join(', ')}` +
      `${incompleteIds.length > 10 ? ', …' : ''}. Finish labeling per SEVERITY_CODEBOOK.md, then re-run.`);
    process.exit(1);
  }

  // ── agreement computation ───────────────────────────────────────────────────
  const perAxis = {};
  for (const axis of AXES) perAxis[axis] = { n: 0, exact: 0, withinOne: 0 };

  let worstMatchN = 0;
  let worstMatchHits = 0;

  for (const r of records) {
    const gold = r.gold || {};
    const model = r.model_dimensions || {};

    for (const axis of AXES) {
      const g = gold[axis];
      const m = typeof model[axis] === 'number' ? model[axis] : null;
      if (g == null || m == null) continue; // n counts only pairs where BOTH sides are non-null
      const gb = band(g);
      const mb = band(m);
      perAxis[axis].n++;
      if (gb === mb) perAxis[axis].exact++;
      const d = bandDistance(gb, mb);
      if (d != null && d <= 1) perAxis[axis].withinOne++;
    }

    // worst-axis-match: only meaningful when both sides have at least one non-null axis
    const goldScores = {};
    const modelScores = {};
    for (const axis of AXES) {
      if (gold[axis] != null) goldScores[axis] = gold[axis];
      if (typeof model[axis] === 'number') modelScores[axis] = model[axis];
    }
    const goldWorst = worstAxis(goldScores);
    const modelWorst = worstAxis(modelScores);
    if (goldWorst && modelWorst) {
      worstMatchN++;
      if (goldWorst.axis === modelWorst.axis) worstMatchHits++;
    }
  }

  // overall (pooled across axes)
  let overallN = 0, overallExact = 0, overallWithinOne = 0;
  for (const axis of AXES) {
    overallN += perAxis[axis].n;
    overallExact += perAxis[axis].exact;
    overallWithinOne += perAxis[axis].withinOne;
  }

  const fmtPct = (num, den) => (den === 0 ? 'n/a' : `${((num / den) * 100).toFixed(1)}%`);

  // ── stamping metadata ────────────────────────────────────────────────────────
  const modelIds = [...new Set(records.map(r => r.model).filter(Boolean))].sort();
  const generatedAts = records.map(r => r.generatedAt).filter(Boolean).sort();
  const genRange = generatedAts.length
    ? `${generatedAts[0]} .. ${generatedAts[generatedAts.length - 1]}`
    : 'unknown';

  // ── console summary ───────────────────────────────────────────────────────
  console.log(`Gold set: ${inputPath} (${records.length} records)`);
  console.log(`Model id(s): ${modelIds.join(', ') || 'unknown'}`);
  console.log(`generatedAt range: ${genRange}`);
  console.log('');
  console.log('Per-axis agreement:');
  for (const axis of AXES) {
    const s = perAxis[axis];
    console.log(`  ${axis.padEnd(12)} n=${s.n}  exact=${fmtPct(s.exact, s.n)}  within-one=${fmtPct(s.withinOne, s.n)}`);
  }
  console.log('');
  console.log(`Overall (pooled): n=${overallN}  exact=${fmtPct(overallExact, overallN)}  within-one=${fmtPct(overallWithinOne, overallN)}`);
  console.log(`Worst-axis match: n=${worstMatchN}  match=${fmtPct(worstMatchHits, worstMatchN)}`);

  // ── markdown report ────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join('quality', 'calibration', `severity-${today}.md`);

  const lines = [];
  lines.push(`# Severity agreement baseline — ${today}`);
  lines.push('');
  lines.push(`Generated by \`quality/severity_agreement.js\` from \`${inputPath}\`.`);
  lines.push(`Rubric: [\`SEVERITY_CODEBOOK.md\`](../../project-docs/architecture/SEVERITY_CODEBOOK.md).`);
  lines.push(`Plan: [\`ONE_TRUTH_EXECUTION_PLAN.md\`](../../project-docs/architecture/ONE_TRUTH_EXECUTION_PLAN.md) Phase 3.`);
  lines.push('');
  lines.push(`- **Records:** ${records.length}`);
  lines.push(`- **Model id(s) in sample:** ${modelIds.join(', ') || 'unknown'}`);
  lines.push(`- **generatedAt range in sample:** ${genRange}`);
  lines.push('');
  lines.push('## Per-axis agreement');
  lines.push('');
  lines.push('| Axis | n | Exact-band | Within-one-band |');
  lines.push('|---|---|---|---|');
  for (const axis of AXES) {
    const s = perAxis[axis];
    lines.push(`| ${axis} | ${s.n} | ${fmtPct(s.exact, s.n)} | ${fmtPct(s.withinOne, s.n)} |`);
  }
  lines.push('');
  lines.push('## Overall');
  lines.push('');
  lines.push(`- **Pooled exact-band:** ${fmtPct(overallExact, overallN)} (n=${overallN})`);
  lines.push(`- **Pooled within-one-band:** ${fmtPct(overallWithinOne, overallN)} (n=${overallN})`);
  lines.push(`- **Worst-axis match:** ${fmtPct(worstMatchHits, worstMatchN)} (n=${worstMatchN})`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('**Hard rule (per plan Step 3.5):** no prompt or rubric change to `newsCountryIntelligence` or ' +
    '`newsThreadAnalysis` before this baseline exists. This file is that baseline.');
  lines.push('');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`\nWrote ${reportPath}`);
}

main();
