// useStoryCardData — the console's story card (M5b) fetch: the topic's per-topic summary
// (SUMMARY cache, keyed by topicId) and the thread's THREAD_ANALYSIS record (keyed by threadId),
// fetched in parallel, reusing the same endpoints the story page already uses (no new backend
// call). Distinguishes an honest "no data yet" (most older stories have no summary, and a brand
// new story has no thread analysis — see DATA FACTS) from a genuine fetch failure:
//   - a normal cache-miss / "not generated yet" rejection leaves that field null — the caller
//     omits the section (CLAUDE.md: no placeholder UI), no error reported;
//   - a real network/server failure (5xx, a thrown TypeError from a dead fetch) sets
//     `fetchError: true` and is reported to the client-error sink; the caller then shows only
//     the header + "Open full story" link, never a "something went wrong" box.
import { useEffect, useState } from 'react';
import { contentService } from '@/shared/data/contentService.js';
import { fetchThreadAnalyses } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';

// Matches an actual transport/server failure, not the everyday "nothing cached for this id yet"
// rejection contentService throws (see getTopicSummary's own "Summary cache unavailable" reason).
const REAL_FAILURE_RE = /Proxy HTTP 5\d\d|network ?error|failed to fetch|ECONNRESET|ETIMEDOUT|NetworkError/i;

const EMPTY = { loading: false, summary: null, analysis: null, fetchError: false };

export function useStoryCardData(topic) {
  const topicId = topic?.topicId || null;
  const threadId = topic?.threadId || null;

  const [state, setState] = useState(() => (topicId || threadId ? { ...EMPTY, loading: true } : EMPTY));

  useEffect(() => {
    let cancelled = false;
    if (!topicId && !threadId) {
      setState(EMPTY);
      return undefined;
    }
    setState({ ...EMPTY, loading: true });

    (async () => {
      let summary = null;
      let analysis = null;
      let fetchError = false;

      if (topicId) {
        try {
          const data = await contentService.getTopicSummary(topicId);
          if (data?.content) summary = { content: data.content, generatedAt: data.generatedAt || null };
        } catch (err) {
          if (REAL_FAILURE_RE.test(err?.message || '')) {
            fetchError = true;
            reportFetchError('story-card-summary', err);
          }
          // else: an honest cache-miss for a story with no summary yet — leave it null.
        }
      }

      if (threadId) {
        try {
          const result = await fetchThreadAnalyses([threadId]);
          analysis = result?.data?.[threadId] || null;
        } catch (err) {
          // The whole lookup failed (not just a missing key) — that's a real failure.
          fetchError = true;
          reportFetchError('story-card-analysis', err);
        }
      }

      if (!cancelled) setState({ loading: false, summary, analysis, fetchError });
    })();

    return () => { cancelled = true; };
  }, [topicId, threadId]);

  return state;
}

export default useStoryCardData;
