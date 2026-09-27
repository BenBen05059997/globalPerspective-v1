import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchCountryIntelligence } from '@/shared/api/restProxy';
import { chunkNames, MAX_NAMES_PER_CALL, MAX_CONCURRENT_BATCHES } from '@/features/map/lib/countryRiskLayer.js';

const CACHE_KEY = 'gp_country_intel_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

// A tiny promise pool — mirrors useCountryRiskLayer.js's runPooled so both callers of
// country_intelligence chunk the same way and neither silently truncates past the
// backend's 15-name-per-call cap (newsSensitiveData index.js:517).
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

export function useCountryIntelligence(countryNames) {
  const [intelligence, setIntelligence] = useState({});
  const [loading, setLoading] = useState(false);

  const namesKey = useMemo(() => [...countryNames].sort().join(','), [countryNames]);

  const load = useCallback(async () => {
    if (countryNames.length === 0) return;

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
          const hit = {};
          let allHit = true;
          for (const name of countryNames) {
            if (name in cached.data) {
              hit[name] = cached.data[name];
            } else {
              allHit = false;
            }
          }
          if (allHit) {
            setIntelligence(hit);
            return;
          }
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    try {
      // Never call the proxy with more than MAX_NAMES_PER_CALL names — the backend silently
      // slices anything bigger (CLAUDE.md / countryRiskLayer.js), which used to strand
      // CountryListPage's 24-name ask at the first 15 with no error. Batch + merge instead.
      const chunks = chunkNames(countryNames, MAX_NAMES_PER_CALL);
      const data = {};
      await runPooled(chunks, MAX_CONCURRENT_BATCHES, async (chunk) => {
        const result = await fetchCountryIntelligence(chunk);
        Object.assign(data, result?.data || {});
      });
      setIntelligence(data);
      try {
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const merged = { ...existing.data, ...data };
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } catch {
      setIntelligence({});
    } finally {
      setLoading(false);
    }
  }, [namesKey]);

  useEffect(() => { load(); }, [load]);

  return { intelligence, loading };
}
