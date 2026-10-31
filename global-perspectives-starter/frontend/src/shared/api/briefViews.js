// The briefs in the record (decision 0048): record/views/index/briefs.json (which daily and weekly briefs exist), briefs/daily/DATE.json
// and briefs/weekly/WEEKOF.json (`brief` = what the `daily_brief` / `weekly_brief` actions answer in `data`). The briefs are public:
// the actions have no membership gate, and drafts are in no view. The views are rebuilt nightly (23:45 UTC), so a brief written
// after the last build is not in them yet: the readers below answer null for anything the views do not hold, and the hooks then
// ask the action (they also ask it for today's daily and for a weekly that should be newer). A failed read is reported and answers
// null, never a made-up "no brief".
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';

const TTL_MS = 30 * 60 * 1000;
const DAY_MS = 86400000;
let memo = null; // { ts, promise }

/** UTC date key of now. */
export const todayUtc = () => new Date().toISOString().slice(0, 10);

/** True when the index can answer: daily and weekly lists. */
export const briefsIndexUsable = (index) => Boolean(index && Array.isArray(index.daily) && Array.isArray(index.weekly));

/**
 * The index for the next ~30 minutes (one request shared by every caller), or null when it is not generated or could not be read
 * (a failed read is reported). `views` is for tests.
 */
export function loadBriefsIndex(views = makeRecordViews()) {
  if (memo && Date.now() - memo.ts < TTL_MS) return memo.promise;
  const promise = views.fetchBriefsIndex()
    .then((index) => (briefsIndexUsable(index) ? index : null))
    .catch((err) => { reportFetchError('briefs-index', err); return null; });
  memo = { ts: Date.now(), promise };
  promise.then((index) => { if (!index && memo && memo.promise === promise) memo = null; }); // never keep a miss
  return promise;
}

/** Tests: forget the shared index. */
export function clearBriefsIndexCache() { memo = null; }

/** The dates with a daily brief in the last `lookbackDays` days up to `today`, newest first (the action's `editions`). */
export function dailyEditions(index, today, lookbackDays) {
  const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - (lookbackDays - 1) * DAY_MS).toISOString().slice(0, 10);
  return index.daily.map((d) => d.dateKey).filter((k) => k >= oldest && k <= today).sort().reverse();
}

/** Whole days from the weekly brief's `weekOf` to `today`. */
export const weekAgeDays = (weekOf, today) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekOf}T00:00:00Z`)) / DAY_MS);

async function readView(read, what) {
  try { return await read(); } catch (err) { reportFetchError(what, err); return null; }
}

/** The daily brief of `dateKey` (the action's `data`), or null when the record does not hold it or could not be read. */
export async function readDailyBrief(dateKey, views = makeRecordViews()) {
  const index = await loadBriefsIndex(views);
  if (!index || !index.daily.some((d) => d.dateKey === dateKey)) return null; // not in the record: no request
  const view = await readView(() => views.fetchDailyBriefView(dateKey), 'daily-brief-view');
  return view && view.brief ? view.brief : null;
}

/** The newest daily brief within the window as the `latest_daily_brief` action answers it ({data, dateKey, editions}), or null when the record holds none. */
export async function readLatestDaily({ today = todayUtc(), lookbackDays }, views = makeRecordViews()) {
  const index = await loadBriefsIndex(views);
  if (!index) return null;
  const editions = dailyEditions(index, today, lookbackDays);
  if (!editions.length) return null;
  const view = await readView(() => views.fetchDailyBriefView(editions[0]), 'daily-brief-view');
  return view && view.brief ? { data: view.brief, dateKey: editions[0], editions } : null;
}

/** The published weekly brief of `week` (its weekOf), or the newest one when `week` is empty (the action's `data`), or null when the record has none. */
export async function readWeeklyBrief(week = null, views = makeRecordViews()) {
  const index = await loadBriefsIndex(views);
  if (!index) return null;
  const weekOf = week || (index.weekly[0] && index.weekly[0].weekOf);
  if (!weekOf || !index.weekly.some((w) => w.weekOf === weekOf)) return null;
  const view = await readView(() => views.fetchWeeklyBriefView(weekOf), 'weekly-brief-view');
  return view && view.brief ? view.brief : null;
}
