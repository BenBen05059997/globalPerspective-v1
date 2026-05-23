#!/usr/bin/env node
// Pick 5 ECON# records from production DDB for human spot-check review.
//
// Stratified: 2 severe / 2 moderate / 1 minor. Buckets that fall short are
// topped up from the next-largest bucket so the reviewer always gets 5 records
// (or all available if total < 5).
//
// Usage:
//   node quality/pick_weekly_review.js [--week 2026-21] [--out path.md] [--n 5]
//
// Reads DDB via the AWS CLI — assumes the CLI is configured. No npm deps.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TABLE = 'SummarizeAndPredict';
const REGION = 'ap-northeast-1';
const THREAD_SK = 'THREAD_ANALYSIS';

// ─── args ─────────────────────────────────────────────────────────────────────
function arg(name, def) {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${name}`);
  return i >= 0 ? a[i + 1] : def;
}

const week = arg('week', currentIsoWeek());
const n = parseInt(arg('n', '5'), 10);
const outPath = arg('out', path.join('quality', 'reviews', `${week}.md`));

// ─── ISO week ─────────────────────────────────────────────────────────────────
function currentIsoWeek(d = new Date()) {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

// ─── DDB helpers (shell out to aws cli; unmarshal types) ─────────────────────
function awsJson(cmd) {
  const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(raw);
}

function unmarshal(attr) {
  if (attr == null) return null;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr) return attr.L.map(unmarshal);
  if ('M' in attr) {
    const out = {};
    for (const [k, v] of Object.entries(attr.M)) out[k] = unmarshal(v);
    return out;
  }
  if ('SS' in attr) return attr.SS;
  if ('NS' in attr) return attr.NS.map(Number);
  return null;
}

function unmarshalItem(item) {
  const out = {};
  for (const [k, v] of Object.entries(item)) out[k] = unmarshal(v);
  return out;
}

function scanAllEconRecords() {
  const filter = "begins_with(PK, :p) AND SK = :s AND hasImpact = :h";
  const values = JSON.stringify({
    ':p': { S: 'ECON#THREAD#' },
    ':s': { S: 'ECONOMIC_IMPACT' },
    ':h': { BOOL: true },
  });
  const items = [];
  let startKey = null;
  do {
    const startArg = startKey ? ` --exclusive-start-key '${JSON.stringify(startKey)}'` : '';
    const cmd = `aws dynamodb scan --table-name ${TABLE} --region ${REGION} ` +
      `--filter-expression "${filter}" ` +
      `--expression-attribute-values '${values}'${startArg} --output json`;
    const resp = awsJson(cmd);
    for (const it of (resp.Items || [])) items.push(unmarshalItem(it));
    startKey = resp.LastEvaluatedKey || null;
  } while (startKey);
  return items;
}

function getThreadAnalysis(threadId) {
  try {
    const key = JSON.stringify({
      PK: { S: `THREAD#${threadId}` },
      SK: { S: THREAD_SK },
    });
    const cmd = `aws dynamodb get-item --table-name ${TABLE} --region ${REGION} ` +
      `--key '${key}' --output json`;
    const resp = awsJson(cmd);
    return resp.Item ? unmarshalItem(resp.Item) : null;
  } catch {
    return null;
  }
}

// ─── stratified sampler ───────────────────────────────────────────────────────
const TARGET = { severe: 2, moderate: 2, minor: 1 };

