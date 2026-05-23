#!/usr/bin/env node
'use strict';

/**
 * verify_ddb.js — Layer 1 schema integrity checks for ECON#THREAD# records.
 * See ECONOMIC_VERIFICATION_PLAN.md §3 for the full check catalog.
 *
 * Usage:
 *   node quality/verify_ddb.js [--window=21d] [--strict]
 *
 * --window: how many days of records to scan (default 21, matches TTL)
 * --strict: exit non-zero if any REQUIRED check has any failure
 *
 * Output: writes quality/verify/iteration-<timestamp>.md and exits 0/1.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-northeast-1';
const TABLE = 'SummarizeAndPredict';
const ECON_PK_PREFIX = 'ECON#THREAD#';
const ECON_SK = 'ECONOMIC_IMPACT';

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const WINDOW_DAYS = (() => {
  const a = args.find(s => s.startsWith('--window='));
  if (!a) return 21;
  const m = a.split('=')[1].match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 21;
})();

const VALID_SEVERITIES = new Set(['minor', 'moderate', 'severe']);
const VALID_CONFIDENCES = new Set(['low', 'medium', 'high']);
const VALID_HORIZONS = new Set(['immediate', 'days', 'weeks', 'months']);
const VALID_DIRECTIONS = new Set(['up', 'down', 'mixed']);
const VALID_MAGNITUDES = new Set(['small', 'moderate', 'large']);
const VALID_ENT_TYPES = new Set(['country', 'sector', 'company']);
const SEVERITY_BAND = {
  minor: { min: 0, max: 40 },
  moderate: { min: 41, max: 69 },
  severe: { min: 70, max: 100 },
};

// Read INSTRUMENT_ALLOWLIST from the Lambda source so it cannot drift.
const INSTRUMENT_ALLOWLIST = (() => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'amplify/backend/function/newsEconomicImpact/src/index.js'),
    'utf8',
  );
  const m = src.match(/const INSTRUMENT_ALLOWLIST = new Set\(\[([\s\S]*?)\]\);/);
  if (!m) throw new Error('Could not locate INSTRUMENT_ALLOWLIST in Lambda source');
  const tokens = [];
  const re = /'([A-Z0-9_\/]+)'/g;
  let mm;
  while ((mm = re.exec(m[1])) !== null) tokens.push(mm[1]);
  return new Set(tokens);
})();
const FX_PAIR_RE = /^USD\/[A-Z]{3}$/;

function isAllowedInstrument(id, runtimeFx = new Set()) {
  if (!id) return false;
  if (INSTRUMENT_ALLOWLIST.has(id)) return true;
  if (FX_PAIR_RE.test(id)) return true; // runtime FX always accepted; strictness handled elsewhere
  if (runtimeFx.has(id)) return true;
  return false;
}

// Load the union of topicIds across the last `days` of archive entries from NewsCache.
// Used by L1.16 archive cross-ref check.
function loadArchiveTopicIds(days) {
  const ids = new Set();
  const now = new Date();
  const keys = ['today-archive'];
  for (let i = 0; i <= days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    // NewsCache stores daily snapshots under `archive#YYYY-MM-DD`; the live rolling
    // pool is `today-archive`. Probe both shapes.
    keys.push(`archive#${ymd}`);
  }
  for (const id of keys) {
    try {
      const out = execSync(
        `aws dynamodb get-item --table-name NewsCache --region ${REGION} --key '${JSON.stringify({ id: { S: id } })}' --projection-expression 'entries' --output json 2>/dev/null`,
        { maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' },
      );
      const j = JSON.parse(out || '{}');
      const entries = j.Item?.entries?.L || [];
      for (const e of entries) {
        const tid = e?.M?.topicId?.S;
        if (tid) ids.add(tid);
      }
    } catch { /* missing archive day is OK */ }
  }
  return ids;
}

