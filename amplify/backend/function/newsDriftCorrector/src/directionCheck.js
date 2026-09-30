'use strict';

// Drift-note direction check (Batch 3 / phase E, D9). A note's `whyChanged` must not explain a LOWER
// score with a worsening, or a HIGHER score with an improvement. Convention (riskTiers.js): higher
// score = more risk = worse. Pure, no AWS / network; unit-tested in ../test/directionCheck.test.js.
//
// Two independent checks, both tuned to FAIL TOWARD SILENCE (a false flag hides a good explanation;
// a missed flag only leaves today's behaviour):
//   1. axisEffects (structural, no NLP): the model states, per moved axis, whether the CITED event
//      "worsens" or "improves" that axis; that word is compared with the sign of the stored delta.
//   2. prose (regex, per clause): a clause that states a score direction (up / down / raising /
//      lowering ...) must not carry wording of the opposite valence. Port of the frontend's
//      features/analysis-studio/lib/directionCheck.js `checkDirectionInText`, with the ambiguous
//      words removed (falling / fallen / rising / risen / cooling: "the Rhine falling to a record
//      low ... economic score up" is NOT an improvement claim) and the verb forms it missed added
//      ("lowering the economic score", "driving ... score up").
// The regex source lines below are compared with the frontend copy by scripts/check-shared-sync.mjs.

const AXES = ['conflict', 'political', 'economic', 'humanitarian'];

const WORSE_WORDS = /\b(worse|worsen(?:s|ing|ed)?|deteriorat\w*|(?<!de-?)escalat\w*|higher risk|increased risk|more dangerous|intensif\w*|heighten\w*|disrupt\w*|undermin\w*|casualties|instability)\b/i;
const BETTER_WORDS = /\b(better|improv\w*|de-?escalat\w*|lower risk|decreased risk|reduced risk|calmer|eas(?:e|es|ed|ing)|receding|stabili[sz](?:e|es|ed|ing)|hopes? for (?:a )?(?:deal|de-?escalation|peace))\b/i;

// A clause states a direction for a score/risk: "score down", "risk fell", "lowering the economic score",
// "driving the economic score up", "raising political risk".
const DOWN_RE = /\b(?:(?:score|risk)\s+(?:down|lower|lowered|fell|falls|dropped|drops|declined|declines)|(?:lower(?:s|ing|ed)?|reduc(?:e|es|ing|ed)|decreas(?:e|es|ing|ed)|cut(?:s|ting)?|driv(?:e|es|ing)\s+(?:\w+\s+){0,3}(?:score|risk)\s+down)\s+(?:the\s+)?(?:\w+\s+){0,2}(?:score|risk))\b/i;
const UP_RE = /\b(?:(?:score|risk)\s+(?:up|higher|rose|rises|increased|increases)|(?:rais(?:e|es|ing|ed)|increas(?:e|es|ing|ed)|push(?:es|ing|ed)|lift(?:s|ing|ed)?)\s+(?:the\s+)?(?:\w+\s+){0,2}(?:score|risk)|driv(?:e|es|ing)\s+(?:the\s+)?(?:\w+\s+){0,2}(?:score|risk)\s+up)\b/i;
// finer than sentences: a multi-axis note packs opposite claims into one sentence
const CLAUSE_SPLIT = /[.;]+|,?\s+\b(?:while|whereas|but)\b\s+|,?\s+and\s+(?=the\s+\w+\s+(?:score|risk)\b)/i;
// "reducing immediate political escalation risk", "easing tensions", "prevent further casualties": a worsening
// word that is the OBJECT of a reducing verb is an improvement, not a worsening.
const NEGATED_WORSE = /\b(?:reduc\w*|lower\w*|eas(?:e|es|ed|ing)|calm\w*|defus\w*|prevent\w*|avert\w*|curb\w*|mitigat\w*|cut(?:s|ting)?|halt\w*|stop\w*|end(?:s|ed|ing)?)\b(?:\s+\w+){0,4}?\s+(?:escalat\w*|tension\w*|risk|toll|casualties|instability|disrupt\w*|violence|intensif\w*)\b/gi;

function clausesOf(text) {
  return String(text || '').split(CLAUSE_SPLIT).map((c) => c.trim()).filter(Boolean);
}

// -> [{ direction: 'up'|'down', clause, reason }] clauses whose stated score direction contradicts their own wording.
function checkProseDirection(text) {
  const out = [];
  for (const clause of clausesOf(text)) {
    const down = DOWN_RE.test(clause); const up = UP_RE.test(clause);
    if (down === up) continue;                       // no claim, or contradictory claim inside the clause: stay quiet
    const negated = clause.match(NEGATED_WORSE) || [];
    const stripped = clause.replace(NEGATED_WORSE, ' ');
    const worse = WORSE_WORDS.test(stripped); const better = BETTER_WORDS.test(stripped) || negated.length > 0;
    if (worse === better) continue;                  // neutral or mixed wording: stay quiet
    if (down && worse) out.push({ direction: 'down', clause, reason: 'says a score went down (an improvement) but describes it as worsening' });
    else if (up && better) out.push({ direction: 'up', clause, reason: 'says a score went up (a worsening) but describes it as improving' });
  }
  return out;
}

