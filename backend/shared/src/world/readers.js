'use strict';

// The readers: one function per raw row type. Each takes the injected client first (client.js), returns plain
// normalised objects and never throws on a missing row (a missing item is null / absent / listed in missingDays).
// A read error from the client is never turned into "no data": it propagates.
// Row shapes were checked against live rows 2026-10-20; the README table lists every field.

const { keepDayZero, utcDay } = require('../dayZero');
const { tierFromScore } = require('./tier');
const { day, isDay, eachDay } = require('./dates');
const { need } = require('./client');

const DEFAULT_TABLES = { cache: 'NewsCache', world: 'SummarizeAndPredict', predictions: 'GlobalPerspectivePredictionLog' };

/** Table names: live defaults, then opts.env (TOPICS_DDB_TABLE, SUMMARIZE_PREDICT_TABLE, PREDICTION_LOG_TABLE), then opts.tables. */
function resolveTables(opts = {}) {
  const env = opts.env || {};
  return {
    ...DEFAULT_TABLES,
    ...(env.TOPICS_DDB_TABLE ? { cache: env.TOPICS_DDB_TABLE } : {}),
    ...(env.SUMMARIZE_PREDICT_TABLE ? { world: env.SUMMARIZE_PREDICT_TABLE } : {}),
    ...(env.PREDICTION_LOG_TABLE ? { predictions: env.PREDICTION_LOG_TABLE } : {}),
    ...(opts.tables || {}),
  };
}

// ---- small normalisers -------------------------------------------------------------------------------------------
const num = (x) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (typeof x === 'string' && x.trim() ? x.trim() : null);
const strs = (x) => arr(x).filter((v) => typeof v === 'string' && v.trim());
const inRange = (d, from, to) => !!d && (!from || d >= from) && (!to || d <= to);

// ---- provenance --------------------------------------------------------------------------------------------------
// Every object a reader returns names the raw row it came from (ARCHITECTURE_TIMELINE §2): sourceRow = { store, key:
// {exact DynamoDB key or S3 key}, index? } and sourceKey, a stable string (README "Provenance" lists each format).
const S = { cache: 'NewsCache', world: 'SummarizeAndPredict', predictions: 'GlobalPerspectivePredictionLog', s3: 'S3' };
const ddbKey = (r) => ({ PK: String(r.PK), SK: String(r.SK) });
const prov = (store, key, sourceKey, index) => ({ sourceRow: { store, key, ...(index === undefined ? {} : { index }) }, sourceKey });
const rowProv = (store, r, index) => prov(store, ddbKey(r), `${r.PK}|${r.SK}`, index);

/** Run fn over items, at most n at a time, keeping order. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next; next += 1; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// ---- archive#<date> ----------------------------------------------------------------------------------------------
// NewsCache { id:'archive#YYYY-MM-DD', entries:[{topicId, threadId, title, category, regions[], iso3[], actors[],
//   event_type, sources:[{source,title,url,tier,outletCountry,outletType,snippet,age,publishedAt?,outlet?}], archivedAt, generationId,
//   continues_topic?, ai:{...}}], updatedAt, ttl }. Writer: NewsProjectInvokeAgentLambda (buildArchiveEntry).

const source = (s) => ({
  source: str(s && s.source) || '', title: str(s && s.title), url: str(s && s.url), tier: str(s && s.tier),
  outletCountry: str(s && s.outletCountry), outletType: str(s && s.outletType), snippet: str(s && s.snippet),
  // Written by newsInvokeGemini since f03ab32b (2026-10-20): the feed's publication time (raw string, not validated here) and the outlet display name.
  publishedAt: str(s && s.publishedAt), outlet: str(s && s.outlet),
});

function entry(e, date, withAi, rowId, index) {
  const topicId = str(e.topicId) || str(e.id);
  // topicId is `title-<rank>` (unstable), so the key adds the generation (archivedAt when the entry has none).
  const gen = str(e.generationId) || str(e.archivedAt) || '';
  return {
    ...prov(S.cache, { id: rowId }, `${rowId}|${gen}|${topicId}`, index),
    date, archive: `archive#${date}`,
    topicId, threadId: str(e.threadId), title: str(e.title) || '',
    category: str(e.category), regions: strs(e.regions), iso3: strs(e.iso3), actors: strs(e.actors),
    eventType: str(e.event_type), archivedAt: str(e.archivedAt), generationId: str(e.generationId),
    continuesTopic: str(e.continues_topic),
    sources: arr(e.sources).filter((s) => s && typeof s === 'object').map(source),
    ...(withAi ? { ai: e.ai || null } : {}),
  };
}

// index = position in the raw item's `entries` array BEFORE any filtering. `kept` (today-archive) is the subset
// keepDayZero left of `raw`; its objects are the raw ones, so the raw position is found by identity.
function entriesOf(raw, kept, date, withAi, rowId) {
  const all = arr(raw);
  return arr(kept || raw).map((e) => [e, all.indexOf(e)]).filter(([e]) => e && typeof e === 'object').map(([e, i]) => entry(e, date, withAi, rowId, i));
}

/**
 * One archive day -> { date, updatedAt, source:'archive'|'today-archive', entries } or null when the day has no row.
 * opts.nowMs (only for the current UTC day): add the `today-archive` entries archived today (dayZero rule) that the
 * day row does not hold yet, and serve them alone when the day row is missing. opts.withAi keeps entry.ai.
 */
