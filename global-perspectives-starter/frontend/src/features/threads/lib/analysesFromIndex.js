// analysesFromIndex — the record's analyses index (/data/record/views/index/analyses.json, decision 0042) as the
// `{ threadId: analysis }` map `thread_analysis` gave. The index carries the fields the Stories page and the country
// page's arc list read (threadTitle, storyArc, watchQuestions and the tier inputs dimensions/riskScore/riskLevel,
// plus generatedAt); the map's thread panel needs more (trajectory, rootCauseChain, entryShortTitles) and stays on
// the action. A story with no analysis note is simply absent, as in the action's answer. Pure.

/** True when the index can answer: an object of analyses. */
export const analysesIndexUsable = (index) => Boolean(index && typeof index.analyses === 'object' && index.analyses && !Array.isArray(index.analyses));

/** @returns {Object<string, object>} the requested stories that have an analysis, in the action's shape */
export function analysesFromIndex(index, threadIds) {
  if (!analysesIndexUsable(index)) return {};
  const out = {};
  for (const id of threadIds || []) if (index.analyses[id]) out[id] = index.analyses[id];
  return out;
}
