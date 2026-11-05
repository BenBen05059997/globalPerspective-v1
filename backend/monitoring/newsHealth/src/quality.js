'use strict';

// The quality panel (monitoring/ops.json `quality`, ARCHITECTURE_OPS.md phase 3): six checks, each naming its source and its day.
// Facts only. A check whose source does not exist says {status:'not_available', why}; a source that failed says {status:'error', error};
// nothing is estimated. Built once per UTC day for the last CLOSED UTC day (`day`); the open-situations snapshot is as of the build.
const { KEYS, QUALITY, READERS } = require('./config');
const { lastDays, dayStart } = require('./days');
const { familyOf } = require('./readers');

const errText = (e) => String((e && e.message) || e).slice(0, 200);
const dayPath = (day) => day.replace(/-/g, '/');
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** The day the checks look at: the last closed UTC day. */
const qualityDay = (now) => lastDays(now, 2)[0];

const notAvailable = (source, why, extra = {}) => ({ status: 'not_available', source, why, ...extra });

/** Run one part; a throw becomes {status:'error'} naming the source. */
async function guard(source, fn, extra = {}) {
  try { return await fn(); } catch (e) { return { status: 'error', source, error: errText(e), ...extra }; }
}

function parseJsonl(text) {
  const rows = []; let unparsed = 0;
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { unparsed += 1; }
  }
  return { rows, unparsed };
}

// ---- 1. duplicate open situations, situations merged ----

const normTitle = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Open situations (not closed) sharing a normalised title AND the same country set. world = parsed world/latest.json. */
function findDuplicates(world) {
  const open = (world.situations || []).filter((s) => s.state !== 'closed');
  const groups = new Map();
  for (const s of open) {
    const title = normTitle(s.verb_label || s.title);
    if (!title) continue;
    const countries = [...new Set(s.iso3_affected || [])].sort();
    const key = `${title}|${countries.join(',')}`;
    if (!groups.has(key)) groups.set(key, { title: s.verb_label || s.title, countries, ids: [] });
    groups.get(key).ids.push(s.id);
  }
  const dup = [...groups.values()].filter((g) => g.ids.length > 1).sort((a, b) => b.ids.length - a.ids.length);
  return {
    status: 'ok', source: KEYS.world, at: world.generated_at || null,
    open: open.length, groups: dup.length, situations: sum(dup.map((g) => g.ids.length)),
    examples: dup.slice(0, QUALITY.examples),
  };
}

async function duplicatesPart(aws) {
  const r = await aws.readText(KEYS.world);
  if (!r) return notAvailable(KEYS.world, `${KEYS.world} is not there`);
  return findDuplicates(JSON.parse(r.text));
}

/** The tracker's merge files for one UTC day: situations/merges/YYYY/MM/DD/HH/HHMM.json, { at, merges:[{rule, ...}] }. */
async function mergedPart(aws, day) {
  const source = `${KEYS.mergesPrefix}${dayPath(day)}/`;
  const keys = (await aws.listKeys(source)).filter((k) => k.endsWith('.json'));
  const byRule = {}; let merged = 0; let unreadable = 0;
  for (const key of keys) {
    try {
      const r = await aws.readText(key);
      if (!r) { unreadable += 1; continue; }
      for (const m of JSON.parse(r.text).merges || []) { merged += 1; byRule[m.rule || 'unknown'] = (byRule[m.rule || 'unknown'] || 0) + 1; }
    } catch { unreadable += 1; }
  }
  return { status: 'ok', source, day, files: keys.length, merged, byRule, unreadable };
}

// ---- 2. summaries that describe their sources ----

/** entries: parsed rows of record/inbox/entries/DAY.jsonl ({title, ai:{summary}}). */
function findSelfReference(entries, examplesMax = QUALITY.examples) {
  const re = new RegExp(QUALITY.selfReference, 'i');
  let withSummary = 0; let matched = 0; const byPhrase = {}; const examples = [];
  for (const e of entries) {
    const text = e && e.ai && typeof e.ai.summary === 'string' ? e.ai.summary : null;
    if (!text) continue;
    withSummary += 1;
    const m = re.exec(text);
    if (!m) continue;
    matched += 1;
    const phrase = m[0].toLowerCase();
    byPhrase[phrase] = (byPhrase[phrase] || 0) + 1;
    if (examples.length < examplesMax) examples.push({ title: String(e.title || e.topicId || '').slice(0, 140), phrase: m[0] });
  }
  return { entries: entries.length, withSummary, matched, byPhrase, examples };
}

