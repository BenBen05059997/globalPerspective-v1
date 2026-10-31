'use strict';

// Fact objects (decision 0036 §2). Pure: no AWS, no clock, no model. A fact is one line of
// record/facts/YYYY-MM-DD.jsonl; its day is the UTC date of `at`, not the run date.
const R = require('./_shared/record');
const {registrableDomain, getOutletMeta} = require('./_shared/outlets');
const world = require('./_shared/world');

const SCHEMA_VERSION = 1;
const MAX_PUBLISHED_AGE_DAYS = 30;
const producerName = `newsStoryRecord@${require('./package.json').version}`;
const KINDS = ['entry', 'story_born', 'forecast_drawn', 'verdict', 'correction', 'story_merged', 'story_split', 'article', 'assignment', 'question_commit', 'question_draw', 'run'];
const ASSIGNERS = ['ingest', 'review', 'operator'];
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
  if (!['run', 'entry', 'article', 'question_commit', 'question_draw'].includes(kind) && threadId === null) throw new Error(`facts: ${kind} needs a threadId`);
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
    // snippet (the feed's text) and tier (primary = the selector's cited source, secondary = added by matching) are raw
    // capture, kept from 2026-10-31; older facts lack them.
    return {sourceId, outlet: meta ? meta.outlet : null, url: s.url || null, title: s.title || null,
      ...(typeof s.snippet === 'string' && s.snippet ? {snippet: s.snippet} : {}), ...(s.tier === 'primary' || s.tier === 'secondary' ? {tier: s.tier} : {})};
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
    payload: {title: e.title, summary: null, category: e.category, eventType: e.eventType, continuesTopic: e.continuesTopic, topicId: e.topicId,
      ...(Array.isArray(e.actors) && e.actors.length ? {actors: e.actors.filter((a) => typeof a === 'string' && a)} : {})}, // display names, as captured
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

/**
 * One line of the resolver's draws inbox (record/inbox/draws/DAY.jsonl, decision 0043) -> `question_commit` (type 'commit') or
 * `question_draw` (type 'draw'). Both belong to a week, not a story (threadId null); eventId = sha1(kind + weekId), so a re-read is
 * the same fact. The commit carries the published seed hash; the draw the revealed seed and the sampled questions.
 */
