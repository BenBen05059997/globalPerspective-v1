// The board's reads of the record views go through the shared reader (shared/api/recordViews.js); in dev with
// ?devRecord=1 they come from the board's fixtures instead.
import { fetchRecordView, makeRecordViews } from '@/shared/api/recordViews.js';

async function getView(path) {
  if (import.meta.env.DEV) {
    const fake = await import('../dev/fakeRecordViews.js');
    if (fake.devRecordMode()) return fake.fakeView(path);
  }
  return fetchRecordView(path);
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