async function archiveDay(client, date, opts = {}) {
  if (!isDay(date)) throw new Error('archiveDay needs a YYYY-MM-DD date');
  const t = resolveTables(opts);
  const row = await need(client, 'getItem')(t.cache, { id: `archive#${date}` });
  let entries = entriesOf(row && row.entries, null, date, opts.withAi, `archive#${date}`);
  let src = 'archive';
  if (Number.isFinite(opts.nowMs) && date === utcDay(opts.nowMs)) {
    const today = await client.getItem(t.cache, { id: 'today-archive' });
    const have = new Set(entries.map((e) => e.topicId));
    const extra = entriesOf(today && today.entries, keepDayZero(today && today.entries, opts.nowMs), date, opts.withAi, 'today-archive').filter((e) => !have.has(e.topicId));
    if (!row && extra.length) src = 'today-archive';
    entries = entries.concat(extra);
  }
  if (!row && src === 'archive') return null;
  return { date, updatedAt: str(row && row.updatedAt), source: src, entries };
}

/**
 * An archive day from raw entries instead of the DynamoDB row (the entries inbox, decision 0051): the same shape archiveDay answers for a
 * day row, with the same provenance (`archive#DATE`, position in the list), so a fact built from it is byte-identical to the one built
 * from the row. `updatedAt` is when the list was last written. No day-zero extras (those come from the `today-archive` item).
 */
function archiveDayOfEntries(date, rawEntries, { updatedAt = null, withAi = false } = {}) {
  if (!isDay(date)) throw new Error('archiveDayOfEntries needs a YYYY-MM-DD date');
  return { date, updatedAt: str(updatedAt), source: 'archive', entries: entriesOf(rawEntries, null, date, withAi, `archive#${date}`) };
}

/** Archive days from..to inclusive -> { from, to, days:[{date, entries, ...}] (days that exist, ascending), missingDays:[date] }. */
async function archiveRange(client, from, to, opts = {}) {
  const dates = eachDay(from, to);
  const rows = await pool(dates, 4, (d) => archiveDay(client, d, opts));
  return { from, to, days: rows.filter(Boolean), missingDays: dates.filter((_, i) => !rows[i]) };
}

// ---- THREAD#<id> / THREAD_ANALYSIS -------------------------------------------------------------------------------
// SummarizeAndPredict { PK, SK:'THREAD_ANALYSIS', threadId, threadTitle, riskScore, lead, trajectory, dimensions{axis:
//   {score,why}}, keyActors:[{name,role,mentionCount}], iso3[] (absent on older rows), entryCount, entryTopicIds[],
//   generatedAt, ttl }. Writer: newsThreadAnalysis. No `type` field exists.