async function selfReferencePart(aws, day) {
  const source = `record/inbox/entries/${day}.jsonl`;
  const r = await aws.readText(source);
  if (!r) return notAvailable(source, `${source} is not there`, { day });
  const { rows, unparsed } = parseJsonl(r.text);
  return { status: 'ok', source, day, pattern: QUALITY.selfReference, unparsed, ...findSelfReference(rows) };
}

// ---- 3. pins outside their country ----

const pinsPart = (day) => notAvailable(
  'newsSituationIngest log',
  'Not available: newsSituationIngest (classifier-core storyCentroid) moves a story centroid that falls outside all of the story\'s countries onto the first country\'s centre, and writes nothing about it. Its result line ([ingest] {...}) and stories/index.json carry no count of moved centroids. Missing: one counter for "centroid snapped to country centre" in the ingest result line.',
  { day },
);

// ---- 4. forecast voids by reason, coverage gaps per day ----

const voidOrder = (a, b) => (b.reason === 'record gap') - (a.reason === 'record gap') || b.count - a.count || a.reason.localeCompare(b.reason);

/** rows: parsed record/inbox/verdicts/DAY.jsonl lines. Revision 1 (or none) is the settlement; later revisions are operator corrections. */
function countVoids(rows) {
  const first = rows.filter((r) => !r.revision || r.revision === 1);
  const results = {}; const reasons = new Map(); const gapDays = new Set();
  for (const r of first) {
    results[r.result] = (results[r.result] || 0) + 1;
    if (r.result !== 'void') continue;
    const reason = r.voidReason || r.reason || 'unknown';
    reasons.set(reason, (reasons.get(reason) || 0) + 1);
    if (reason === 'record gap') for (const d of r.gapDays || []) gapDays.add(d);
  }
  return {
    settled: first.length, results, corrections: rows.length - first.length,
    voids: sum([...reasons.values()]),
    byReason: [...reasons].map(([reason, count]) => ({ reason, count })).sort(voidOrder),
    recordGapDays: [...gapDays].sort(),
  };
}

async function voidsPart(aws, day) {
  const source = `record/inbox/verdicts/${day}.jsonl`;
  const r = await aws.readText(source);
  if (!r) return { status: 'ok', source, day, fileAbsent: true, settled: 0, results: {}, corrections: 0, voids: 0, byReason: [], recordGapDays: [] };
  const { rows, unparsed } = parseJsonl(r.text);
  return { status: 'ok', source, day, fileAbsent: false, unparsed, ...countVoids(rows) };
}

/** The resolver's own rule: a day covers a window only with a run file of status ok or partial whose archiveDay is present. */
function coverageOf(run) {
  if (!run) return 'no run file';
  if (!['ok', 'partial'].includes(run.status)) return `run status ${run.status || 'missing'}`;
  const a = run.inputs && run.inputs.archiveDay;     // 'present' | 'missing' | { thin: n } (newsStoryRecord: fewer than THIN_ENTRIES entries)
  if (a !== 'present') return `archive day ${a && typeof a === 'object' ? `thin:${a.thin}` : a || 'unknown'}`;
  return null;
}

async function coveragePart(aws, day, now) {
  const days = lastDays(now, QUALITY.coverageDays + 1).slice(0, QUALITY.coverageDays);   // the closed days ending at `day`
  const source = 'record/runs/DAY.json';
  const results = await Promise.all(days.map(async (d) => {
    try {
      const r = await aws.readText(`record/runs/${d}.json`);
      return { day: d, why: coverageOf(r ? JSON.parse(r.text) : null), read: true };
    } catch (e) { return { day: d, why: `unreadable: ${errText(e)}`, read: false }; }
  }));
  if (results.every((x) => !x.read)) return { status: 'error', source, error: results[0].why };
  return { status: 'ok', source, from: days[0], to: day, days: days.length, gaps: results.filter((x) => x.why).map(({ day: d, why }) => ({ day: d, why })) };
}

// ---- 5. source audit ----

