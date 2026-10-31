import { fetchStoryAnalysis } from '@/shared/api/storyAnalysis.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes, as useThreadAnalyses

/**
 * One story's analysis: the record's story view `analysis` (decision 0042), the `thread_analysis` action when the
 * view has none. Many stories at once stay on useThreadAnalyses.
 */
export function useStoryAnalysis(threadId) {
  const key = threadId ? `gp_story_analysis_v1_${threadId}` : null;
  const { data, loading } = useCachedQuery(key, () => fetchStoryAnalysis(threadId), { ttl: CACHE_TTL_MS, storage: 'session' });
  return { analysis: data ?? null, loading };
}
