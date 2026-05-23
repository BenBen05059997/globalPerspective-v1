#!/usr/bin/env node
'use strict';

/**
 * calibration_report.js — Layer 9 drift report.
 * See ECONOMIC_VERIFICATION_PLAN.md §11.
 *
 * Aggregates the active ECON#THREAD# records and produces a markdown report
 * tracking severity / confidence / horizon distributions, tombstone rate,
 * judge low-quality rate, and coverage trend across the window.
 *
 * Usage:
 *   node quality/calibration_report.js [--window=30d]
 *
 * Writes to quality/calibration/YYYY-WW.md (ISO week numbering).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const WINDOW_DAYS = (() => {
  const a = args.find(s => s.startsWith('--window='));
  if (!a) return 30;
  const m = a.split('=')[1].match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
})();

const REGION = 'ap-northeast-1';
const TABLE = 'SummarizeAndPredict';

function isoWeek(d = new Date()) {
  // ISO 8601 week numbering
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function ddbScanAll() {
  const all = [];
  let lastKey = null;
  do {
    const argsList = [
      'dynamodb', 'scan',
      '--table-name', TABLE,
      '--region', REGION,
      '--filter-expression', 'begins_with(PK, :p) AND SK = :sk',
      '--expression-attribute-values', JSON.stringify({
        ':p': { S: 'ECON#THREAD#' },
        ':sk': { S: 'ECONOMIC_IMPACT' },
      }),
      '--output', 'json',
    ];
    if (lastKey) argsList.push('--starting-token', Buffer.from(JSON.stringify(lastKey)).toString('base64'));
    const cmd = `aws ${argsList.map(a => /[\s"]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a).join(' ')}`;
    const out = execSync(cmd, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
    const j = JSON.parse(out);
    all.push(...(j.Items || []));
    lastKey = j.LastEvaluatedKey || null;
  } while (lastKey);
  return all.map(unmarshal);
}
function unmarshal(item) {
  const out = {};
  for (const [k, v] of Object.entries(item)) out[k] = unmarshalVal(v);
  return out;
}
function unmarshalVal(v) {
  if (v == null) return null;
  if ('S' in v) return v.S;
  if ('N' in v) return Number(v.N);
  if ('BOOL' in v) return v.BOOL;
  if ('NULL' in v) return null;
  if ('L' in v) return v.L.map(unmarshalVal);
  if ('M' in v) return unmarshal(v.M);
  return null;
}
function withinWindow(iso, days) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  return (Date.now() - t) <= days * 86400 * 1000;
}
function pct(num, denom) { return denom === 0 ? '—' : `${(100 * num / denom).toFixed(1)}%`; }

function band(metric, value, healthy, alarmIf) {
  // healthy is a string description; alarmIf is the alarm threshold note
  return `| ${metric} | ${value} | ${healthy} | ${alarmIf} |`;
}

// ─── History persistence ────────────────────────────────────────────────────
// Snapshot key metrics each run so we can detect drift over time.
function loadHistory(outDir) {
  const p = path.join(outDir, '_history.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}
function appendHistory(outDir, snap) {
  const p = path.join(outDir, '_history.json');
  const hist = loadHistory(outDir);
  hist.push(snap);
  // Keep last 90 snapshots — enough for rolling 30/60/90-day windows.
  const trimmed = hist.slice(-90);
  fs.writeFileSync(p, JSON.stringify(trimmed, null, 2));
  return trimmed;
}
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}
function zscore(curr, history) {
  if (history.length < 5) return null; // need ≥ 5 samples for a stable baseline
  const m = mean(history);
  const s = stdev(history);
  return s === 0 ? 0 : (curr - m) / s;
}

function buildReport(records) {
  const inWindow = records.filter(r => withinWindow(r.generatedAt, WINDOW_DAYS));
  const live = inWindow.filter(r => r.hasImpact === true);
  const tombs = inWindow.filter(r => r.hasImpact === false);
  const tombRate = inWindow.length ? tombs.length / inWindow.length : 0;

  const sev = { minor: 0, moderate: 0, severe: 0 };
  const conf = { low: 0, medium: 0, high: 0 };
  const hor = { immediate: 0, days: 0, weeks: 0, months: 0 };
  let instCount = 0;
  let flagsTotal = 0;
  for (const r of live) {
    sev[r.severity] = (sev[r.severity] || 0) + 1;
    conf[r.confidence] = (conf[r.confidence] || 0) + 1;
    hor[r.horizon] = (hor[r.horizon] || 0) + 1;
    instCount += (r.instruments || []).length;
    flagsTotal += (r.qualityFlags || []).length;
  }
  const meanInst = live.length ? (instCount / live.length).toFixed(2) : '—';
  const meanFlags = live.length ? (flagsTotal / live.length).toFixed(2) : '—';

  const judgeable = live.filter(r => Date.now() - new Date(r.generatedAt).getTime() > 24 * 3600 * 1000);
  const judged = judgeable.filter(r => r.quality_judged_at);
  const lowQ = judged.filter(r => r.is_low_quality);

  // Per-day timeline
  const byDay = {};
  for (const r of inWindow) {
    const d = (r.generatedAt || '').slice(0, 10);
    if (!byDay[d]) byDay[d] = { live: 0, tomb: 0 };
    if (r.hasImpact) byDay[d].live++; else byDay[d].tomb++;
  }
  const days = Object.keys(byDay).sort();

  // Inline citation compliance over last 7d
  const recent7 = live.filter(r => withinWindow(r.generatedAt, 7));
  const recent7Inline = recent7.filter(r => {
    const cited = r.citedTopicIds || [];
    return (r.mechanism || '') && cited.some(id => r.mechanism.includes(`[${id}]`));
  });

  const lines = [];
  lines.push(`# Calibration Report — ${isoWeek()}`);
  lines.push('');
  lines.push(`**Window:** last ${WINDOW_DAYS} days`);
  lines.push(`**Total records in window:** ${inWindow.length} (live: ${live.length}, tombstone: ${tombs.length})`);
  lines.push(`**Distinct days with records:** ${days.length}`);
  lines.push('');

  lines.push('## Distribution health');
  lines.push('');
  lines.push('| Metric | Value | Healthy band | Alarm if |');
  lines.push('|---|---|---|---|');
  lines.push(band('severity: % severe',   pct(sev.severe, live.length),   '5–25%',  'drifts ≥ 2σ in 7d'));
  lines.push(band('severity: % moderate', pct(sev.moderate, live.length), '50–80%', 'drifts ≥ 2σ in 7d'));
  lines.push(band('severity: % minor',    pct(sev.minor, live.length),    '5–25%',  'drifts ≥ 2σ in 7d'));
  lines.push(band('tombstone rate',       pct(tombs.length, inWindow.length), '20–40%', '<10% or >60%'));
  lines.push(band('mean instruments/record', meanInst, '2.5–4.0', '< 2 or > 5'));
  lines.push(band('confidence: % high',   pct(conf.high, live.length),   '10–25%', '> 40%'));
  lines.push(band('confidence: % medium', pct(conf.medium, live.length), '50–70%', ''));
  lines.push(band('confidence: % low',    pct(conf.low, live.length),    '10–30%', ''));
  lines.push(band('mean Phase A flags/record', meanFlags, '≤ 1.5', '> 2.5'));
  lines.push(band('inline-citation compliance (7d)', pct(recent7Inline.length, recent7.length), '100%', '< 95%'));
  lines.push(band('judge coverage (>24h)', pct(judged.length, judgeable.length), '≥ 80%', '< 50%'));
  lines.push(band('judge low-quality rate', pct(lowQ.length, judged.length), '5–25%', '> 30% or < 2%'));
  lines.push('');

  lines.push('## Horizon mix');
  lines.push('');
  for (const k of Object.keys(hor)) lines.push(`- ${k}: ${hor[k]} (${pct(hor[k], live.length)})`);
  lines.push('');

  lines.push('## Daily coverage timeline');
  lines.push('');
  lines.push('| Date | Live | Tombstones | Total |');
  lines.push('|---|---:|---:|---:|');
  for (const d of days) lines.push(`| ${d} | ${byDay[d].live} | ${byDay[d].tomb} | ${byDay[d].live + byDay[d].tomb} |`);
  lines.push('');

  lines.push('## Phase D backtest readiness');
  lines.push('');
  const liveDays = new Set(live.map(r => r.generatedAt.slice(0, 10))).size;
  lines.push(`- Distinct days of live records: **${liveDays}** / 30 needed`);
  lines.push(`- Estimated unblock date: ~${liveDays < 30 ? 'TBD — keep running cron' : 'NOW — ready to build backtest'}`);
  lines.push('');

  return lines.join('\n');
}

function buildSnapshot(records) {
  const inWindow = records.filter(r => withinWindow(r.generatedAt, WINDOW_DAYS));
  const live = inWindow.filter(r => r.hasImpact === true);
  const tombs = inWindow.filter(r => r.hasImpact === false);
  const sev = { minor: 0, moderate: 0, severe: 0 };
  const conf = { low: 0, medium: 0, high: 0 };
  let instCount = 0;
  let flagsTotal = 0;
  for (const r of live) {
    sev[r.severity] = (sev[r.severity] || 0) + 1;
    conf[r.confidence] = (conf[r.confidence] || 0) + 1;
    instCount += (r.instruments || []).length;
    flagsTotal += (r.qualityFlags || []).length;
  }
  return {
    ts: new Date().toISOString(),
    n_live: live.length,
    n_tomb: tombs.length,
    severe_pct: live.length ? 100 * sev.severe / live.length : 0,
    moderate_pct: live.length ? 100 * sev.moderate / live.length : 0,
    minor_pct: live.length ? 100 * sev.minor / live.length : 0,
    tomb_pct: inWindow.length ? 100 * tombs.length / inWindow.length : 0,
    mean_instruments: live.length ? instCount / live.length : 0,
    mean_flags: live.length ? flagsTotal / live.length : 0,
    high_conf_pct: live.length ? 100 * conf.high / live.length : 0,
  };
}

function buildDriftSection(curr, history) {
  if (history.length < 5) {
    return ['## Drift detection', '', `_Need ≥5 historical snapshots to compute sigma alarms; have ${history.length}._`, ''];
  }
  const lines = [];
  lines.push('## Drift detection (z-score vs rolling history)');
  lines.push('');
  lines.push('| Metric | Current | Mean (history) | σ | z | Status |');
  lines.push('|---|---:|---:|---:|---:|:--:|');
  const fields = [
    ['severe_pct',       '% severe'],
    ['moderate_pct',     '% moderate'],
    ['minor_pct',        '% minor'],
    ['tomb_pct',         'tombstone rate'],
    ['mean_instruments', 'mean instruments/record'],
    ['high_conf_pct',    '% high confidence'],
    ['mean_flags',       'mean Phase A flags'],
  ];
  for (const [k, label] of fields) {
    const series = history.map(h => h[k]).filter(v => typeof v === 'number');
    const m = mean(series);
    const s = stdev(series);
    const z = zscore(curr[k], series);
    let status = '·';
    if (z != null) {
      const absz = Math.abs(z);
      if (absz >= 3) status = '🚨 SEVERE';
      else if (absz >= 2) status = '⚠️ alarm';
      else if (absz >= 1) status = '🟡 watch';
      else status = '✅';
    }
    lines.push(`| ${label} | ${curr[k].toFixed(2)} | ${m.toFixed(2)} | ${s.toFixed(2)} | ${z == null ? '—' : z.toFixed(2)} | ${status} |`);
  }
  lines.push('');
  return lines;
}

function main() {
  console.log(`Scanning ${TABLE}...`);
  const records = ddbScanAll();
  console.log(`Got ${records.length} ECON records.`);

  const outDir = path.join(__dirname, 'calibration');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const snap = buildSnapshot(records);
  const history = appendHistory(outDir, snap);
  // Drift compares current vs the prior snapshots only (excludes current we just appended)
  const driftLines = buildDriftSection(snap, history.slice(0, -1));

  const baseReport = buildReport(records);
  const report = baseReport.split('## Horizon mix')[0]
    + driftLines.join('\n') + '\n## Horizon mix'
    + baseReport.split('## Horizon mix')[1];

  const out = path.join(outDir, `${isoWeek()}.md`);
  fs.writeFileSync(out, report);
  fs.writeFileSync(path.join(outDir, 'latest.md'), report);
  console.log(`Report: ${out}`);
  console.log(`History: ${history.length} snapshots in _history.json`);
}

main();
