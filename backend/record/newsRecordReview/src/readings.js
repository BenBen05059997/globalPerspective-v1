'use strict';

// S4 helpers: reading ids and lines, supersession, the merge inbox lines. Pure.
const {createHash} = require('node:crypto');
const {keyOf, latestEarlier} = require('./select');

const SCHEMA_VERSION = 1;
const SUBTYPES = ['line', 'chapter', 'branch_status', 'link', 'merge_proposal', 'alias'];
const sha1 = (s) => createHash('sha1').update(s).digest('hex');

/** readingId = sha1(week + threadId + subtype + key); the same reading of the same week always has the same id. */
const readingId = (week, threadId, subtype, payload) => sha1(`${week}${threadId}${subtype}${keyOf(subtype, payload)}`);

/** Accepted items of one story -> reading lines. `supersedable` = latestEarlier(earlier readings). */
function readingLines({week, threadId, accepted, covers, runId, model, promptVersion, supersedable}) {
  return accepted.map((a) => {
    const prev = supersedable.get(`${threadId}|${a.subtype}|${keyOf(a.subtype, a.payload)}`);
    return {
      schemaVersion: SCHEMA_VERSION, readingId: readingId(week, threadId, a.subtype, a.payload), week, threadId, subtype: a.subtype, payload: a.payload,
      cites: a.cites, covers, supersedes: prev ? prev.readingId : null, run: runId, model, promptVersion, confidence: a.confidence,
    };
  });
}

/** The week's file after this run: stored lines of stories this run did not read, plus the new lines; stable order. */
function mergeWeekFile(stored, fresh, processed) {
  const keep = stored.filter((l) => !processed.has(l.threadId));
  return [...keep, ...fresh].sort((a, b) => (a.threadId + a.subtype + a.readingId < b.threadId + b.subtype + b.readingId ? -1 : 1));
}

/** Accepted auto-merges -> inbox lines, one per from-story and unordered pair. */
function inboxLines(items, at) {
  const lines = [];
  const pairs = new Set();
  const froms = new Set();
  for (const {autoMerge, reading, why} of items) {
    const pair = [autoMerge.from, autoMerge.into].sort().join('|');
    if (pairs.has(pair) || froms.has(autoMerge.from)) continue;
    pairs.add(pair);
    froms.add(autoMerge.from);
    lines.push({from: autoMerge.from, into: autoMerge.into, at, reason: why, cites: reading.cites, readingId: reading.readingId});
  }
  return lines;
}

module.exports = {SCHEMA_VERSION, SUBTYPES, readingId, readingLines, mergeWeekFile, inboxLines, latestEarlier};
