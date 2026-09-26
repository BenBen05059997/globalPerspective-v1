import { useState, useEffect, useCallback } from 'react';
import { fetchDailyBrief } from '@/shared/api/restProxy';

const CACHE_KEY = 'gp_daily_brief_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
const LAST_FOUND_KEY = 'gp_daily_brief_last_found_v1';

// How far back to look for the most recent published brief, and how to look without firing a
// long serial waterfall of requests on every page load. STAGE0_FIXES_PLAN.md item (i) originally
// scoped this hook as "already correct" (only the date-arrow UI was flagged), but a live check
// (2026-09-24) found the real gap: DAILY_BRIEF# records exist through 2026-09-12 (a DeepSeek
// outage has now run 11+ days), while this hook's old `daysBack <= 7` cap meant "today minus 7"
// (2026-09-17 as of the 24th) never reached the last real brief — the fallback existed but its
// window was too short to be the honest safety net it was supposed to be.
// MAX_LOOKBACK_DAYS is bounded (not "look back forever") both because DAILY_BRIEF# rows carry a
// 90-day TTL server-side (ARCHITECTURE.md) — nothing older can exist — and to keep worst-case
// request volume bounded.
export const MAX_LOOKBACK_DAYS = 30;
const BATCH_SIZE = 10;

// F1.1 (map-console review R1): every mount of useDailyBrief() with the same effective date used
// to run its own independent backward scan — Layout and SituationHome both mount it with no
// explicit dateKey (both default to "today"), so a cold /map made up to 40 proxy calls and every
// other page made 20, and worse, "nothing found" was never cached (`if (!data) return`), so a
// multi-week outage repeated that full scan on every single page load forever. This module now
// keeps ONE result cache + ONE in-flight promise per effective date, shared by every hook
// instance in the tab, caches a "nothing found" result for the same TTL as a real one, and
// remembers the last date that actually returned a brief so a steady-state outage costs 2
// requests per lookup (today + the remembered date) instead of a full batched scan.
const inFlight = new Map();    // effectiveDateKey -> Promise<{ data, served, timestamp }>, self-clearing

function safeStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

