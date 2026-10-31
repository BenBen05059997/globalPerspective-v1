'use strict';

// The briefs as views (decision 0048), from the daily_brief and weekly_brief notes. One file per brief, in the shape the
// `daily_brief` / `weekly_brief` actions answer (`brief` = the action's `data`: the stored row with generatedAt and model back in,
// iso3 filled in by the shared briefWithIso3 / weeklyWithIso3), and one small index of what exists. Pure: no I/O, no clock.
// Public data only, and no more than the anonymous actions serve: the actions have no membership gate, but `weekly_brief` serves a
// published brief only, so a draft (or a brief the operator held back) is in no view and no index. The latest note of a subject
// wins (a regenerated day replaces the earlier text, as the DynamoDB row is overwritten).
const {briefWithIso3, weeklyWithIso3} = require('./_shared/briefs');

const SCHEMA_VERSION = 1;

/** subject id -> its newest note (by `at`, then noteId, so the choice never depends on file order) */
function latestBySubject(noteLines, subtype) {
  const newest = new Map();
  for (const n of noteLines) {
    if (n.subtype !== subtype) continue;
    const have = newest.get(n.subject.id);
    if (!have || n.at > have.at || (n.at === have.at && n.noteId > have.noteId)) newest.set(n.subject.id, n);
  }
  return newest;
}

/** The row as the action serves it: payload + the note's at (generatedAt) and model, countries filled in. */
const rowOf = (n) => ({...n.payload, generatedAt: n.at, model: n.model});

/** -> {daily: Map(dateKey -> view), weekly: Map(weekOf -> view), index} */
function buildBriefViews(noteLines, builtFrom) {
  const daily = new Map();
  for (const n of latestBySubject(noteLines, 'daily_brief').values()) {
    const brief = briefWithIso3(rowOf(n));
    daily.set(brief.dateKey, {schemaVersion: SCHEMA_VERSION, builtFrom, dateKey: brief.dateKey, brief});
  }
  const weekly = new Map();
  for (const n of latestBySubject(noteLines, 'weekly_brief').values()) {
    if (n.payload.status !== 'published') continue;
    const brief = weeklyWithIso3(rowOf(n));
    weekly.set(brief.weekOf, {schemaVersion: SCHEMA_VERSION, builtFrom, weekOf: brief.weekOf, brief});
  }
  const newestFirst = (key) => (a, b) => (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0);
  const index = {
    schemaVersion: SCHEMA_VERSION, builtFrom,
    daily: [...daily.values()].map(({brief: b}) => ({dateKey: b.dateKey, headline: b.headline, generatedAt: b.generatedAt})).sort(newestFirst('dateKey')),
    weekly: [...weekly.values()].map(({brief: b}) => ({weekOf: b.weekOf, asOf: b.asOf, lede: (b.signals[0] || {}).lede ?? null, signals: b.signals.length, generatedAt: b.generatedAt})).sort(newestFirst('weekOf')),
  };
  return {daily, weekly, index};
}

module.exports = {buildBriefViews, SCHEMA_VERSION};
