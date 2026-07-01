'use strict';

// Pure helpers for newsDriftCorrector (no AWS SDK, no network) — unit-tested in
// ../test/lib.test.js. The corrector is a GROUNDED EVENT-DETECTOR, not a self-reflection
// loop: it only ever explains a *deterministically-detected* conclusion move by pointing at
// a REAL, dated archive event (never invents a cause). See LIVING_ANALYSIS_PLAN.md.

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'and', 'to', 'as', 'at', 'for', 'amid', 'with']);
function tokens(s) {
  return new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i);
}

const SCORE_MOVE = 8;
const TRAJ_SIM = 0.6;

// Did the CONCLUSION move between two country snapshots? (risk level / |Δscore|≥8 / trajectory)
function conclusionMoved(prior, current) {
  const levelChg = !!(prior.riskLevel && current.riskLevel && prior.riskLevel !== current.riskLevel);
  const ps = Number(prior.riskScore); const cs = Number(current.riskScore);
  const scoreChg = Number.isFinite(ps) && Number.isFinite(cs) && Math.abs(cs - ps) >= SCORE_MOVE;
  const ta = tokens(prior.trajectory); const tb = tokens(current.trajectory);
  const trajChg = ta.size > 0 && tb.size > 0 && jaccard(ta, tb) < TRAJ_SIM;
  return { levelChg, scoreChg, trajChg, any: !!(levelChg || scoreChg || trajChg) };
}

// From dated snapshots (any order), return {current, prior} where prior is the most recent
// snapshot whose conclusion differs from current — or null (no material move → no note).
function findDrift(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')));
  const current = sorted[sorted.length - 1];
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (conclusionMoved(sorted[i], current).any) {
      const moved = conclusionMoved(sorted[i], current);
      return { current, prior: sorted[i], moved };
    }
  }
  return null;
}

// The grounding prompt. Events = [{topicId, title, date}] within the change window; the
// model must pick ONE real event id (or declare no single driver) — never invent.
function buildDriftPrompt(countryName, prior, current, events) {
  // Number the events — models cite a small [n] far more reliably than a long hash id.
  const evLines = events.map((e, i) => `  [${i + 1}] (${e.date || '?'}) ${e.title}`).join('\n');
  return [
    `Our automated risk read on ${countryName} moved between two dates. Explain WHY, grounded ONLY in the real news events listed.`,
    '',
    `PRIOR (${prior.dateKey}): risk ${prior.riskLevel}/${prior.riskScore} — "${prior.headline || ''}"`,
    `NOW  (${current.dateKey}): risk ${current.riskLevel}/${current.riskScore} — "${current.headline || ''}"`,
    '',
    'Real news events for this country in the window (numbered):',
    evLines || '  (none provided)',
    '',
    'Pick the SINGLE event above (by its number) that best explains the change. Rules:',
    '- Use ONLY a number from the list. Do NOT invent events, dates, or facts.',
    '- If no single listed event clearly explains the move, set noSingleDriver=true and triggerEventNumber=0.',
    '- whyChanged: 1–2 sentences, grounded strictly in the cited event.',
    'Return ONLY JSON: {"triggerEventNumber":<n or 0>,"whyChanged":"<text>","noSingleDriver":<true|false>}',
  ].join('\n');
}

// Parse + VALIDATE against the real event list (anti-hallucination): triggerEventNumber must
// be an in-range 1-based index, else the note degrades to noSingleDriver. null on unparseable.
function parseDriftResponse(text, events) {
  let obj;
  try {
    const m = String(text || '').match(/\{[\s\S]*\}/);
    obj = m ? JSON.parse(m[0]) : null;
  } catch { obj = null; }
  if (!obj || typeof obj !== 'object') return null;
  const why = typeof obj.whyChanged === 'string' ? obj.whyChanged.trim() : '';
  if (!why) return null;
  const n = Number(obj.triggerEventNumber);
  const cited = (!obj.noSingleDriver && Number.isInteger(n) && n >= 1 && n <= events.length) ? events[n - 1] : null;
  if (!cited) return { noSingleDriver: true, whyChanged: why, triggerEvent: null };
  return {
    noSingleDriver: false,
    whyChanged: why,
    triggerEvent: { topicId: cited.topicId, title: cited.title, date: cited.date || null },
  };
}

module.exports = { conclusionMoved, findDrift, buildDriftPrompt, parseDriftResponse, tokens, jaccard };
