import { useEffect, useState } from 'react';
import { fetchDailyBrief } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';
import { lastNDateKeys, todayKey, addDaysKey } from '@/features/briefings/lib/editions.js';
import { loadLatestDailyBrief, MAX_LOOKBACK_DAYS } from '@/features/daily/hooks/useDailyBrief.js';

// useDailyEditionsIndex — powers the daily editions strip without a request-per-day fan-out
// (TASK_2026-09-27_pages_local.md S3: "watch the fan-out"). Probes at most LOOKBACK_DAYS dates
// (the design brief's own §6.7 interim: "probe backwards … stopping after 14 dates"), in small
// batches, and caches the found/not-found result in sessionStorage so re-opening /briefings in
// the same tab costs zero extra requests. A network failure leaves that date 'unknown' (never
// silently 'no edition') and is reported once via reportFetchError.
export const LOOKBACK_DAYS = 14;
const BATCH_SIZE = 5;
const CACHE_KEY = 'gp_briefings_daily_editions_v1';

function readCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(map) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export function useDailyEditionsIndex(anchorDateKey) {
  const [index, setIndex] = useState(() => readCache());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!anchorDateKey) { setLoading(false); return undefined; }
    let cancelled = false;
    const dateKeys = lastNDateKeys(anchorDateKey, LOOKBACK_DAYS);

    (async () => {
      setLoading(true);
      const cache = readCache();
      // Batch 3 / B: the `latest_daily_brief` response already lists every date that has a brief in
      // the last MAX_LOOKBACK_DAYS days, so those dates need no probe. A date outside that window,
      // or a failed lookup, falls back to the per-date probe below (never a guess).
      try {
        const latest = await loadLatestDailyBrief();
        if (Array.isArray(latest?.editions)) {
          const oldest = addDaysKey(todayKey(), -(MAX_LOOKBACK_DAYS - 1));
          for (const dk of dateKeys) {
            if (dk >= oldest && dk <= todayKey()) cache[dk] = latest.editions.includes(dk);
          }
        }
      } catch { /* fall back to probing */ }
      const missing = dateKeys.filter((dk) => cache[dk] === undefined);
      for (let i = 0; i < missing.length && !cancelled; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (dk) => {
          try {
            const res = await fetchDailyBrief(dk);
            return [dk, !!res?.data];
          } catch (err) {
            reportFetchError('briefings-daily-editions', err);
            return [dk, undefined]; // stays unknown — not a claim of "no edition"
          }
        }));
        for (const [dk, exists] of results) {
          if (exists !== undefined) cache[dk] = exists;
        }
      }
      writeCache(cache);
      if (!cancelled) { setIndex({ ...cache }); setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [anchorDateKey]);

  return { index, loading };
}
