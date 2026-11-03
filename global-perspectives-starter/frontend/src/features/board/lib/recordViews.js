// The board's reads of the record views go through the shared reader (shared/api/recordViews.js); in dev with
// ?devRecord=1 they come from the board's fixtures instead.
import { fetchRecordView, makeRecordViews } from '@/shared/api/recordViews.js';

async function readView(path) {
  if (import.meta.env.DEV) {
    const fake = await import('../dev/fakeRecordViews.js');
    if (fake.devRecordMode()) return fake.fakeView(path);
  }
  return fetchRecordView(path);
}

// One fetch per view file: the board hook and the verdict sheet ask for the same stories and links, so a file is
// read once and shared for a minute (the promise itself is cached, so two asks at the same time share one request).
// A failed read is not kept.
const VIEW_TTL_MS = 60 * 1000;
const views = new Map();
export const clearViewCache = () => views.clear();

function getView(path) {
  const hit = views.get(path);
  if (hit && Date.now() - hit.at < VIEW_TTL_MS) return hit.promise;
  const promise = readView(path);
  views.set(path, { at: Date.now(), promise });
  promise.catch(() => { if (views.get(path)?.promise === promise) views.delete(path); });
  return promise;
}

export const { fetchStoryView, fetchLinksView, fetchCounts } = makeRecordViews(getView);

/** UTC dates from `from` to `to` inclusive (YYYY-MM-DD). */
export function datesBetween(from, to) {
  const out = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Monday of the ISO week holding `date` (UTC, YYYY-MM-DD). */
export function isoWeekStart(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
}

/** Sunday of the ISO week holding `date` (UTC, YYYY-MM-DD): the day the board's week ends. */
export function isoWeekEnd(date) {
  return new Date(Date.parse(isoWeekStart(date)) + 6 * 86400000).toISOString().slice(0, 10);
}

/** '2026-W42' (an ISO week, as readings carry it) -> the Monday of that week, YYYY-MM-DD; anything else -> null. */
export function weekMonday(week) {
  const m = /^(\d{4})-W(\d{2})$/.exec(week || '');
  if (!m) return null;
  const jan4 = Date.UTC(Number(m[1]), 0, 4);
  const monday1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * 86400000;
  return new Date(monday1 + (Number(m[2]) - 1) * 7 * 86400000).toISOString().slice(0, 10);
}
