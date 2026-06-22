// composeTopicsLede — deterministic "Today's lede" one-line orientation band.
//
// Pure function over the data Home + the Map already load (today's `topics` and
// the economic-disruption list). NO LLM, NO fabrication: the headline is a real
// topic title and every count traces to a real input field. It mirrors the
// /economy `composeEconomyBriefing` honesty contract.
//
// Honesty contract (enforced by quality/briefing/verify_lede.mjs):
//   - the lede headline is verbatim one of the input topics' titles
//   - topicCount / countryCount / threadCount equal real tallies of the inputs
//   - the `reason` is derived from a real signal on the chosen topic (severity
//     of a cited disruption, urgency flag, trending flag, or source count) —
//     never invented
//   - if there are no topics, it returns { empty: true } and the band renders
//     nothing rather than a placeholder lede

const SEV_RANK = { severe: 3, moderate: 2, minor: 1 };

// Build threadId → highest severity cited by the disruption list.
function severityByThread(disruptions) {
  const m = {};
  for (const d of disruptions || []) {
    const tid = d && d.scopeId;
    if (!tid) continue;
    const rank = SEV_RANK[d.severity] || 0;
    if (rank > (SEV_RANK[m[tid]] || 0)) m[tid] = d.severity;
  }
  return m;
}

const sourceCountOf = (t) => (Array.isArray(t && t.sources) ? t.sources.length : 0);

// Returns { empty, lede, topicCount, countryCount, threadCount, text }.
// `lede` = { title, threadId, category, country, reason } | null.
export function composeTopicsLede({ topics = [], disruptions = [] } = {}) {
  const list = Array.isArray(topics) ? topics.filter((t) => t && t.title) : [];

  if (list.length === 0) {
    return {
      empty: true,
      lede: null,
      topicCount: 0,
      countryCount: 0,
      threadCount: 0,
      text: 'No topics loaded yet.',
    };
  }

  const sevByThread = severityByThread(disruptions);

  // Distinct countries (from each topic's regions[]) and distinct active threads.
  const countries = new Set();
  const threads = new Set();
  for (const t of list) {
    for (const r of Array.isArray(t.regions) ? t.regions : []) {
      if (r && typeof r === 'string') countries.add(r.trim());
    }
    if (t.threadId) threads.add(t.threadId);
  }

  // ── Pick the day's lede: severity of cited disruption first, then urgency,
  // then trending, then source count. Ties resolve to the earlier topic. ──
  const score = (t) => {
    const sev = SEV_RANK[sevByThread[t.threadId]] || 0;
    return sev * 1000
      + (t.urgency === 'high' ? 400 : 0)
      + (t.x_trending ? 200 : 0)
      + Math.min(sourceCountOf(t), 99);
  };

  let best = null;
  let bestScore = -1;
  for (const t of list) {
    const s = score(t);
    if (s > bestScore) { best = t; bestScore = s; }
  }

  // Reason traces to the winning signal that put this topic on top.
  const sev = sevByThread[best.threadId];
  const srcN = sourceCountOf(best);
  let reason = null;
  if (sev) reason = `${sev} economic impact`;
  else if (best.urgency === 'high') reason = 'urgent';
  else if (best.x_trending) reason = 'trending';
  else if (srcN > 0) reason = `${srcN} source${srcN !== 1 ? 's' : ''}`;

  const lede = {
    title: best.title,
    threadId: best.threadId || null,
    category: best.category || null,
    country: best.primaryCountry || (Array.isArray(best.regions) ? best.regions[0] : null) || null,
    reason,
  };

  const topicCount = list.length;
  const countryCount = countries.size;
  const threadCount = threads.size;

  const metaParts = [`${topicCount} ${topicCount === 1 ? 'story' : 'stories'}`];
  if (countryCount) metaParts.push(`${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`);
  if (threadCount) metaParts.push(`${threadCount} active ${threadCount === 1 ? 'thread' : 'threads'}`);

  const text = `Today's lede: ${lede.title}. ${metaParts.join(', ')}.`;

  return { empty: false, lede, topicCount, countryCount, threadCount, text };
}

export default composeTopicsLede;
