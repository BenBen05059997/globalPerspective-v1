// Analysis Studio — the network layer. Fetches each selected story's stored material
// and hands it to the PURE prompt assembler in analysisPrompt.js. The prompt/lens/
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
import { dropRedatedRepeats } from '@/features/threads/hooks/useNarrativeThread';
import { reportFetchError } from '@/shared/api/errorSink';
import { assembleContext, buildStorySources, pickText, clip } from '@/features/analysis-studio/lib/analysisPrompt';

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

const MAX_NEWS_PER_STORY = 4;

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
  return items.slice(0, MAX_NEWS_PER_STORY);
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
  if (note.triggerEvent?.title) parts.push(`Trigger: ${note.triggerEvent.title} (${note.triggerEvent.date || 'undated'})`);
  if (note.whyChanged) parts.push(note.whyChanged);
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
    const news = (Array.isArray(t.sources) ? t.sources : []).slice(0, MAX_NEWS_PER_STORY)
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

// Fetch each selected story's D2 material (parallel across stories, capped — the shared
// restProxy request layer caps in-flight proxy calls at 4, so this never bursts the
// backend regardless of how many stories are selected), build typed/budgeted sources per
// story, and assemble the final numbered, citable context.
// Returns { context, citations, perStory, thin, thinTitles, totalChars }.
export async function buildAnalysisContext(selectedTopics) {
  const stories = await Promise.all(
    (selectedTopics || []).map(async (t) => {
      const material = await fetchStoryMaterial(t);
      const { sources, richness, counts, truncated } = buildStorySources(material);
      return { topic: t, sources, richness, counts, truncated };
    })
  );
  return assembleContext(stories);
}
