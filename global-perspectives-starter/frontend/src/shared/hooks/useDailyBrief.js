import { useState, useEffect, useCallback } from 'react';
import { fetchDailyBrief, fetchLatestDailyBrief } from '@/shared/api/restProxy';
import { loadBriefsIndex, readDailyBrief, readLatestDaily, todayUtc } from '@/shared/api/briefViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { loadViewsFresh } from '@/shared/api/viewsFresh.js';
import { isCalendarDate } from '@/shared/lib/dateUtils.js';

const CACHE_KEY = 'gp_daily_brief_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

// The window the newest brief is looked for in: DAILY_BRIEF# rows carry a 90-day TTL server-side (ARCHITECTURE.md) and the bound
// keeps the request volume small. An explicit date falls back to the nearest earlier edition within the same window.
export const MAX_LOOKBACK_DAYS = 30;
// Days the action is probed for when the record's index cannot say which editions exist (not generated, or views not fresh).
const PROBE_DAYS = 7;

// Every mount with the same effective date shares ONE result cache and ONE in-flight promise (a "nothing found" answer is cached
// for the same TTL as a real one). With no explicit date ("latest": Layout, map, About, Desk, Account, /briefings) the record's
// index answers; an explicit date is looked up in the index too (findBrief below).
const LATEST_KEY = '__latest__';
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

// Reads straight from localStorage rather than keeping a separate long-lived in-memory mirror:
// the persisted cache is the single source of truth, and this keeps a test's `localStorage.clear()`
// fully authoritative instead of a stale in-memory copy surviving it across test cases in the same file.
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

const dayKey = (key, back) => new Date(Date.parse(`${key}T00:00:00Z`) - back * 86400000).toISOString().slice(0, 10);

async function actionBrief(key) {
  try {
    const result = await fetchDailyBrief(key);
    return result?.data || null;
  } catch {
    return null;
  }
}

// An explicit date. The record's index knows every edition it holds, so the answer is the requested day, else the newest edition
// before it (within MAX_LOOKBACK_DAYS), read from the record. The action is asked only for days the index cannot hold: the requested
// day when it is newer than the index's newest edition, or (views not fresh, viewsFresh.js) the days between them, at most PROBE_DAYS + 1.
// With no index at all the action is probed for the requested day and the PROBE_DAYS before it. Nothing newer than today is asked.
async function findBrief(requested) {
  const index = await loadBriefsIndex();
  const indexed = index ? index.daily.map((d) => d.dateKey).sort().reverse() : [];
  const newestIndexed = indexed[0] || '';

  let probes = [];
  if (!index) {
    probes = Array.from({ length: PROBE_DAYS + 1 }, (_, back) => dayKey(requested, back));
  } else if (requested > newestIndexed) {
    probes = (await loadViewsFresh()).fresh
      ? [requested]
      : Array.from({ length: PROBE_DAYS + 1 }, (_, back) => dayKey(requested, back)).filter((k) => k > newestIndexed);
  }
  probes = probes.filter((k) => k <= todayUtc());
  const hits = await Promise.all(probes.map(actionBrief)); // nearest first: the first hit is the closest day to the request
  const hit = hits.findIndex(Boolean);
  if (hit >= 0) return { data: hits[hit], served: probes[hit] };

  const oldest = dayKey(requested, MAX_LOOKBACK_DAYS);
  const key = indexed.find((k) => k <= requested && k >= oldest);
  if (!key) return { data: null, served: null };
  const data = (await readDailyBrief(key)) || (await actionBrief(key)); // a view that cannot be read asks the action
  return data ? { data, served: key } : { data: null, served: null };
}

// The record answers the newest brief in the window in two small static reads. newsStoryRecord rebuilds the views right after the
// daily brief (14:15 UTC, decision 0050), so while the views are fresh they are the answer (no brief for today yet is the honest state
// before 14:00). Only when they are not fresh (viewsFresh.js; reported) is the action asked for today's brief alone, as before.
async function findLatestInRecord() {
  const today = todayUtc();
  const recorded = await readLatestDaily({ today, lookbackDays: MAX_LOOKBACK_DAYS });
  if (!recorded) return null;
  if (recorded.dateKey === today || (await loadViewsFresh()).fresh) return { data: recorded.data, served: recorded.dateKey, editions: recorded.editions };
  try {
    const fresh = await fetchDailyBrief(today);
    if (fresh?.data) return { data: fresh.data, served: today, editions: [today, ...recorded.editions] };
  } catch (err) {
    reportFetchError('daily-brief-today', err);
  }
  return { data: recorded.data, served: recorded.dateKey, editions: recorded.editions };
}

async function findLatest() {
  const recorded = await findLatestInRecord();
  if (recorded) return recorded;
  const res = await fetchLatestDailyBrief(MAX_LOOKBACK_DAYS);
  const data = res?.data || null;
  return {
    data,
    served: data ? (res.dateKey || data.dateKey || null) : null,
    editions: Array.isArray(res?.editions) ? res.editions : null,
  };
}

function getOrFetch(effectiveDateKey) {
  const cached = cachedEntry(effectiveDateKey);
  if (cached) return Promise.resolve(cached);
  if (inFlight.has(effectiveDateKey)) return inFlight.get(effectiveDateKey);
  const finder = effectiveDateKey === LATEST_KEY ? findLatest() : findBrief(effectiveDateKey);
  const p = finder
    .then(({ data, served, editions }) => {
      const entry = { data, served, timestamp: Date.now(), ...(editions ? { editions } : {}) };
      storeEntry(effectiveDateKey, entry);
      return entry;
    })
    .finally(() => { inFlight.delete(effectiveDateKey); });
  inFlight.set(effectiveDateKey, p);
  return p;
}

// Shared with the /briefings editions strip: the cached/in-flight "latest" result, including the
// `editions` (dateKeys that have a brief in the lookback window, newest first).
export function loadLatestDailyBrief() {
  return getOrFetch(LATEST_KEY);
}

// `rawDateKey` is a real YYYY-MM-DD day, or anything else (no date, an impossible date) for the latest edition.
export function useDailyBrief(rawDateKey) {
  const dateKey = isCalendarDate(rawDateKey) ? rawDateKey : undefined;
  const [brief, setBrief] = useState(null);
  const [servedDateKey, setServedDateKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const effectiveDateKey = dateKey || LATEST_KEY;

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

  // The newest published edition: what the latest lookup served. With no date that is this hook's own answer; with a date it is the
  // shared (cached) latest lookup. Null while unknown; a failed lookup is reported and shown by the hook that asks it.
  const [otherNewest, setOtherNewest] = useState(null);
  useEffect(() => {
    if (!dateKey) return undefined;
    let live = true;
    loadLatestDailyBrief().then((entry) => { if (live) setOtherNewest(entry?.served || null); }, () => {});
    return () => { live = false; };
  }, [dateKey]);

  return { brief, servedDateKey, latestDateKey: dateKey ? otherNewest : servedDateKey, loading, error, refetch: load };
}
