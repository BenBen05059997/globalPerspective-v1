import { useState, useEffect, useCallback } from 'react';
import { fetchDailyBrief } from '@/shared/api/restProxy';

const CACHE_KEY = 'gp_daily_brief_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

// How far back to look for the most recent published brief, and how to look without firing a
// long serial waterfall of requests on every page load. STAGE0_FIXES_PLAN.md item (i) originally
// scoped this hook as "already correct" (only the date-arrow UI was flagged), but a live check
// (2026-09-24) found the real gap: DAILY_BRIEF# records exist through 2026-09-12 (a DeepSeek
// outage has now run 11+ days), while this hook's old `daysBack <= 7` cap meant "today minus 7"
// (2026-09-17 as of the 24th) never reached the last real brief — the fallback existed but its
// window was too short to be the honest safety net it was supposed to be.
// MAX_LOOKBACK_DAYS is bounded (not "look back forever") both because DAILY_BRIEF# rows carry a
// 90-day TTL server-side (ARCHITECTURE.md) — nothing older can exist — and to keep worst-case
// request volume bounded. Requests are issued in small parallel batches (not one big serial
// per-day loop) so a multi-week gap costs a handful of round-trips, not dozens fired one after
// another: each batch of BATCH_SIZE candidate dates is fetched with Promise.all, and only if
// nothing in that batch has data does the hook move to the next (older) batch.
const MAX_LOOKBACK_DAYS = 30;
const BATCH_SIZE = 10;

export function useDailyBrief(dateKey) {
  const [brief, setBrief] = useState(null);
  const [servedDateKey, setServedDateKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const effectiveDateKey = dateKey || today;

  const load = useCallback(async () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.[effectiveDateKey]?.timestamp &&
            (Date.now() - cached[effectiveDateKey].timestamp) < CACHE_TTL_MS &&
            cached[effectiveDateKey].data) {
          setBrief(cached[effectiveDateKey].data);
          setServedDateKey(cached[effectiveDateKey].served || effectiveDateKey);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    setError(null);
    try {
      let data = null;
      let served = null;
      const base = new Date(effectiveDateKey + 'T00:00:00Z');
      const dateKeyForOffset = (daysBack) => {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() - daysBack);
        return d.toISOString().slice(0, 10);
      };
      for (let batchStart = 0; batchStart <= MAX_LOOKBACK_DAYS && !data; batchStart += BATCH_SIZE) {
        const offsets = [];
        for (let o = batchStart; o < batchStart + BATCH_SIZE && o <= MAX_LOOKBACK_DAYS; o++) offsets.push(o);
        const results = await Promise.all(offsets.map(async (daysBack) => {
          const tryKey = dateKeyForOffset(daysBack);
          try {
            const result = await fetchDailyBrief(tryKey);
            return result?.data ? { daysBack, tryKey, data: result.data } : null;
          } catch {
            return null;
          }
        }));
        // Nearest (smallest daysBack) hit within this batch wins, so the served date is always
        // the closest available one to the request, not just the first promise to settle.
        const hit = results.filter(Boolean).sort((a, b) => a.daysBack - b.daysBack)[0];
        if (hit) { data = hit.data; served = hit.tryKey; }
      }
      setBrief(data);
      setServedDateKey(served);
      try {
        if (!data) return;
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        existing[effectiveDateKey] = { data, served, timestamp: Date.now() };
        const keys = Object.keys(existing);
        if (keys.length > 7) {
          const oldest = keys.sort()[0];
          delete existing[oldest];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(existing));
      } catch { /* ignore */ }
    } catch (err) {
      setError(err?.message || 'Failed to fetch daily brief');
    } finally {
      setLoading(false);
    }
  }, [effectiveDateKey]);

  useEffect(() => { load(); }, [load]);

  return { brief, servedDateKey, loading, error, refetch: load };
}
