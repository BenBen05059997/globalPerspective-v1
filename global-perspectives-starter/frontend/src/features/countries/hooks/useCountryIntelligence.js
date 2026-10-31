import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchCountryIntelligence } from '@/shared/api/restProxy';
import { makeRecordViews } from '@/shared/api/recordViews';
import { reportFetchError } from '@/shared/api/errorSink';
import { resolveCountry } from '@/shared/lib/countries';
import { intelligenceFromCountryView } from '@/features/countries/lib/viewIntelligence';
import { reportAnalysisAt, newestOf } from '@/shared/lib/analysisFreshness';
import { chunkNames, MAX_NAMES_PER_CALL, MAX_CONCURRENT_BATCHES } from '@/shared/map/countryRiskLayer.js';
import { loadCountriesIndex, briefingsFromIndex } from '@/shared/api/countryBriefingsIndex.js';

const CACHE_KEY = 'gp_country_intel_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

const views = makeRecordViews();

/**
 * One country's briefing, the record first (decision 0042): the country view's `intelligence`; a country without a
 * view or briefing falls back to the `country_intelligence` action, as does a failed view fetch (reported). Several
 * countries at once (the list page) read the record's countries index in one request (`index/countries.json`), and
 * only when it is missing or unreadable (reported) ask the action, 15 names per call.
 */
export async function fetchCountryBriefing(name, { getViews = views, fetchAction = fetchCountryIntelligence } = {}) {
  const iso3 = resolveCountry(name)?.iso3;
  const view = await getViews.fetchCountryView(iso3).catch((e) => { reportFetchError('country-view-intelligence', e); return null; });
  const fromView = intelligenceFromCountryView(view);
  if (fromView) return fromView;
  const result = await fetchAction([name]);
  return result?.data?.[name] ?? null;
}

function cacheMerge(data) {
  try {
    const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: { ...existing.data, ...data }, timestamp: Date.now() }));
  } catch { /* ignore */ }
}

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
      const data = {};
      if (countryNames.length === 1) {
        const one = await fetchCountryBriefing(countryNames[0]);
        if (one) data[countryNames[0]] = one;
      } else {
        const index = await loadCountriesIndex();
        if (index) {
          Object.assign(data, briefingsFromIndex(index, countryNames));
        } else {
          await runPooled(chunkNames(countryNames, MAX_NAMES_PER_CALL), MAX_CONCURRENT_BATCHES, async (chunk) => {
            const result = await fetchCountryIntelligence(chunk);
            Object.assign(data, result?.data || {});
          });
        }
      }
      setIntelligence(data);
      cacheMerge(data);
    } catch {
      setIntelligence({});
    } finally {
      setLoading(false);
    }
  }, [namesKey]);

  useEffect(() => { load(); }, [load]);

  // The newest real briefing time among the countries loaded feeds the site-wide status line.
  useEffect(() => {
    const newest = newestOf(Object.values(intelligence).map((v) => v?.generatedAt));
    if (newest != null) reportAnalysisAt('country_intelligence', newest);
  }, [intelligence]);

  return { intelligence, loading };
}
