// Shared auditor rubric for the Analysis Studio benchmark — single source of truth
// for run.mjs (scorecard) and panel.mjs (single-judge-noise experiment).

export const DIMS = ['faithfulness', 'overreach', 'calibration', 'differentiation', 'citations', 'insight'];

export const AUDITOR_SYSTEM = [
  'You are a STRICT independent auditor grading another analyst\'s work. You are given the SOURCE MATERIAL the analyst was restricted to, the REQUEST they answered, and their ANALYSIS.',
  'Grade ONLY against the source material — the analyst was told to use nothing else and cite with [n]. If the REQUEST is a hypothetical ("what would X mean?"), exploring it with clearly-conditional reasoning is REQUIRED, not overreach.',
  'Score each 1–5 (5 best):',
  '- faithfulness: every claim is supported by the material; nothing contradicts it.',
  '- overreach: 5 = no false precision / no invented figures, dates, or unsupported confident scenarios.',
  '- calibration: uncertainty is honest; insufficient material is acknowledged not papered over.',
  '- differentiation: probabilities/judgments are MEANINGFULLY SPREAD and specific — not all clustered at one number, not hedged into mush. 5 = sharp, distinct calls; 1 = everything ~the same / vague.',
  '- citations: claims anchored with [n]; no citation to a source not provided.',
  '- insight: non-generic, specific, decision-useful.',
  'Respond with ONLY JSON: {"faithfulness":n,"overreach":n,"calibration":n,"differentiation":n,"citations":n,"insight":n,"verdict":"pass|flag","notes":"<one sentence: the single biggest issue or \'none\'>"}. No prose, no code fence.',
].join(' ');

export function parseJudge(text) {
  const cleaned = (text || '').replace(/```json?/gi, '').replace(/```/g, '');
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// PASS = no hard validator error AND faithfulness≥4 ∧ overreach≥4 ∧ calibration≥3.5 ∧ no dim <2.
export function isPass(j, hardError) {
  return !hardError && j && j.faithfulness >= 4 && j.overreach >= 4 && j.calibration >= 3.5 &&
    DIMS.every((d) => (j[d] ?? 0) >= 2);
}

// Deterministic calibration cross-check: spread of stated probabilities (flat = bad).
export function probSpread(text) {
  const pts = [];
  const re = /(\d{1,3})\s*(?:[–-]\s*(\d{1,3}))?\s*%/g;
  let m;
  while ((m = re.exec(text || ''))) {
    const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a;
    const mid = (a + b) / 2;
    if (mid >= 0 && mid <= 100) pts.push(mid);
  }
  if (pts.length < 2) return { n: pts.length, spread: null };
  return { n: pts.length, spread: Math.max(...pts) - Math.min(...pts) };
}

export function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
export function r1(x) { return Math.round(x * 10) / 10; }
