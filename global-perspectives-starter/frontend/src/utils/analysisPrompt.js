// Analysis Studio — the PURE prompt layer (no browser-only imports).
//
// This holds the honesty contract, the fixed guided "lenses", the user-message
// builder, and a pure context assembler that turns already-fetched story data
// into a numbered, citable block. It is deliberately dependency-free so the SAME
// prompts can be exercised from the offline eval harness (quality/analysis) — the
// eval must test exactly what ships, not a copy that can drift.
//
// utils/analysis.js consumes this and adds buildAnalysisContext() (the network
// fetch of our cached SUMMARY/PREDICTION/TRACE_CAUSE), then re-exports the pieces.

// The honesty contract, shared by BOTH Guided and Free-form modes. This is NOT the
// thing being A/B-tested — only the input style (lens vs open prompt) differs.
export const SYSTEM_PROMPT = [
  'You are a senior geopolitical and markets intelligence analyst writing for professional readers.',
  'Analyze ONLY the stories provided below. Ground every claim in them and cite sources with bracket numbers like [1], [2].',
  'If the provided material is insufficient to answer well, say so plainly under a "Limits of this analysis" heading — never invent facts, dates, figures, or sources.',
  'Never fabricate percentages or precise numbers that are not present in the material.',
  'Write clean Markdown: short ## section headings and concise, specific bullet points. Be analytical, not generic.',
].join(' ');

// Deep-research variant — ONLY for providers whose API actually searches the web
// (Perplexity sonar; Anthropic with the web_search tool attached). The closed-book
// SYSTEM_PROMPT forbids outside material; this one instructs the model to gather it —
// via REAL retrieval, never from memory. Sending this to a no-search API would make
// the model fake having searched, so services/llm.js hard-refuses that combination.
export const DEEP_SYSTEM_PROMPT = [
  'You are a senior geopolitical and markets intelligence analyst — the standard is a buy-side desk note or an ISW assessment, not a news recap. Write for professional readers who already know the headlines.',
  'You are given seed stories (numbered [1], [2], …) from our intelligence pipeline. Search the web for current, reputable reporting on these specific stories and gather as many relevant sources as you can.',
  'Then write a DEEP ANALYSIS with these sections:',
  '## Bottom line — Lead with a THESIS: one sharp, directional, defensible call (ideally where you differ from consensus, e.g. "the market is underpricing X"). State your confidence. This is a view, not a summary.',
  '## What happened — The verified picture, dense with HARD NUMBERS pulled from your sources (levels, magnitudes, %, dates, sizes) — each attributed. Specificity is the point; "a large share" is a failure, "~20m b/d, ~20% of seaborne crude" is the bar.',
  '## Why it happened — The transmission mechanism in concrete steps (what moves what, and by roughly how much), not generic drivers.',
  '## What might happen next — 2–3 named scenarios, each with: a calibrated probability; a HISTORICAL ANALOG or base rate that justifies that probability (e.g. "after the 2019 Abqaiq strike Brent spiked ~15% then round-tripped in ~10 days"); and a DATED, FALSIFIABLE trigger ("if no signed deal by <date>, …").',
  '## What the consensus is missing — One genuinely non-obvious insight: an overlooked actor, a second-order effect, or a mispriced risk. If you have nothing non-obvious, say so rather than padding.',
  '## Who is affected — Actors, sectors, instruments; direction and mechanism, cited.',
  'Cite seed stories with their bracket numbers [n]. Every figure and claim from web research must come from a source you actually retrieved — never cite from memory, never invent a number, source, or date. Where sources conflict, give the range and say which you trust and why.',
  'Have a view and defend it, but stay calibrated: distinguish what is established fact from your judgment. If the evidence is genuinely thin, a confident "we cannot call this yet, and here is what would change that" beats false precision — put it under "Limits of this analysis".',
  'Write clean, tight Markdown: short ## headings, specific bullets, no filler, no throat-clearing. Earn the reader\'s time.',
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
export function pickText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const d = obj.data || obj;
  const v = d?.content || d?.summary || d?.prediction || d?.trace_cause || d?.text || '';
  return typeof v === 'string' ? v.trim() : '';
}