function ddbScan() {
  const all = [];
  let lastKey = null;
  // Loop until no more pages
  do {
    const args = [
      'dynamodb', 'scan',
      '--table-name', TABLE,
      '--region', REGION,
      '--filter-expression', 'begins_with(PK, :p) AND SK = :sk',
      '--expression-attribute-values', JSON.stringify({
        ':p': { S: ECON_PK_PREFIX },
        ':sk': { S: ECON_SK },
      }),
      '--output', 'json',
    ];
    if (lastKey) {
      args.push('--starting-token', Buffer.from(JSON.stringify(lastKey)).toString('base64'));
    }
    const cmd = `aws ${args.map(a => /[\s"]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a).join(' ')}`;
    const out = execSync(cmd, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
    const j = JSON.parse(out);
    all.push(...(j.Items || []));
    lastKey = j.LastEvaluatedKey || null;
  } while (lastKey);
  return all.map(unmarshal);
}

// Minimal DDB attribute-value unmarshaller. Handles S, N, BOOL, L, M, NULL.
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
  if ('SS' in v) return v.SS;
  if ('NS' in v) return v.NS.map(Number);
  return null;
}

// ─── Check framework ─────────────────────────────────────────────────────────

class CheckRun {
  constructor() {
    this.results = []; // {id, label, category, required, fails: [{pk, reason}], total}
  }
  add(id, label, category, required) {
    const r = { id, label, category, required, fails: [], total: 0 };
    this.results.push(r);
    return r;
  }
  failed(check, pk, reason) {
    check.fails.push({ pk, reason });
  }
  hits(check) { check.total++; }
  summarize() {
    let requiredOk = true;
    for (const r of this.results) {
      if (r.required && r.fails.length > 0) requiredOk = false;
    }
    return { requiredOk, total: this.results.length };
  }
}

function nowIso() { return new Date().toISOString(); }
function withinWindow(iso, days) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  return (Date.now() - t) <= days * 86400 * 1000;
}

// ─── Checks ──────────────────────────────────────────────────────────────────

