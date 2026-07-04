'use strict';

// Pure prediction-capture helpers for methodology v1, split out of index.js so they can be
// unit-tested without DynamoDB or an LLM. index.js requires this; ../test/lib.test.js imports
// the SAME functions (no copy → no drift).
//
// The job of this module: turn an LLM's raw scenarios[] into a set of gated, structured
// triggers that are safe to write to the immutable prediction log. Every defect class the
// 2026-07-04 resolution pilot found (retrodictions, false premises, date artifacts, relative
// windows) is rejectable HERE, mechanically, before it can inflate the public track record.
// See PREDICTION_METHODOLOGY_V1_PLAN.md §3 (gates G1–G5) and PREDICTION_V1_EXAMPLE.md.

const METHODOLOGY_VERSION = 1;
const HORIZON_DAYS = 180;

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function lastDayOfMonth(year, monthIdx) {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

function isoDate(year, monthIdx, day) {
  if (!year || monthIdx == null) return null;
  const d = String(day).padStart(2, '0');
  const m = String(monthIdx + 1).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function probabilityMidpoint(range) {
  if (!range || typeof range !== 'string') return null;
  const nums = (range.match(/\d{1,3}(?:\.\d+)?/g) || []).map(Number).filter(n => n >= 0 && n <= 100);
  if (!nums.length) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.round((avg / 100) * 1000) / 1000;
}

// Add N days to a YYYY-MM-DD date (UTC), returning YYYY-MM-DD.
function addDays(isoDay, n) {
  const d = new Date(isoDay + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Best-effort: pull a deadline date out of free-text trigger prose. Handles ISO,
// "Month D, YYYY", "D Month YYYY", "end of/late Month YYYY", "Month YYYY", "QN YYYY".
// (Moved verbatim from index.js so lib owns the parse; v1 prefers a structured `deadline`
// field on the trigger and only falls back to this for legacy free-text.)
function parseTriggerDeadline(text, fallbackYear) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();

  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const monthNames = Object.keys(MONTHS).join('|');

  m = t.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`));
  if (m) return isoDate(Number(m[3]), MONTHS[m[1]], Number(m[2]));

  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\s+(\\d{4})`));
  if (m) return isoDate(Number(m[3]), MONTHS[m[2]], Number(m[1]));

  m = t.match(new RegExp(`\\b(?:end of|late)\\s+(${monthNames})\\s+(\\d{4})`));
  if (m) { const y = Number(m[2]); const mi = MONTHS[m[1]]; return isoDate(y, mi, lastDayOfMonth(y, mi)); }

  m = t.match(/\bq([1-4])\s+(\d{4})/);
  if (m) { const q = Number(m[1]); const y = Number(m[2]); const mi = q * 3 - 1; return isoDate(y, mi, lastDayOfMonth(y, mi)); }

  m = t.match(new RegExp(`\\b(${monthNames})\\s+(\\d{4})`));
  if (m) { const y = Number(m[2]); const mi = MONTHS[m[1]]; return isoDate(y, mi, lastDayOfMonth(y, mi)); }

  return null;
}

// Normalize one raw trigger (object {text,deadline} from a v1 prompt, or a legacy free-text
// string) into { text, deadline|null }. A structured deadline wins; else we parse the prose.
function normalizeTrigger(raw, fallbackYear) {
  if (raw && typeof raw === 'object') {
    const text = String(raw.text || '').trim();
    let deadline = raw.deadline != null ? String(raw.deadline).trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) deadline = parseTriggerDeadline(text, fallbackYear);
    return { text, deadline: deadline || null };
  }
  const text = String(raw == null ? '' : raw).trim();
  return { text, deadline: parseTriggerDeadline(text, fallbackYear) };
}

// The falsifiability lint (G4): a trigger must name a forward, absolute, checkable event.
const G4_PATTERNS = [
  { re: /within\s+\d+\s+(?:days?|weeks?|months?)\s+of/i, why: 'relative window — the deadline must be the window END as an absolute date, not the anchor' },
  { re: /\bas seen in\b|\bprecedent\b|\bsimilar to (?:the )?\d{4}/i, why: 'references a historical precedent, not a forward falsifiable event' },
];

