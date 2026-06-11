// Analysis Studio — the network layer. Fetches each selected topic's cached AI
// (SUMMARY / PREDICTION / TRACE_CAUSE) and hands it to the PURE prompt assembler
// in analysisPrompt.js. The prompt/lens/validator logic lives in dependency-free
// modules so the offline eval (quality/analysis) can reuse exactly what ships.

import {
  fetchSummaryCache,
  fetchPredictionCache,
  fetchTraceCauseCache,
} from '../services/restProxy';
import { assembleContext, pickText, clip } from './analysisPrompt';

// Re-export the pure prompt pieces so existing importers (AnalysisStudio.jsx)
// keep working unchanged.
export {
  SYSTEM_PROMPT,
  LENSES,
  getLens,
  buildUserMessage,
  pickText,
  clip,
} from './analysisPrompt';

// Fetch the cached AI for each selected topic and assemble a numbered, citable
// context block. Returns { context, citations:[{ n, title, regions, sources }] }.
export async function buildAnalysisContext(selectedTopics) {
  const enriched = await Promise.all(
    selectedTopics.map(async (t) => {
      const [s, p, c] = await Promise.allSettled([
        fetchSummaryCache(t.topicId),
        fetchPredictionCache(t.topicId),
        fetchTraceCauseCache(t.topicId),
      ]);
      return {
        topic: t,
        summary: clip(pickText(s.status === 'fulfilled' ? s.value : null)),
        prediction: clip(pickText(p.status === 'fulfilled' ? p.value : null)),
        trace: clip(pickText(c.status === 'fulfilled' ? c.value : null)),
      };
    })
  );
  return assembleContext(enriched);
}
