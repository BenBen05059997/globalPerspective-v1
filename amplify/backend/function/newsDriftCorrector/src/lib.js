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

// EVERY consecutive material move (day-by-day chain), not just the latest. This is what keeps
// the read "not drifted": the corrector grounds each move it hasn't grounded yet, so a missed
// day (or pre-live history) self-heals on the next run instead of leaving a stale gap.
// `moved(prev, cur)` is the conclusion-move test (country or thread variant).
function findAllDrifts(snapshots, moved = conclusionMoved) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return [];
  const sorted = [...snapshots].sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')));
  const out = [];
  for (let i = 1; i < sorted.length; i++) {
    const m = moved(sorted[i - 1], sorted[i]);
    if (m.any) out.push({ current: sorted[i], prior: sorted[i - 1], moved: m });
  }
  return out;
}

// Thread conclusion move: threads have no riskLevel, but do have riskScore + threadTitle +
// trajectory. A material move = big score shift, or the title (compressed conclusion) or
// trajectory genuinely changed. Title change is the strongest single signal for a thread.
const TITLE_SIM = 0.5;
function threadConclusionMoved(prior, current) {
  const ps = Number(prior.riskScore); const cs = Number(current.riskScore);
  const scoreChg = Number.isFinite(ps) && Number.isFinite(cs) && Math.abs(cs - ps) >= SCORE_MOVE;
  const na = tokens(prior.threadTitle); const nb = tokens(current.threadTitle);
  const titleChg = na.size > 0 && nb.size > 0 && jaccard(na, nb) < TITLE_SIM;
  const ta = tokens(prior.trajectory); const tb = tokens(current.trajectory);
  const trajChg = ta.size > 0 && tb.size > 0 && jaccard(ta, tb) < TRAJ_SIM;
  return { scoreChg, titleChg, trajChg, any: !!(scoreChg || titleChg || trajChg) };
}

function findThreadDrift(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')));
  const current = sorted[sorted.length - 1];
  for (let i = sorted.length - 2; i >= 0; i--) {
    const moved = threadConclusionMoved(sorted[i], current);
    if (moved.any) return { current, prior: sorted[i], moved };
  }
  return null;
}

// The grounding prompt. Events = [{topicId, title, date}] within the change window; the
// model must pick ONE real event id (or declare no single driver) — never invent.
function buildDriftPrompt(subject, prior, current, events) {
  // Number the events — models cite a small [n] far more reliably than a long hash id.
  const evLines = events.map((e, i) => `  [${i + 1}] (${e.date || '?'}) ${e.title}`).join('\n');
  // Works for both countries (riskLevel/score + headline) and threads (score + threadTitle).
  const riskStr = (s) => `${s.riskLevel ? `${s.riskLevel}/` : ''}${s.riskScore}`;
  const label = (s) => s.headline || s.threadTitle || '';
  return [
    `Our automated read on ${subject} moved between two dates. Explain WHY, grounded ONLY in the real news events listed.`,
    '',
    `PRIOR (${prior.dateKey}): risk ${riskStr(prior)} — "${label(prior)}"`,
    `NOW  (${current.dateKey}): risk ${riskStr(current)} — "${label(current)}"`,
    '',
    'Real news events in the window (numbered):',
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

module.exports = { conclusionMoved, findDrift, findAllDrifts, threadConclusionMoved, findThreadDrift, buildDriftPrompt, parseDriftResponse, tokens, jaccard };
