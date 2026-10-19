// analysisContext — turns selected stories into the numbered, typed, citable context a Studio run is
// built on. PURE and IMPORT-FREE: every dependency is injected, so the identical file runs in the
// browser (analysis.js wires restProxy) and in the newsSharedAnalysis Lambda (which wires plain HTTP
// calls to the public proxy and re-derives the sources itself when a run is shared). The Lambda's copy
// is byte-identical (scripts/check-shared-sync.mjs).
//
// createContextBuilder({ fetchers, assembly, helpers, onError }) -> buildAnalysisContext(selectedTopics)
//   fetchers: { summary(topicId), prediction(topicId), traceCause(topicId), narrativeThread(threadId),
//               threadAnalyses(threadIds), predictionSnapshot(topicIds) }   (same response shapes as restProxy)
//   assembly: { assembleContext, buildStorySources, pickText, clip, MAX_NEWS_PER_STORY }   (analysisPrompt.js)
//   helpers:  { safeWhy, safeTriggerEvent, dropRedatedRepeats }
//   onError:  (label, err) => void   (the browser reports to the error sink; the Lambda logs)
// Returns { context, citations, perStory, thin, thinTitles, totalChars, sources }, where `sources` is the
// full numbered list ({ n, kind, date, label, storyTitle, url, text }) a share freezes.
//
// D2 (TASK_2026-09-27_pages_local.md S5b): every selected story becomes typed, dated sources — archive
// snippets (NEWS), the stored thread analysis (ANALYSIS), the latest drift note (DRIFT) and the forecast
// log (FORECAST) — so any story in the archive is analysable, not only today's ~17.
// A story with no threadId falls back to the per-topic SUMMARY/PREDICTION/TRACE_CAUSE cache as one
// ANALYSIS source. Never throws: a failed sub-fetch reports and the story keeps whatever it has.

