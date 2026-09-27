// imported by Node tooling outside src/ — keep relative imports
// "What changed" lens — the direction-check heuristic (S5c brief, F1 §2 "What changed"):
// a simple, TESTED heuristic that flags an explanation whose wording direction
// contradicts the numeric score movement it is attached to (e.g. text says risk got
// "worse" while the stored score actually moved DOWN). This is a flag, never an
// auto-correction — feedback_no_misinformation_fallback: we never silently rewrite the
// model's or the data's words, only surface the mismatch for the reader to judge.
//
// Score convention (riskTiers.js / countryDirection.js): HIGHER score = MORE risk =
// worse. A score that goes UP is a worsening; DOWN is an improvement.

const WORSE_WORDS = /\b(worse|worsen(?:s|ing|ed)?|deteriorat\w*|escalat\w*|higher risk|increased risk|more dangerous|intensif\w*|risen|rising)\b/i;
const BETTER_WORDS = /\b(better|improv\w*|de-?escalat\w*|lower risk|decreased risk|cooling|calmer|eased?|receding|fallen|falling)\b/i;

// checkDirection({ text, scoreBefore, scoreAfter }) -> { flag, reason }
//   - text: the change-log / drift note prose to check.
//   - scoreBefore / scoreAfter: the two numeric risk-score readings the text describes.
// Returns flag=false whenever there isn't enough to check (missing text, missing/equal
// scores, or wording that doesn't clearly claim a direction) — a heuristic this blunt
// must fail toward silence, not toward crying wolf on ambiguous prose.
export function checkDirection({ text, scoreBefore, scoreAfter } = {}) {
  if (typeof text !== 'string' || !text.trim()) return { flag: false, reason: null };
  if (typeof scoreBefore !== 'number' || typeof scoreAfter !== 'number') return { flag: false, reason: null };
  if (!Number.isFinite(scoreBefore) || !Number.isFinite(scoreAfter)) return { flag: false, reason: null };
  const delta = scoreAfter - scoreBefore;
  if (delta === 0) return { flag: false, reason: null };

  const saysWorse = WORSE_WORDS.test(text);
  const saysBetter = BETTER_WORDS.test(text);
  // Text using both a "worse" and a "better" word (e.g. quoting two sides) is
  // ambiguous — don't flag it, a blunt heuristic should stay quiet rather than guess.
  if (saysWorse === saysBetter) return { flag: false, reason: null };

  if (saysWorse && delta < 0) {
    return {
      flag: true,
      reason: `Text says risk got worse, but the score moved down (${scoreBefore} → ${scoreAfter}) — an improvement by this measure.`,
    };
  }
  if (saysBetter && delta > 0) {
    return {
      flag: true,
      reason: `Text says risk improved, but the score moved up (${scoreBefore} → ${scoreAfter}) — a worsening by this measure.`,
    };
  }
  return { flag: false, reason: null };
}

// checkDirectionInText(text) -> [{ axis, direction, clause, reason }]
//
// A SECOND, self-contained form of the same heuristic (no external score needed): a drift
// note sometimes states its OWN explicit direction claim per axis/clause — "shifts the
// humanitarian score down" — and that claim can contradict the SENTIMENT WORDING in the very
// same clause ("...as trade disruption worsens civilian conditions"). Higher score = worse
// (riskTiers.js convention), so "down" paired with worsening language, or "up" paired with
// improving language, is an internal self-contradiction — catchable without fetching anything.
// Real case (2026-08-19 Iran drift note): "...shifts the humanitarian score down as trade
// disruption worsens civilian conditions" — flagged; the same note's "...economic score up
// from 80 to 90" (escalares/worsens wording) is NOT flagged (consistent).
//
// Splits on clause boundaries so a multi-axis note (this one names both economic and
// humanitarian) is checked per clause, not polluted by an unrelated clause's wording.
const DIRECTION_RE = /\b(?:the\s+)?([a-z]+)\s+score\s+(up|down)\b/gi;
const CLAUSE_RE = /[^.;]+[.;]?/g;

export function checkDirectionInText(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const clauses = text.match(CLAUSE_RE) || [text];
  const out = [];
  for (const clause of clauses) {
    const re = new RegExp(DIRECTION_RE.source, 'gi');
    let m;
    while ((m = re.exec(clause))) {
      const axis = m[1].toLowerCase();
      const direction = m[2].toLowerCase();
      const saysWorse = WORSE_WORDS.test(clause);
      const saysBetter = BETTER_WORDS.test(clause);
      if (saysWorse === saysBetter) continue; // ambiguous or neutral clause — stay quiet
      if (direction === 'down' && saysWorse) {
        out.push({
          axis, direction, clause: clause.trim(),
          reason: `Says the ${axis} score went down (an improvement) but describes it as worsening.`,
        });
      } else if (direction === 'up' && saysBetter) {
        out.push({
          axis, direction, clause: clause.trim(),
          reason: `Says the ${axis} score went up (a worsening) but describes it as improving.`,
        });
      }
    }
  }
  return out;
}
