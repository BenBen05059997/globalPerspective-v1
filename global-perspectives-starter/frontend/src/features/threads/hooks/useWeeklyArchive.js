import { useMemo } from 'react';
import { loadArchiveDayMap } from '@/shared/api/archiveRange';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_KEY = 'gp_weekly_archive_v3'; // v3: useCachedQuery's { data, ts } entry (v2 held { dayMap, tier, uid, timestamp })
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const NO_DAYS = {};

// The archive is public and identical for every reader: no sign-in state is read here (CLAUDE.md "public data hooks
// never gate on sign-in"). A failed load is reported and not cached; the page decides what to say.
async function loadArchive() {
  window.dispatchEvent(new CustomEvent('gp-loading-start'));
  try {
    return await loadArchiveDayMap();
  } catch (err) {
    reportFetchError('weekly-archive', err);
    throw err;
  } finally {
    window.dispatchEvent(new CustomEvent('gp-loading-end'));
  }
}

export function useWeeklyArchive() {
  const { data, error, loading, refetch } = useCachedQuery(CACHE_KEY, loadArchive, { storage: 'local', ttl: CACHE_TTL_MS });
  const dayMap = data ?? NO_DAYS;

  const sortedDates = useMemo(
    () => Object.keys(dayMap).sort((a, b) => b.localeCompare(a)),
    [dayMap]
  );

  // Newest real content write across the archive. The "today" day can be a `source: latest`
  // snapshot whose own updatedAt is days old, so the page must never use fetch time instead.
  const dataUpdatedAt = useMemo(() => {
    let latest = null;
    for (const day of Object.values(dayMap)) {
      const t = Date.parse(day?.updatedAt);
      if (Number.isFinite(t) && (latest === null || t > latest)) latest = t;
    }
    return latest;
  }, [dayMap]);

  return { dayMap, sortedDates, loading, error, dataUpdatedAt, refetch };
}
