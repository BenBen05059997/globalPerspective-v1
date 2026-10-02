import { useEffect, useMemo } from 'react';
import { useDailyBrief, MAX_LOOKBACK_DAYS } from '@/features/daily/hooks/useDailyBrief.js';
import { pausedSince } from '@/shared/lib/freshness.js';
import { reportAnalysisAt, useNewestAnalysisAt, newestOf } from '@/shared/lib/analysisFreshness.js';

/**
 * usePausedSince() -> { paused, newestAt }
 * `paused` is null unless the newest generation time across everything already loaded (the daily brief
 * this hook reads through the shared brief cache, plus whatever the stories feed and country
 * intelligence have reported) is older than the pause threshold. No request of its own beyond the
 * brief lookup every page already makes.
 */
export function usePausedSince() {
  const { brief, loading, error } = useDailyBrief();
  useEffect(() => { reportAnalysisAt('daily_brief', brief?.generatedAt); }, [brief]);
  const reportedNewest = useNewestAnalysisAt();
  // Include this render's own brief directly: the store only learns of it after the effect above, and
  // one render with the brief loaded but not yet counted would flash a false "no analysis" line.
  const newestAt = useMemo(() => newestOf([reportedNewest, brief?.generatedAt]), [reportedNewest, brief]);
  const paused = useMemo(() => pausedSince({
    newestAnalysisAt: newestAt,
    searched: !loading && !error,
    lookbackDays: MAX_LOOKBACK_DAYS,
  }), [newestAt, loading, error]);
  return { paused, newestAt };
}

export default usePausedSince;
