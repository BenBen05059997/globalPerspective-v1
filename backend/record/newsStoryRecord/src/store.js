'use strict';

// The facts writer's reads. Everything comes through shared world/; nothing here parses a raw row,
// scans a table or lists a bucket.
const world = require('./_shared/world');

const WINDOW_DAYS = 30; // archive days read for a run: date-29 .. date (birth needs the earlier days)

function makeStore(client, {env = {}, tables} = {}) {
  const opts = {env, tables};
  return {
    /**
     * The inputs of one UTC day. nowMs is set to noon of `date`, so world.archiveDay also merges the entries of
     * `today-archive` archived on that day (0036 section 5.3); a day with no archive row but such entries comes back
     * with source 'today-archive'. dayRow is null when neither exists (the day is missing).
     */
    async load(date) {
      const from = world.addDays(date, 1 - WINDOW_DAYS);
      const range = await world.archiveRange(client, from, date, {...opts, nowMs: Date.parse(`${date}T12:00:00Z`)});
      const dayRow = range.days.find((d) => d.date === date) || null;
      const entries = dayRow ? dayRow.entries : [];
      const topicIds = [...new Set(entries.map((e) => e.topicId).filter(Boolean))];
      const snapshots = topicIds.length ? await world.scenarios(client, {topicIds, from, to: date}, opts) : [];
      return {date, from, range, dayRow, entries, births: world.birthByThread(range), snapshots};
    },
  };
}

module.exports = {makeStore, WINDOW_DAYS};
