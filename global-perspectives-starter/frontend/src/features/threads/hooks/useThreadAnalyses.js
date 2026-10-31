import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchThreadAnalyses } from '@/shared/api/restProxy';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
import { analysesFromIndex, analysesIndexUsable } from '@/features/threads/lib/analysesFromIndex.js';

const CACHE_KEY = 'gp_thread_analyses_v2';
const CACHE_TTL_MS = 30 * 60 * 1000;
const views = makeRecordViews();

// The record's analyses index (every story's analysis fields in ONE file), or null when it is not generated (404).
// A failed read is reported and thrown (not cached), and the caller asks the action.
function loadAnalysesIndex() {
  return views.fetchAnalysesIndex().catch((err) => { reportFetchError('analyses-index', err); throw err; });
}

/**
 * useThreadAnalyses(threadIds, { light }) — many stories' analyses at once.
 *   light: the caller reads only threadTitle, storyArc, watchQuestions and the tier inputs (dimensions, riskScore,
 *          riskLevel) — the Stories page and the country page's arc list. It then reads the record's analyses
 *          index in one request (no 20-id cap), and falls back to the `thread_analysis` action when the index is
 *          missing or unreadable. Without it (the map's thread panel, which also reads trajectory, rootCauseChain
 *          and entryShortTitles) the action answers, as before.
 */
export function useThreadAnalyses(threadIds, { light = false } = {}) {
  const [fromAction, setFromAction] = useState({});
  const [loading, setLoading] = useState(false);

  const idsKey = useMemo(() => [...threadIds].sort().join(','), [threadIds]);

  const index = useCachedQuery(light && threadIds.length ? 'gp_analyses_index_v1' : null, loadAnalysesIndex, { ttl: CACHE_TTL_MS });
  const indexUsable = analysesIndexUsable(index.data);
  const useIndex = light && indexUsable;
  const actionOn = !light || (!index.loading && !indexUsable);

  const load = useCallback(async () => {
    if (!actionOn || threadIds.length === 0) return;

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
          const hit = {};
          let allHit = true;
          for (const id of threadIds) {
            if (id in cached.data) {
              hit[id] = cached.data[id];
            } else {
              allHit = false;
            }
          }
          if (allHit) {
            setFromAction(hit);
            return;
          }
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    try {
      const result = await fetchThreadAnalyses(threadIds);
      const data = result?.data || {};
      setFromAction(data);
      try {
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const merged = { ...existing.data, ...data };
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } catch {
      setFromAction({});
    } finally {
      setLoading(false);
    }
  }, [idsKey, actionOn]);

  useEffect(() => { load(); }, [load]);

  const fromIndex = useMemo(() => (useIndex ? analysesFromIndex(index.data, threadIds) : null), [useIndex, index.data, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return { analyses: fromIndex ?? fromAction, loading: light ? index.loading || loading : loading };
}