export function createContextBuilder({ fetchers, assembly, helpers, onError = () => {} }) {
  const { assembleContext, buildStorySources, pickText, clip, MAX_NEWS_PER_STORY } = assembly;
  const { safeWhy, safeTriggerEvent, dropRedatedRepeats } = helpers;
  const MAX_NEWS = MAX_NEWS_PER_STORY;
  const fetchSummaryCache = fetchers.summary;
  const fetchPredictionCache = fetchers.prediction;
  const fetchTraceCauseCache = fetchers.traceCause;
  const fetchNarrativeThread = fetchers.narrativeThread;
  const fetchThreadAnalyses = fetchers.threadAnalyses;
  const fetchPredictionSnapshot = fetchers.predictionSnapshot;
  const reportFetchError = onError;

  // Turn a narrative_thread entry list into typed NEWS candidates (headline + outlet +
  // date, verbatim snippet). Drops re-dated repeats first (an archive re-write of an old
  // story under today's date must never be fed as two different events — same rule
  // story mode applies, threads/hooks/useNarrativeThread.js). Newest first, capped.
  function newsFromThreadEntries(entries) {
    const deduped = dropRedatedRepeats(Array.isArray(entries) ? entries : []);
    const items = [];
    for (const entry of deduped) {
      const date = entry?.archivedAt ? entry.archivedAt.slice(0, 10) : null;
      for (const s of Array.isArray(entry?.sources) ? entry.sources : []) {
        if (!s) continue;
        items.push({ title: s.title || entry.topicId || null, outlet: s.source || null, date, snippet: s.snippet || null, url: s.url || null });
      }
    }
    items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return items.slice(0, MAX_NEWS);
  }

  // Build a short, cited-by-nothing-but-honest text block from a stored THREAD_ANALYSIS
  // record — the pieces most useful to a downstream lens, in plain prose.
  function analysisTextFromRecord(rec) {
    if (!rec) return '';
    const parts = [];
    if (rec.trajectory) parts.push(`Trajectory: ${rec.trajectory}`);
    if (rec.rootCauseChain) parts.push(`Cause chain: ${Array.isArray(rec.rootCauseChain) ? rec.rootCauseChain.join(' → ') : rec.rootCauseChain}`);
    if (rec.storyArc) parts.push(`Story arc: ${rec.storyArc}`);
    if (Array.isArray(rec.watchQuestions) && rec.watchQuestions.length) parts.push(`Watch: ${rec.watchQuestions.slice(0, 3).join(' | ')}`);
    return parts.join('\n');
  }

  function driftTextFromNote(note) {
    if (!note) return '';
    const level = note.changeLevel ? `${note.changeLevel.from} → ${note.changeLevel.to}` : null;
    const parts = [];
    if (level) parts.push(`Risk level ${level}`);
    const trig = safeTriggerEvent(note); // direction-flagged notes: numbers only, no trusted cause
    if (trig?.title) parts.push(`Trigger: ${trig.title} (${trig.date || 'undated'})`);
    if (safeWhy(note)) parts.push(safeWhy(note));
    return parts.join(' — ');
  }

  // The stored `probability` field has been observed as BOTH a 0–1 fraction and a
  // 0–100 percentage across snapshot generations — normalize to a percentage for
  // display without ever inventing a number that wasn't in the record.
  function toPercent(p) {
    if (typeof p !== 'number' || Number.isNaN(p)) return null;
    return p <= 1 ? Math.round(p * 1000) / 10 : Math.round(p * 10) / 10;
  }

  function forecastTextFromSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.scenarios) || !snapshot.scenarios.length) return '';
    return snapshot.scenarios.map((s) => {
      const pct = toPercent(s.probability);
      const p = pct != null ? ` (${pct}%)` : '';
      const triggers = (s.triggers || []).slice(0, 3).map((t) => `${t.text} by ${t.deadline}${t.verdict ? ` [${t.verdict}]` : ''}`).join('; ');
      return `${s.label}${p}${triggers ? ` — ${triggers}` : ''}`;
    }).join('\n');
  }

  // Fetch one story's D2 material. Never throws — a failed sub-fetch reports to the
  // error sink and the story simply falls back to whatever it has (fail empty, honest).
  async function fetchStoryMaterial(t) {
    const threadId = t.threadId || null;
    if (!threadId) {
      // Legacy path (no threadId known for this story): today's per-topic cache only.
      const [s, p, c] = await Promise.allSettled([
        fetchSummaryCache(t.topicId),
        fetchPredictionCache(t.topicId),
        fetchTraceCauseCache(t.topicId),
      ]);
      const summary = clip(pickText(s.status === 'fulfilled' ? s.value : null));
      const prediction = clip(pickText(p.status === 'fulfilled' ? p.value : null));
      const trace = clip(pickText(c.status === 'fulfilled' ? c.value : null));
      const analysisText = [summary && `Summary: ${summary}`, prediction && `Prediction: ${prediction}`, trace && `Background: ${trace}`]
        .filter(Boolean).join('\n');
      const news = (Array.isArray(t.sources) ? t.sources : []).slice(0, MAX_NEWS)
        .map((src) => ({ title: t.title, outlet: null, date: null, snippet: null, url: src?.url || null }))
        .filter((n) => n.url);
      return {
        analysis: analysisText ? { text: analysisText, generatedAt: null } : null,
        forecast: null,
        drift: null,
        news,
      };
    }

    const [threadRes, analysesRes, snapshotRes] = await Promise.allSettled([
      fetchNarrativeThread(threadId),
      fetchThreadAnalyses([threadId]),
      fetchPredictionSnapshot([t.topicId].filter(Boolean)),
    ]);

    let news = [];
    if (threadRes.status === 'fulfilled') {
      news = newsFromThreadEntries(threadRes.value?.data);
    } else {
      reportFetchError('analysis-studio-narrative-thread', threadRes.reason);
    }

    let analysis = null;
    let drift = null;
    let extraTopicIds = [];
    if (analysesRes.status === 'fulfilled') {
      const rec = analysesRes.value?.data?.[threadId];
      if (rec) {
        const text = analysisTextFromRecord(rec);
        if (text) analysis = { text, generatedAt: rec.generatedAt || null };
        if (rec.driftNote) {
          const dtext = driftTextFromNote(rec.driftNote);
          if (dtext) drift = { text: dtext, generatedAt: rec.driftNote.asOf || null };
        }
        extraTopicIds = (rec.entryShortTitles || []).map((e) => e.topicId).filter(Boolean);
      }
    } else {
      reportFetchError('analysis-studio-thread-analysis', analysesRes.reason);
    }

    // The first prediction_snapshot call only tried the story's own topicId — a thread
    // usually has several dated entries, each its own topicId, and the forecast log is
    // keyed by topicId. Retry with the fuller set from thread_analysis when it added
    // topicIds we didn't already try (best-effort; never blocks the run on failure).
    let forecast = null;
    let snapshotOutcome = snapshotRes;
    if (extraTopicIds.length > 0) {
      const tried = new Set([t.topicId].filter(Boolean));
      if (extraTopicIds.some((id) => !tried.has(id))) {
        snapshotOutcome = await Promise.allSettled([
          fetchPredictionSnapshot([...tried, ...extraTopicIds]),
        ]).then((r) => r[0]);
      }
    }
    if (snapshotOutcome.status === 'fulfilled') {
      const snap = snapshotOutcome.value?.snapshot;
      if (snap) {
        const text = forecastTextFromSnapshot(snap);
        if (text) forecast = { text, generatedAt: snap.generatedAt || null };
      }
    } else {
      reportFetchError('analysis-studio-prediction-snapshot', snapshotOutcome.reason);
    }

    return { analysis, forecast, drift, news };
  }

  // Fetch each selected story's D2 material (parallel across stories), build typed/budgeted sources per story,
  // and assemble the final numbered, citable context.
  return async function buildAnalysisContext(selectedTopics) {
    const stories = await Promise.all(
      (selectedTopics || []).map(async (t) => {
        const material = await fetchStoryMaterial(t);
        const { sources, richness, counts, truncated } = buildStorySources(material);
        return { topic: t, sources, richness, counts, truncated };
      })
    );
    const assembled = assembleContext(stories);
    // the full numbered source list (text included), for a share to freeze; numbering matches `citations`
    let n = 0;
    const sourcesFull = [];
    for (const story of stories) {
      for (const s of story.sources || []) {
        n += 1;
        sourcesFull.push({ n, kind: s.kind, date: s.date || null, label: s.label || null, storyTitle: story.topic?.title || null, url: s.url || null, text: s.text });
      }
    }
    return { ...assembled, sources: sourcesFull };
  };
}