function pickStratified(records, totalNeeded) {
  const buckets = { severe: [], moderate: [], minor: [] };
  for (const r of records) {
    if (buckets[r.severity]) buckets[r.severity].push(r);
  }
  // Shuffle each bucket
  for (const k of Object.keys(buckets)) shuffle(buckets[k]);

  const picked = [];
  // First pass — take target counts where available
  for (const [sev, want] of Object.entries(TARGET)) {
    const take = Math.min(want, buckets[sev].length);
    for (let i = 0; i < take; i++) picked.push(buckets[sev].shift());
  }
  // Top up if short — pull from any remaining bucket, preferring severe→moderate→minor
  const remaining = [...buckets.severe, ...buckets.moderate, ...buckets.minor];
  while (picked.length < totalNeeded && remaining.length > 0) {
    picked.push(remaining.shift());
  }
  return picked;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ─── markdown rendering ───────────────────────────────────────────────────────
function fmtInstruments(insts = []) {
  return insts.map(i => `\`${i.instrumentId} ${arrow(i.direction)} ${i.magnitude || ''}\``.trim()).join(', ');
}
function arrow(d) {
  if (d === 'up') return '↑';
  if (d === 'down') return '↓';
  if (d === 'mixed') return '↕';
  return '·';
}
function fmtEntities(list = []) {
  return list.map(e => `${e.name} (${e.type})`).join(', ');
}
function fmtAnalog(a) {
  if (!a?.event) return '—';
  return `${a.event}${a.year ? ` (${a.year})` : ''}`;
}
function fmtAutoJudge(r) {
  if (!r.qualityScores) return 'not yet judged';
  const scores = JSON.stringify(r.qualityScores);
  return `${scores} · is_low_quality: \`${r.is_low_quality}\``;
}

function renderRecord(idx, record, threadAnalysis) {
  const ta = threadAnalysis || {};
  return `## Record ${idx + 1} — ${record.headline || '(no headline)'}

- **ID:** \`${record.PK}\`
- **Severity:** ${record.severity} (score ${record.severityScore ?? '—'}) · **Confidence:** ${record.confidence || '—'} · **Horizon:** ${record.horizon || '—'}
- **Generated at:** ${record.generatedAt || '—'}
- **Auto-judge:** ${fmtAutoJudge(record)}

**Thread:** ${ta.threadTitle || record.scopeId || '(no thread analysis)'}
**Story arc:** ${(ta.storyArc || '').slice(0, 500) || '(none)'}

**Instruments:** ${fmtInstruments(record.instruments) || '—'}
**Mechanism:** ${record.mechanism || '—'}
**Analog:** ${fmtAnalog(record.historicalAnalog)}
**Winners:** ${fmtEntities(record.winners) || '—'}
**Losers:** ${fmtEntities(record.losers) || '—'}
**Cited topicIds:** ${(record.citedTopicIds || []).join(', ') || '(none)'}

### Review

1. **Headline accurate?** \`[Y / N / partial]\`
   Notes:

2. **Direction calls correct?** \`[all correct / some wrong / all wrong]\`
   Notes:

3. **Mechanism makes sense?** \`[yes / mostly / partly / no]\`
   Notes:

4. **Historical analog appropriate?** \`[good fit / weak / wrong / not in catalog and shouldn't be cited]\`
   Notes:

5. **Severity calibrated?** \`[right / too high / too low]\`
   Notes:

6. **Any hallucinations or BS?** \`[none / minor / moderate / severe]\`
   Notes:

7. **Would you publish on a paid newsletter?** \`[yes / yes-with-edits / no]\`
   Notes:

**Overall grade:** \`[A / B / C / D / F]\`

**Free-form notes:**


---
`;
}

// ─── main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log(`Scanning ${TABLE} for ECON# records…`);
  const all = scanAllEconRecords();
  console.log(`Found ${all.length} hasImpact:true records.`);

  if (all.length === 0) {
    console.error('No records to review. Aborting.');
    process.exit(1);
  }

  const picked = pickStratified(all, n);
  console.log(`Picked ${picked.length} records (stratified):`);
  for (const r of picked) console.log(`  - [${r.severity}] ${r.headline?.slice(0, 70)}`);

  console.log('Fetching thread analyses for context…');
  const enriched = picked.map(rec => ({
    record: rec,
    thread: rec.scopeId ? getThreadAnalysis(rec.scopeId) : null,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const header = `# Human spot-check — week ${week}

> Generated by \`quality/pick_weekly_review.js\` on ${today}.
> Rubric: [\`ECONOMIC_DISRUPTION_QUALITY_PLAN.md\`](../../ECONOMIC_DISRUPTION_QUALITY_PLAN.md) §Layer 4.
> ${picked.length} records — stratification target 2 severe / 2 moderate / 1 minor (top-ups OK).

---

`;
  const body = enriched.map((e, i) => renderRecord(i, e.record, e.thread)).join('\n');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, header + body, 'utf8');
  console.log(`\nWrote ${outPath}`);
  console.log(`Open it, fill in the rubric, then run: node quality/build_dashboard.js`);
}

main();
