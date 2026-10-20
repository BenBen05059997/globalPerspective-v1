'use strict';

// record — the board's pure rules (PLAN_2026-10-20_board.md, Stage 1). Used by newsBoard now and by the
// record writer later. Pure: no AWS, no network, no clock. The block between the markers is kept identical to
// the frontend's shared/lib/board.js by scripts/check-shared-sync.mjs.

// --- board rules core (identical in the frontend copy) ---
const PIN_BUDGET = 12;

/** pairKey('b', 'a') -> 'a__b'. One key per pair of pins, whichever order they are given in. */
function pairKey(a, b) {
  if (a === b) throw new Error('pairKey: a string needs two different pins');
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/** An actor name as compared everywhere: trimmed, whitespace collapsed, lowercase (the key newsSystemsAnalysis
 *  normalizeActors uses). */
function normalizeActor(name) {
  return String(name == null ? '' : name).trim().replace(/\s+/g, ' ').toLowerCase();
}

/** How a string is drawn. A cut string is 'cut' whoever owns it. Ours with a confirmed strength (weak | medium |
 *  strong) is 'solid'; ours 'inferred' or with no strength is 'dashed' (slice 1: every ours-string is inferred);
 *  yours is 'dashed-alt'. */
function stringTexture(str) {
  if (!str) return 'dashed';
  if (str.cutAt) return 'cut';
  if (str.owner === 'yours') return 'dashed-alt';
  return ['weak', 'medium', 'strong'].includes(str.strength) ? 'solid' : 'dashed';
}
// --- end board rules core ---

const MOVE_MIN = 8; // a day-over-day score move of at least this many points counts as a move
const LAG_MAX_DAYS = 3; // two moves this close (days) are one pairing
const COMOVE_WINDOW_DAYS = 30; // moves older than this (from the latest score) are ignored
const COMOVE_MIN_PAIRS = 2; // one pairing is not a pattern
const DAY_MS = 86400000;

const NO_LINK_NOTE = 'No link found. Shared: nothing but the week.';
const OUTLET_NOTE = 'coverage artefact possible';
const ONE_PAIRING_NOTE = 'one pairing is not a pattern';

function pinBudgetOk(board) {
  return Array.isArray(board && board.pins) && board.pins.length <= PIN_BUDGET;
}

const time = (s) => (s ? Date.parse(s) || 0 : 0);

/** A copy of the board with strings' a/b ordered (a < b), one string per pair (the latest keptAt wins; a tie keeps
 *  the later one in the list) and pins unique by kind + refId (first wins). The input is not changed. */
function normalizeBoard(board) {
  const seenPins = new Set();
  const pins = (board.pins || []).filter((p) => {
    const k = `${p.kind}:${p.refId}`;
    if (seenPins.has(k)) return false;
    seenPins.add(k);
    return true;
  }).map((p) => ({ ...p }));
  const byPair = new Map();
  for (const s of board.strings || []) {
    if (s.a === s.b) continue;
    const ordered = s.a < s.b ? { ...s } : { ...s, a: s.b, b: s.a };
    const k = pairKey(ordered.a, ordered.b);
    const prev = byPair.get(k);
    if (!prev || time(ordered.keptAt) >= time(prev.keptAt)) byPair.set(k, ordered);
  }
  return { ...board, pins, strings: [...byPair.values()] };
}

// Moves of one series: [{day, ms}] for each consecutive-entry change of at least MOVE_MIN points.
function movesOf(series) {
  const pts = (series || []).filter((p) => p && p.date && Number.isFinite(p.score))
    .map((p) => ({ date: p.date, ms: Date.parse(p.date), score: p.score })).filter((p) => !Number.isNaN(p.ms))
    .sort((x, y) => x.ms - y.ms);
  const moves = [];
  for (let i = 1; i < pts.length; i += 1) {
    if (Math.abs(pts[i].score - pts[i - 1].score) >= MOVE_MIN) moves.push(pts[i].ms);
  }
  return moves;
}

// Pair each move of A with the nearest unused move of B within LAG_MAX_DAYS, inside the last 30 days.
// Returns { pairs, lagDays } where lagDays is the widest lag among the pairs.
function comovement(seriesA, seriesB) {
  const all = [...(seriesA || []), ...(seriesB || [])].map((p) => Date.parse(p && p.date)).filter((n) => !Number.isNaN(n));
  if (!all.length) return { pairs: 0, lagDays: 0 };
  const cutoff = Math.max(...all) - COMOVE_WINDOW_DAYS * DAY_MS;
  const a = movesOf(seriesA).filter((m) => m >= cutoff);
  const b = movesOf(seriesB).filter((m) => m >= cutoff);
  const used = new Set();
  let pairs = 0;
  let lagDays = 0;
  for (const ma of a) {
    let best = -1;
    b.forEach((mb, i) => {
      const lag = Math.abs(ma - mb) / DAY_MS;
      if (used.has(i) || lag > LAG_MAX_DAYS) return;
      if (best < 0 || lag < Math.abs(ma - b[best]) / DAY_MS) best = i;
    });
    if (best >= 0) {
      used.add(best);
      pairs += 1;
      lagDays = Math.max(lagDays, Math.round(Math.abs(ma - b[best]) / DAY_MS));
    }
  }
  return { pairs, lagDays };
}

const intersect = (xs, ys) => {
  const set = new Set(ys);
  return [...new Set(xs)].filter((x) => set.has(x));
};

/** The cheap, no-LLM test of whether two pins are linked. ctx is plain data (no I/O):
 *  actorsOf(pin) -> string[], placesOf(pin) -> iso3[], outletsOf(pin) -> string[], scoresOf(pin) -> [{date, score}].
 *  -> { strength: 'none' | 'weak' | 'medium', grounds: [{kind, detail}], note }. Never 'strong': that needs the
 *  record's confirmed links. Shared outlets alone stay 'weak' (coverage artefact); one score pairing is shown but
 *  is not a pattern. */
function cheapGrounds(pinA, pinB, ctx) {
  const grounds = [];
  const kinds = new Set(); // qualifying kinds, outlets excluded
  const actors = intersect((ctx.actorsOf(pinA) || []).map(normalizeActor).filter(Boolean),
    (ctx.actorsOf(pinB) || []).map(normalizeActor).filter(Boolean));
  if (actors.length) { grounds.push({ kind: 'actor', detail: actors }); kinds.add('actor'); }
  const places = intersect(ctx.placesOf(pinA) || [], ctx.placesOf(pinB) || []);
  if (places.length) { grounds.push({ kind: 'place', detail: places }); kinds.add('place'); }
  const outlets = intersect(ctx.outletsOf(pinA) || [], ctx.outletsOf(pinB) || []);
  if (outlets.length) grounds.push({ kind: 'outlet', detail: { outlets, note: OUTLET_NOTE } });
  const { pairs, lagDays } = comovement(ctx.scoresOf(pinA), ctx.scoresOf(pinB));
  if (pairs >= COMOVE_MIN_PAIRS) { grounds.push({ kind: 'comovement', detail: { lagDays, pairs } }); kinds.add('comovement'); }
  else if (pairs === 1) grounds.push({ kind: 'comovement', detail: { lagDays, pairs, note: ONE_PAIRING_NOTE } });

  let strength = 'none';
  if (kinds.size >= 2) strength = 'medium';
  else if (kinds.size === 1 || outlets.length) strength = 'weak';

  let note;
  if (strength === 'none') note = NO_LINK_NOTE;
  else if (!kinds.size) note = `Shared outlets only: ${OUTLET_NOTE}.`;
  else {
    note = `Shared: ${[...kinds].join(' + ')}.`;
    if (outlets.length) note += ` Shared outlets add nothing (${OUTLET_NOTE}).`;
  }
  return { strength, grounds, note };
}

module.exports = {
  PIN_BUDGET, MOVE_MIN, LAG_MAX_DAYS, COMOVE_WINDOW_DAYS, COMOVE_MIN_PAIRS,
  pairKey, normalizeActor, stringTexture, pinBudgetOk, normalizeBoard, cheapGrounds,
};
