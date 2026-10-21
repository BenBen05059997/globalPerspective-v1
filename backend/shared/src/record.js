'use strict';

const { createHash } = require('node:crypto');
const { registrableDomain } = require('./outlets');

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

// --- content IDs for the facts (decision 0036 section 3). Backend only: the frontend does not mint IDs, so these sit
// outside the marked core and have no mirror in shared/lib/board.js. ---
const sha1 = (text) => createHash('sha1').update(text).digest('hex');
const TRACKING = /^(utm_.*|fbclid|gclid)$/i;

/** The canonical form of an article url, or null when it is not an http(s) url. Lower-case scheme and host, `www.` and
 *  default ports (80, 443) dropped, trailing `/` removed unless the path is `/`, `utm_*` / `fbclid` / `gclid` removed, the
 *  remaining query pairs sorted by key then value, fragment dropped. */
function canonicalUrl(url) {
  let u;
  try { u = new URL(String(url == null ? '' : url).trim()); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  const port = u.port && u.port !== '80' && u.port !== '443' ? `:${u.port}` : '';
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : u.pathname;
  const pairs = u.search.slice(1).split('&').filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    return i < 0 ? [p, null] : [p.slice(0, i), p.slice(i + 1)];
  }).filter(([k]) => !TRACKING.test(k)).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : String(a[1]) < String(b[1]) ? -1 : String(a[1]) > String(b[1]) ? 1 : 0));
  const query = pairs.length ? `?${pairs.map(([k, v]) => (v === null ? k : `${k}=${v}`)).join('&')}` : '';
  return `${u.protocol}//${host}${port}${path}${query}`;
}

/** The ID of an `entry` fact: sha1('entry' + the smallest canonical url among its sources), else (no usable url)
 *  sha1('entry' + date + normalized title) with idBasis 'title'. `date` is the archive day, which a re-run keeps. */
function entryIdentity({ sources, date, title }) {
  const urls = (sources || []).map((s) => canonicalUrl(s && s.url)).filter(Boolean).sort();
  if (urls.length) return { eventId: sha1(`entry${urls[0]}`), idBasis: 'url' };
  return { eventId: sha1(`entry${date}${normalizeActor(title)}`), idBasis: 'title' };
}

/** sha1 of the registrable domain of a url or host; null when there is none. */
function sourceIdOf(urlOrHost) {
  const domain = registrableDomain(urlOrHost);
  return domain ? sha1(domain) : null;
}

/** 'name:' + the normalized name; null for an empty name. Unresolved names keep this form (no prefix yet). */
function actorIdOf(name) {
  const n = normalizeActor(name);
  return n ? `name:${n}` : null;
}

/** The ID of every other fact kind: sha1(kind + sourceKey). */
const factId = (kind, sourceKey) => sha1(kind + sourceKey);

module.exports = {
  canonicalUrl, entryIdentity, sourceIdOf, actorIdOf, factId, sha1,
  PIN_BUDGET, MOVE_MIN, LAG_MAX_DAYS, COMOVE_WINDOW_DAYS, COMOVE_MIN_PAIRS,
  pairKey, normalizeActor, stringTexture, pinBudgetOk, normalizeBoard, cheapGrounds,
};