function runChecks(records) {
  const cr = new CheckRun();

  // Filter to records inside our window (skip TTL-pending old records)
  const inWindow = records.filter(r => withinWindow(r.generatedAt, WINDOW_DAYS));
  const live = inWindow.filter(r => r.hasImpact === true);
  const tombs = inWindow.filter(r => r.hasImpact === false);

  // L1.01 — PK matches ECON#THREAD#<threadId> and threadId == scopeId
  const c01 = cr.add('L1.01', 'PK structure & scopeId/threadId match', 'shape', true);
  for (const r of inWindow) {
    cr.hits(c01);
    const m = (r.PK || '').match(/^ECON#THREAD#(.+)$/);
    if (!m) { cr.failed(c01, r.PK, 'bad PK shape'); continue; }
    if (m[1] !== r.threadId) cr.failed(c01, r.PK, `PK threadId="${m[1]}" != threadId="${r.threadId}"`);
    if (r.scopeId !== r.threadId) cr.failed(c01, r.PK, `scopeId="${r.scopeId}" != threadId="${r.threadId}"`);
  }

  // L1.02 — SK constant
  const c02 = cr.add('L1.02', 'SK = ECONOMIC_IMPACT', 'shape', true);
  for (const r of inWindow) {
    cr.hits(c02);
    if (r.SK !== ECON_SK) cr.failed(c02, r.PK, `SK="${r.SK}"`);
  }

  // L1.03 — generatedAt parses + within 21d
  const c03 = cr.add('L1.03', 'generatedAt ISO within 21d', 'shape', true);
  for (const r of inWindow) {
    cr.hits(c03);
    if (!r.generatedAt || isNaN(new Date(r.generatedAt).getTime())) {
      cr.failed(c03, r.PK, `bad generatedAt="${r.generatedAt}"`);
    } else if (!withinWindow(r.generatedAt, 21)) {
      cr.failed(c03, r.PK, `older than 21 days`);
    }
  }

  // L1.04 — ttl >= now
  const c04 = cr.add('L1.04', 'ttl is in the future', 'shape', true);
  const nowSec = Math.floor(Date.now() / 1000);
  for (const r of inWindow) {
    cr.hits(c04);
    if (typeof r.ttl !== 'number' || r.ttl < nowSec) cr.failed(c04, r.PK, `ttl=${r.ttl} (now=${nowSec})`);
  }

  // L1.05 — modelId non-empty
  const c05 = cr.add('L1.05', 'modelId non-empty', 'shape', true);
  for (const r of inWindow) {
    cr.hits(c05);
    if (!r.modelId) cr.failed(c05, r.PK, 'missing modelId');
  }

  // L1.06 — entryCount >= 1
  const c06 = cr.add('L1.06', 'entryCount >= 1', 'shape', true);
  for (const r of inWindow) {
    cr.hits(c06);
    if (!(typeof r.entryCount === 'number' && r.entryCount >= 1)) cr.failed(c06, r.PK, `entryCount=${r.entryCount}`);
  }

  // ─── Enums (hasImpact=true only) ───
  const c07 = cr.add('L1.07', 'severity enum legality', 'enum', true);
  const c08 = cr.add('L1.08', 'confidence enum legality', 'enum', true);
  const c09 = cr.add('L1.09', 'horizon enum legality', 'enum', true);
  const c10 = cr.add('L1.10', 'severityScore in [0,100] integer', 'enum', true);
  const c11 = cr.add('L1.11', 'severityScore inside SEVERITY_BAND[severity]', 'enum', true);
  const c12 = cr.add('L1.12', 'every instrument.direction is legal', 'enum', true);
  const c13 = cr.add('L1.13', 'every instrument.magnitude is legal', 'enum', true);
  const c14 = cr.add('L1.14', 'every winners/losers .type is legal', 'enum', true);

  for (const r of live) {
    cr.hits(c07); if (!VALID_SEVERITIES.has(r.severity)) cr.failed(c07, r.PK, r.severity);
    cr.hits(c08); if (!VALID_CONFIDENCES.has(r.confidence)) cr.failed(c08, r.PK, r.confidence);
    cr.hits(c09); if (!VALID_HORIZONS.has(r.horizon)) cr.failed(c09, r.PK, r.horizon);
    cr.hits(c10);
    if (!(Number.isInteger(r.severityScore) && r.severityScore >= 0 && r.severityScore <= 100)) {
      cr.failed(c10, r.PK, `severityScore=${r.severityScore}`);
    }
    cr.hits(c11);
    const band = SEVERITY_BAND[r.severity];
    if (band && (r.severityScore < band.min || r.severityScore > band.max)) {
      cr.failed(c11, r.PK, `${r.severity} expects [${band.min},${band.max}] got ${r.severityScore}`);
    }
    cr.hits(c12);
    for (const inst of (r.instruments || [])) {
      if (!VALID_DIRECTIONS.has(inst.direction)) cr.failed(c12, r.PK, `${inst.instrumentId} dir=${inst.direction}`);
    }
    cr.hits(c13);
    for (const inst of (r.instruments || [])) {
      if (!VALID_MAGNITUDES.has(inst.magnitude)) cr.failed(c13, r.PK, `${inst.instrumentId} mag=${inst.magnitude}`);
    }
    cr.hits(c14);
    for (const w of [...(r.winners || []), ...(r.losers || [])]) {
      if (!VALID_ENT_TYPES.has(w.type)) cr.failed(c14, r.PK, `winner/loser type=${w.type}`);
    }
  }

  // ─── Citation integrity ───
  const c15 = cr.add('L1.15', 'citedTopicIds.length >= 1', 'citation', true);
  // L1.16 only checks records < 48h old. Older records can fail purely because
  // `today-archive` has rotated entries that were valid at generation time but
  // no longer resolve. Within 48h we have full archive coverage so any miss is
  // a real hallucination.
  const c16 = cr.add('L1.16', 'every citedTopicId on records <48h old exists in NewsCache archive', 'citation', true);
  const c17 = cr.add('L1.17', 'instrument.citedTopicIds ⊆ citedTopicIds', 'citation', true);
  const c18 = cr.add('L1.18', 'mechanism contains ≥1 inline citation matching a cited topicId', 'citation', true);
  const c19 = cr.add('L1.19', 'every inline [id] in mechanism is in citedTopicIds', 'citation', true);

  // Load archive topicIds once for L1.16
  console.log('Loading archive entries for cross-ref...');
  const archiveIds = loadArchiveTopicIds(21);
  console.log(`Got ${archiveIds.size} unique topicIds from archive.`);

  const RECENT_MS = 48 * 3600 * 1000;
  const recent = live.filter(r => Date.now() - new Date(r.generatedAt).getTime() < RECENT_MS);
  for (const r of recent) {
    cr.hits(c16);
    for (const id of (r.citedTopicIds || [])) {
      if (!archiveIds.has(id)) {
        cr.failed(c16, r.PK, `cited "${id.slice(0, 60)}…" not in archive`);
      }
    }
  }

  for (const r of live) {
    const cited = new Set(r.citedTopicIds || []);
    cr.hits(c15); if (cited.size === 0) cr.failed(c15, r.PK, 'empty citedTopicIds');
    cr.hits(c17);
    for (const inst of (r.instruments || [])) {
      for (const id of (inst.citedTopicIds || [])) {
        if (!cited.has(id)) cr.failed(c17, r.PK, `${inst.instrumentId} cites unknown ${id}`);
      }
    }
    cr.hits(c18);
    const mech = r.mechanism || '';
    const inlineFound = [...cited].some(id => mech.includes(`[${id}]`));
    if (!inlineFound) cr.failed(c18, r.PK, 'no inline [topicId] match');
    cr.hits(c19);
    // Pull every [whatever] bracketed token, check each is in cited.
    const brackets = mech.match(/\[([^\]\n]+)\]/g) || [];
    for (const tok of brackets) {
      const id = tok.slice(1, -1);
      // Allow if matches one of cited
      if (!cited.has(id)) cr.failed(c19, r.PK, `inline [${id.slice(0, 60)}…] not in cited`);
    }
  }

  // ─── Allowlist ───
  const c20 = cr.add('L1.20', 'every instrumentId is allowlisted', 'allowlist', true);
  const c21 = cr.add('L1.21', 'no individual stock tickers (AAPL/RTX/TSM/etc)', 'allowlist', true);
  const c22 = cr.add('L1.22', 'instruments.length in [1,6]', 'allowlist', true);
  const FORBIDDEN_STOCKS = new Set(['AAPL', 'TSM', 'RTX', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'META', 'NFLX', 'AMZN']);
  for (const r of live) {
    cr.hits(c20);
    for (const inst of (r.instruments || [])) {
      if (!isAllowedInstrument(inst.instrumentId)) cr.failed(c20, r.PK, inst.instrumentId);
    }
    cr.hits(c21);
    for (const inst of (r.instruments || [])) {
      if (FORBIDDEN_STOCKS.has(inst.instrumentId)) cr.failed(c21, r.PK, inst.instrumentId);
    }
    cr.hits(c22);
    const n = (r.instruments || []).length;
    if (n < 1 || n > 6) cr.failed(c22, r.PK, `instruments.length=${n}`);
  }

  // ─── Tombstone hygiene ───
  const c23 = cr.add('L1.23', 'tombstones carry no payload fields', 'tombstone', true);
  const FORBIDDEN_TOMB_FIELDS = ['instruments', 'mechanism', 'severity', 'severityScore', 'confidence', 'horizon', 'winners', 'losers', 'historicalAnalog', 'watchSignals', 'citedTopicIds', 'marketContext', 'qualityScores', 'is_low_quality'];
  for (const t of tombs) {
    cr.hits(c23);
    for (const f of FORBIDDEN_TOMB_FIELDS) {
      if (t[f] !== undefined && t[f] !== null) cr.failed(c23, t.PK, `tombstone leaks ${f}`);
    }
  }
  const c24 = cr.add('L1.24', 'tombstone ratio ≤ 60% over window (informational)', 'tombstone', false);
  cr.hits(c24);
  if (inWindow.length > 0 && tombs.length / inWindow.length > 0.6) {
    cr.failed(c24, '(aggregate)', `${tombs.length}/${inWindow.length} = ${(100 * tombs.length / inWindow.length).toFixed(1)}%`);
  }

  // ─── Historical analog plausibility ───
  const c25 = cr.add('L1.25', 'historicalAnalog.year ∈ [1990,2030]', 'analog', true);
  const c26 = cr.add('L1.26', 'historicalAnalog.caveat present when analog present (informational)', 'analog', false);
  for (const r of live) {
    if (!r.historicalAnalog || !r.historicalAnalog.event) continue;
    cr.hits(c25);
    const y = parseInt(r.historicalAnalog.year, 10);
    if (isNaN(y) || y < 1990 || y > 2030) cr.failed(c25, r.PK, `year=${r.historicalAnalog.year}`);
    cr.hits(c26);
    if (!r.historicalAnalog.caveat) cr.failed(c26, r.PK, 'no caveat');
  }

  // ─── Phase B judge coverage ───
  const c27 = cr.add('L1.27', '≥80% of hasImpact records >24h old have quality_judged_at', 'judge', true);
  const c28 = cr.add('L1.28', 'judged records have 5 axes integer 1..5', 'judge', true);
  const c29 = cr.add('L1.29', 'is_low_quality === (∃ axis ≤ 2)', 'judge', true);
  const c30 = cr.add('L1.30', 'low-quality rate ≤ 30% over window (informational)', 'judge', false);

  const judgeable = live.filter(r => Date.now() - new Date(r.generatedAt).getTime() > 24 * 3600 * 1000);
  const judged = judgeable.filter(r => r.quality_judged_at);
  cr.hits(c27);
  if (judgeable.length > 0 && judged.length / judgeable.length < 0.8) {
    cr.failed(c27, '(aggregate)', `${judged.length}/${judgeable.length} judged (${(100 * judged.length / judgeable.length).toFixed(1)}%)`);
  }

  const AXES = ['coherence', 'citation_fidelity', 'analog_match', 'severity_calibration', 'no_bs'];
  for (const r of judged) {
    cr.hits(c28);
    const sc = r.qualityScores || {};
    for (const ax of AXES) {
      const v = sc[ax];
      if (!Number.isInteger(v) || v < 1 || v > 5) cr.failed(c28, r.PK, `${ax}=${v}`);
    }
    cr.hits(c29);
    const any2 = AXES.some(ax => typeof sc[ax] === 'number' && sc[ax] <= 2);
    if (any2 !== Boolean(r.is_low_quality)) cr.failed(c29, r.PK, `any≤2=${any2} but is_low_quality=${r.is_low_quality}`);
  }
  cr.hits(c30);
  if (judged.length >= 5) {
    const low = judged.filter(r => r.is_low_quality).length;
    if (low / judged.length > 0.3) cr.failed(c30, '(aggregate)', `${low}/${judged.length} flagged low (${(100 * low / judged.length).toFixed(1)}%)`);
  }

  return { cr, live, tombs, inWindow };
}

