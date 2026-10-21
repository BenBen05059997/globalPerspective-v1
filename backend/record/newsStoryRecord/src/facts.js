'use strict';

// Fact objects (decision 0036 §2). Pure: no AWS, no clock, no model. A fact is one line of
// record/facts/YYYY-MM-DD.jsonl; its day is the UTC date of `at`, not the run date.
const {createHash} = require('node:crypto');
const {normalizeActor} = require('./_shared/record');
const world = require('./_shared/world');
const {getOutletMeta} = require('./_shared/outlets');

const SCHEMA_VERSION = 1;
const producerName = `newsStoryRecord@${require('./package.json').version}`;
const KINDS = ['entry', 'story_born', 'forecast_drawn', 'verdict', 'correction', 'story_merged', 'run'];
const VERDICTS = ['yes', 'no', 'void'];
const sha1 = (text) => createHash('sha1').update(text).digest('hex');
const uniqueSorted = (xs) => [...new Set(xs.filter((x) => typeof x === 'string' && x))].sort();
const isoOrNull = (s) => (s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null);

// I1 placeholders, replaced by the content IDs of 0036 §3 in the next stage.
const idOf = (kind, sourceKey) => sha1(kind + sourceKey);
const actorIdsOf = (names) => uniqueSorted((names || []).map((n) => normalizeActor(n)).filter(Boolean).map((n) => `name:${n}`));
const hostOf = (s) => { try { return new URL(s.url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return String(s.source || '').toLowerCase().replace(/^www\./, ''); } };
const sourceIdsOf = (sources) => uniqueSorted((sources || []).map(hostOf).filter(Boolean).map(sha1));

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
    eventId: eventId || idOf(kind, sourceKey),
    kind, at: when, date: when.slice(0, 10), precision, threadId,
    iso3: uniqueSorted(iso3), actorIds: uniqueSorted(actorIds), sourceIds: uniqueSorted(sourceIds),
    payload, producer: {lambda: producerName, runId}, sourceKey, sourceRow, ...extra,
  };
}

function entrySources(e) {
  return (e.sources || []).map((s) => ({sourceId: sha1(hostOf(s)), outlet: (getOutletMeta(s.source) || {}).outlet || null, url: s.url || null, title: s.title || null}));
}

/** One archive entry -> an `entry` fact. */
function entryFact(e, runId) {
  const sources = entrySources(e);
  return makeFact({
    kind: 'entry', sourceKey: e.sourceKey, at: e.archivedAt || `${e.date}T00:00:00Z`, precision: 'day', threadId: e.threadId,
    iso3: e.iso3, actorIds: actorIdsOf(e.actors), sourceIds: sources.map((s) => s.sourceId), sourceRow: e.sourceRow, runId,
    payload: {title: e.title, summary: null, category: e.category, eventType: e.eventType, continuesTopic: e.continuesTopic, topicId: e.topicId},
    extra: {idBasis: 'url', sources},
  });
}

/** The first entry of a thread in the window -> `story_born`. `birth` is world.birthByThread()[threadId]. */
function bornFact(threadId, birth, first, runId) {
  return makeFact({
    kind: 'story_born', sourceKey: `birth|${threadId}`, at: birth.bornAt, precision: 'day', threadId,
    iso3: first.iso3, actorIds: actorIdsOf(first.actors), sourceIds: entrySources(first).map((s) => s.sourceId), sourceRow: first.sourceRow, runId,
    payload: {born: birth.born, bornAtApprox: birth.bornAtApprox, firstTitle: first.title, windowLimited: birth.windowLimited, missingBefore: birth.missingBefore},
  });
}

/** One PRED# snapshot -> `forecast_drawn`. `ctx` = the day's entries drawn on the same topic (iso3, actors, sources). */
function forecastFact(snap, threadId, ctx, runId) {
  const fork = world.branchesFromScenarios([snap])[0];
  const branches = fork.branches.map((b) => ({branchId: b.branchId, text: b.text, p: b.p, trigger: b.trigger, resolutionSource: b.resolutionSource, due: b.due, question: b.question, qid: b.qid, scenarioP: b.scenarioP}));
  return makeFact({
    kind: 'forecast_drawn', sourceKey: snap.sourceKey, at: snap.generatedAt || `${snap.date}T00:00:00Z`, precision: snap.generatedAt ? 'exact' : 'day', threadId,
    iso3: ctx.flatMap((e) => e.iso3), actorIds: ctx.flatMap((e) => actorIdsOf(e.actors)), sourceIds: ctx.flatMap((e) => entrySources(e).map((s) => s.sourceId)),
    sourceRow: snap.sourceRow, runId, payload: {forkId: fork.forkId, topicId: snap.topicId, branches},
  });
}

/** One verdict row (world.verdicts()[qid].all[i]) -> `verdict`. `forecast` = {threadId, branchId} from the forecast_drawn fact. */
function verdictFact(v, forecast, runId) {
  if (!VERDICTS.includes(v.verdict)) throw new Error(`facts: verdict ${v.sk} has result ${v.verdict}`);
  return makeFact({
    kind: 'verdict', sourceKey: v.sourceKey, at: v.decidedAt, precision: 'exact', threadId: forecast.threadId, sourceRow: v.sourceRow, runId,
    payload: {qid: v.qid, branchId: forecast.branchId, result: v.verdict, revision: v.n, decidedBy: v.decidedBy, evidence: v.evidence, reason: v.reason, voidReason: v.voidReason},
  });
}

/** `run` fact: the day was processed (0036 §4). */
function runFact(run) {
  return makeFact({
    kind: 'run', sourceKey: `run#${run.runId}`, at: run.finishedAt, precision: 'exact', threadId: null, sourceRow: {store: 'record', key: `runs/${run.date}.json`}, runId: run.runId,
    payload: {runId: run.runId, status: run.status, counts: run.counts},
  });
}

module.exports = {SCHEMA_VERSION, KINDS, makeFact, entryFact, bornFact, forecastFact, verdictFact, runFact, sha1, uniqueSorted};