const AUDIT_LINE = /\[audit\]\s+(\S+)\s*\|\s*(OK|DRIFT|AUDIT_ERROR)\s*\|\s*(.*)$/;
const REQUEST_ID = /\t([0-9a-f]{8}-[0-9a-f-]{27})\t/;
const DEAD_OUTLETS = 'newsSourceAudit does not look for dead outlets: it checks our cached summaries against the text of their source articles (drift) and writes only CloudWatch log lines and an SNS alert, no file. An article it cannot fetch is skipped without a log line, so unreachable outlets are not recorded anywhere. Missing: a per-outlet fetch result in its log.';

/** rows: [{ '@timestamp': '2026-11-04 11:30:36.997', '@message': '...' }] -> the latest run's verdicts, or null when there is none. */
function parseAuditRuns(rows) {
  const runs = new Map();
  for (const r of rows) {
    const message = String(r['@message'] || '').trim();
    const m = AUDIT_LINE.exec(message);
    if (!m) continue;
    const at = `${String(r['@timestamp']).replace(' ', 'T')}${String(r['@timestamp']).endsWith('Z') ? '' : 'Z'}`;
    const id = (REQUEST_ID.exec(message) || [])[1] || at.slice(0, 10);
    const run = runs.get(id) || { at, lines: [] };
    if (at > run.at) run.at = at;
    run.lines.push({ robustness: m[1], verdict: m[2], title: m[3].trim() });
    runs.set(id, run);
  }
  const latest = [...runs.values()].sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!latest) return null;
  return {
    at: latest.at, day: latest.at.slice(0, 10), checked: latest.lines.length,
    drift: latest.lines.filter((l) => l.verdict === 'DRIFT').length,
    auditErrors: latest.lines.filter((l) => l.verdict === 'AUDIT_ERROR').length,
    singleSource: latest.lines.filter((l) => l.robustness === 'single' || l.robustness === 'none').length,
    drifted: latest.lines.filter((l) => l.verdict === 'DRIFT').slice(0, QUALITY.examples).map(({ title, robustness }) => ({ title, robustness })),
  };
}

async function auditPart(aws, now) {
  const source = `${QUALITY.auditGroup} (CloudWatch Logs Insights, last ${QUALITY.auditWindowDays} days)`;
  const rows = await aws.auditLog(now - QUALITY.auditWindowDays * 86400000, now);
  const deadOutlets = notAvailable('newsSourceAudit', DEAD_OUTLETS);
  if (rows == null) return notAvailable(source, `the log group ${QUALITY.auditGroup} does not exist`, { deadOutlets });
  const run = parseAuditRuns(rows);
  if (!run) return notAvailable(source, `no newsSourceAudit run in the last ${QUALITY.auditWindowDays} days (it runs Mon, Wed, Fri; or its log lines are gone)`, { deadOutlets });
  return { status: 'ok', source, ...run, deadOutlets };
}

// ---- 6. client errors by page ----

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const pageOf = (url) => {
  try { return familyOf(new URL(url).pathname); } catch { return 'unknown'; }
};

/** rows: [{ day, count, url }] projected from the error sink table (no message, stack, user agent, uid or email). */
function errorsByPage(rows, day) {
  const base = lastDays(dayStart(day) - 86400000, QUALITY.errorsBaselineDays);   // the 14 days before `day`
  const labels = Object.fromEntries([...READERS.families, READERS.otherFamily].map((f) => [f.id, f.label]));
  labels.unknown = 'Unknown page (no URL)';
  const pages = new Map();
  let total = 0;
  const totalBase = Object.fromEntries(base.map((d) => [d, 0]));
  for (const r of rows) {
    const n = Number(r.count) || 0;
    const inBase = r.day in totalBase;
    if (r.day !== day && !inBase) continue;
    const id = r.url ? pageOf(r.url) : 'unknown';
    const p = pages.get(id) || { id, label: labels[id] || id, day: 0, perDay: Object.fromEntries(base.map((d) => [d, 0])) };
    if (r.day === day) { p.day += n; total += n; } else { p.perDay[r.day] += n; totalBase[r.day] += n; }
    pages.set(id, p);
  }
  const out = [...pages.values()].map((p) => ({ id: p.id, label: p.label, day: p.day, median: median(Object.values(p.perDay)) }))
    .filter((p) => p.day > 0 || p.median > 0)
    .sort((a, b) => b.day - a.day || b.median - a.median || a.id.localeCompare(b.id));
  return { total, median: median(Object.values(totalBase)), baselineFrom: base[0], baselineTo: base[base.length - 1], pages: out.slice(0, QUALITY.errorsTopPages), pagesOmitted: Math.max(0, out.length - QUALITY.errorsTopPages) };
}