// ─── Distribution helpers ───────────────────────────────────────────────────

function distributions(live) {
  const sev = {}; const conf = {}; const hor = {};
  let instCount = 0;
  for (const r of live) {
    sev[r.severity] = (sev[r.severity] || 0) + 1;
    conf[r.confidence] = (conf[r.confidence] || 0) + 1;
    hor[r.horizon] = (hor[r.horizon] || 0) + 1;
    instCount += (r.instruments || []).length;
  }
  return {
    severity: sev,
    confidence: conf,
    horizon: hor,
    medianInstruments: live.length ? (instCount / live.length).toFixed(2) : 'n/a',
  };
}

// ─── Report writer ──────────────────────────────────────────────────────────

// State persistence for iteration diffs
function loadPrevState(outDir) {
  const p = path.join(outDir, '_state.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function savePrevState(outDir, cr) {
  const p = path.join(outDir, '_state.json');
  const snapshot = {
    ts: nowIso(),
    checks: cr.results.map(r => ({ id: r.id, fails: r.fails.length, total: r.total })),
  };
  fs.writeFileSync(p, JSON.stringify(snapshot, null, 2));
}
function computeDiff(prev, cr) {
  if (!prev) return null;
  const prevById = Object.fromEntries(prev.checks.map(c => [c.id, c]));
  const wentGreen = [];
  const wentRed = [];
  const stillFail = [];
  for (const r of cr.results) {
    const p = prevById[r.id];
    if (!p) continue;
    if (p.fails > 0 && r.fails.length === 0) wentGreen.push(`${r.id} (${p.fails}→0)`);
    if (p.fails === 0 && r.fails.length > 0) wentRed.push(`${r.id} (0→${r.fails.length})`);
    if (p.fails > 0 && r.fails.length > 0) stillFail.push(`${r.id} (${p.fails}→${r.fails.length})`);
  }
  return { wentGreen, wentRed, stillFail, prevTs: prev.ts };
}

function writeReport(cr, live, tombs, inWindow, allRecords) {
  const summary = cr.summarize();
  const ts = nowIso();
  const filename = `iteration-${ts.replace(/[:.]/g, '-')}.md`;
  const outDir = path.join(__dirname, 'verify');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, filename);
  const latest = path.join(outDir, 'latest.md');

  const prev = loadPrevState(outDir);
  const diff = computeDiff(prev, cr);

  const lines = [];
  lines.push(`# Verification Iteration — ${ts}`);
  lines.push('');
  lines.push(`**Mode:** ${STRICT ? 'STRICT (required-fail = non-zero exit)' : 'soft (informational)'}`);
  lines.push(`**Window:** last ${WINDOW_DAYS} days`);
  lines.push(`**Total ECON records scanned:** ${allRecords.length} (${inWindow.length} in window)`);
  lines.push(`**hasImpact=true:** ${live.length}  ·  **tombstones:** ${tombs.length}`);
  lines.push('');

  if (diff) {
    lines.push(`## Diff vs previous iteration (${diff.prevTs})`);
    lines.push('');
    if (diff.wentGreen.length) lines.push(`- ✅ went green: ${diff.wentGreen.join(', ')}`);
    if (diff.wentRed.length)   lines.push(`- ❌ went red:   ${diff.wentRed.join(', ')}`);
    if (diff.stillFail.length) lines.push(`- 🟡 still failing: ${diff.stillFail.join(', ')}`);
    if (!diff.wentGreen.length && !diff.wentRed.length && !diff.stillFail.length) {
      lines.push('- (no changes since previous iteration)');
    }
    lines.push('');
  }

  const d = distributions(live);
  lines.push('## Distributions (in window)');
  lines.push('');
  lines.push(`- severity: ${JSON.stringify(d.severity)}`);
  lines.push(`- confidence: ${JSON.stringify(d.confidence)}`);
  lines.push(`- horizon: ${JSON.stringify(d.horizon)}`);
  lines.push(`- mean instruments/record: ${d.medianInstruments}`);
  lines.push('');

  // Coverage section
  const days = new Set(allRecords.map(r => (r.generatedAt || '').slice(0, 10)).filter(Boolean));
  lines.push('## Coverage');
  lines.push('');
  lines.push(`- Distinct days with at least one ECON record: **${days.size}**`);
  lines.push(`- Target for Phase D backtest unblock: ≥30 days of ECON#THREAD# with hasImpact:true (current: ${new Set(live.map(r=>r.generatedAt.slice(0,10))).size} days hasImpact)`);
  lines.push('');

  // Check results table
  lines.push('## Required checks');
  lines.push('');
  lines.push('| ID | Check | Total | Fails | Status |');
  lines.push('|---|---|---:|---:|:--:|');
  for (const r of cr.results.filter(x => x.required)) {
    const status = r.fails.length === 0 ? 'PASS' : 'FAIL';
    lines.push(`| ${r.id} | ${r.label} | ${r.total} | ${r.fails.length} | **${status}** |`);
  }
  lines.push('');
  lines.push('## Informational checks');
  lines.push('');
  lines.push('| ID | Check | Total | Fails | Status |');
  lines.push('|---|---|---:|---:|:--:|');
  for (const r of cr.results.filter(x => !x.required)) {
    const status = r.fails.length === 0 ? 'pass' : 'soft-fail';
    lines.push(`| ${r.id} | ${r.label} | ${r.total} | ${r.fails.length} | ${status} |`);
  }
  lines.push('');

  // Failures detail
  const failed = cr.results.filter(r => r.fails.length > 0);
  if (failed.length > 0) {
    lines.push('## Failure details');
    lines.push('');
    for (const r of failed) {
      lines.push(`### ${r.id} — ${r.label} (${r.required ? 'REQUIRED' : 'informational'})`);
      lines.push('');
      const sample = r.fails.slice(0, 8);
      for (const f of sample) {
        lines.push(`- \`${(f.pk || '').replace(/^ECON#THREAD#/, '').slice(0, 60)}\` — ${f.reason}`);
      }
      if (r.fails.length > sample.length) lines.push(`- … and ${r.fails.length - sample.length} more`);
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`**Overall:** ${summary.requiredOk ? 'ALL REQUIRED CHECKS PASS' : 'SOME REQUIRED CHECKS FAILED'}`);
  lines.push('');

  fs.writeFileSync(out, lines.join('\n'));
  fs.writeFileSync(latest, lines.join('\n'));
  savePrevState(outDir, cr);
  console.log(`Report: ${out}`);
  return summary.requiredOk;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Scanning ${TABLE}...`);
  const records = ddbScan();
  console.log(`Got ${records.length} ECON records.`);
  const { cr, live, tombs, inWindow } = runChecks(records);
  const ok = writeReport(cr, live, tombs, inWindow, records);
  if (STRICT && !ok) {
    console.error('STRICT: required checks failed — exiting 1');
    process.exit(1);
  }
  process.exit(0);
}

main();
