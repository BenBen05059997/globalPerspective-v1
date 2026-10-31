// The 30-day archive as { [YYYY-MM-DD]: { entries, updatedAt } } for the Stories page, the Stories map, the countries list and
// page, the story page's related stories and the map's country card and risk layer. It reads the record's weekly index
// (/data/record/views/index/weekly.json) for the recorded days and the `archive_range` action for the newest recorded day and
// every day after it (the record is built nightly and its newest day can be part-way; like the story timeline, the action
// supplies what the record has not caught up with), or for all 30 days when the index is missing or unreadable (reported).
// A failed action call for those last days leaves the recorded days.
//
// What the record changes against the action (measured 2026-10-31): an article listed again on a later archive day is shown
// once, on its first day; an entry sits under the story it belongs to now (merges and reassignments applied); places are the
// entry's countries by the one country table plus the EU (any other region, such as Global or the Middle East, is not carried),
// in ISO3 order; a source is named by its outlet (its host when the outlet is unknown).
import { fetchArchiveRange } from '@/shared/api/restProxy.js';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { resolveCountry } from '@/shared/lib/countries.js';

const WINDOW_DAYS = 30;
const DAY_MS = 86400000;
const views = makeRecordViews();

/** True when the index can answer: at least one recorded day. */
export const weeklyIndexUsable = (index) => Boolean(index && index.days && typeof index.days === 'object' && !Array.isArray(index.days)
  && Object.keys(index.days).length > 0);

// the record's iso3 also carries the EU as EUU, which the country table does not have; the pages know it by name (broad-region coverage)
const placeOf = (code) => (code === 'EUU' ? 'European Union' : resolveCountry(code)?.name);

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function entryFromRecord(e) {
  const iso3 = Array.isArray(e.iso3) ? e.iso3 : [];
  return {
    topicId: e.topicId ?? null,
    threadId: e.threadId ?? null,
    title: e.title,
    category: e.category ?? '',
    iso3,
    regions: iso3.map(placeOf).filter(Boolean),
    sources: (e.sources || []).map((s) => ({ source: s.outlet || hostOf(s.url) || '', url: s.url ?? undefined })),
  };
}

const dayBefore = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) - n * DAY_MS).toISOString().slice(0, 10);

/** The index as the action's day map, the window's days only (today and the 29 before). Pure. */
export function dayMapFromIndex(index, today = new Date().toISOString().slice(0, 10)) {
  const from = dayBefore(today, WINDOW_DAYS - 1);
  const out = {};
  for (const [day, d] of Object.entries(index.days)) {
    if (day < from || !Array.isArray(d?.entries)) continue;
    out[day] = { entries: d.entries.map(entryFromRecord), updatedAt: d.updatedAt ?? null, source: 'record' };
  }
  return out;
}

/** Days from `day` to `today` (0 when `day` is today or later). */
export const daysFrom = (day, today) => Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS));

async function loadIndex() {
  try { return await views.fetchWeeklyIndex(); } catch (err) { reportFetchError('weekly-index', err); return null; }
}

async function actionDays(days) {
  const res = await fetchArchiveRange(days);
  return res?.data || {};
}

/**
 * The 30-day archive, record first. When the index is missing the action's answer is returned (or its error thrown, as the
 * hooks always handled it); a failed action call for the newest days only is reported and the recorded days are kept.
 */
export async function loadArchiveDayMap(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const index = await loadIndex();
  if (!weeklyIndexUsable(index)) return actionDays(WINDOW_DAYS);
  const recorded = dayMapFromIndex(index, today);
  const newest = Object.keys(recorded).sort().at(-1);
  if (!newest) return actionDays(WINDOW_DAYS);
  try {
    const fresh = await actionDays(daysFrom(newest, today) + 1);
    return { ...recorded, ...Object.fromEntries(Object.entries(fresh).filter(([day]) => day >= newest)) };
  } catch (err) {
    reportFetchError('archive-range-recent', err);
    return recorded;
  }
}