async function clientErrorsPart(aws, day) {
  const source = `DynamoDB ${QUALITY.errorsTable} (attributes day, count, sampleUrl)`;
  const rows = await aws.clientErrorRows();
  return {
    status: 'ok', source, day, rows: rows.length,
    note: 'Count is every hit of an error that day; its page is the URL of the first hit of that error (the sink keeps one sample URL per error and day). The table keeps 30 days.',
    ...errorsByPage(rows, day),
  };
}

// ---- the section ----

const CHECK_IDS = ['situations', 'selfReference', 'pins', 'forecast', 'sourceAudit', 'clientErrors'];

/** True when this check, or one of its parts, failed to read its source (status 'error'; not_available is a fact, not a failure). */
const failed = (c) => !!c && (c.status === 'error' || Object.values(c).some((v) => v && typeof v === 'object' && v.status === 'error'));

/** True when a pull is due: nothing built for the current check day, or a check of that day is in error (retried hourly, alone). */
function qualityPullDue(prev, now) {
  const q = prev && prev.quality;
  if (!q || q.day !== qualityDay(now) || !q.checks) return true;
  return CHECK_IDS.some((id) => !q.checks[id] || failed(q.checks[id]));
}

/**
 * The daily pull. prev = the earlier ops.json `quality` section: its checks of the same day that did not fail are kept as they were,
 * only missing or failed ones are read again. aws ports: readText, listKeys, clientErrorRows, auditLog. Never throws.
 */
async function pullQuality({ aws, now, prev }) {
  const day = qualityDay(now);
  const kept = prev && prev.day === day && prev.checks ? prev.checks : {};
  const want = (id, make) => (kept[id] && !failed(kept[id]) ? Promise.resolve(kept[id]) : make());
  const [situations, selfReference, forecast, sourceAudit, clientErrors] = await Promise.all([
    want('situations', async () => {
      const [duplicates, merged] = await Promise.all([guard(KEYS.world, () => duplicatesPart(aws)), guard(`${KEYS.mergesPrefix}${dayPath(day)}/`, () => mergedPart(aws, day), { day })]);
      return { duplicates, merged };
    }),
    want('selfReference', () => guard(`record/inbox/entries/${day}.jsonl`, () => selfReferencePart(aws, day), { day })),
    want('forecast', async () => {
      const [voids, coverage] = await Promise.all([guard(`record/inbox/verdicts/${day}.jsonl`, () => voidsPart(aws, day), { day }), guard('record/runs/DAY.json', () => coveragePart(aws, day, now))]);
      return { voids, coverage };
    }),
    want('sourceAudit', () => guard(QUALITY.auditGroup, () => auditPart(aws, now))),
    want('clientErrors', () => guard(QUALITY.errorsTable, () => clientErrorsPart(aws, day), { day })),
  ]);
  return { day, checks: { situations, selfReference, pins: pinsPart(day), forecast, sourceAudit, clientErrors }, pulledAt: new Date(now).toISOString() };
}

const NOTE = `Checks look at the last closed UTC day (the day named on each); the open-situations snapshot is as of the build. Built once a UTC day; a check that could not read its source is retried hourly. A source that does not exist says so and names what is missing; nothing here is estimated.`;

/** pull: null when not due this run (the earlier section stays), else pullQuality's answer. Null when nothing was ever built. */
function buildQuality({ pull, prev, now }) {
  if (!pull) return (prev && prev.quality) || null;
  return { asOf: new Date(now).toISOString(), pulledAt: pull.pulledAt, day: pull.day, note: NOTE, checks: pull.checks };
}

module.exports = {
  qualityDay, qualityPullDue, pullQuality, buildQuality, CHECK_IDS,
  findDuplicates, findSelfReference, countVoids, coverageOf, parseAuditRuns, errorsByPage, median, parseJsonl,
  duplicatesPart, mergedPart, selfReferencePart, voidsPart, coveragePart, auditPart, clientErrorsPart, pinsPart,
};
