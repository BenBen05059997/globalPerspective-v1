// Analysis Studio — parser for the optional ```gp-struct fenced JSON block.
//
// The prompt (analysisPrompt.js SYSTEM_PROMPT, guided scenario/economic lenses) asks the
// model to append a fenced ```gp-struct block after its prose: a machine-readable INDEX of
// numbers/names already stated in the analysis (scenario probability ranges, indicators,
// economic ripples) — never new content. This module turns that optional block into data
// the UI can render as compact visuals (see components/atoms/AnalysisVisuals.jsx), while
// keeping the anti-fabrication guarantee: nothing renders unless it can be traced back to
// the prose the model actually wrote.
//
// Pure + dependency-free on purpose — same reason as analysisPrompt.js: the offline eval
// (quality/analysis/check.mjs) and any future Node tooling must import exactly what ships,
// with no browser globals.

const FENCE_RE = /```gp-struct\s*\n?([\s\S]*?)```/;
// Truncation guard: the block comes LAST in the model's output, so a token-cap cutoff
// leaves an OPENING fence with no closing ``` — the closed-fence regex won't match and
// the partial JSON would leak into the prose (false-triggering invented_figure and
// rendering as garbage). Caught live 2026-07-10 on the first structured re-sample.
const OPEN_FENCE_RE = /```gp-struct[^\n]*\n?/;

// extractStruct(text) → { struct, prose }
//   - struct: the parsed JSON object, or null if no fence / malformed JSON / not an object.
//   - prose: `text` with the fence (and its content) removed — this is what the Markdown
//     renderer and the honesty validator must see; the raw JSON must never reach either
//     (bare percentages in the block would false-trigger the validator's invented_figure
//     check, and the block itself is not meant to be read as prose).
// Never throws — a malformed or truncated block degrades to "no struct", not a crash.
export function extractStruct(text) {
  const raw = typeof text === 'string' ? text : '';
  const m = raw.match(FENCE_RE);
  if (!m) {
    // No closed fence — check for a truncated (unclosed) one and strip it to the end:
    // a half-emitted JSON block is never renderable content.
    const open = raw.match(OPEN_FENCE_RE);
    if (open) return { struct: null, prose: raw.slice(0, open.index).trim() };
    return { struct: null, prose: raw };
  }

  const prose = (raw.slice(0, m.index) + raw.slice(m.index + m[0].length)).trim();

  let parsed;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return { struct: null, prose };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { struct: null, prose };
  }
  return { struct: parsed, prose };
}

const DIRECTIONS = new Set(['up', 'down', 'mixed']);
const MAGNITUDES = new Set(['small', 'moderate', 'large']);

// True only when EVERY number in `nums` literally appears (as a plain digit string)
// somewhere in `prose`. This is the anti-invention cross-check from the plan: the
// gp-struct block may only index numbers the model already committed to in its prose —
// a scenario whose probability the prose never mentions is treated as invented and dropped.
function numsInProse(nums, prose) {
  const p = prose || '';
  return nums.every((n) => p.includes(String(n)));
}

function isPct(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
}

// validateStruct(struct, prose) → sanitized struct, or null when nothing survives.
// Drops (never repairs):
//   - scenarios with non-numeric/out-of-range/inverted pLow/pHigh, or whose probability
//     digits do not literally appear in the prose (the anti-invention cross-check).
//   - indicators missing a non-empty `signal` or `confirms` (the required fields; `kills`
//     is optional per the plan's "scenario name|" example).
//   - ripples with a bad/missing `direction` or `magnitude` enum, or empty `instrument`.
// An emptied section is omitted entirely (never rendered as an empty table/row).
export function validateStruct(struct, prose) {
  if (!struct || typeof struct !== 'object') return null;
  const p = typeof prose === 'string' ? prose : '';

  const scenarios = (Array.isArray(struct.scenarios) ? struct.scenarios : [])
    .filter((s) => s && typeof s.name === 'string' && s.name.trim())
    .filter((s) => isPct(s.pLow) && isPct(s.pHigh) && s.pLow <= s.pHigh)
    .filter((s) => numsInProse([s.pLow, s.pHigh], p))
    .map((s) => ({ name: s.name.trim(), pLow: s.pLow, pHigh: s.pHigh }));

  const indicators = (Array.isArray(struct.indicators) ? struct.indicators : [])
    .filter((i) => i && typeof i.signal === 'string' && i.signal.trim())
    .filter((i) => typeof i.confirms === 'string' && i.confirms.trim())
    .map((i) => ({
      signal: i.signal.trim(),
      confirms: i.confirms.trim(),
      kills: typeof i.kills === 'string' ? i.kills.trim() : '',
    }));

  const ripples = (Array.isArray(struct.ripples) ? struct.ripples : [])
    .filter((r) => r && typeof r.instrument === 'string' && r.instrument.trim())
    .filter((r) => DIRECTIONS.has(r.direction) && MAGNITUDES.has(r.magnitude))
    .map((r) => ({ instrument: r.instrument.trim(), direction: r.direction, magnitude: r.magnitude }));

  const out = {};
  if (scenarios.length) out.scenarios = scenarios;
  if (indicators.length) out.indicators = indicators;
  if (ripples.length) out.ripples = ripples;
  return Object.keys(out).length ? out : null;
}
