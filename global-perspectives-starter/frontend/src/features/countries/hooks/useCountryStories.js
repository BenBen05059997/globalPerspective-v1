// useCountryStories — the country card's "<=3 stories" + "<=2 future dated triggers" data.
// Deliberately does NOT use useWeeklyArchive() (which calls useAuth() and throws outside an
// AuthProvider) — this hook is mounted from the map console's CountryCardV2, and the map's own
// tests render SituationHome standalone (see useCountryRiskLayer.js's identical note). It reads
// the shared public archive (useArchiveDayMap, one cached read per tab) so re-selecting a country
// doesn't re-fetch the 30-day archive every time.
import { useEffect, useMemo, useState } from 'react';
import { fetchPredictionSnapshot } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useArchiveDayMap } from '@/shared/hooks/useArchiveDayMap.js';
import { buildDeadlines } from '@/features/threads';
import { countryMatcher } from '@/features/countries/lib/countryMatch.js';

/**
 * useCountryStories(countryName) -> { stories, deadlines, loading }
 *   stories:   up to 3 { threadId, title, date, category } — most recent thread per story,
 *              newest first. Never invented: a country with no archive entries gets [].
 *   deadlines: this country's stories' future dated forecast triggers (see countryTriggers.js
 *              for the "future only" filter — this hook returns the raw, unfiltered deadlines).
 */
export function useCountryStories(countryName) {
  const { dayMap, loading } = useArchiveDayMap();
  const [snapshot, setSnapshot] = useState(null);

  const { stories, topicIds, topicIdToThreadId } = useMemo(() => {
    if (!countryName || !dayMap) return { stories: [], topicIds: [], topicIdToThreadId: new Map() };
    const inCountry = countryMatcher(countryName);
    const threadMap = new Map();
    const topicIdToThreadIdMap = new Map();
    for (const day of Object.values(dayMap)) {
      for (const entry of (day?.entries || [])) {
        if (!inCountry(entry.regions)) continue;
        if (entry.topicId && entry.threadId) topicIdToThreadIdMap.set(entry.topicId, entry.threadId);
        const key = entry.threadId || entry.topicId;
        if (!key) continue;
        const existing = threadMap.get(key);
        if (!existing || String(entry.date) > String(existing.date)) {
          threadMap.set(key, {
            threadId: entry.threadId || null,
            topicId: entry.topicId || null,
            title: entry.title,
            date: entry.date,
            category: entry.category || 'other',
          });
        }
      }
    }
    const sorted = [...threadMap.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return {
      stories: sorted.slice(0, 3),
      topicIds: sorted.map((s) => s.topicId).filter(Boolean).slice(0, 20),
      topicIdToThreadId: topicIdToThreadIdMap,
    };
  }, [countryName, dayMap]);

  const topicKey = topicIds.join(',');
  useEffect(() => {
    let cancelled = false;
    if (!topicKey) { setSnapshot(null); return undefined; }
    fetchPredictionSnapshot(topicIds)
      .then((res) => { if (!cancelled) setSnapshot(res?.success ? (res.snapshot || null) : null); })
      .catch((err) => { if (!cancelled) { reportFetchError('country-card-forecast', err); setSnapshot(null); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicKey]);

  const deadlines = useMemo(() => buildDeadlines(snapshot), [snapshot]);

  return { stories, deadlines, topicIdToThreadId, loading };
}
