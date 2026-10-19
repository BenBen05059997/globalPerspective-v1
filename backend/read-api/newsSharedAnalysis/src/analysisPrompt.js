// imported by Node tooling outside src/ — keep relative imports
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
//
// P1 (professional-structure upgrade, ANALYSIS_PRO_STRUCTURE_PLAN.md): adds a Key
// Judgments box, the ICD-203 probability yardstick, and the probability/confidence
// distinction. Every new instruction below carries its OWN omit-when-unsupported
// escape hatch — the 06-13 lesson (structure pressure induces fabrication) means we
// never add a "must fill this box" rule without also saying "fewer/none is fine."
// None of the pre-existing honesty lines above are touched or weakened.
export const SYSTEM_PROMPT = [
  'You are a senior geopolitical and markets intelligence analyst writing for professional readers.',
  'Open with a one-line "Bottom line": your sharpest defensible takeaway — ideally the angle a casual reader would miss — but ONLY where the material supports it; never manufacture a thesis (if the material is too thin for a view, say so plainly instead).',
  'Immediately after the Bottom line, add a "## Key judgments" section of 2–4 bullets — each ONE decision-relevant judgment, stated with a yardstick probability term (see below) AND a separate confidence level (low/moderate/high) justified by how deep/corroborated the material is. Only include a bullet where the material genuinely supports a calibrated judgment; if it supports fewer than 2, write fewer, or omit the section and say why — NEVER manufacture a judgment just to fill the box. The detailed sections follow after Key judgments.',
  'Probability vocabulary — when stating likelihood anywhere (Key judgments or elsewhere), use EXACTLY this yardstick, word plus numeric range together: almost no chance (1–5%) · very unlikely (5–20%) · unlikely (20–45%) · roughly even chance (45–55%) · likely (55–80%) · very likely (80–95%) · almost certain (95–99%) — or a narrower explicit range inside a band (e.g. "60–70% — likely"). Never use vague hedges ("could", "may well") for a headline judgment; if you cannot honestly attach a yardstick term, say the probability is not assessable rather than guessing one.',
  'Probability and confidence are DIFFERENT axes — never conflate them. Probability = how likely the event is. Confidence = how solid the underlying material is (single-source/thin → low; multi-source/corroborated → high), independent of how likely the event seems. State both for every Key judgment (e.g. "likely (55–80%), moderate confidence"). A thin, single-source story caps confidence at low no matter how probable the event looks.',
  'Favor structural drivers (geography, institutions, incentives, economics) over personalities and day-to-day events where both fit.',
  'Analyze ONLY the stories provided below. Ground every claim in them and cite sources with bracket numbers.',
  'Each story below is backed by one or more numbered, TYPED sources — e.g. [1] (NEWS, dated), [2] (ANALYSIS, dated), [3] (FORECAST, dated). Cite ONLY source numbers that exist in the material: never invent a number, and never cite higher than the highest [n] shown.',
  'Citation integrity: a citation [n] means that specific claim is stated in source n, and a FORECAST-kind source is OUR OWN forecast, not a reported fact. Do NOT attach [n] to a date, figure, or trigger that comes only from a FORECAST source or that you derived yourself; mark such items "(our forecast)" or leave them uncited. Stapling [n] to a source that never reported it is fabrication even if the number is plausible.',
  'You MAY use general background knowledge for framing and mechanisms — but NEVER cite [n] for it, and never present outside knowledge as something the story reported. Reserve [n] strictly for claims actually in that story; if a useful fact is your own knowledge (e.g. a gang\'s known activities, a chokepoint\'s share of trade), say so as analyst context, uncited — do not launder it through a source number.',
  'CRITICAL — sharpness must never become fabrication: do NOT invent specific names, organizations, dates, or figures to sound authoritative or precise. If you lack a specific, stay general; a true general statement beats a fabricated specific.',
  'If the provided material is insufficient to answer well, say so plainly under a "Limits of this analysis" heading — never invent facts, dates, figures, or sources.',
  'Never fabricate percentages or precise numbers that are not present in the material.',
  'Write clean Markdown: short ## section headings and concise, specific bullet points. Be analytical, not generic.',
  'For the SCENARIO FORECAST and ECONOMIC RIPPLE tasks (skip this ONLY for other lenses and free-form): you MUST end your ENTIRE response with ONE fenced code block tagged ```gp-struct``` containing ONLY JSON — no prose inside it. This is not optional for these two lenses: a scenario forecast always states scenario probabilities, and an economic-ripple analysis always names affected instruments, so you will always have at least one array to fill. Copy this exact shape and fill it from what you already wrote:\n```gp-struct\n{"scenarios":[{"name":"Ceasefire holds","pLow":45,"pHigh":55,"by":"2026-10-31","places":["Strait of X"]},{"name":"Localized clashes resume","pLow":30,"pHigh":40},{"name":"Full collapse","pLow":10,"pHigh":20}],"indicators":[{"signal":"Daily transit volume returns to 80% of baseline","confirms":"Ceasefire holds","kills":"Full collapse"}],"ripples":[{"instrument":"Brent crude","direction":"up","magnitude":"moderate"}]}\n```\nRules: `direction` is exactly up|down|mixed; `magnitude` is exactly small|moderate|large; `pLow`/`pHigh` are integers 0–100 with pLow ≤ pHigh. `by` and `places` on a scenario are OPTIONAL and INDEX-ONLY, same rule as everything else in this block: include `by` (an ISO date, YYYY-MM-DD) ONLY when your prose already names that exact dated trigger for that scenario, and `places` (an array of place names) ONLY when your prose already names those places for that scenario — omit either field rather than guessing a date or a place just to fill it. Omit only an INDIVIDUAL array that genuinely does not apply (e.g. no ripples in a pure scenario forecast) — never skip the whole block for these two lenses. HARD RULE: this block is a machine-readable INDEX of the analysis above — it may contain ONLY numbers and names you already stated in your prose; never introduce a new scenario, indicator, figure, date, or place here that is not already written out above.',
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
  '## What might happen next — 2–3 named scenarios that fork on DISTINCT OUTCOMES (include a genuine downside/tail; probabilities should roughly partition to ~100%, not cluster). Each with: a calibrated probability; a HISTORICAL ANALOG or base rate that justifies that probability (e.g. "after the 2019 Abqaiq strike Brent spiked ~15% then round-tripped in ~10 days"); and a DATED, FALSIFIABLE trigger ("if no signed deal by <date>, …").',
  '## What the consensus is missing — One genuinely non-obvious insight: an overlooked actor, a second-order effect, or a mispriced risk. If you have nothing non-obvious, say so rather than padding.',
  '## Who is affected — Actors, sectors, instruments; direction and mechanism, cited.',
  'Cite seed stories with their bracket numbers [n] — e.g. [1], [2]. For anything from your web search, use a DIFFERENT marker so the two never collide: [W1] for the first web source you cite, [W2] for the second, and so on, in the order you first use them — never reuse [W1] for a second, different web source. Every figure and claim from web research must come from a source you actually retrieved — never cite from memory, never invent a number, source, or date. Where sources conflict, give the range and say which you trust and why.',
  'Have a view and defend it, but stay calibrated: distinguish what is established fact from your judgment. If the evidence is genuinely thin, a confident "we cannot call this yet, and here is what would change that" beats false precision — put it under "Limits of this analysis".',
  'Write clean, tight Markdown: short ## headings, specific bullets, no filler, no throat-clearing. Earn the reader\'s time.',
].join(' ');

