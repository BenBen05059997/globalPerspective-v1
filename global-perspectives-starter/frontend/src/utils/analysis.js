// Analysis Studio core logic: the guardrailed system prompt, the fixed "lenses"
// (Guided mode), and the builder that turns the user's selected stories into a
// cited context block. Provider-agnostic — consumed by AnalysisStudio.jsx.

import {
  fetchSummaryCache,
  fetchPredictionCache,
  fetchTraceCauseCache,
} from '../services/restProxy';

// The honesty contract, shared by BOTH Guided and Free-form modes. This is NOT the
// thing being A/B-tested — only the input style (lens vs open prompt) differs.
export const SYSTEM_PROMPT = [
  'You are a senior geopolitical and markets intelligence analyst writing for professional readers.',
  'Analyze ONLY the stories provided below. Ground every claim in them and cite sources with bracket numbers like [1], [2].',
  'If the provided material is insufficient to answer well, say so plainly under a "Limits of this analysis" heading — never invent facts, dates, figures, or sources.',
  'Never fabricate percentages or precise numbers that are not present in the material.',
  'Write clean Markdown: short ## section headings and concise, specific bullet points. Be analytical, not generic.',
].join(' ');

// Guided lenses — fixed templates. Each `task` is appended after the cited context.
export const LENSES = [
  {
    id: 'scenario',
    label: 'Scenario forecast',
    blurb: 'Named scenarios with probabilities and dated triggers',
    task:
      'Produce a SCENARIO FORECAST: 2–3 named scenarios. For each, give a rough probability, the key (dated where possible) triggers, and what evidence would confirm or kill it. End with the single most important thing to watch.',
  },
  {
    id: 'winners_losers',
    label: 'Winners & losers',
    blurb: 'Who benefits, who is hurt — by actor and sector',
    task:
      'Identify WINNERS and LOSERS from these developments, split into Actors (states, companies, groups) and Sectors. For each, one specific line on the mechanism, cited.',
  },
  {
    id: 'economic',
    label: 'Economic ripple',
    blurb: 'Instruments/sectors affected, direction, mechanism',
    task:
      'Map the ECONOMIC RIPPLE: which instruments, sectors or commodities are affected, the likely direction (up/down/mixed), and the transmission mechanism. Qualitative only — do NOT invent percentage moves.',
  },
  {
    id: 'root_cause',
    label: 'Root-cause chain',
    blurb: 'Immediate trigger → medium-term condition → structural factor',
    task:
      'Give the ROOT-CAUSE CHAIN in three layers: (1) immediate trigger, (2) medium-term condition, (3) structural factor. Then name one commonly underreported angle.',
  },
  {
    id: 'compare',
    label: 'Compare stories',
    blurb: 'Shared drivers, divergences, combined outlook',
    task:
      'COMPARE and synthesize the selected stories: shared drivers, key divergences, and a single combined outlook. Best when 2+ stories are selected.',
  },
];

export function getLens(id) {
  return LENSES.find((l) => l.id === id) || LENSES[0];
}

// Tolerant text extraction — the cache actions return slightly different shapes.
function pickText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const d = obj.data || obj;
  const v = d?.content || d?.summary || d?.prediction || d?.trace_cause || d?.text || '';
  return typeof v === 'string' ? v.trim() : '';
}

function clip(text, max = 1200) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

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

  const citations = [];
  const blocks = enriched.map((e, i) => {
    const n = i + 1;
    const t = e.topic;
    const regions = Array.isArray(t.regions) ? t.regions.join(', ') : '';
    const sources = Array.isArray(t.sources)
      ? t.sources.map((s) => s.url).filter(Boolean)
      : [];
    citations.push({ n, title: t.title, regions, sources });

    const lines = [`[${n}] ${t.title}`];
    if (t.category || regions) lines.push(`Category: ${t.category || '—'} | Regions: ${regions || '—'}`);
    if (e.summary) lines.push(`Summary: ${e.summary}`);
    if (e.prediction) lines.push(`Prediction: ${e.prediction}`);
    if (e.trace) lines.push(`Background: ${e.trace}`);
    if (sources.length) lines.push(`Sources: ${sources.slice(0, 6).join(' ; ')}`);
    return lines.join('\n');
  });

  const context = `STORIES (cite by bracket number):\n\n${blocks.join('\n\n')}`;
  return { context, citations };
}

// Compose the final user-message. `mode` is 'guided' (lens) or 'freeform' (open prompt).
export function buildUserMessage({ context, mode, lensId, focus, freeform }) {
  let task;
  if (mode === 'freeform') {
    task = (freeform || '').trim() || 'Give a sharp intelligence analysis of the selected stories.';
    task = `ANALYST REQUEST: ${task}`;
  } else {
    const lens = getLens(lensId);
    task = `TASK — ${lens.label}: ${lens.task}`;
    if (focus && focus.trim()) task += `\nAdditional focus from the reader: ${focus.trim()}`;
  }
  return `${context}\n\n---\n${task}\n\nRemember: cite with [n], and flag anything the stories don't support.`;
}
