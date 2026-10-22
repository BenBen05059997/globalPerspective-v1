'use strict';

// The forecast DRAW stage (decision 0038), pure: no network, no clock, no model.
// Cadence: a story is drawn only when it moved (decideReuse says generate) and no fork was drawn
// for its thread in the last MIN_GAP_DAYS. Unit: the outcome, at most lib.MAX_OUTCOMES per draw.
// index.js does the DynamoDB reads and the model call; everything decidable lives here so it is tested.

const lib = require('./lib');

const MIN_GAP_DAYS = 7;
const OPEN_LOOKBACK_DAYS = 90; // PRED# rows older than the horizon cannot hold an open branch

// The text the forecast model is shown. G13 (lib.buildGatedScenarios) checks every date / named
// scheduled event in the model's output against exactly this, so build it in one place.
function forecastInputText(topic, v1 = {}) {
  const snippets = (topic.sources || []).map(s => `${s.source || ''} ${s.snippet || ''}`);
  return [topic.title, topic.description, ...snippets, v1.arcDigest, v1.premiseBlock].filter(Boolean).join('\n');
}

function buildPredictionPrompt(topic, generatedDate, generatedYear, v1 = {}, today = new Date().toISOString().slice(0, 10)) {
  const snippets = topic.sources
    ? topic.sources.map(s => `Source (${s.source}): ${s.snippet || 'No snippet'}`).join('\n')
    : '';

  const snippetBlock = snippets
    ? `\nArticle Snippets:\n${snippets}\n`
    : '';

  const minDeadline = lib.addDays(today, 8);

  return [
    `You are a geopolitical forecasting analyst. Today is ${today} (year ${generatedYear}). Respond with ONLY valid JSON — no markdown, no code fences, no commentary before or after.`,
    '',
    `Topic: ${topic.title}`,
    `Description: ${topic.description}`,
    `Regions: ${(topic.regions || []).join(', ') || 'Unknown'}`,
    v1.premiseBlock || '',
    v1.arcDigest ? `\nHow this story has evolved (our archive, dated — use to ground trajectory, do not restate):\n${v1.arcDigest}\n` : '',
    snippetBlock,
    'CALENDAR RULE (strict): your training data ends before today, so you do NOT know the calendar ahead. Use a specific date, or the name of a scheduled event (summit, session, meeting, election, treaty expiry, review), ONLY if it appears in the Article Snippets, the dated archive digest or the verified facts above. If no scheduled date is known, say "no scheduled date known" — that is a correct, useful answer. Never fill a gap with a plausible date from memory. The "deadline" of an outcome is your own forecast window, not a claim, so you may choose it freely.',
    '',
    'Work in this order and WRITE each step into the JSON (nothing is done silently):',
    '1. precedents: 5 closest past cases (different years/places). For each, how it ended and how long it took.',
    '2. outcomes: AT MOST 3 distinct outcomes for this story, the ones that matter most to a reader. Each outcome\'s "p" STARTS from how often the precedents ended that way, then you adjust for today\'s specifics and say so in the rationale. Fewer than 3 is fine; an empty list is a correct answer when no checkable outcome exists.',
    'Return this JSON structure (all fields required):',
    `{
  "precedents": [
    { "case": "string — past event, place and year", "ended": "string — how it ended", "took": "string — how long it took to resolve" }
  ],
  "outcomes": [
    {
      "text": "string — one specific, falsifiable FUTURE event (who does what)",
      "deadline": "YYYY-MM-DD",
      "p": "integer 2-98 — YOUR probability that this exact event happens by the deadline",
      "resolution_source": "string — the specific public record that will settle it",
      "rationale": "string — 2-4 sentences naming specific actors, mechanisms and the precedent base rate; no date or scheduled event that is not in the input"
    }
  ],
  "winners": ["string — country, industry, or leader name"],
  "losers": ["string — population, economy, or alliance name"]
}`,
    '',
    'OUTCOME RULES (an outcome we cannot score is worthless — follow exactly):',
    `- deadline MUST be an absolute date in YYYY-MM-DD form, on or after ${minDeadline} (events resolving sooner are not scored) and on/before ${lib.addDays(today, 90)} (we keep questions within 90 days).`,
    '- The outcome must describe a FUTURE event that has NOT happened yet — never restate something already reported in the snippets or digest (that is not a prediction).',
    '- If a claim has a window ("within 2 weeks"), put the END of the window as the deadline — never a relative phrase, never a past "precedent" date.',
    '- text must be a single, concrete, checkable event (who does what) — not a vague mood ("tensions rise"). Do not put a date or named scheduled event in the text unless it is in the input.',
    '- Each outcome is a standalone yes/no question judged ALONE, with its own "p". Outcomes are different events, not the same event worded twice.',
    '- "resolution_source" must NAME the publisher or record that will exist after the deadline and settle the question (for example "Reuters or AP wire report", "Official Gazette of Japan", "UN Security Council press release", "IAEA Board report"). Never "news", "media", "reports" or "sources".',
    '- Only name a person in an office if the VERIFIED FACTS above or the snippets support it.',
    'Output only the JSON object.',
  ].join('\n');
}

