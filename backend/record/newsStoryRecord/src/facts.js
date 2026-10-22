'use strict';

// Fact objects (decision 0036 §2). Pure: no AWS, no clock, no model. A fact is one line of
// record/facts/YYYY-MM-DD.jsonl; its day is the UTC date of `at`, not the run date.
const R = require('./_shared/record');
const {registrableDomain, getOutletMeta} = require('./_shared/outlets');
const world = require('./_shared/world');

const SCHEMA_VERSION = 1;
const MAX_PUBLISHED_AGE_DAYS = 30;
const producerName = `newsStoryRecord@${require('./package.json').version}`;
const KINDS = ['entry', 'story_born', 'forecast_drawn', 'verdict', 'correction', 'story_merged', 'run'];
const VERDICTS = ['yes', 'no', 'void'];
const uniqueSorted = (xs) => [...new Set(xs.filter((x) => typeof x === 'string' && x))].sort();
const isoOrNull = (s) => (s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null);

const actorIdsOf = (names) => uniqueSorted((names || []).map(R.actorIdOf));
/** The envelope shared by every fact. `eventId` defaults to sha1(kind + sourceKey). Throws on a malformed fact. */
function makeFact({kind, eventId, sourceKey, at, precision, threadId = null, iso3 = [], actorIds = [], sourceIds = [], payload, sourceRow, runId, extra = {}}) {
  if (!KINDS.includes(kind)) throw new Error(`facts: unknown kind ${kind}`);
  if (typeof sourceKey !== 'string' || !sourceKey) throw new Error(`facts: ${kind} needs a sourceKey`);
  const when = isoOrNull(at);
  if (!when) throw new Error(`facts: ${kind} needs a valid at`);
  if (!['exact', 'day'].includes(precision)) throw new Error('facts: precision must be exact or day');
  if (!sourceRow || !sourceRow.store || sourceRow.key == null) throw new Error(`facts: ${kind} needs a sourceRow`);
  if (kind !== 'run' && threadId === null && kind !== 'entry') throw new Error(`facts: ${kind} needs a threadId`);
  return {
    schemaVersion: SCHEMA_VERSION,
    eventId: eventId || R.factId(kind, sourceKey),
    kind, at: when, date: when.slice(0, 10), precision, threadId,
    iso3: uniqueSorted(iso3), actorIds: uniqueSorted(actorIds), sourceIds: uniqueSorted(sourceIds),
    payload, producer: {lambda: producerName, runId}, sourceKey, sourceRow, ...extra,
  };
}

/** The evidence list of an entry: sourceId from the url's registrable domain (the `source` host when the url is unusable);
 *  outlet from the outlet table by the stored host, then by the registrable domain, else null. */
function entrySources(e) {
  return (e.sources || []).map((s) => {
    const sourceId = R.sourceIdOf(s.url) || R.sourceIdOf(s.source);
    const meta = getOutletMeta(s.source) || getOutletMeta(registrableDomain(s.url) || registrableDomain(s.source));
    return {sourceId, outlet: meta ? meta.outlet : null, url: s.url || null, title: s.title || null};
  });
}
const sourceIdsOf = (e) => entrySources(e).map((s) => s.sourceId);

/**
 * The exact time of an entry (0036 amendment 2026-10-22): the earliest valid `sources[].publishedAt`, as an ISO string, or null.
 * Valid = parses, is not after the time the entry was archived (a story cannot be published after we archived it), and is at most
 * MAX_PUBLISHED_AGE_DAYS before the archive day (a stale feed date would put the fact outside the re-run window).
 */