function analysis(r) {
  const score = num(r.riskScore);
  const threadId = str(r.threadId) || String(r.PK || '').replace(/^THREAD#/, '');
  return {
    ...rowProv(S.world, r),
    threadId, title: str(r.threadTitle), riskScore: score, tier: tierFromScore(score), lead: str(r.lead),
    trajectory: str(r.trajectory), iso3: strs(r.iso3), dimensions: r.dimensions || null,
    keyActors: arr(r.keyActors).map((a) => (typeof a === 'string' ? { name: a, role: null, mentionCount: null } : { name: str(a && a.name), role: str(a && a.role), mentionCount: num(a && a.mentionCount) })).filter((a) => a.name),
    entryCount: num(r.entryCount), entryTopicIds: strs(r.entryTopicIds), generatedAt: str(r.generatedAt),
    asOfDay: day(r.generatedAt) || null, ttl: num(r.ttl),
  };
}

/** Analyses of the given threads -> { [threadId]: analysis }; threads without a row are absent. opts.nowMs drops rows whose TTL has passed (TTL deletion lags). */
async function threadAnalysis(client, threadIds, opts = {}) {
  const ids = [...new Set(arr(threadIds).filter((id) => typeof id === 'string' && id))];
  if (!ids.length) return {};
  const rows = await need(client, 'batchGet')(resolveTables(opts).world, ids.map((id) => ({ PK: `THREAD#${id}`, SK: 'THREAD_ANALYSIS' })));
  return threadAnalysisOfRows(rows, opts);
}

/** The same normalisation for rows already read (THREAD_ANALYSIS-shaped, e.g. built from the record's story views, recordReads.js) -> { [threadId]: analysis }. */
function threadAnalysisOfRows(rows, opts = {}) {
  const out = {};
  for (const r of arr(rows)) {
    if (!r) continue;
    const a = analysis(r);
    if (!a.threadId) continue;
    if (Number.isFinite(opts.nowMs) && a.ttl !== null && a.ttl * 1000 < opts.nowMs) continue;
    out[a.threadId] = a;
  }
  return out;
}

// ---- THREAD_HISTORY# and COUNTRY# HISTORY# -----------------------------------------------------------------------
// THREAD#<id>/THREAD_HISTORY#<date>  { dateKey, riskScore, trajectory, threadTitle, lead, dimensions, entryCount, generatedAt, ttl }
// COUNTRY#<name>/HISTORY#<date>      { dateKey, riskScore, riskLevel, trajectory, headline, generatedAt, ttl }
// A history point is a score: rows without a finite riskScore or a date are dropped.

function points(rows, prefix, from, to, shape) {
  return rows
    .map((r) => ({ date: str(r.dateKey) || String(r.SK || '').slice(prefix.length), score: num(r.riskScore), r }))
    .filter((p) => isDay(p.date) && p.score !== null && inRange(p.date, from, to))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((p) => ({ ...rowProv(S.world, p.r), date: p.date, score: p.score, tier: tierFromScore(p.score), trajectory: str(p.r.trajectory), generatedAt: str(p.r.generatedAt), ...shape(p.r) }));
}

/** Daily scores of a thread, ascending, optionally from..to (inclusive) -> [{date, score, tier, trajectory, title, lead, dimensions, generatedAt}]. */
async function threadHistory(client, threadId, from, to, opts = {}) {
  const rows = await need(client, 'query')(resolveTables(opts).world, `THREAD#${threadId}`, 'THREAD_HISTORY#');
  return points(rows, 'THREAD_HISTORY#', from, to, (r) => ({ title: str(r.threadTitle), lead: str(r.lead), dimensions: r.dimensions || null }));
}

/** Daily scores of a country (name as stored, e.g. 'Iran') -> [{date, score, tier, level, trajectory, headline, generatedAt}]. `level` is the stored riskLevel word; `tier` is always from the score. */
async function countryHistory(client, country, from, to, opts = {}) {
  const rows = await need(client, 'query')(resolveTables(opts).world, `COUNTRY#${country}`, 'HISTORY#');
  return points(rows, 'HISTORY#', from, to, (r) => ({ level: str(r.riskLevel), headline: str(r.headline) }));
}

// ---- DRIFT# and DRIFTLOG# ----------------------------------------------------------------------------------------
// THREAD#<id> or COUNTRY#<name> / DRIFT#<date> (60 d TTL) and DRIFTLOG#<date> (same body, no TTL). Writer:
// newsDriftCorrector (putDriftNote writes both). Body: asOf, since, changeScore{from,to,delta}, changeLevel{from,to}?,
// changeDimensions{axis:{from,to,delta}}?, priorTitle/currentTitle (thread) or priorHeadline/currentHeadline (country),
// triggerEvent{date,topicId,title}?, whyChanged, noSingleDriver, directionFlag?, generatedAt, emailedAt? (country).

function drift(r, kind) {
  const sk = String(r.SK || '');
  const link = sk.startsWith('DRIFTLOG#') ? 'DRIFTLOG' : 'DRIFT';
  const cs = r.changeScore && typeof r.changeScore === 'object' ? { from: num(r.changeScore.from), to: num(r.changeScore.to), delta: num(r.changeScore.delta) } : null;
  const te = r.triggerEvent && typeof r.triggerEvent === 'object' ? { date: str(r.triggerEvent.date), topicId: str(r.triggerEvent.topicId), title: str(r.triggerEvent.title) } : null;
  const date = sk.slice(sk.indexOf('#') + 1);
  return {
    // sourceKey names the note, not the row: DRIFT# and DRIFTLOG# of one date are one note, so it stays the same
    // whichever of them is read. sourceRow is the row the note was taken from; sourceRows lists every row merged.
    ...prov(S.world, ddbKey(r), `${r.PK}|DRIFT#${date}`),
    sourceRows: [ddbKey(r)],
    subject: kind === 'thread' ? { kind, id: String(r.PK).slice('THREAD#'.length) } : { kind, id: String(r.PK).slice('COUNTRY#'.length) },
    date, asOf: str(r.asOf), since: str(r.since), source: link,
    whyChanged: str(r.whyChanged) || '', noSingleDriver: r.noSingleDriver === true,
    changeScore: cs, changeLevel: r.changeLevel || null, changeDimensions: r.changeDimensions || null,
    prior: str(r.priorTitle) || str(r.priorHeadline), current: str(r.currentTitle) || str(r.currentHeadline),
    triggerEvent: te && (te.topicId || te.title) ? te : null, directionFlag: r.directionFlag || null,
    generatedAt: str(r.generatedAt),
  };
}

/**
 * Drift notes of one thread ({threadId}) or country ({country}), ascending by date, optionally from..to.
 * DRIFT# and DRIFTLOG# carry the same note: one result per date, DRIFTLOG# (permanent) preferred, DRIFT# when the
 * log row is absent. `date` is the date in the sort key.
 */
async function driftNotes(client, subject, from, to, opts = {}) {
  const isThread = !!(subject && subject.threadId);
  if (!isThread && !(subject && subject.country)) throw new Error('driftNotes needs {threadId} or {country}');
  const kind = isThread ? 'thread' : 'country';
  const pk = isThread ? `THREAD#${subject.threadId}` : `COUNTRY#${subject.country}`;
  const rows = await need(client, 'query')(resolveTables(opts).world, pk, 'DRIFT');
  const byDate = new Map();
  for (const r of rows) {
    const note = drift(r, kind);
    if (!isDay(note.date) || !inRange(note.date, from, to)) continue;
    const had = byDate.get(note.date);
    if (!had) { byDate.set(note.date, note); continue; }
    const keep = note.source === 'DRIFTLOG' && had.source !== 'DRIFTLOG' ? note : had;
    keep.sourceRows = [...had.sourceRows, ...note.sourceRows].sort((a, b) => (a.SK < b.SK ? -1 : 1));
    byDate.set(note.date, keep);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---- PRED# scenarios ---------------------------------------------------------------------------------------------
// GlobalPerspectivePredictionLog { PK:'PRED#<topicId>', SK:'<YYYY-MM-DD>', topicId, title, threadId?, generatedAt,
//   model, questionSchema?, scenarios:[{label, probability (0..1), probabilityRange:'55-65%', horizon, rationale,
//   scoreable, triggers:[{id:'<si>-<ti>', text, deadline, status, question?, qid?, p? (PERCENT 0..100), resolutionSource?,
//   resolver?}]}] }. Writer: NewsProjectInvokeAgentLambda (first snapshot of a topic per day wins). Older rows have no
// questionSchema/threadId and triggers without p/qid/resolutionSource.

const trigger = (t, i, si) => ({
  id: str(t && t.id) || `${si}-${i}`, trigger: str(t && t.text) || '', due: str(t && t.deadline), p: num(t && t.p),
  resolutionSource: str(t && t.resolutionSource) || str(t && t.resolution_source), question: t && typeof t.question === 'boolean' ? t.question : null,
  qid: str(t && t.qid), status: str(t && t.status),
});

function snapshot(r) {
  const pk = String(r.PK);
  return {
    ...rowProv(S.predictions, r),
    pk, topicId: str(r.topicId) || pk.slice('PRED#'.length), date: String(r.SK), threadId: str(r.threadId), title: str(r.title),
    generatedAt: str(r.generatedAt), model: str(r.model), questionSchema: r.questionSchema === 1 || r.questionSchema === true,
    scenarios: arr(r.scenarios).map((s, si) => ({
      ...prov(S.predictions, ddbKey(r), `${r.PK}|${r.SK}|${si}`, si),
      index: si, label: str(s && s.label), probability: num(s && s.probability) === null ? null : Math.round(num(s.probability) * 1000) / 10,
      probabilityRange: str(s && s.probabilityRange), horizon: str(s && s.horizon), rationale: str(s && s.rationale),
      scoreable: !!(s && s.scoreable), triggers: arr(s && s.triggers).map((t, ti) => trigger(t, ti, si)),
    })),
  };
}

/**
 * Forecast snapshots (one per PRED# row) -> [snapshot], ascending by date then pk.
 *   {topicIds}          the PRED#<topicId> partitions of those topics
 *   {threadId}          the thread's topics from THREAD#<id>/TOPICS (+ any {topicIds} given, e.g. its archive topics);
 *                       a row that names another thread is dropped
 *   {from, to}          every PRED# row dated in the range (the one bounded scan; needs client.scan)
 * {from, to} also narrows the first two. snapshot.scenarios[].probability and triggers[].p are PERCENT (0..100).
 */
async function scenarios(client, by = {}, opts = {}) {
  const t = resolveTables(opts);
  const { threadId, from, to } = by;
  let ids = strs(by.topicIds);
  if (threadId) {
    const ptr = await need(client, 'getItem')(t.world, { PK: `THREAD#${threadId}`, SK: 'TOPICS' });
    ids = ids.concat(strs(ptr && ptr.topicIds), ptr && ptr.topicId ? [ptr.topicId] : []);
  }
  let rows;
  if (threadId || by.topicIds) {
    ids = [...new Set(ids)];
    rows = (await pool(ids, 4, (id) => client.query(t.predictions, `PRED#${id}`))).flat();
  } else if (from && to) {
    rows = await need(client, 'scan')(t.predictions, { expression: 'begins_with(PK, :p) AND SK BETWEEN :f AND :t', values: { ':p': 'PRED#', ':f': from, ':t': to } });
  } else {
    throw new Error('scenarios needs {topicIds}, {threadId} or {from, to}');
  }
  return snapshotsOfRows(rows, { threadId, from, to });
}

/**
 * PRED# rows (from the table or replayed from the forecasts inbox, decision 0052) -> [snapshot], the filter and order of scenarios():
 * rows that are not a day's PRED# row or lie outside {from, to} are dropped, a row naming another thread than `threadId` too.
 */
function snapshotsOfRows(rows, { threadId, from, to } = {}) {
  return rows
    .filter((r) => r && String(r.PK).startsWith('PRED#') && isDay(String(r.SK)) && inRange(String(r.SK), from, to))
    .filter((r) => !threadId || !r.threadId || r.threadId === threadId)
    .map(snapshot)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pk < b.pk ? -1 : a.pk > b.pk ? 1 : 0));
}

// ---- Q#<qid> / VERDICT, VERDICT#<n> ------------------------------------------------------------------------------
// GlobalPerspectivePredictionLog { PK:'Q#<qid>', SK:'VERDICT'|'VERDICT#<n>', qid, verdict:'yes'|'no'|'void', decidedAt,
//   decidedBy, confirmedBy, evidence{url,quote}?, voidReason?, reason? (operator corrections), draftSk? }. Writer:
//   newsPredictionResolver. VERDICT is number 1; each correction appends VERDICT#2, #3...; the HIGHEST number wins
//   (same rule as questionBoard.js). No verdict rows existed live on 2026-10-20; the shape is from the resolver.

const verdictOrder = (sk) => { const m = /^VERDICT#(\d+)$/.exec(String(sk)); return sk === 'VERDICT' ? 1 : m ? Number(m[1]) : 0; };

const verdictRow = (r) => ({
  ...rowProv(S.predictions, r),
  qid: str(r.qid) || String(r.PK).slice('Q#'.length), n: verdictOrder(r.SK), sk: String(r.SK), verdict: str(r.verdict), decidedAt: str(r.decidedAt),
  decidedBy: str(r.decidedBy), reason: str(r.reason), voidReason: str(r.voidReason), evidence: r.evidence || null,
});

/**
 * Latest verdict per question -> { [qid]: { ...latest, all:[every verdict row, ascending n] } }; questions without a
 * verdict are absent. opts.asOf (a day) ignores verdicts decided after that day.
 */
async function verdicts(client, qids, opts = {}) {
  const t = resolveTables(opts);
  const ids = [...new Set(arr(qids).filter((q) => typeof q === 'string' && q))];
  const lists = await pool(ids, 4, (qid) => need(client, 'query')(t.predictions, `Q#${qid}`, 'VERDICT'));
  const out = {};
  ids.forEach((qid, i) => {
    const all = lists[i].map(verdictRow).filter((v) => v.n > 0 && (!opts.asOf || day(v.decidedAt) <= opts.asOf)).sort((a, b) => a.n - b.n);
    if (all.length) out[qid] = { ...all[all.length - 1], all };
  });
  return out;
}

// ---- Q#<qid> / SAMPLED -------------------------------------------------------------------------------------------
// GlobalPerspectivePredictionLog { PK:'Q#<qid>', SK:'SAMPLED', qid, question, triggerId:'<si>-<ti>', clusterKey (a
//   thread id 'thread-...' or another cluster key), deadline:'YYYY-MM-DD', issuedAt, drawnAt, weekId, hash, storyTitle,
//   resolutionSource, pk:'PRED#<topicId>-<n>' and sk:'<date>' (the forecast row it was drawn from, lower-case names) }.
//   Writer: newsPredictionResolver (sampler). Immutable. The questions are deliberately blind: there is no
//   probability on the row and none is returned.

const THREAD_ID = /^thread-/;

function sampled(r) {
  const qid = str(r.qid) || String(r.PK).slice('Q#'.length);
  const clusterKey = str(r.clusterKey);
  const deadline = str(r.deadline);
  return {
    ...prov(S.predictions, { PK: `Q#${qid}`, SK: 'SAMPLED' }, `Q#${qid}|SAMPLED`),
    qid, threadId: clusterKey && THREAD_ID.test(clusterKey) ? clusterKey : null, clusterKey,
    question: str(r.question) || str(r.text), deadline: deadline && isDay(deadline.slice(0, 10)) ? deadline.slice(0, 10) : null,
    issuedAt: str(r.issuedAt), resolutionSource: str(r.resolutionSource), triggerId: str(r.triggerId),
    pred: { PK: str(r.pk), SK: str(r.sk) },
  };
}

/**
 * Sampled forecast questions -> [question], ascending by deadline then qid. Never returns a probability.
 *   {qids}      BatchGet of Q#<qid>/SAMPLED (qids that were never sampled are absent)
 *   (no qids)   the one more bounded scan: begins_with(PK,'Q#') AND SK = 'SAMPLED' (no index exists); needs client.scan
 * Then filters: {from, to} the deadline window inclusive (YYYY-MM-DD; rows without a deadline are dropped by a window),
 * {threadId} questions whose clusterKey is that thread. The row's own key is in sourceRow; `pred` is the PRED# row it
 * was drawn from.
 */
async function sampledQuestions(client, by = {}, opts = {}) {
  const t = resolveTables(opts);
  const { from, to, threadId } = by;
  const qids = by.qids === undefined ? null : [...new Set(strs(by.qids))];
  let rows;
  if (qids) {
    rows = qids.length ? await need(client, 'batchGet')(t.predictions, qids.map((q) => ({ PK: `Q#${q}`, SK: 'SAMPLED' }))) : [];
  } else {
    rows = await need(client, 'scan')(t.predictions, { expression: 'begins_with(PK, :p) AND SK = :s', values: { ':p': 'Q#', ':s': 'SAMPLED' } });
  }
  return rows
    .filter((r) => r && r.SK === 'SAMPLED' && String(r.PK).startsWith('Q#'))
    .map(sampled)
    .filter((q) => (!from && !to) || inRange(q.deadline, from, to))
    .filter((q) => !threadId || q.clusterKey === threadId)
    .sort((a, b) => ((a.deadline || '') < (b.deadline || '') ? -1 : (a.deadline || '') > (b.deadline || '') ? 1 : a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0));
}

// ---- WEB#INDEX and web/latest.json -------------------------------------------------------------------------------
// The same bundle twice. DynamoDB SummarizeAndPredict WEB#INDEX/LATEST is the index itself; S3 web/latest.json is
// { runId, generatedAt, index:{...the same...} }. Writer: newsSystemsAnalysis.
//   links:   [{from, to, confidence 'weak'|'medium'|'strong', lagDays, mechanism, cited:[{date,topicId,title}], country, generatedAt}]
//            (a link that already carries a/b instead of from/to is accepted; confirmed/confirmedBy/strength/since/evidence pass through)
//   shared:  [{a, b, actors[], weight, country, generatedAt}]
//   threads: { <threadId>: { state, title, entries, places:[{name,n}], analysedIn:[{country,generatedAt}] } }

// where = { store, key } of the raw bundle; link/shared index = position in the raw array BEFORE filtering.
function bundle(b, where) {
  const x = b && typeof b === 'object' ? b : {};
  const links = arr(x.links).map((l, i) => {
    const from = str(l && (l.from || l.a)); const to = str(l && (l.to || l.b));
    if (!from || !to) return null;
    const extra = {};
    for (const k of ['confirmed', 'confirmedBy', 'strength', 'since', 'evidence']) if (l[k] !== undefined) extra[k] = l[k];
    return { ...prov(where.store, where.key, `web|${from}|${to}`, i), from, to, confidence: str(l.confidence), lagDays: num(l.lagDays), mechanism: str(l.mechanism) || '', cited: arr(l.cited), country: str(l.country), generatedAt: str(l.generatedAt), ...extra };
  }).filter(Boolean);
  const shared = arr(x.shared).map((s, i) => [s, i]).filter(([s]) => s && s.a && s.b).map(([s, i]) => ({ ...prov(where.store, where.key, `web-shared|${s.a}|${s.b}`, i), a: s.a, b: s.b, actors: strs(s.actors), weight: num(s.weight), country: str(s.country), generatedAt: str(s.generatedAt) }));
  const threads = {};
  for (const [id, th] of Object.entries(x.threads && typeof x.threads === 'object' ? x.threads : {})) {
    if (!th || typeof th !== 'object') continue;
    threads[id] = {
      state: str(th.state), title: str(th.title), entries: num(th.entries) || 0,
      places: arr(th.places).filter((p) => p && str(p.name)).map((p) => ({ name: p.name, n: num(p.n) || 0 })),
      analysedIn: arr(th.analysedIn),
    };
  }
  return { generatedAt: str(x.generatedAt) || str(x.coverage && x.coverage.asOf), links, shared, threads };
}

/** The story web from DynamoDB (WEB#INDEX/LATEST) -> { generatedAt, links, shared, threads }; empty arrays/object when there is no row. */
async function webIndex(client, opts = {}) {
  const key = { PK: 'WEB#INDEX', SK: 'LATEST' };
  return bundle(await need(client, 'getItem')(resolveTables(opts).world, key), { store: S.world, key });
}

// One S3 web object -> { runId, generatedAt, index:{ generatedAt, links, shared, threads } } or null; `key` is stamped
// into every link's sourceRow, so provenance names the object actually read.
function webObject(raw, key) {
  if (!raw || typeof raw !== 'object') return null;
  const b = bundle(raw.index || raw, { store: S.s3, key });
  return { runId: str(raw.runId), generatedAt: str(raw.generatedAt) || b.generatedAt, index: b };
}

const WEB_LATEST = 'web/latest.json';

/** The story web from S3 (web/latest.json) -> { runId, generatedAt, index:{ generatedAt, links, shared, threads } } or null when the object does not exist. */
async function webLatest(client) {
  return webObject(await need(client, 'getS3Json')(WEB_LATEST), WEB_LATEST);
}

/**
 * The story web of one day from S3 (web/YYYY/MM/DD.json), normalised exactly like webLatest, plus `key` (the S3 key read)
 * and `fellBackTo` (null, or 'web/latest.json'). Missing day: null with {fallback:'none'} (default); with
 * {fallback:'latest'} web/latest.json is read instead and the result is marked fellBackTo. Provenance is always the key
 * really read (sourceRow.key), never the key asked for.
 */
async function webAt(client, date, { fallback = 'none' } = {}) {
  if (!isDay(date)) throw new Error('webAt needs a YYYY-MM-DD date');
  if (fallback !== 'none' && fallback !== 'latest') throw new Error("webAt fallback must be 'none' or 'latest'");
  const get = need(client, 'getS3Json');
  const key = `web/${date.slice(0, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}.json`;
  const hit = webObject(await get(key), key);
  if (hit) return { ...hit, key, fellBackTo: null };
  if (fallback !== 'latest') return null;
  const latest = webObject(await get(WEB_LATEST), WEB_LATEST);
  return latest && { ...latest, key: WEB_LATEST, fellBackTo: WEB_LATEST };
}

// ---- NewsCache `latest` ------------------------------------------------------------------------------------------
// NewsCache { id:'latest', topics:[{id, topicId, threadId, title, actors[], iso3[], regions[], category, significance,
//   sources:[{source,...}]}], model, limit }. Writer: NewsProjectInvokeAgentLambda (ACTIVE_ITEM_ID). The current topic pool; no history.

/** The topic pool of the latest run -> [{topicId, threadId, title, category, actors, iso3, regions, sources}] ([] when there is no row). */
async function latestTopics(client, opts = {}) {
  return latestTopicsOfItem(await need(client, 'getItem')(resolveTables(opts).cache, { id: 'latest' }));
}

/** The same normalisation for a `latest` item already read (e.g. built from the record's today view, recordReads.js). */
function latestTopicsOfItem(row) {
  return arr(row && row.topics).map((t, i) => [t, i]).filter(([t]) => t && typeof t === 'object').map(([t, i]) => ({
    ...prov(S.cache, { id: 'latest' }, `latest|${str(t.topicId) || str(t.id)}`, i),
    topicId: str(t.topicId) || str(t.id), threadId: str(t.threadId), title: str(t.title) || '', category: str(t.category),
    actors: strs(t.actors), iso3: strs(t.iso3), regions: strs(t.regions),
    sources: arr(t.sources).filter((s) => s && typeof s === 'object').map(source),
  }));
}

module.exports = {
  DEFAULT_TABLES, resolveTables, verdictOrder,
  archiveDay, archiveDayOfEntries, archiveRange, threadAnalysis, threadAnalysisOfRows, latestTopicsOfItem, threadHistory, countryHistory, driftNotes, scenarios, snapshotsOfRows, verdicts, sampledQuestions,
  webIndex, webLatest, webAt, latestTopics,
};