// The stored / logged shape. Readers (home PredictionDisplay, ThreadForecast, derive.branchesFromScenarios,
// the sampler, LinkedIn) read scenarios[].{label, probability_range, horizon, rationale, triggers[]}, so each
// outcome is written as a one-trigger scenario whose label IS the event text (branch.text = the event).
// `unit: 'outcome'` marks it for logPredictionSnapshot (outcome-mode gates). Non-outcome content is returned as is.
function outcomesToScenarios(parsed) {
  if (!parsed || !Array.isArray(parsed.outcomes)) return parsed;
  const { outcomes, ...rest } = parsed;
  const scenarios = outcomes.filter((o) => o && typeof o === 'object').map((o) => {
    const text = String(o.text || '').trim();
    const p = o.p == null ? null : String(o.p).replace('%', '').trim();
    return {
      label: text,
      probability_range: p ? `${p}%` : null,
      horizon: o.deadline ? `by ${o.deadline}` : null,
      rationale: o.rationale || null,
      triggers: [{ text, deadline: o.deadline, p: o.p, resolution_source: o.resolution_source }],
    };
  });
  return { ...rest, unit: 'outcome', scenarios };
}

// Newest fork day among a thread's PRED# rows ({SK:'YYYY-MM-DD', scenarios}); null when none.
function latestForkDay(rows) {
  let best = null;
  for (const r of rows || []) if (r && /^\d{4}-\d{2}-\d{2}$/.test(r.SK || '') && (!best || r.SK > best)) best = r.SK;
  return best;
}

// Texts of the thread's OPEN branches: any trigger of any PRED# row whose deadline has not passed.
// (Resolved-early branches are not visible here; treating them as open only makes the duplicate gate stricter.)
function openBranchTexts(rows, today) {
  const out = [];
  for (const r of rows || []) {
    for (const sc of (r && r.scenarios) || []) {
      for (const t of (sc && sc.triggers) || []) {
        if (t && t.text && t.deadline && String(t.deadline) >= today) out.push(String(t.text));
      }
    }
  }
  return out;
}

function daysBetween(fromDay, toDay) { return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86400000); }

/**
 * Draw or not. `decision` is lib.decideReuse(...): it says "generate" exactly when the story moved
 * (new, or its article set changed). A story that did not move, or whose thread was drawn in the last
 * MIN_GAP_DAYS, is not drawn again: it reuses the stored forecast when there is a usable one, else skips.
 * force (operator) bypasses the cadence. -> {draw:true,reason} | {draw:false, reuse:boolean, reason}
 */
function drawDecision({ decision, existing, lastForkDay, today, force = false }) {
  if (force) return { draw: true, reason: 'force' };
  if (decision.reuse) return { draw: false, reuse: true, reason: decision.reason };
  const usable = Boolean(existing && existing.contentFormat === 'json');
  if (lastForkDay && daysBetween(lastForkDay, today) < MIN_GAP_DAYS) {
    return { draw: false, reuse: usable, reason: `fork-within-${MIN_GAP_DAYS}d` };
  }
  return { draw: true, reason: decision.reason };
}

module.exports = { MIN_GAP_DAYS, OPEN_LOOKBACK_DAYS, forecastInputText, buildPredictionPrompt, outcomesToScenarios, latestForkDay, openBranchTexts, drawDecision };
