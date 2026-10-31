import { fetchWeeklyBrief } from '@/shared/api/restProxy';
import { readWeeklyBrief, todayUtc, weekAgeDays } from '@/shared/api/briefViews.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const WEEKLY_EVERY_DAYS = 7; // the brief is written on Sundays; the record is rebuilt nightly

// The record's copy first (decision 0048); a week it does not hold, or could not be read, asks the action. The newest brief is
// the record's only while it is under a week old: a Sunday's brief reaches the record at the night's build, so after that the
// action is asked and the newer of the two wins.
async function loadWeeklyBrief(week) {
  const recorded = await readWeeklyBrief(week);
  if (recorded && (week || weekAgeDays(recorded.weekOf, todayUtc()) < WEEKLY_EVERY_DAYS)) return recorded;
  const res = await fetchWeeklyBrief(week);
  const fresh = res?.data || null;
  return fresh && (!recorded || String(fresh.weekOf) >= String(recorded.weekOf)) ? fresh : recorded;
}

// A published weekly intelligence brief: the latest by default, or the one published for `week`
// (its weekOf, YYYY-MM-DD) when given. Null when none is published (honest empty state). 30-min
// localStorage cache per edition. A read API without per-week lookup answers with the latest
// edition: callers compare `brief.weekOf` with the week they asked for and say so.
export function useWeeklyBrief(week = null) {
  const key = week ? `gp_weekly_brief_v1:${week}` : 'gp_weekly_brief_v1';
  const { data, loading, error, refetch } = useCachedQuery(key, () => loadWeeklyBrief(week), { ttl: CACHE_TTL_MS, storage: 'local' });
  return {
    brief: data ?? null,
    loading,
    error: error ? (error.message || 'Failed to load the weekly brief') : null,
    refetch,
  };
}