// Guided lenses — fixed templates. Each `task` is appended after the cited context.
export const LENSES = [
  {
    id: 'scenario',
    label: 'Scenario forecast',
    blurb: 'Named scenarios with probabilities and dated triggers',
    // The prompt below hard-requires a closing ```gp-struct``` block for this lens —
    // used by the validator's structural/schema-failure check (analysisValidator.js).
    requiresStruct: true,
    task:
      'Produce a SCENARIO FORECAST of 2–3 scenarios that fork on genuinely DISTINCT OUTCOMES (e.g. holds / stalls in limbo / collapses) — NOT the same outcome at different speeds (a "fast" vs "slow" version of success is one scenario, not two). You MUST include a real downside/tail scenario (what failure looks like), especially when the recent baseline was severe (e.g. an active shooting conflict). The scenarios are mutually exclusive, so their probabilities must roughly PARTITION: make them meaningfully different AND have their midpoints sum to ~100% (a small residual is fine). For each: a rough probability using the yardstick vocabulary, the key triggers, and what evidence would confirm or kill it. Attach a date to a trigger ONLY if that date appears in the source story itself (not in our Prediction field); otherwise write "timing unclear" or a relative horizon — never invent a calendar date, and never cite [n] for a date the story did not report. End with the single most important thing to watch. THEN, as a separate consolidated dashboard (this does not replace the per-scenario confirm/kill prose above), close with a markdown table `| Indicator to watch | Confirms | Kills |` — one row per concrete, OBSERVABLE signal (something a reader could check in the news), mapping it to the scenario(s) it confirms and the scenario(s) it kills. If the material supports fewer than 2 real, observable indicators, write "No clean indicators derivable from this material" instead of padding the table. FINALLY, after that table, you MUST append the machine-readable ```gp-struct``` JSON block described in the system instructions, indexing the exact scenarios (with their probabilities) and indicators you just wrote — this is a required part of the scenario-forecast output, not an optional add-on.',
  },
  {
    id: 'whatchanged',
    label: 'What changed',
    blurb: 'What moved since last time, and why — flags a wording/score mismatch',
    task:
      'Write a WHAT CHANGED analysis: state plainly what is DIFFERENT about this story since the most recent prior material you were given (a stored analysis, drift note, or forecast, if present) — the specific development, and why it moved things in that direction. If no prior material exists to compare against, say so and describe the current state instead of inventing a "before". Close with a short, dated change log: 2–4 bullets, each one dated event and its effect, oldest first. Never state or imply a numeric risk score yourself — that comes from our own stored scoring, not your judgment; describe direction and mechanism in words only.',
  },
  {
    id: 'economic',
    label: 'Economic ripple',
    blurb: 'Instruments/sectors affected, direction, mechanism',
    requiresStruct: true,
    // PARKED (S5c, TASK_2026-09-27_pages_local.md): removed from the launch lens picker.
    // The prompt/task and validator path stay wired (never deleted) so a future go-live
    // decision can re-enable it by dropping this flag — AnalysisStudio.jsx filters
    // `hidden` lenses out of the rendered picker only, never out of LENSES itself.
    hidden: true,
    task:
      'Map the ECONOMIC RIPPLE. For EACH affected instrument, sector or commodity give the chain: direction (up/down/mixed) → rough magnitude (small/moderate/large) → the transmission mechanism (what specifically moves it, and why). JUSTIFY the magnitude — say WHY it is small vs moderate vs large; never just assert the label. Include ONLY ripples with a real, non-trivial mechanism, and prefer 3–5 high-conviction ones over an exhaustive checklist — OMIT negligible or speculative links rather than padding to fill categories (e.g. a financing/listing event does not move commodity markets; if a chain is hand-wavy or could plausibly run the other way, drop it). Do NOT invent percentage moves; if a mechanism cannot be derived from the material, write "mechanism unclear" rather than asserting a direction. FINALLY, after the prose, you MUST append the machine-readable ```gp-struct``` JSON block described in the system instructions, listing each instrument you named with its direction and magnitude in the `ripples` array — this is a required part of the economic-ripple output, not an optional add-on. Include a short "Who\'s exposed" read — the specific actors/sectors that gain or lose from this repricing, each tied to the direction→magnitude→mechanism above (name only actors present in the material; never invent firms/tickers).',
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

// D2 (TASK_2026-09-27_pages_local.md S5b): every selected story becomes a set of
// TYPED, DATED, numbered sources instead of one opaque per-story block — archive
// snippets (NEWS), the stored thread analysis (ANALYSIS), the latest drift note
// (DRIFT), and the forecast log (FORECAST). This lets a story with no current-day
// AI cache (i.e. every story except today's ~17) still be genuinely analysable from
// what we already store, and lets the reader (and the validator) see exactly which
// kind of material backs each citation and how old it is.
//
// A per-story character budget keeps a rich thread (many archive entries + a full
// stored analysis) from crowding out every other selected story — see
// buildStorySources(). Priority when trimming: ANALYSIS > FORECAST > DRIFT > NEWS
// (the analyst's own synthesis is worth more per-character than a raw headline).
export const SOURCE_KINDS = ['NEWS', 'ANALYSIS', 'DRIFT', 'FORECAST'];
export const SOURCE_KIND_LABELS = {
  NEWS: 'News',
  ANALYSIS: 'Analysis',
  DRIFT: 'What changed',
  FORECAST: 'Forecast',
};
export const PER_STORY_BUDGET_CHARS = 1800;
export const MAX_NEWS_PER_STORY = 4;

function clipTo(text, max) {
  if (!text) return '';
  const t = String(text).trim();
  if (t.length <= max) return t;
  return max > 1 ? `${t.slice(0, max - 1)}…` : '';
}

// Build the typed, budgeted source list for ONE story from already-fetched raw
// material (analysis.js does the fetching; this is pure). Each of `analysis`,
// `forecast`, `drift` is `{ text, generatedAt } | null`; `news` is
// `[{ title, outlet, date, snippet, url }]` (already deduped — see
// dropRedatedRepeats, threads/hooks/useNarrativeThread.js — and ideally newest
// first). Returns `{ sources, richness, counts, truncated }`.
//
// `richness` is RICH iff the story carries any STORED material beyond raw
// headlines (ANALYSIS / DRIFT / FORECAST) — matching TRACK_RECORD_AND_STUDIO_RULING.md's
// "per-story material RICH / THIN" definition. Headlines-only (NEWS only, or
// nothing at all) is THIN: real, but too thin to support a confident forecast.
export function buildStorySources({ analysis, forecast, drift, news } = {}, opts = {}) {
  const budget = opts.budget || PER_STORY_BUDGET_CHARS;
  const maxNews = opts.maxNews || MAX_NEWS_PER_STORY;

  const candidates = [];
  if (analysis?.text) {
    candidates.push({ kind: 'ANALYSIS', date: analysis.generatedAt || null, label: 'Stored thread analysis', text: analysis.text });
  }
  if (forecast?.text) {
    candidates.push({ kind: 'FORECAST', date: forecast.generatedAt || null, label: 'Forecast log', text: forecast.text });
  }
  if (drift?.text) {
    candidates.push({ kind: 'DRIFT', date: drift.generatedAt || null, label: 'What changed', text: drift.text });
  }
  (Array.isArray(news) ? news.slice(0, maxNews) : []).forEach((a) => {
    if (!a || !(a.snippet || a.title)) return;
    candidates.push({
      kind: 'NEWS',
      date: a.date || null,
      label: a.outlet || 'News source',
      text: a.snippet || a.title,
      url: a.url || null,
    });
  });

  const sources = [];
  let used = 0;
  let truncated = false;
  for (const c of candidates) {
    const remaining = budget - used;
    if (remaining <= 20) { truncated = true; continue; }
    const cap = Math.min(remaining, c.kind === 'NEWS' ? 320 : 900);
    const text = clipTo(c.text, cap);
    if (!text) { truncated = true; continue; }
    if (text.length < String(c.text).trim().length) truncated = true;
    used += text.length;
    sources.push({ ...c, text });
  }

  const counts = { NEWS: 0, ANALYSIS: 0, DRIFT: 0, FORECAST: 0 };
  sources.forEach((s) => { counts[s.kind] = (counts[s.kind] || 0) + 1; });
  const richness = (counts.ANALYSIS > 0 || counts.DRIFT > 0 || counts.FORECAST > 0) ? 'RICH' : 'THIN';
  return { sources, richness, counts, truncated };
}

// Pure context assembler. Takes stories that already carry a typed `sources` array
// (buildStorySources output): `[{ topic:{ title, category, regions }, sources, richness,
// counts, truncated }]`. Numbers sources [n] SEQUENTIALLY ACROSS ALL STORIES (not one
// number per story) so every archive snippet, stored analysis, drift note and forecast
// gets its own citable, typed, dated number. No network — buildAnalysisContext() (in
// analysis.js) does the fetching + buildStorySources() and calls this.
//
// Returns { context, citations:[{ n, kind, date, label, storyTitle, url }],
//   perStory:[{ title, richness, counts, truncated }], thin, thinTitles, totalChars }.
export function assembleContext(stories) {
  const list = Array.isArray(stories) ? stories : [];
  const citations = [];
  const perStory = [];
  let n = 0;

  const blocks = list.map((story) => {
    const t = story.topic || {};
    const regions = Array.isArray(t.regions) ? t.regions.join(', ') : '';
    const storySources = Array.isArray(story.sources) ? story.sources : [];
    const lines = [`STORY: ${t.title || 'Untitled'}${regions ? ` (${regions})` : ''}`];
    storySources.forEach((s) => {
      n += 1;
      citations.push({ n, kind: s.kind, date: s.date || null, label: s.label || null, storyTitle: t.title, url: s.url || null });
      const dateStr = s.date ? s.date : 'date unknown';
      const label = s.label ? ` — ${s.label}` : '';
      lines.push(`[${n}] (${s.kind} · ${dateStr}${label}) ${s.text}`);
    });
    if (storySources.length === 0) lines.push('(no material available for this story)');
    perStory.push({
      title: t.title,
      richness: story.richness || 'THIN',
      counts: story.counts || { NEWS: 0, ANALYSIS: 0, DRIFT: 0, FORECAST: 0 },
      truncated: !!story.truncated,
    });
    return lines.join('\n');
  });

  const context = `STORIES (typed, dated sources — cite by bracket number):\n\n${blocks.join('\n\n')}`;
  const thin = perStory.length > 0 && perStory.every((p) => p.richness === 'THIN');
  const thinTitles = perStory.filter((p) => p.richness === 'THIN').map((p) => p.title).filter(Boolean);
  return { context, citations, perStory, thin, thinTitles, totalChars: context.length };
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