// A clause that names an axis and states a direction the STORED delta contradicts ("humanitarian score
// up" when the stored humanitarian delta is negative). -> [{ axis, said, actual, clause }]
function checkAxisClaims(text, changeDimensions) {
  const out = [];
  const dims = changeDimensions || {};
  for (const clause of clausesOf(text)) {
    const words = clause.split(/\s+/);
    for (const axis of AXES) {
      const d = dims[axis] && Number(dims[axis].delta);
      if (!Number.isFinite(d) || d === 0) continue;
      // only the words AROUND the axis name count: one clause can name several axes with different directions
      words.forEach((w, i) => {
        if (!new RegExp(`^${axis}\\b`, 'i').test(w.replace(/^[^a-z]+/i, ''))) return;
        const win = words.slice(Math.max(0, i - 5), i + 6).join(' ');
        const down = DOWN_RE.test(win); const up = UP_RE.test(win);
        if (down === up) return;
        if ((up && d < 0) || (down && d > 0)) out.push({ axis, said: up ? 'up' : 'down', actual: d > 0 ? 'up' : 'down', clause });
      });
    }
  }
  return out;
}

// axisEffects: { axis: 'worsens'|'improves'|'unclear' } stated by the model for the CITED event.
// -> [{ axis, said, actual }] where the effect contradicts the sign of the stored delta.
function checkAxisEffects(axisEffects, axisMovesArr) {
  const out = [];
  const eff = axisEffects && typeof axisEffects === 'object' ? axisEffects : {};
  for (const m of Array.isArray(axisMovesArr) ? axisMovesArr : []) {
    const said = String(eff[m.axis] || '').toLowerCase();
    if ((said === 'worsens' && m.delta < 0) || (said === 'improves' && m.delta > 0)) out.push({ axis: m.axis, said, actual: m.delta > 0 ? 'rose' : 'fell' });
  }
  return out;
}

// One verdict for a parsed model note. `axisMovesArr` = lib.axisMoves(prior, current); `changeDimensions` =
// lib.changeDimensionsFrom(...). ok=false lists every reason (used for the retry message + the flag).
function checkDrift(note, { axisMovesArr = [], changeDimensions } = {}) {
  const problems = [];
  if (!note || typeof note.whyChanged !== 'string') return { ok: true, problems };
  for (const p of checkAxisEffects(note.axisEffects, axisMovesArr)) problems.push({ kind: 'axisEffect', ...p });
  for (const p of checkAxisClaims(note.whyChanged, changeDimensions)) problems.push({ kind: 'axisClaim', ...p });
  for (const p of checkProseDirection(note.whyChanged)) problems.push({ kind: 'prose', ...p });
  return { ok: problems.length === 0, problems };
}

// Words for the retry message: what to fix, in plain language.
function describeProblems(problems) {
  return problems.map((p) => {
    if (p.kind === 'axisEffect') return `you said the cited event ${p.said} the ${p.axis} axis, but its score ${p.actual}`;
    if (p.kind === 'axisClaim') return `you wrote that the ${p.axis} score went ${p.said}, but it went ${p.actual}`;
    return `this clause ${p.reason}: "${p.clause}"`;
  }).join('; ');
}

// Deterministic replacement text when the model cannot get the direction right twice: built from the
// stored numbers only (never the rejected prose).
function numbersOnlyText(drift) {
  const moved = drift && drift.moved; const dims = moved && moved.axisMoves ? moved.axisMoves : [];
  const parts = dims.map((m) => `${m.axis.charAt(0).toUpperCase()}${m.axis.slice(1)} risk ${m.delta > 0 ? 'rose' : 'fell'} ${Math.abs(m.delta)} points (${m.from} to ${m.to})`);
  if (!parts.length) {
    const a = Number(drift && drift.prior && drift.prior.riskScore); const b = Number(drift && drift.current && drift.current.riskScore);
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) parts.push(`Overall risk score ${b > a ? 'rose' : 'fell'} ${Math.abs(b - a)} points (${a} to ${b})`);
  }
  const head = parts.length ? `${parts.join('; ')}.` : 'The overall read moved.';
  return `${head} No listed event explains a move in this direction.`;
}

module.exports = { checkDrift, checkProseDirection, checkAxisClaims, checkAxisEffects, describeProblems, numbersOnlyText, clausesOf, WORSE_WORDS, BETTER_WORDS, DOWN_RE, UP_RE, CLAUSE_SPLIT, AXES };