function exactTimeOf(e) {
  const archivedMs = Date.parse(e.archivedAt || `${e.date}T23:59:59.999Z`);
  const floor = Date.parse(`${e.date}T00:00:00Z`) - MAX_PUBLISHED_AGE_DAYS * 86400000;
  const times = (e.sources || []).map((s) => (typeof s.publishedAt === 'string' ? Date.parse(s.publishedAt) : NaN))
    .filter((t) => Number.isFinite(t) && t <= archivedMs && t >= floor);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

/** One archive entry -> an `entry` fact. */
function entryFact(e, runId) {
  const exact = exactTimeOf(e);
  const sources = entrySources(e);
  const identity = R.entryIdentity({sources: e.sources, date: e.date, title: e.title});
  return makeFact({
    kind: 'entry', eventId: identity.eventId, sourceKey: e.sourceKey, at: exact || e.archivedAt || `${e.date}T00:00:00Z`, precision: exact ? 'exact' : 'day', threadId: e.threadId,
    iso3: e.iso3, actorIds: actorIdsOf(e.actors), sourceIds: sources.map((s) => s.sourceId), sourceRow: e.sourceRow, runId,
    payload: {title: e.title, summary: null, category: e.category, eventType: e.eventType, continuesTopic: e.continuesTopic, topicId: e.topicId},
    extra: {idBasis: identity.idBasis, sources},
  });
}

/** The first entry of a thread in the window -> `story_born`. `birth` is world.birthByThread()[threadId]. */
function bornFact(threadId, birth, first, runId) {
  return makeFact({
    kind: 'story_born', sourceKey: `birth|${threadId}`, at: birth.bornAt, precision: 'day', threadId,
    iso3: first.iso3, actorIds: actorIdsOf(first.actors), sourceIds: sourceIdsOf(first), sourceRow: first.sourceRow, runId,
    payload: {born: birth.born, bornAtApprox: birth.bornAtApprox, firstTitle: first.title, windowLimited: birth.windowLimited, missingBefore: birth.missingBefore},
  });
}

/** One PRED# snapshot -> `forecast_drawn`. `ctx` = the day's entries drawn on the same topic (iso3, actors, sources). */
function forecastFact(snap, threadId, ctx, runId) {
  const fork = world.branchesFromScenarios([snap])[0];
  const branches = fork.branches.map((b) => ({branchId: b.branchId, text: b.text, p: b.p, trigger: b.trigger, resolutionSource: b.resolutionSource, due: b.due, question: b.question, qid: b.qid, scenarioP: b.scenarioP}));
  return makeFact({
    kind: 'forecast_drawn', sourceKey: snap.sourceKey, at: snap.generatedAt || `${snap.date}T00:00:00Z`, precision: snap.generatedAt ? 'exact' : 'day', threadId,
    iso3: ctx.flatMap((e) => e.iso3), actorIds: ctx.flatMap((e) => actorIdsOf(e.actors)), sourceIds: ctx.flatMap(sourceIdsOf),
    sourceRow: snap.sourceRow, runId, payload: {forkId: fork.forkId, topicId: snap.topicId, branches},
  });
}

/**
 * One line of the resolver's inbox (record/inbox/verdicts/DAY.jsonl) -> `verdict`. `forecast` = {threadId, branchId} from the
 * forecast_drawn fact, used only when the line lacks them. eventId = sha1('verdict' + qid + revision), so a re-read is the same
 * fact and a correction (revision 2) is a second one.
 */
function inboxVerdictFact(line, forecast, runId) {
  const l = line && typeof line === 'object' ? line : {};
  if (typeof l.qid !== 'string' || !l.qid) throw new Error('facts: inbox verdict needs a qid');
  if (!VERDICTS.includes(l.result)) throw new Error(`facts: inbox verdict ${l.qid} has result ${l.result}`);
  const revision = Number.isInteger(l.revision) && l.revision >= 1 ? l.revision : 1;
  const threadId = l.threadId || (forecast && forecast.threadId);
  const branchId = l.branchId || (forecast && forecast.branchId);
  if (!threadId || !branchId) throw new Error(`facts: inbox verdict ${l.qid} has no thread or branch and no forecast fact to take them from`);
  const sourceKey = l.sourceKey || `inbox:verdicts/${l.qid}#${revision}`;
  return makeFact({
    kind: 'verdict', eventId: R.sha1(`verdict${l.qid}${revision}`), sourceKey, at: l.decidedAt, precision: 'exact', threadId, sourceRow: {store: 'record', key: sourceKey}, runId,
    payload: {qid: l.qid, branchId, result: l.result, revision, decidedBy: l.decidedBy ?? null, evidence: l.evidence ?? null, reason: l.reason ?? null, voidReason: l.voidReason ?? null},
  });
}

const LEGACY_VOID_REASON = 'issued_before_method';
const LEGACY_VOID_DECIDER = 'operator-job';
/** The branch can receive a verdict: a question with a question id (0038). The rest was recorded before scoring began. */
const isResolvable = (b) => b.question === true && Boolean(b.qid);

/**
 * `verdict` void for a branch that has no question id (0038 Legacy). Keyed by branchId alone, so a re-run produces the same eventId.
 * `at` is the time of the job; `qid` is null because the branch never had one.
 */
function legacyVoidFact({threadId, branchId, at, runId}) {
  const sourceKey = `legacy-void|${branchId}`;
  return makeFact({
    kind: 'verdict', sourceKey, at, precision: 'exact', threadId, sourceRow: {store: 'record', key: sourceKey}, runId,
    payload: {qid: null, branchId, result: 'void', revision: 1, decidedBy: LEGACY_VOID_DECIDER, evidence: null, reason: null, voidReason: LEGACY_VOID_REASON},
  });
}

/** `correction`: an earlier fact was wrong. No input produces one yet; the builder is here so the kind has one shape. */
function correctionFact({corrects, what, reason, threadId, at, sourceKey, sourceRow, runId}) {
  if (!corrects || !what || !reason) throw new Error('facts: a correction needs corrects, what and reason');
  return makeFact({kind: 'correction', sourceKey, at, precision: 'exact', threadId, sourceRow, runId, payload: {corrects, what, reason}});
}

/** `story_merged`: `from` is folded into `into` (threadId = into). Readers resolve chains and ignore a cycle. */
function mergedFact({from, into, reason, evidence = [], at, sourceKey, sourceRow, runId}) {
  if (!from || !into || from === into || !reason) throw new Error('facts: a merge needs two different threads and a reason');
  return makeFact({kind: 'story_merged', sourceKey, at, precision: 'exact', threadId: into, sourceRow, runId, payload: {from, into, reason, evidence}});
}

/** `run` fact: the day was processed (0036 §4). `at` defaults to finishedAt; a backfill passes the end of the replayed day so its run fact stays in that day's file. */
function runFact(run, at = run.finishedAt) {
  return makeFact({
    kind: 'run', sourceKey: `run#${run.runId}`, at, precision: 'exact', threadId: null, sourceRow: {store: 'record', key: `runs/${run.date}.json`}, runId: run.runId,
    payload: {runId: run.runId, status: run.status, counts: run.counts},
  });
}

module.exports = {SCHEMA_VERSION, MAX_PUBLISHED_AGE_DAYS, exactTimeOf, KINDS, makeFact, entryFact, bornFact, forecastFact, inboxVerdictFact, legacyVoidFact, isResolvable, LEGACY_VOID_REASON, LEGACY_VOID_DECIDER, correctionFact, mergedFact, runFact, uniqueSorted};
