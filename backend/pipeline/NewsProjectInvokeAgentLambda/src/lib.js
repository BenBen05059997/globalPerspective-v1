'use strict';

const crypto = require('crypto');
const { normalizeUrl } = require('./url-normalize');
const questions = require('./questions');

// Pure prediction-capture helpers for methodology v1, split out of index.js so they can be
// unit-tested without DynamoDB or an LLM. index.js requires this; ../test/lib.test.js imports
// the SAME functions (no copy → no drift).
//
// The job of this module: turn an LLM's raw scenarios[] into a set of gated, structured
// triggers that are safe to write to the immutable prediction log. Every defect class the
// 2026-07-04 resolution pilot found (retrodictions, false premises, date artifacts, relative
// windows) is rejectable HERE, mechanically, before it can inflate the public track record.
// G6 (added 2026-07-07) additionally scopes out pure sporting results.
// See PREDICTION_METHODOLOGY_V1_PLAN.md §3 (gates G1–G6) and PREDICTION_V1_EXAMPLE.md.

const METHODOLOGY_VERSION = 1;
// Prompt identity, stamped on every new PRED# row and TOPIC# PREDICTION item as `promptVersion`
// (methodologyVersion stays 1: the question schema / gates G1-G12 are unchanged, so scoring keeps
// one methodology; promptVersion lets the study split pre/post the 2026-10-17 grounded-forecast change).
//   1 = research briefing + forecast (two calls); 2 = single grounded call + G13;
//   3 = outcomes (decision 0038): at most 3 events DONE per story, due 7-90 days, own p and source.
const PROMPT_VERSION = 3;
const HORIZON_DAYS = 180;
const MAX_OUTCOMES = 3;

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
    return { text, deadline: deadline || null, p: raw.p, resolutionSource: raw.resolution_source };
  }
  const text = String(raw == null ? '' : raw).trim();
  return { text, deadline: parseTriggerDeadline(text, fallbackYear) };
}

// The falsifiability lint (G4): a trigger must name a forward, absolute, checkable event.
const G4_PATTERNS = [
  { re: /within\s+\d+\s+(?:days?|weeks?|months?)\s+of/i, why: 'relative window — the deadline must be the window END as an absolute date, not the anchor' },
  { re: /\bas seen in\b|\bprecedent\b|\bsimilar to (?:the )?\d{4}/i, why: 'references a historical precedent, not a forward falsifiable event' },
];

// G6 — capture-scope: no pure sporting-RESULT triggers. A match/tournament outcome or a
// player's on-field participation carries no geopolitical / economic / institutional signal
// (the product's remit), so it is gated out at capture. Requires BOTH a sporting-competition
// CONTEXT and a RESULT/participation claim, so sport-ADJACENT governance triggers survive —
// "Belgium files a protest with FIFA", "CAS grants an interim measure", "FIFA lifts the ban"
// are institutional events (no result verb) and pass. Added 2026-07-07 after the Trump–FIFA /
// Balogun story's box-score triggers ("U.S. wins its round of 16 match", "Balogun starts")
// drifted into the log; the story stayed, only the sporting results were dropped. The AND of
// the two signals is what keeps political "wins/advances/starts" (elections, bills, talks)
// from being caught — those lack the sporting context.
const G6_SPORT_CONTEXT = /\b(?:world cup|olympics?|tournament|match(?:es)?|fixtures?|quarter-?finals?|semi-?finals?|group stage|knockout stage|playoffs?|grand prix|gold medal|starting xi|penalty shootout|round of \d+|premier league|la liga|bundesliga|serie a|\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b)\b/i;
const G6_SPORT_RESULT = /\b(?:wins?|won|loses?|lost|defeats?|beats?|advances?|advanced|eliminat\w+|qualif\w+|starts?|started|scores?|scored|goals?|substitute|clean sheet)\b/i;

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

  // G6 — capture-scope: drop pure sporting results (context AND result signal both present).
  if (G6_SPORT_CONTEXT.test(text) && G6_SPORT_RESULT.test(text))
    return { ok: false, gate: 'G6', why: 'sporting result/participation, not a geopolitical/economic/institutional event' };

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