function inboxDrawFact(line, runId) {
  const l = line && typeof line === 'object' ? line : {};
  const WEEK = /^\d{4}-W\d{2}$/;
  if (typeof l.weekId !== 'string' || !WEEK.test(l.weekId)) throw new Error(`facts: inbox draw line needs a weekId, got ${l.weekId}`);
  if (typeof l.rule !== 'string' || !l.rule) throw new Error(`facts: inbox draw ${l.weekId} needs a rule`);
  const common = {threadId: null, precision: 'exact', runId};
  if (l.type === 'commit') {
    if (typeof l.commitHash !== 'string' || !/^[0-9a-f]{64}$/.test(l.commitHash)) throw new Error(`facts: commit ${l.weekId} needs a sha-256 commitHash`);
    const sourceKey = `inbox:draws/commit|${l.weekId}`;
    return makeFact({
      ...common, kind: 'question_commit', eventId: R.sha1(`question_commit${l.weekId}`), sourceKey, at: l.committedAt, sourceRow: {store: 'record', key: sourceKey},
      payload: {weekId: l.weekId, weekStart: l.weekStart ?? null, weekEnd: l.weekEnd ?? null, rule: l.rule, commitHash: l.commitHash},
    });
  }
  if (l.type === 'draw') {
    const picked = Array.isArray(l.picked) ? l.picked : null;
    if (!picked || picked.some((p) => !p || typeof p.qid !== 'string' || !p.qid)) throw new Error(`facts: draw ${l.weekId} needs picked: [{qid, hash, clusterKey}]`);
    const sourceKey = `inbox:draws/draw|${l.weekId}`;
    return makeFact({
      ...common, kind: 'question_draw', eventId: R.sha1(`question_draw${l.weekId}`), sourceKey, at: l.drawnAt, sourceRow: {store: 'record', key: sourceKey},
      payload: {
        weekId: l.weekId, rule: l.rule, K: l.K ?? null, eligible: l.eligible ?? null, clusters: l.clusters ?? null, seedHex: l.seedHex ?? null,
        picked: picked.map((p) => ({qid: p.qid, hash: p.hash ?? null, clusterKey: p.clusterKey ?? null})),
      },
    });
  }
  throw new Error(`facts: inbox draw line has type ${l.type}`);
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
function mergedFact({from, into, reason, evidence = [], at, sourceKey, sourceRow, runId, eventId, extra = {}}) {
  if (!from || !into || from === into || !reason) throw new Error('facts: a merge needs two different threads and a reason');
  return makeFact({kind: 'story_merged', eventId, sourceKey, at, precision: 'exact', threadId: into, sourceRow, runId, payload: {from, into, reason, evidence, ...extra}});
}

/** `story_split`: undoes the merge of `from` into `into` (threadId = into). Operator only, through record/inbox/splits/. */
function splitFact({from, into, reason, at, sourceKey, sourceRow, runId, eventId}) {
  if (!from || !into || from === into || !reason) throw new Error('facts: a split needs two different threads and a reason');
  return makeFact({kind: 'story_split', eventId, sourceKey, at, precision: 'exact', threadId: into, sourceRow, runId, payload: {from, into, reason}});
}

const inboxLine = (line, what) => {
  const l = line && typeof line === 'object' ? line : {};
  if (typeof l.from !== 'string' || typeof l.into !== 'string' || typeof l.at !== 'string' || !isoOrNull(l.at)) throw new Error(`facts: inbox ${what} needs from, into and a valid at`);
  return l;
};

/**
 * One line of the review's merge inbox (record/inbox/merges/DAY.jsonl: {from, into, at, reason, cites, readingId}) -> `story_merged`.
 * eventId = sha1('story_merged' + from + into + at), so a re-read is the same fact.
 */
function inboxMergeFact(line, runId) {
  const l = inboxLine(line, 'merge');
  const sourceKey = `inbox:merges/${l.from}|${l.into}|${l.at}`;
  const cites = Array.isArray(l.cites) ? l.cites.filter((c) => typeof c === 'string' && c) : [];
  return mergedFact({
    from: l.from, into: l.into, reason: l.reason, evidence: cites.map((eventId) => ({eventId})), at: l.at, sourceKey, sourceRow: {store: 'record', key: sourceKey}, runId,
    eventId: R.sha1(`story_merged${l.from}${l.into}${l.at}`), extra: l.readingId ? {readingId: l.readingId} : {},
  });
}

/** One line of the operator's split inbox (record/inbox/splits/DAY.jsonl: {from, into, at, reason}) -> `story_split`. eventId = sha1('story_split' + from + into + at). */
function inboxSplitFact(line, runId) {
  const l = inboxLine(line, 'split');
  const sourceKey = `inbox:splits/${l.from}|${l.into}|${l.at}`;
  return splitFact({from: l.from, into: l.into, reason: l.reason, at: l.at, sourceKey, sourceRow: {store: 'record', key: sourceKey}, runId, eventId: R.sha1(`story_split${l.from}${l.into}${l.at}`)});
}

/**
 * One line of the selector's article inbox (record/inbox/articles/DAY.jsonl) -> `article`. eventId = sha1('article' + canonicalUrl),
 * so a live copy and a recovered copy of the same url are one fact. `at` is publishedAt (precision exact) when it parses and is not
 * after fetchedAt, else the start of the fetch day (precision day). threadId is null: an article is not yet a story.
 */
function inboxArticleFact(line, runId) {
  const l = line && typeof line === 'object' ? line : {};
  if (typeof l.url !== 'string' || !l.url) throw new Error('facts: inbox article needs a url');
  const canonicalUrl = R.canonicalUrl(l.canonicalUrl) || R.canonicalUrl(l.url);
  if (!canonicalUrl) throw new Error(`facts: inbox article ${l.url} has no usable url`);
  if (typeof l.title !== 'string' || !l.title) throw new Error(`facts: inbox article ${canonicalUrl} needs a title`);
  const fetched = isoOrNull(l.fetchedAt);
  if (!fetched) throw new Error(`facts: inbox article ${canonicalUrl} needs a valid fetchedAt`);
  const published = isoOrNull(l.publishedAt);
  const exact = published && Date.parse(published) <= Date.parse(fetched) ? published : null;
  const sourceKey = `inbox:articles/${canonicalUrl}`;
  return makeFact({
    kind: 'article', eventId: R.sha1(`article${canonicalUrl}`), sourceKey, at: exact || `${fetched.slice(0, 10)}T00:00:00.000Z`, precision: exact ? 'exact' : 'day', threadId: null,
    sourceIds: [R.sourceIdOf(canonicalUrl)], sourceRow: {store: 'record', key: sourceKey}, runId,
    payload: {url: l.url, canonicalUrl, title: l.title, outlet: l.outlet ?? null, feed: l.feed ?? null, snippet: l.snippet ?? null, lang: l.lang ?? null, recoveredAt: isoOrNull(l.recoveredAt), recoveredFrom: l.recoveredFrom ?? null},
  });
}

/**
 * `assignment` (0040 rule 3): entry `entryId` (the entry's eventId) belongs to story `threadId`. threadId on the envelope is the
 * assigned story. eventId = sha1('assignment' + entryId + threadId + by + at), so a re-read is the same fact. `supersedes` names the
 * assignment eventId this one replaces (informational: the views take the latest by `at`, not by this link).
 */
function assignmentFact({entryId, threadId, by, supersedes = null, reason = null, at, precision = 'exact', sourceKey, sourceRow, runId, iso3 = [], actorIds = [], sourceIds = []}) {
  if (typeof entryId !== 'string' || !entryId) throw new Error('facts: an assignment needs an entryId');
  if (typeof threadId !== 'string' || !threadId) throw new Error('facts: an assignment needs a threadId');
  if (!ASSIGNERS.includes(by)) throw new Error(`facts: assignment by ${by}`);
  const when = isoOrNull(at);
  if (!when) throw new Error('facts: an assignment needs a valid at');
  return makeFact({
    kind: 'assignment', eventId: R.sha1(`assignment${entryId}${threadId}${by}${when}`), sourceKey, at: when, precision, threadId, iso3, actorIds, sourceIds, sourceRow, runId,
    payload: {entryId, threadId, by, supersedes: supersedes || null, reason: reason || null},
  });
}

/** The ingest assignment of an entry fact: the entry's archive thread, at the entry's own time (the entry fact is the ingest claim). Null for a threadless entry. */
function ingestAssignmentFor(entry, runId) {
  if (!entry.threadId) return null;
  return assignmentFact({
    entryId: entry.eventId, threadId: entry.threadId, by: 'ingest', at: entry.at, precision: entry.precision, sourceKey: `ingest:assignments/${entry.eventId}|${entry.threadId}`,
    sourceRow: {store: 'record', key: `ingest:assignments/${entry.eventId}`}, runId,
  });
}

/**
 * One line of the assignment inbox (record/inbox/assignments/DAY.jsonl: {entryId, threadId, by: 'operator'|'review', at, reason, supersedes?}) -> `assignment`.
 * `at` is required (the latest assignment wins by `at`). `by` ingest is refused: ingest assignments are derived, never inboxed.
 */
function inboxAssignmentFact(line, runId) {
  const l = line && typeof line === 'object' ? line : {};
  if (!['operator', 'review'].includes(l.by)) throw new Error(`facts: inbox assignment by must be operator or review, got ${l.by}`);
  if (typeof l.at !== 'string' || !isoOrNull(l.at)) throw new Error('facts: inbox assignment needs a valid at');
  const sourceKey = `inbox:assignments/${l.entryId}|${l.threadId}|${l.by}|${l.at}`;
  return assignmentFact({entryId: l.entryId, threadId: l.threadId, by: l.by, supersedes: l.supersedes, reason: l.reason, at: l.at, sourceKey, sourceRow: {store: 'record', key: sourceKey}, runId});
}

/** `run` fact: the day was processed (0036 §4). `at` defaults to finishedAt; a backfill passes the end of the replayed day so its run fact stays in that day's file. */
function runFact(run, at = run.finishedAt) {
  return makeFact({
    kind: 'run', sourceKey: `run#${run.runId}`, at, precision: 'exact', threadId: null, sourceRow: {store: 'record', key: `runs/${run.date}.json`}, runId: run.runId,
    payload: {runId: run.runId, status: run.status, counts: run.counts},
  });
}

module.exports = {SCHEMA_VERSION, MAX_PUBLISHED_AGE_DAYS, exactTimeOf, KINDS, makeFact, entryFact, bornFact, forecastFact, inboxVerdictFact, inboxDrawFact, legacyVoidFact, isResolvable, LEGACY_VOID_REASON, LEGACY_VOID_DECIDER, correctionFact, mergedFact, splitFact, inboxMergeFact, inboxSplitFact, inboxArticleFact, assignmentFact, ingestAssignmentFor, inboxAssignmentFact, ASSIGNERS, runFact, uniqueSorted};
