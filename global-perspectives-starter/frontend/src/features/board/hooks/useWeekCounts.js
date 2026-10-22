import { useEffect, useState } from 'react';
import { fetchCounts, datesBetween, isoWeekStart } from '@/features/board/lib/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink';

const MAX_SINCE_DAYS = 31;
const nextDay = (d) => new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);

/** The days the board needs counts for: the current ISO week up to today (UTC), plus the days after the last visit
 *  through today when that is at most MAX_SINCE_DAYS (a longer gap is not claimed). */
export function countDates(today, lastVisitedAt) {
  const week = datesBetween(isoWeekStart(today), today);
  const visit = typeof lastVisitedAt === 'string' ? lastVisitedAt.slice(0, 10) : null;
  const since = visit && visit < today ? datesBetween(nextDay(visit), today) : [];
  return { week, since: since.length <= MAX_SINCE_DAYS ? since : null, visit };
}

/** { byDate: {date: countsView | null}, loading, error } for the days above. 404 is null; other failures are reported. */
export function useWeekCounts(today, lastVisitedAt, enabled) {
  const { week, since, visit } = countDates(today, lastVisitedAt);
  const dates = [...new Set([...week, ...(since || [])])];
  const key = enabled ? dates.join(',') : '';
  const [state, setState] = useState({ byDate: {}, loading: false, error: false });
  useEffect(() => {
    let live = true;
    if (!key) { setState({ byDate: {}, loading: false, error: false }); return undefined; }
    setState({ byDate: {}, loading: true, error: false });
    Promise.all(key.split(',').map(async (d) => {
      try { return [d, await fetchCounts(d)]; }
      catch (error) { reportFetchError('board-counts', error); return [d, null, true]; }
    })).then((rows) => {
      if (live) setState({ byDate: Object.fromEntries(rows.map(([d, c]) => [d, c])), loading: false, error: rows.some((r) => r[2]) });
    });
    return () => { live = false; };
  }, [key]);
  return { ...state, week, since, visit };
}
