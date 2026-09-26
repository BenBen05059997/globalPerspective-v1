// useCountryRiskLayer — data for the R4b COUNTRY RISK map layer. Fetches country_intelligence for
// every country candidate the site already knows is "in the news" (the same weekly-archive
// derivation CountryListPage uses), batched at the backend's real per-call cap (15 names — the
// newsSensitiveData Lambda silently slices anything bigger, so a caller that ignores this loses
// the tail of its request without an error), with bounded concurrency and a session cache so
// flipping the layer switch back and forth never re-fetches.
//
// Deliberately does NOT reuse features/threads' useWeeklyArchive — that hook calls useAuth() and
// throws outside an AuthProvider (map tests render SituationHome standalone, and the map's public
// data must never gate on auth anyway — CLAUDE.md). It calls the same public `archive_range`
// proxy action directly instead, with its own tiny module-level cache.
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchArchiveRange, fetchCountryIntelligence } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { chunkNames, MAX_NAMES_PER_CALL, MAX_CONCURRENT_BATCHES, buildCountryRiskLayer } from '@/features/map/lib/countryRiskLayer.js';
import { iso3ForName } from '@/features/map/lib/situationLabels.js';

// How many candidate countries to request briefings for. Bounded so a busy news day can't turn
// one layer switch into dozens of Lambda calls; a country beyond this rank simply isn't drawn
// (same "not every country in the world" honesty the situations layer already applies to old
// situations — nothing invented, just not requested this session).
const MAX_CANDIDATES = 60;

// Module-level session state, shared across every mount of this hook (the desktop console and the
// phone tab render two different trees but should never double-fetch): the archive-derived name
// list, and the country_intelligence results keyed by name.
let archiveNamesCache = null; // string[] | null
let archiveFetchPromise = null;
let intelCache = new Map(); // name -> intel | null
let intelFetchedKey = null; // the namesKey intelCache was built for

function namesFromArchive(dayMap) {
  const counts = new Map();
  for (const day of Object.values(dayMap || {})) {
    for (const entry of (day?.entries || [])) {
      for (const region of (entry.regions || [])) {
        counts.set(region, (counts.get(region) || 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter((name) => iso3ForName(name)) // never request a name this map can't draw
    .slice(0, MAX_CANDIDATES);
}

// A tiny promise pool — at most `limit` chunk requests in flight at once (same spirit as
// restProxy's own MAX_PROXY_CONCURRENCY, scoped to this one batch of calls).
async function runPooled(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function loadArchiveNames() {
  if (archiveNamesCache) return archiveNamesCache;
  if (!archiveFetchPromise) {
    archiveFetchPromise = fetchArchiveRange(30)
      .then((result) => { archiveNamesCache = namesFromArchive(result?.data || {}); return archiveNamesCache; })
      .catch((err) => { reportFetchError('map-country-risk-archive', err); archiveNamesCache = []; return archiveNamesCache; });
  }
  return archiveFetchPromise;
}

export function useCountryRiskLayer(active) {
  const [names, setNames] = useState(() => archiveNamesCache || []);
  const [intelByName, setIntelByName] = useState(() => Object.fromEntries(intelCache));
  const [loading, setLoading] = useState(false);
  const [callCount, setCallCount] = useState(0);
  const startedRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    if (archiveNamesCache) { setNames(archiveNamesCache); return undefined; }
    setLoading(true);
    loadArchiveNames().then((list) => { if (!cancelled) { setNames(list); setLoading(false); } });
    return () => { cancelled = true; };
  }, [active]);

  const namesKey = useMemo(() => names.join(','), [names]);

  useEffect(() => {
    // Only fetch once the layer is actually selected (never on page load just in case) and once
    // per distinct candidate set for the session.
    if (!active || !names.length) return undefined;
    if (intelFetchedKey === namesKey) { setIntelByName(Object.fromEntries(intelCache)); return undefined; }
    if (startedRef.current === namesKey) return undefined;
    startedRef.current = namesKey;

    let cancelled = false;
    const chunks = chunkNames(names, MAX_NAMES_PER_CALL);
    setLoading(true);
    setCallCount(0);
    (async () => {
      await runPooled(chunks, MAX_CONCURRENT_BATCHES, async (chunk) => {
        try {
          const result = await fetchCountryIntelligence(chunk);
          if (cancelled) return;
          const data = result?.data || {};
          for (const name of chunk) intelCache.set(name, data[name] || null);
        } catch (err) {
          if (cancelled) return;
          reportFetchError('map-country-risk-layer', err);
          // Leave this chunk's countries unset (never invented) rather than caching a failure.
        } finally {
          if (!cancelled) setCallCount((n) => n + 1);
        }
      });
      if (cancelled) return;
      intelFetchedKey = namesKey;
      setIntelByName(Object.fromEntries(intelCache));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [active, names, namesKey]);

  const layer = useMemo(() => buildCountryRiskLayer(intelByName, Date.now()), [intelByName]);

  return { ...layer, loading, callCount, candidateCount: names.length };
}
