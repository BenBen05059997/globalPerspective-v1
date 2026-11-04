'use strict';

// The agent's reads of the two world families the record already holds (decision 0035 step 5d), so the NewsCache `archive#DAY` /
// `today-archive` rows and the PredictionLog `PRED#` rows (and the `THREAD#/TOPICS` pointer) can go. One switch per family:
//
//   ARCHIVE_READS (threading window + freshness gate)  ddb (default) | inbox (record/inbox/entries/DAY.jsonl) | compare
//   FORKS_READS   (draw cadence + near-duplicate gate)  ddb (default) | inbox (record/inbox/forecasts/DAY.jsonl) | compare
//
// compare reads both, answers from DynamoDB and logs every difference as `[archive-compare]` / `[forks-compare]`. Anything else is ddb, so a
// typo never changes what the agent reads. The inboxes are read under the prefix the agent writes them to (ENTRIES_INBOX_PREFIX,
// FORECASTS_INBOX_PREFIX); with it unset the switch stays ddb. The replay rules are the shared ones (entriesInbox.replayDay,
// forecastsInbox.replay); this file only shapes what they give into what the DynamoDB reads gave. Pure: no I/O, no clock.

const { lastArchiveWrite } = require('./run-guard');
const { latestForkDay, openBranchTexts } = require('./forecast-draw');

// The generic half (MODES, readMode, readBy, sameJson, archiveOfLines) lives in the shared archiveReads.js, one copy for every Lambda that reads the archive.
const { MODES, readMode, readBy, sameJson, archiveOfLines } = require('./_shared/archiveReads');

// ---- archive window and freshness --------------------------------------------------------------------------------------------------------

/** One day's archive list (the row's `entries`, oldest generation first) -> the threading window's entries of that day, newest first. */
function pastEntriesOfDay(day, entries) {
  return (Array.isArray(entries) ? entries : []).slice().reverse().map((e) => ({
    topicId: e.topicId,
    threadId: e.threadId,
    title: e.title,
    summary: e.summary || '',
    search_keywords: e.search_keywords || [],
    regions: e.regions || [],
    category: e.category || '',
    archivedAt: e.archivedAt,
    generationId: e.generationId,
    date: day, // for the v1 arc digest (buildArcDigest)
  }));
}

/** Differences between two threading windows, per day: topics on one side only, changed fields, the same topics in another order. */
function diffWindow(a, b) {
  const byDay = (list) => {
    const m = new Map();
    for (const e of list || []) (m.get(e.date) || m.set(e.date, []).get(e.date)).push(e);
    return m;
  };
  const da = byDay(a);
  const db = byDay(b);
  const out = [];
  for (const day of [...new Set([...da.keys(), ...db.keys()])].sort()) {
    const ea = da.get(day) || [];
    const eb = db.get(day) || [];
    const mb = new Map(eb.map((e) => [e.topicId, e]));
    const ma = new Map(ea.map((e) => [e.topicId, e]));
    const changed = ea.filter((e) => mb.has(e.topicId) && !sameJson(e, mb.get(e.topicId)))
      .map((e) => ({ topicId: e.topicId, fields: Object.keys({ ...e, ...mb.get(e.topicId) }).filter((k) => !sameJson(e[k], mb.get(e.topicId)[k])) }));
    const onlyDdb = ea.filter((e) => !mb.has(e.topicId)).map((e) => e.topicId);
    const onlyInbox = eb.filter((e) => !ma.has(e.topicId)).map((e) => e.topicId);
    const orderDiffers = !onlyDdb.length && !onlyInbox.length && ea.some((e, i) => e.topicId !== eb[i].topicId);
    if (onlyDdb.length || onlyInbox.length || changed.length || orderDiffers) out.push({ day, ddb: ea.length, inbox: eb.length, onlyDdb, onlyInbox, changed, ...(orderDiffers ? { orderDiffers } : {}) });
  }
  return out;
}

/**
 * The freshness gate reads [today-archive, archive#today, archive#yesterday] from DynamoDB and [archive#today, archive#yesterday] replayed
 * from the inbox: the gate only uses the newest write time (run-guard.lastArchiveWrite), and a run's today-archive write carries the same
 * updatedAt as its daily write and entry times a few ms older, so the daily rows alone give the same value. Compared: that value.
 */
function diffFreshness(a, b) {
  const [x, y] = [lastArchiveWrite(a), lastArchiveWrite(b)];
  return x === y ? [] : [{ lastWrite: { ddb: x ? new Date(x).toISOString() : null, inbox: y ? new Date(y).toISOString() : null } }];
}

// ---- thread forks -----------------------------------------------------------------------------------------------------------------------

/**
 * The PRED# rows readThreadForks answers, from rows replayed from the forecasts inbox: this topic's rows and every row whose (reconciled)
 * threadId is the thread, SK from `from` on, projected to what the DynamoDB query returns ({PK, SK, scenarios}), sorted by PK then SK.
 */
function forkRows(rows, { topicId, threadId, from }) {
  const pk = `PRED#${topicId}`;
  return (rows || [])
    .filter((r) => r && String(r.SK) >= from && (r.PK === pk || (threadId && r.threadId === threadId)))
    .map((r) => ({ PK: r.PK, SK: r.SK, ...(r.scenarios === undefined ? {} : { scenarios: r.scenarios }) }))
    .sort((p, q) => (p.PK < q.PK ? -1 : p.PK > q.PK ? 1 : p.SK < q.SK ? -1 : p.SK > q.SK ? 1 : 0));
}

/** Differences between two fork lists (by PK|SK) and in what the gates read from them: the newest fork day (cadence), the open branch texts (G12). */
function diffForks(today) {
  return (a, b) => {
    const key = (r) => `${r.PK}|${r.SK}`;
    const ma = new Map((a || []).map((r) => [key(r), r]));
    const mb = new Map((b || []).map((r) => [key(r), r]));
    const out = [];
    for (const [k, r] of ma) {
      if (!mb.has(k)) out.push({ row: k, only: 'ddb' });
      else if (!sameJson(r.scenarios, mb.get(k).scenarios)) out.push({ row: k, changed: 'scenarios' });
    }
    for (const k of mb.keys()) if (!ma.has(k)) out.push({ row: k, only: 'inbox' });
    const [la, lb] = [latestForkDay(a), latestForkDay(b)];
    if (la !== lb) out.push({ lastForkDay: { ddb: la, inbox: lb } });
    const [oa, ob] = [openBranchTexts(a, today).sort(), openBranchTexts(b, today).sort()];
    if (!sameJson(oa, ob)) out.push({ openBranches: { ddb: oa.length, inbox: ob.length } });
    return out;
  };
}

module.exports = { MODES, readMode, readBy, sameJson, pastEntriesOfDay, archiveOfLines, diffWindow, diffFreshness, forkRows, diffForks };