export function clip(text, max = 1200) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// How much real material backs a single enriched story. A story with only a bare
// headline (no summary/prediction/background) can't support a confident forecast —
// forcing the Scenario lens onto it produces false precision (the overreach the
// audit caught). We measure the cached prose; sources alone don't carry an analysis.
const THIN_CHARS = 240;

function storyMaterialLength(e) {
  return [e.summary, e.prediction, e.trace].filter(Boolean).join(' ').trim().length;
}

// Assess whether the selected set is too thin to support a confident deep forecast.
// `thin` is true when even the RICHEST selected story is below the bar — i.e. there
// is nowhere near enough material anywhere in the set. Returns the thin story titles.
export function assessRichness(enriched) {
  if (!enriched || !enriched.length) return { thin: true, thinTitles: [] };
  const lengths = enriched.map(storyMaterialLength);
  const thinTitles = enriched
    .filter((e, i) => lengths[i] < THIN_CHARS)
    .map((e) => e.topic?.title)
    .filter(Boolean);
  const thin = Math.max(...lengths) < THIN_CHARS;
  return { thin, thinTitles };
}

// Pure context assembler. Takes already-fetched, enriched topics:
//   [{ topic:{ title, category, regions, sources:[{url}] }, summary, prediction, trace }]
// and returns { context, citations:[{ n, title, regions, sources }], thin, thinTitles }.
// No network — buildAnalysisContext() (in analysis.js) does the fetching and calls this.
export function assembleContext(enriched) {
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
  const { thin, thinTitles } = assessRichness(enriched);
  return { context, citations, thin, thinTitles };
}

// Anti-overreach instruction appended when the selected material is thin (see
// assessRichness). Without it the lens template pressures the model into
// manufacturing scenarios/probabilities a bare headline can't support.
const THIN_GUARD =
  'IMPORTANT — the material on the selected stor(y/ies) is thin (little beyond a headline). ' +
  'Do NOT manufacture scenarios, probabilities, or specific figures the material cannot support. ' +
  'State plainly what can and cannot be concluded, and exactly what additional information would be needed, under a "Limits of this analysis" heading. A short honest answer beats false precision.';

// Compose the final user-message. `mode` is 'guided' (lens), 'freeform' (open prompt),
// or 'deep' (web research — pair with DEEP_SYSTEM_PROMPT + a search-capable provider).
// `thin` (from assembleContext) appends the anti-overreach guard. In deep mode thin
// is less relevant (the web supplies material) so the guard is skipped there.
export function buildUserMessage({ context, mode, lensId, focus, freeform, thin }) {
  let task;
  if (mode === 'deep') {
    task =
      'DEEP RESEARCH REQUEST: Search the web for additional current reporting on the seed stories above and produce the structured deep analysis (What happened / Why / What might happen next / Who is affected).';
    if (freeform && freeform.trim()) task += `\nReader's focus: ${freeform.trim()}`;
    return `${context}\n\n---\n${task}\n\nCite seed stories with [n]; web claims only from sources you actually retrieved.`;
  }
  if (mode === 'freeform') {
    task = (freeform || '').trim() || 'Give a sharp intelligence analysis of the selected stories.';
    task = `ANALYST REQUEST: ${task}`;
  } else {
    const lens = getLens(lensId);
    task = `TASK — ${lens.label}: ${lens.task}`;
    if (focus && focus.trim()) task += `\nAdditional focus from the reader: ${focus.trim()}`;
  }
  const guard = thin ? `\n\n${THIN_GUARD}` : '';
  return `${context}\n\n---\n${task}${guard}\n\nRemember: cite with [n], and flag anything the stories don't support.`;
}
