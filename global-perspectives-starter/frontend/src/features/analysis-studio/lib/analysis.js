// Analysis Studio — the network layer. The pure context builder (analysisContext.js) fetches each selected
// story's stored material through the browser's proxy layer and hands it to the PURE prompt assembler in analysisPrompt.js. The prompt/lens/
// validator logic lives in dependency-free modules so the offline eval
// (quality/analysis) can reuse exactly what ships.
//
// D2 (TASK_2026-09-27_pages_local.md S5b): every selected story is now analysable,
// not only the ~17 with today's SUMMARY/PREDICTION/TRACE_CAUSE cache. When a selected
// story carries a `threadId` (STORY_WEB_RETHINK_PLAN's durable thread id, e.g.
// `thread-germany-…`), we pull the archive's stored history for that thread instead:
//   - NEWS      — archive snippets from narrative_thread (headline + outlet + date),
//                 with re-dated repeats dropped (dropRedatedRepeats, same rule story
//                 mode uses — a re-dated headline must never look like a second event).
//   - ANALYSIS  — the stored THREAD_ANALYSIS record (trajectory / cause chain / arc).
//   - DRIFT     — that record's latest grounded "what changed" note (DRIFT#), the
//                 closest public read to THREAD_HISTORY/DRIFTLOG for a single thread
//                 (see report: no public action serves the full THREAD_HISTORY/DRIFTLOG
//                 time series for one thread — country_history has one, threads don't).
//   - FORECAST  — the newest v1 prediction_snapshot (scenarios + dated triggers).
// A story with no threadId (or with a threadId but nothing stored yet) falls back to
// the existing per-topic SUMMARY/PREDICTION/TRACE_CAUSE cache as a single ANALYSIS
// source, exactly as before — so today's flow is unchanged when D2 material doesn't apply.

import {
  fetchSummaryCache,
  fetchPredictionCache,
  fetchTraceCauseCache,
  fetchNarrativeThread,
  fetchThreadAnalyses,
  fetchPredictionSnapshot,
} from '@/shared/api/restProxy';
import { dropRedatedRepeats } from '@/shared/lib/dropRedatedRepeats.js';
import { reportFetchError } from '@/shared/api/errorSink';
import * as promptLib from '@/features/analysis-studio/lib/analysisPrompt';
import { createContextBuilder } from '@/features/analysis-studio/lib/analysisContext.js';
import { safeWhy, safeTriggerEvent } from '@/shared/lib/driftNote.js';

// Re-export the pure prompt pieces so existing importers (AnalysisStudio.jsx)
// keep working unchanged.
export {
  SYSTEM_PROMPT,
  DEEP_SYSTEM_PROMPT,
  LENSES,
  getLens,
  buildUserMessage,
  pickText,
  clip,
} from '@/features/analysis-studio/lib/analysisPrompt';

// Wires the pure builder to the browser's proxy layer (concurrency-capped by restProxy) and the error sink.
// The identical builder runs in the newsSharedAnalysis Lambda when a run is shared.
// Returns { context, citations, perStory, thin, thinTitles, totalChars, sources }.
export const buildAnalysisContext = createContextBuilder({
  fetchers: {
    summary: fetchSummaryCache,
    prediction: fetchPredictionCache,
    traceCause: fetchTraceCauseCache,
    narrativeThread: fetchNarrativeThread,
    threadAnalyses: fetchThreadAnalyses,
    predictionSnapshot: fetchPredictionSnapshot,
  },
  assembly: {
    assembleContext: promptLib.assembleContext,
    buildStorySources: promptLib.buildStorySources,
    pickText: promptLib.pickText,
    clip: promptLib.clip,
    MAX_NEWS_PER_STORY: promptLib.MAX_NEWS_PER_STORY,
  },
  helpers: { safeWhy, safeTriggerEvent, dropRedatedRepeats },
  onError: reportFetchError,
});