function readPersistedCache() {
  try {
    const raw = safeStorage()?.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writePersistedCache(map) {
  try {
    const storage = safeStorage();
    if (!storage) return;
    const keys = Object.keys(map);
    if (keys.length > 7) {
      for (const k of keys.sort().slice(0, keys.length - 7)) delete map[k];
    }
    storage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function readLastFoundDate() {
  try { return safeStorage()?.getItem(LAST_FOUND_KEY) || null; } catch { return null; }
}

function writeLastFoundDate(dateKey) {
  try { safeStorage()?.setItem(LAST_FOUND_KEY, dateKey); } catch { /* ignore */ }
}

// Reads straight from localStorage rather than keeping a separate long-lived in-memory mirror:
// the persisted cache is already the single source of truth (shared with the last-found-date
// shortcut below), and this keeps a test's `localStorage.clear()` fully authoritative instead of
// a stale in-memory copy surviving it across test cases in the same file.
function cachedEntry(effectiveDateKey) {
  const p = readPersistedCache()[effectiveDateKey];
  if (p && Number.isFinite(p.timestamp) && (Date.now() - p.timestamp) < CACHE_TTL_MS) return p;
  return null;
}

function storeEntry(effectiveDateKey, entry) {
  const persisted = readPersistedCache();
  persisted[effectiveDateKey] = entry;
  writePersistedCache(persisted);
}

function dateKeyForOffset(base, daysBack) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

async function tryOffset(base, daysBack) {
  const tryKey = dateKeyForOffset(base, daysBack);
  try {
    const result = await fetchDailyBrief(tryKey);
    return result?.data ? { daysBack, tryKey, data: result.data } : null;
  } catch {
    return null;
  }
}

// The original batched backward scan across the whole lookback window — small parallel batches
// (not one big serial per-day loop) so a multi-week gap costs a handful of round-trips, not dozens
// fired one after another. Used only when there's no remembered "last found" date to shortcut
// with (first-ever lookup in this browser, or the shortcut below came up empty).
async function fullBatchScan(base, fromOffset = 0) {
  let data = null; let served = null;
  for (let batchStart = fromOffset; batchStart <= MAX_LOOKBACK_DAYS && !data; batchStart += BATCH_SIZE) {
    const offsets = [];
    for (let o = batchStart; o < batchStart + BATCH_SIZE && o <= MAX_LOOKBACK_DAYS; o++) offsets.push(o);
    const results = await Promise.all(offsets.map((daysBack) => tryOffset(base, daysBack)));
    // Nearest (smallest daysBack) hit within this batch wins, so the served date is always the
    // closest available one to the request, not just the first promise to settle.
    const hit = results.filter(Boolean).sort((a, b) => a.daysBack - b.daysBack)[0];
    if (hit) { data = hit.data; served = hit.tryKey; }
  }
  return { data, served };
}

async function findBrief(effectiveDateKey) {
  const base = new Date(effectiveDateKey + 'T00:00:00Z');

  // Always check "today" fresh first, in case a new brief just landed.
  const fresh = await tryOffset(base, 0);
  if (fresh) { writeLastFoundDate(fresh.tryKey); return { data: fresh.data, served: fresh.tryKey }; }

  // A remembered last-found date lets a steady-state outage (nothing published for days/weeks)
  // cost one more request instead of re-scanning every day in between, which we already know are
  // empty from every previous lookup during the same outage.
  const lastFound = readLastFoundDate();
  if (lastFound) {
    const lastFoundMs = new Date(lastFound + 'T00:00:00Z').getTime();
    const baseMs = base.getTime();
    if (Number.isFinite(lastFoundMs) && lastFoundMs < baseMs) {
      const offset = Math.round((baseMs - lastFoundMs) / 86400000);
      if (offset >= 1 && offset <= MAX_LOOKBACK_DAYS) {
        const hit = await tryOffset(base, offset);
        if (hit) { writeLastFoundDate(hit.tryKey); return { data: hit.data, served: hit.tryKey }; }
      }
    }
  }

  // No usable shortcut (first run in this browser, or the remembered date no longer has data —
  // e.g. it fell off the server's 90-day TTL) — fall back to the full batched scan, starting just
  // past "today" since offset 0 was already checked above.
  const scanned = await fullBatchScan(base, 1);
  if (scanned.served) writeLastFoundDate(scanned.served);
  return scanned;
}

function getOrFetch(effectiveDateKey) {
  const cached = cachedEntry(effectiveDateKey);
  if (cached) return Promise.resolve(cached);
  if (inFlight.has(effectiveDateKey)) return inFlight.get(effectiveDateKey);
  const p = findBrief(effectiveDateKey)
    .then(({ data, served }) => {
      const entry = { data, served, timestamp: Date.now() };
      storeEntry(effectiveDateKey, entry);
      return entry;
    })
    .finally(() => { inFlight.delete(effectiveDateKey); });
  inFlight.set(effectiveDateKey, p);
  return p;
}

export function useDailyBrief(dateKey) {
  const [brief, setBrief] = useState(null);
  const [servedDateKey, setServedDateKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const effectiveDateKey = dateKey || today;

  const load = useCallback(async () => {
    // Synchronous cache hit — no loading flash, and no fetch at all when another instance (or an
    // earlier mount) already resolved this same date within the TTL.
    const cached = cachedEntry(effectiveDateKey);
    if (cached) {
      setBrief(cached.data);
      setServedDateKey(cached.served);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const entry = await getOrFetch(effectiveDateKey);
      setBrief(entry.data);
      setServedDateKey(entry.served);
    } catch (err) {
      setError(err?.message || 'Failed to fetch daily brief');
    } finally {
      setLoading(false);
    }
  }, [effectiveDateKey]);

  useEffect(() => { load(); }, [load]);

  return { brief, servedDateKey, loading, error, refetch: load };
}