/**
 * Validate one normalized trigger at capture time. Pure — no LLM, no network.
 * @param {{text:string, deadline:string|null}} trigger
 * @param {string} generatedAtDay YYYY-MM-DD of the prediction snapshot
 * @param {Array<{country:string, current:string[], stale?:string[]}>} facts
 *        verified FACTS# leadership for the topic's regions ([] = no coverage → G5 skips)
 * @returns {{ok:boolean, gate?:string, why?:string}}
 */
function validateTrigger(trigger, generatedAtDay, facts = []) {
  const text = trigger && trigger.text ? String(trigger.text) : '';
  const dl = trigger && trigger.deadline ? String(trigger.deadline) : '';

  if (!text.trim()) return { ok: false, gate: 'G0', why: 'empty trigger text' };

  // G1 — date-valid
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dl) || Number.isNaN(Date.parse(dl + 'T00:00:00Z')))
    return { ok: false, gate: 'G1', why: `deadline "${dl || '(none)'}" is not a valid ISO date` };

  // G2 — forward-looking (kills retrodictions: deadline before/at generation)
  if (dl <= String(generatedAtDay).slice(0, 10))
    return { ok: false, gate: 'G2', why: `deadline ${dl} is not after generation date ${generatedAtDay} — retrodiction` };

  // G3 — sane horizon
  if (dl > addDays(String(generatedAtDay).slice(0, 10), HORIZON_DAYS))
    return { ok: false, gate: 'G3', why: `deadline ${dl} is beyond the ${HORIZON_DAYS}-day horizon` };

  // G4 — falsifiability lint
  for (const p of G4_PATTERNS)
    if (p.re.test(text)) return { ok: false, gate: 'G4', why: p.why };

  // G5 — premise check: a trigger naming a country's office-holder must match verified FACTS#.
  // Only fires where we have coverage AND the text names a KNOWN-STALE holder for that country
  // (a former leader). We never invent a pass; absent coverage the gate skips.
  for (const f of facts) {
    for (const stale of f.stale || []) {
      if (stale && new RegExp(`\\b${escapeRe(stale)}\\b`, 'i').test(text))
        return { ok: false, gate: 'G5', why: `names "${stale}" but FACTS#${f.country} verifies ${(f.current || []).join(', ') || 'a different office-holder'}` };
    }
  }

  return { ok: true };
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Turn parsed LLM scenarios[] into gated, structured scenarios ready for the prediction log.
 * Dropped triggers are removed from the log AND recorded in the capture report, so a resolved
 * track record can never be silently inflated by a malformed trigger.
 *
 * @param {Array} rawScenarios parsed.scenarios from the LLM
 * @param {{generatedAtDay:string, fallbackYear:number, facts?:Array}} ctx
 * @returns {{ scenarios:Array, capture:{ methodologyVersion:number, kept:number, dropped:Array } }}
 */
function buildGatedScenarios(rawScenarios, ctx) {
  const { generatedAtDay, fallbackYear, facts = [] } = ctx;
  const dropped = [];
  let kept = 0;

  const scenarios = (Array.isArray(rawScenarios) ? rawScenarios : []).map((s, si) => {
    const rawTriggers = Array.isArray(s.triggers) ? s.triggers : [];
    const triggers = [];
    rawTriggers.forEach((rt, ti) => {
      const norm = normalizeTrigger(rt, fallbackYear);
      const verdict = validateTrigger(norm, generatedAtDay, facts);
      if (verdict.ok) {
        triggers.push({ id: `${si}-${ti}`, text: norm.text, deadline: norm.deadline, status: 'pending' });
        kept++;
      } else {
        dropped.push({ scenario: si, text: norm.text, deadline: norm.deadline, gate: verdict.gate, why: verdict.why });
      }
    });
    return {
      label: s.label || `Scenario ${si + 1}`,
      probabilityRange: s.probability_range || null,
      probability: probabilityMidpoint(s.probability_range),
      horizon: s.horizon || null,
      rationale: s.rationale || null,
      triggers,
      // A scenario whose every dated trigger was gated out can't be scored — flag it honestly.
      scoreable: triggers.some(t => t.deadline),
    };
  });

  return { scenarios, capture: { methodologyVersion: METHODOLOGY_VERSION, kept, dropped } };
}

module.exports = {
  METHODOLOGY_VERSION,
  HORIZON_DAYS,
  MONTHS,
  lastDayOfMonth,
  isoDate,
  probabilityMidpoint,
  addDays,
  parseTriggerDeadline,
  normalizeTrigger,
  validateTrigger,
  buildGatedScenarios,
};
