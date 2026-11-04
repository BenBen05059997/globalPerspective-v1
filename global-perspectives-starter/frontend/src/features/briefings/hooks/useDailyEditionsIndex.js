import { useEffect, useState } from 'react';
import { fetchDailyBrief } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';
import { loadBriefsIndex } from '@/shared/api/briefViews.js';
import { loadViewsFresh } from '@/shared/api/viewsFresh.js';
import { lastNDateKeys, todayKey, addDaysKey } from '@/features/briefings/lib/editions.js';
import { loadLatestDailyBrief, MAX_LOOKBACK_DAYS } from '@/shared/hooks/useDailyBrief.js';

// useDailyEditionsIndex — powers the daily editions strip without a request-per-day fan-out
// (TASK_2026-09-27_pages_local.md S3: "watch the fan-out"). Probes at most LOOKBACK_DAYS dates
// (the design brief's own §6.7 interim: "probe backwards … stopping after 14 dates"), in small
// batches, and caches the found/not-found result in sessionStorage so re-opening /briefings in
// the same tab costs zero extra requests. A network failure leaves that date 'unknown' (never
// silently 'no edition') and is reported once via reportFetchError. A probe's "no edition" is
// kept for MISS_TTL_MS only: `daily_brief` answers null for a read error too, so one blip must not
// read as "no edition" for the whole tab session. An answer from the record's index or the latest
// lookup (authoritative) and a found edition are kept for the session.
export const LOOKBACK_DAYS = 14;
const BATCH_SIZE = 5;
const CACHE_KEY = 'gp_briefings_daily_editions_v1';
const MISS_KEY = 'gp_briefings_daily_misses_v1';
export const MISS_TTL_MS = 10 * 60 * 1000;

function readCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(map) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
// dateKey -> ms when a probe last found no edition
function readMisses() {
  try { return JSON.parse(sessionStorage.getItem(MISS_KEY) || '{}'); } catch { return {}; }
}
function writeMisses(map) {
  try { sessionStorage.setItem(MISS_KEY, JSON.stringify(map)); } catch { /* ignore */ }
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
      // The record's index lists every daily brief up to its last nightly build (decision 0048): those dates need no probe.
      // Today (and a date the build has not seen) comes from the latest lookup below, or the probe.
      // While the views are fresh (viewsFresh.js, decision 0050) the index covers today too: a date it lacks has no brief.
      const recorded = await loadBriefsIndex();
      if (recorded) {
        const known = new Set(recorded.daily.map((d) => d.dateKey));
        const upTo = (await loadViewsFresh()).fresh ? todayKey() : addDaysKey(todayKey(), -1);
        for (const dk of dateKeys) if (dk <= upTo) cache[dk] = known.has(dk);
      }
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
      // Probe misses that are still fresh stand for this run only; they are never written to the main cache.
      const now = Date.now();
      const misses = Object.fromEntries(Object.entries(readMisses()).filter(([, ts]) => now - ts < MISS_TTL_MS));
      for (const dk of dateKeys) if (cache[dk] === undefined && misses[dk]) cache[dk] = false;
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
          if (exists === undefined) continue;
          cache[dk] = exists;
          if (!exists) misses[dk] = Date.now();
        }
      }
      const persisted = { ...cache };
      for (const dk of Object.keys(misses)) if (persisted[dk] === false) delete persisted[dk];
      writeCache(persisted);
      writeMisses(misses);
      if (!cancelled) { setIndex({ ...cache }); setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [anchorDateKey]);

  return { index, loading };
}
