'use strict';

// Forecasts from the inbox instead of the PredictionLog (decision 0052). The agent appends record/inbox/forecasts/DAY.jsonl (shared forecastsInbox.js
// holds the line format and the replay rule); this reads the days and answers in the shape world.scenarios({from, to}) does, so forecastFact and
// the rest of the facts run do not change. compareSnapshots tells what differs between the two sources, for FORECASTS_SOURCE=compare and the proof CLI.
const world = require('./_shared/world');
const forecasts = require('./_shared/forecastsInbox');

/** Map date -> the day's inbox lines, for from..to inclusive (a day with no file or no line is absent). */
async function readForecastDays(s3json, prefix, from, to) {
  const dates = world.eachDay(from, to);
  const parts = await Promise.all(dates.map((d) => s3json.getLines(`${prefix}inbox/forecasts/${d}.jsonl`)));
  const out = new Map();
  dates.forEach((d, i) => { if (parts[i].lines.length) out.set(d, parts[i].lines); });
  return out;
}

/** world.scenarios({from, to})'s answer from readForecastDays' map: {snapshots, orphans (thread lines whose forecast line is missing), days}. */
function snapshotsOfDays(days, {from, to}) {
  const dates = [...days.keys()].sort();
  const {rows, orphans} = forecasts.replay(dates.flatMap((d) => days.get(d)));
  return {snapshots: world.snapshotsOfRows(rows, {from, to}), orphans, days: dates};
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The differences between two snapshot lists (the PredictionLog's and the inbox's), per forecast (sourceKey): on one side only, or on both with
 * the fields that differ (provenance included). `skipDays` = days not to compare (the inbox has no file for days before it started).
 * Returns {snapshots, differing, differences: [{sourceKey, date, only?: 'log'|'inbox', fields?}]}.
 */
function compareSnapshots(log, fromInbox, {skipDays = []} = {}) {
  const skip = new Set(skipDays);
  const a = new Map(log.filter((s) => !skip.has(s.date)).map((s) => [s.sourceKey, s]));
  const b = new Map(fromInbox.filter((s) => !skip.has(s.date)).map((s) => [s.sourceKey, s]));
  const differences = [];
  for (const [key, s] of a) {
    const o = b.get(key);
    if (!o) differences.push({sourceKey: key, date: s.date, only: 'log'});
    else if (!sameJson(s, o)) differences.push({sourceKey: key, date: s.date, fields: [...new Set([...Object.keys(s), ...Object.keys(o)])].filter((k) => !sameJson(s[k], o[k]))});
  }
  for (const [key, s] of b) if (!a.has(key)) differences.push({sourceKey: key, date: s.date, only: 'inbox'});
  return {snapshots: a.size, differing: differences.length, differences};
}

module.exports = {readForecastDays, snapshotsOfDays, compareSnapshots};