// ── G13 — grounded-date gate (2026-10-17) ─────────────────────────────────────────────────────
// The old research pass invented calendar facts ("G20 Summit Nov 15-16, New Delhi" — it is Miami,
// 14-15 Dec) that leaked into reader-facing rationale. Prompt rule asks the model not to; this is
// the code that enforces it: any explicit calendar date or NAMED scheduled event in a trigger or
// scenario rationale must occur in the model's INPUT text (snippets + arc digest + facts block).
// A trigger's own `deadline` is a forecast window, not a claim, and is exempt (so is the same date
// restated in text). Pure and conservative: when unsure it flags, and a flagged trigger is only
// demoted to narrative, never silently lost.
const MONTH_KEYS = Object.keys(MONTHS).sort((x, y) => y.length - x.length);
const MONTH_RE = `(?:${MONTH_KEYS.map((k) => k[0].toUpperCase() + k.slice(1)).join('|')})\\.?`;
const monthIdx = (name) => MONTHS[String(name).toLowerCase().replace(/\.$/, '')];
const DATE_SEP = '\\s*[\\u2013\\u2014-]\\s*';

// Every calendar-date mention in `text`: { m, d|null, endD|null, y|null, raw }.
function findDateMentions(text) {
  const t = String(text || '');
  const out = [];
  let m;
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(t))) out.push({ m: Number(m[2]) - 1, d: Number(m[3]), endD: null, y: Number(m[1]), raw: m[0] });
  const md = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:${DATE_SEP}(\\d{1,2}))?(?:,?\\s+(\\d{4}))?\\b`, 'g');
  while ((m = md.exec(t))) out.push({ m: monthIdx(m[1]), d: Number(m[2]), endD: m[3] ? Number(m[3]) : null, y: m[4] ? Number(m[4]) : null, raw: m[0] });
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:${DATE_SEP}(\\d{1,2}))?\\s+(${MONTH_RE})(?:,?\\s+(\\d{4}))?\\b`, 'g');
  while ((m = dm.exec(t))) out.push({ m: monthIdx(m[3]), d: Number(m[1]), endD: m[2] ? Number(m[2]) : null, y: m[4] ? Number(m[4]) : null, raw: m[0] });
  const my = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{4})\\b`, 'g');
  while ((m = my.exec(t))) out.push({ m: monthIdx(m[1]), d: null, endD: null, y: Number(m[2]), raw: m[0] });
  const vague = new RegExp(`\\b(?:early|mid|late|end of|the end of)[-\\s]*(${MONTH_KEYS.join('|')})\\b`, 'gi');
  while ((m = vague.exec(t))) out.push({ m: monthIdx(m[1]), d: null, endD: null, y: null, raw: m[0] });
  return out.filter((x) => x.m != null && (x.d == null || (x.d >= 1 && x.d <= 31)));
}

// Named scheduled events: a capitalised qualifier + a generic event noun ("G20 Summit", "WHO Executive
// Board", "FOMC meeting", "Cabinet Committee"), or a resolution number keyed on the number.
const capFirst = (w) => `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}`;
const EVENT_NOUNS = ['Summit', 'Executive Board', 'Special Session', 'Plenary', 'General Assembly', 'Conference', 'Committee', 'Meeting', 'Session'];
const EVENT_NOUN_RE = new RegExp(`\\b((?:[A-Z][A-Za-z0-9.&'\\u2019]*\\s+){1,3})(${EVENT_NOUNS.map(capFirst).join('|')})\\b(?!\\s+of\\b)`, 'g');
const EVENT_NUM_RE = /\b(?:UNSCR|UN Security Council Resolution|Security Council Resolution|Resolution)\s+(\d{3,4})\b/g;
const EVENT_LEAD_STOP = new Set(['the', 'a', 'an', 'at', 'before', 'after', 'during', 'in', 'on', 'by', 'following', 'ahead', 'until', 'of', 'to', 'for', 'and', 'with', 'from', 'next', 'upcoming', 'this']);
const normPhrase = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

function findEventMentions(text) {
  const t = String(text || '');
  const out = [];
  let m;
  EVENT_NOUN_RE.lastIndex = 0;
  while ((m = EVENT_NOUN_RE.exec(t))) {
    const quals = m[1].trim().split(/\s+/);
    while (quals.length && EVENT_LEAD_STOP.has(quals[0].toLowerCase())) quals.shift();
    if (!quals.length) continue;
    const phrase = `${quals[quals.length - 1]} ${m[2]}`;
    out.push({ kind: 'event', raw: `${quals.join(' ')} ${m[2]}`, phrase });
  }
  EVENT_NUM_RE.lastIndex = 0;
  while ((m = EVENT_NUM_RE.exec(t))) out.push({ kind: 'event', raw: m[0], num: m[1] });
  return out;
}

// Index of everything the model was shown: which (month,day) pairs and months are mentioned,
// plus the normalised text for event-name lookups.
function buildGroundIndex(inputText, generatedAtDay) {
  const full = `${inputText || ''}\n${generatedAtDay || ''}`;
  const days = new Set();
  const months = new Set();
  for (const d of findDateMentions(full)) {
    months.add(d.m);
    if (d.d != null) for (let x = d.d; x <= (d.endD && d.endD >= d.d ? d.endD : d.d); x++) days.add(`${d.m}-${x}`);
  }
  return { days, months, today: String(generatedAtDay || ''), norm: normPhrase(full), raw: full };
}

function dateIsExempt(mention, deadlines) {
  for (const dl of deadlines || []) {
    const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dl || ''));
    if (!mm) continue;
    const dm = Number(mm[2]) - 1;
    const dd = Number(mm[3]);
    if (mention.m !== dm) continue;
    if (mention.y != null && mention.y !== Number(mm[1])) continue;
    if (mention.d == null) return true;        // "December 2026" / "end of November" naming the window's month
    if (mention.d === dd && mention.endD == null) return true;
  }
  return false;
}

/**
 * Dated claims and named scheduled events in `text` that do not occur in the input.
 * @returns {Array<{kind:'date'|'event', text:string}>}
 */
function ungroundedClaims(text, index, deadlines = []) {
  const claims = [];
  const seen = new Set();
  const add = (kind, raw) => { const k = `${kind}|${raw}`; if (!seen.has(k)) { seen.add(k); claims.push({ kind, text: raw }); } };
  for (const d of findDateMentions(text)) {
    if (dateIsExempt(d, deadlines)) continue;
    // A dated reference that is already in the past (a precedent: "December 2018") is history, not a
    // claim about the calendar ahead, so it is not gated. Undated-year mentions are still checked.
    if (d.y != null && index.today && isoDate(d.y, d.m, d.d || lastDayOfMonth(d.y, d.m)) < index.today) continue;
    const grounded = d.d != null ? index.days.has(`${d.m}-${d.d}`) : index.months.has(d.m);
    if (!grounded) add('date', d.raw);
  }
  for (const e of findEventMentions(text)) {
    const grounded = e.num ? new RegExp(`\\b${e.num}\\b`).test(index.raw) : index.norm.includes(normPhrase(e.phrase));
    if (!grounded) add('event', e.raw);
  }
  return claims;
}

const SENTENCE_SPLIT = /(?<=[a-z0-9)%]{2}[.!?])\s+(?=[A-Z"“(])/;

// Remove sentences carrying an ungrounded date/event. Returns the kept text (null when nothing is left).
function stripUngroundedSentences(text, index, deadlines = []) {
  if (typeof text !== 'string' || !text.trim()) return { text, removed: [] };
  const kept = [];
  const removed = [];
  for (const sentence of text.split(SENTENCE_SPLIT)) {
    const claims = ungroundedClaims(sentence, index, deadlines);
    if (claims.length) removed.push({ sentence, claims }); else kept.push(sentence);
  }
  return { text: kept.length ? kept.join(' ') : null, removed };
}

// Grounds a parsed forecast ONCE: rationale sentences carrying a date / named event the model was never
// shown are removed. The grounded copy is what gets stored and logged; `removed` feeds capture.dropped.
// (Triggers are untouched here; buildGatedScenarios demotes ungrounded ones to narrative.)
function groundForecastContent(parsed, inputText, generatedAtDay) {
  if (!parsed || !Array.isArray(parsed.scenarios)) return { parsed, removed: [] };
  const index = buildGroundIndex(inputText, generatedAtDay);
  const removed = [];
  const scenarios = parsed.scenarios.map((s, si) => {
    if (!s || typeof s.rationale !== 'string') return s;
    const dls = (Array.isArray(s.triggers) ? s.triggers : []).map((t) => normalizeTrigger(t, 0).deadline);
    const r = stripUngroundedSentences(s.rationale, index, dls);
    for (const x of r.removed) removed.push({ scenario: si, field: 'rationale', text: x.sentence, gate: 'G13', why: `ungrounded in input: ${x.claims.map((c) => c.text).join('; ')}` });
    return { ...s, rationale: r.text };
  });
  return { parsed: { ...parsed, scenarios }, removed };
}

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
  // M2 question mode: only when the caller supplies the row key (pk/sk), so old callers/tests behave as before.
  const qMode = Boolean(ctx.pk && ctx.sk);
  // Outcome mode (decision 0038): the unit is the outcome, so a trigger that is not a scored question is dropped
  // (not kept as narrative), and at most MAX_OUTCOMES are kept per draw.
  const outcomeMode = Boolean(ctx.outcomeMode);
  const dropped = [];
  const demoted = [];
  const priorTexts = [...(ctx.priorTexts || [])];
  // G13 runs only when the caller supplies the model's input text (so old callers/tests are unchanged).
  const groundIdx = typeof ctx.inputText === 'string' ? buildGroundIndex(ctx.inputText, generatedAtDay) : null;
  let kept = 0;
  let questionCount = 0;
  let echo = 0;

  const scenarios = (Array.isArray(rawScenarios) ? rawScenarios : []).map((s, si) => {
    const rawTriggers = Array.isArray(s.triggers) ? s.triggers : [];
    const triggers = [];
    const scenarioProb = probabilityMidpoint(s.probability_range);
    rawTriggers.forEach((rt, ti) => {
      const norm = normalizeTrigger(rt, fallbackYear);
      if (outcomeMode && questionCount >= MAX_OUTCOMES) {
        dropped.push({ scenario: si, text: norm.text, deadline: norm.deadline, gate: 'CAP', why: `more than ${MAX_OUTCOMES} outcomes in one draw` });
        return;
      }
      const verdict = validateTrigger(norm, generatedAtDay, facts);
      if (!verdict.ok) {
        dropped.push({ scenario: si, text: norm.text, deadline: norm.deadline, gate: verdict.gate, why: verdict.why });
        return;
      }
      const trig = { id: `${si}-${ti}`, text: norm.text, deadline: norm.deadline, status: 'pending' };
      if (groundIdx) {
        const claims = ungroundedClaims(norm.text, groundIdx, [norm.deadline]);
        if (claims.length) {
          // Kept as narrative (like G7-G12 demotions), never a scored question.
          dropped.push({ scenario: si, text: norm.text, deadline: norm.deadline, gate: 'G13', why: `ungrounded in input: ${claims.map((c) => c.text).join('; ')}` });
          if (outcomeMode) return;
          trig.question = false;
          triggers.push(trig);
          kept++;
          return;
        }
      }
      if (qMode) {
        const g = questions.questionGate(norm, { generatedAtDay, snippets: ctx.snippets || [], priorTexts });
        if (g.action === 'drop') {
          dropped.push({ scenario: si, text: norm.text, deadline: norm.deadline, gate: g.gate, why: g.reason });
          return;
        }
        if (g.action === 'demote' && outcomeMode) {
          dropped.push({ scenario: si, text: norm.text, deadline: norm.deadline, gate: g.gate, why: g.reason });
          return;
        }
        if (g.action === 'demote') {
          trig.question = false;
          demoted.push({ text: norm.text, reason: g.reason });
        } else {
          trig.qid = questions.qidFor(ctx.pk, ctx.sk, trig.id);
          trig.question = true;
          trig.p = g.p;
          trig.resolutionSource = g.source;
          trig.resolver = 'human';
          priorTexts.push(norm.text);
          questionCount++;
          if (!outcomeMode && scenarioProb != null && Math.abs(g.p - scenarioProb * 100) <= 1) echo++;
        }
      }
      triggers.push(trig);
      kept++;
    });
    return {
      label: s.label || `Scenario ${si + 1}`,
      probabilityRange: s.probability_range || null,
      probability: scenarioProb,
      horizon: s.horizon || null,
      rationale: s.rationale || null,
      triggers,
      // A scenario whose every dated trigger was gated out can't be scored — flag it honestly.
      scoreable: triggers.some(t => t.deadline),
    };
  });

  const capture = { methodologyVersion: METHODOLOGY_VERSION, kept, dropped };
  if (outcomeMode) {
    // An outcome whose only trigger was gated out is not an outcome.
    const outcomes = scenarios.filter((sc) => sc.triggers.length);
    scenarios.length = 0;
    scenarios.push(...outcomes);
  }
  if (qMode) capture.questions = { kept: questionCount, demoted, pEcho: questionCount ? Math.round((echo / questionCount) * 1000) / 1000 : 0 };
  return { scenarios, capture };
}

// ── R2 (Batch 1): regenerate only new / changed stories ──────────────────────────────────────
// Fingerprint of a story's article set: sha1 of the sorted, de-duplicated normalized source URLs
// (snippet text when no URLs). null = cannot fingerprint => always regenerate.
function sourceFingerprint(topic) {
  const sources = (topic && topic.sources) || [];
  const urls = sources.map((s) => normalizeUrl(s && s.url)).filter(Boolean);
  const basis = urls.length
    ? urls
    : sources.map((s) => String((s && s.snippet) || '').trim().toLowerCase()).filter(Boolean);
  if (!basis.length) return null;
  return crypto.createHash('sha1').update([...new Set(basis)].sort().join('\n')).digest('hex').slice(0, 16);
}

// Decide whether a stored item can be reused instead of calling the LLM.
function decideReuse({ kind, existing, fingerprint, predictionLoggedToday, force }) {
  if (force) return { reuse: false, reason: 'force' };
  if (!existing) return { reuse: false, reason: 'new' };
  if ((kind === 'prediction' || kind === 'trace_cause') && existing.contentFormat !== 'json') {
    return { reuse: false, reason: 'bad-content' };
  }
  if (kind === 'prediction' && predictionLoggedToday) return { reuse: true, reason: 'once-per-day' };
  if (!fingerprint) return { reuse: false, reason: 'no-fingerprint' };
  if (existing.sourceFingerprint !== fingerprint) {
    return { reuse: false, reason: existing.sourceFingerprint ? 'changed' : 'legacy-item' };
  }
  return { reuse: true, reason: 'unchanged' };
}

// Topic ids are "<title>-<position>" (newsInvokeGemini createStableTopicId), so the same story
// at a different position in the next run gets a new id and found nothing to reuse: every run
// re-researched every story (0 reused, 2026-09-30..10-04). These are the same-title ids at the
// other positions; the caller reuses the newest stored item among them (2026-10-05).
function siblingTopicIds(topicId, maxPosition = 30) {
  const m = /^(.*)-(\d+)$/.exec(String(topicId || ''));
  if (!m || !m[1]) return [];
  const out = [];
  for (let i = 0; i <= maxPosition; i++) if (String(i) !== m[2]) out.push(`${m[1]}-${i}`);
  return out;
}

function newestItem(items) {
  return (items || []).filter(Boolean).reduce((best, it) => (!best || String(it.generatedAt || '') > String(best.generatedAt || '') ? it : best), null);
}

// A run is "usable" when at least one story has a current item, generated OR reused. Gates the
// threadId assignment, the staging->latest swap and the archive (was: outputs.length > 0).
function runOutcome({ generated = 0, reused = 0 }) {
  const usable = generated + reused;
  return { usable, swap: usable > 0 };
}

// Which TOPIC# items the prune step deletes: anything of an older generation. Reused items are
// re-stamped with the current generationId (restampFields) so they are never selected.
function selectPruneKeys(items, pkPrefix, currentGenerationId) {
  if (!currentGenerationId) return [];
  const out = [];
  for (const it of items || []) {
    const pk = it && it.PK;
    if (typeof pk === 'string' && pk.startsWith(pkPrefix) && (!it.generationId || it.generationId !== currentGenerationId)) {
      out.push({ PK: pk, SK: it.SK });
    }
  }
  return out;
}

function restampFields(existing, generationId, ttlSeconds, nowMs = Date.now()) {
  return {
    ...existing,
    generationId,
    ttl: Math.floor(nowMs / 1000) + ttlSeconds,
    lastVerifiedAt: new Date(nowMs).toISOString(),
  };
}

// ── Batch 2 / D3: the forecast (research briefing + forecast call) runs on PREDICTION_MODEL
// (deepseek-v4-pro); summary and cause chain stay on GROK_MODEL (flash). PREDICTION_MODEL falls back
// to GROK_MODEL when unset, so behaviour is unchanged until the env is set.
function modelForKind(kind, env = {}) {
  const base = env.GROK_MODEL || 'deepseek-flash';
  return (kind === 'prediction' || kind === 'research_briefing') ? (env.PREDICTION_MODEL || base) : base;
}

// One request body for EVERY LLM call. thinking must stay disabled: DeepSeek V4 (flash and pro)
// defaults to thinking-on, which burns max_tokens on hidden reasoning and empties `content`.
// json: DeepSeek JSON mode — guarantees a parseable object (without it the model sometimes wraps
// the answer in ```json fences, which then failed JSON.parse and skipped the PRED# log).
function buildChatBody({ model, prompt, maxTokens, temperature, topP, json = false }) {
  return {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    thinking: { type: 'disabled' },
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };
}


// "Was a forecast already generated today?" from the stored item itself: copies keep the original
// generatedAt, so this survives sibling copies and reuse-by-fingerprint (which write no PRED# row).
function forecastedOn(item, day) {
  return Boolean(item && typeof item.generatedAt === 'string' && item.generatedAt.slice(0, 10) === day);
}

// Topic ids of today's archive entries that carry this threadId (candidates to copy a forecast from).
function threadSiblingsToday(archiveEntries, threadId) {
  if (!threadId) return [];
  return [...new Set((archiveEntries || []).filter((e) => e && e.threadId === threadId && e.topicId).map((e) => e.topicId))];
}

// `threadId` attribute for a per-story row (omitted when unknown, so a row never stores null).
function threadAttr(threadId) {
  return threadId ? { threadId: String(threadId) } : {};
}

// UpdateCommand params (minus TableName) for the thread's pointer row `THREAD#<threadId>` / `TOPICS`.
// topics = this run's topics on the thread, in list (rank) order: the first is the current topicId
// (+ title, generation), and `topicIds` (a string set) accumulates every topicId the thread has had,
// so a reader can go threadId -> TOPIC#<topicId> rows (current) and PRED#<topicId> rows (all).
const THREAD_POINTER_SK = 'TOPICS';
function threadPointerUpdate(threadId, topics, generationId, nowIso) {
  return {
    Key: { PK: `THREAD#${threadId}`, SK: THREAD_POINTER_SK },
    UpdateExpression: 'SET threadId = :th, topicId = :t, title = :ti, generationId = :g, updatedAt = :n ADD topicIds :ids',
    ExpressionAttributeValues: {
      ':th': threadId, ':t': topics[0].id, ':ti': topics[0].title || '', ':g': generationId || null, ':n': nowIso,
      ':ids': new Set(topics.map((t) => t.id)),
    },
  };
}

module.exports = {
  threadAttr,
  threadPointerUpdate,
  THREAD_POINTER_SK,
  PROMPT_VERSION,
  forecastedOn,
  threadSiblingsToday,
  findDateMentions,
  findEventMentions,
  buildGroundIndex,
  ungroundedClaims,
  stripUngroundedSentences,
  groundForecastContent,
  modelForKind,
  buildChatBody,
  sourceFingerprint,
  decideReuse,
  siblingTopicIds,
  newestItem,
  runOutcome,
  selectPruneKeys,
  restampFields,
  METHODOLOGY_VERSION,
  HORIZON_DAYS,
  MAX_OUTCOMES,
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
