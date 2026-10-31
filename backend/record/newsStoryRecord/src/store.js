'use strict';

// The facts writer's reads. Everything comes through shared world/; nothing here parses a raw row,
// scans a table or lists a bucket.
const world = require('./_shared/world');
const {readInboxDays, dayOfLines, rangeOfDays, compareEntries} = require('./inboxEntries');
const {readForecastDays, snapshotsOfDays, compareSnapshots} = require('./inboxForecasts');

const WINDOW_DAYS = 30; // archive days read for a run: date-29 .. date (birth needs the earlier days)
const ENTRY_SOURCES = ['archive', 'inbox', 'compare'];
const FORECAST_SOURCES = ['log', 'inbox', 'compare'];

/**
 * ENTRIES_SOURCE (decision 0051) says where the day's entries come from:
 *   archive  NewsCache `archive#DAY` + `today-archive` (default)
 *   inbox    record/inbox/entries/DAY.jsonl (the agent's lines, replayed to what the archive row ends the day as)
 *   compare  both are read; the ARCHIVE is used, and every difference is logged as [entries-compare]. Nothing inbox-derived is written.
 */
function makeStore(client, {env = {}, tables, s3json = null, log = console} = {}) {
  const opts = {env, tables};
  const source = env.ENTRIES_SOURCE || 'archive';
  if (!ENTRY_SOURCES.includes(source)) throw new Error(`newsStoryRecord: ENTRIES_SOURCE must be one of ${ENTRY_SOURCES.join(', ')}, got ${source}`);
  const needsInbox = source !== 'archive';
  // FORECASTS_SOURCE (decision 0052): log = PredictionLog `PRED#` rows (default, a Scan of the window), inbox = record/inbox/forecasts/DAY.jsonl replayed
  // to the same rows, compare = both read, the LOG used, every difference logged as [forecasts-compare].
  const forecastSource = env.FORECASTS_SOURCE || 'log';
  if (!FORECAST_SOURCES.includes(forecastSource)) throw new Error(`newsStoryRecord: FORECASTS_SOURCE must be one of ${FORECAST_SOURCES.join(', ')}, got ${forecastSource}`);
  if (forecastSource !== 'log' && !s3json) throw new Error(`newsStoryRecord: FORECASTS_SOURCE=${forecastSource} needs the record bucket`);
  const inboxPrefix = (prefix) => {
    if (!s3json) throw new Error(`newsStoryRecord: ENTRIES_SOURCE=${source} needs the record bucket`);
    return prefix || 'record/';
  };
  const report = (what, diff, skipDays) => {
    const line = JSON.stringify({what, days: diff.days, entries: diff.entries, differing: diff.differing, skippedDays: skipDays.length, differences: diff.differences.slice(0, 20)});
    if (diff.differing) log.warn(`[entries-compare] ${line}`); else log.log(`[entries-compare] ${line}`);
  };

  // Every PRED# row of the window, not only those of the day's archive topics: the forecaster also draws topics the archive never keeps (a different
  // run's topic id). From the log this needs dynamodb:Scan on the PredictionLog table; from the inbox, only the bucket.
  async function loadSnapshots(from, to, prefix) {
    if (forecastSource === 'log') return world.scenarios(client, {from, to}, opts);
    const fromInbox = snapshotsOfDays(await readForecastDays(s3json, inboxPrefix(prefix), from, to), {from, to});
    if (forecastSource === 'inbox') {
      if (fromInbox.orphans) log.warn(`[forecasts-inbox] ${fromInbox.orphans} thread line(s) without their forecast line`);
      return fromInbox.snapshots;
    }
    const fromLog = await world.scenarios(client, {from, to}, opts);
    // the inbox starts on the day the agent first wrote it: days before it are missing there by construction, not a difference
    const first = fromInbox.days[0] || null;
    const skipDays = world.eachDay(from, to).filter((d) => !first || d < first);
    const diff = compareSnapshots(fromLog, fromInbox.snapshots, {skipDays});
    const line = JSON.stringify({what: 'forecasts', snapshots: diff.snapshots, differing: diff.differing, orphans: fromInbox.orphans, skippedDays: skipDays.length, differences: diff.differences.slice(0, 20)});
    if (diff.differing || fromInbox.orphans) log.warn(`[forecasts-compare] ${line}`); else log.log(`[forecasts-compare] ${line}`);
    return fromLog;
  }

  return {
    source,
    forecastSource,
    /**
     * The entries of one UTC day as the nightly run would read them (the day row plus the `today-archive` entries archived that day),
     * for a refresh (0050): no window, no snapshots, no births. [] when the day has neither.
     */
    async loadDay(date, {prefix} = {}) {
      const nowMs = Date.parse(`${date}T12:00:00Z`);
      const fromArchive = source === 'inbox' ? null : await world.archiveDay(client, date, {...opts, nowMs});
      if (!needsInbox) return fromArchive ? fromArchive.entries : [];
      const days = await readInboxDays(s3json, inboxPrefix(prefix), date, date);
      const fromInbox = dayOfLines(date, days.get(date));
      if (source === 'inbox') return fromInbox ? fromInbox.entries : [];
      report('refresh', compareEntries({days: fromArchive ? [fromArchive] : []}, {days: fromInbox ? [fromInbox] : []}), []);
      return fromArchive ? fromArchive.entries : [];
    },
    /**
     * The inputs of one UTC day. nowMs is set to noon of `date`, so world.archiveDay also merges the entries of
     * `today-archive` archived on that day (0036 section 5.3); a day with no archive row but such entries comes back
     * with source 'today-archive'. dayRow is null when neither exists (the day is missing).
     */
    async load(date, {prefix} = {}) {
      const from = world.addDays(date, 1 - WINDOW_DAYS);
      const nowMs = Date.parse(`${date}T12:00:00Z`);
      const archived = source === 'inbox' ? null : await world.archiveRange(client, from, date, {...opts, nowMs});
      let range = archived;
      if (needsInbox) {
        const fromInbox = rangeOfDays(await readInboxDays(s3json, inboxPrefix(prefix), from, date), from, date);
        if (source === 'compare') {
          // the inbox starts on the day the agent first wrote it: days before it are missing there by construction, not a difference
          const first = fromInbox.days.length ? fromInbox.days[0].date : null;
          const skipDays = world.eachDay(from, date).filter((d) => !first || d < first);
          report('nightly', compareEntries(archived, fromInbox, {skipDays}), skipDays);
        } else {
          range = fromInbox;
        }
      }
      const dayRow = range.days.find((d) => d.date === date) || null;
      const entries = dayRow ? dayRow.entries : [];
      const snapshots = await loadSnapshots(from, date, prefix);
      // Thread of a topic for a row that names none: its latest archive entry in the window (the row's own threadId wins in buildFacts).
      const threadOfTopic = new Map();
      for (const d of range.days) for (const e of d.entries) if (e.topicId && e.threadId) threadOfTopic.set(e.topicId, e.threadId);
      return {date, from, range, dayRow, entries, births: world.birthByThread(range), snapshots, threadOfTopic};
    },
  };
}

module.exports = {makeStore, WINDOW_DAYS, ENTRY_SOURCES, FORECAST_SOURCES};
