// boardOps — pure edits and read-models for one board. No network, no React. The server normalises and
// validates every save (pin budget, pair order, ours = inferred); these keep the local copy in the same shape.
import { PIN_BUDGET, pairKey, normalizeActor } from '@/shared/lib/board.js';
import { COUNTRIES } from '@/shared/lib/countries.js';

export const MAX_LINE = 280;
export const MAX_NAME = 80;
export const KIND_WORD = { thread: 'Story', country: 'Country', actor: 'Actor' };

const sameRef = (p, kind, refId) => p.kind === kind && (kind === 'actor' ? normalizeActor(p.refId) === normalizeActor(refId) : p.refId === refId);

/** The smallest unused pin id of the form p01, p02, ... */
export function nextPinId(pins) {
  const used = new Set(pins.map((p) => p.pinId));
  for (let i = 1; ; i += 1) {
    const id = `p${String(i).padStart(2, '0')}`;
    if (!used.has(id)) return id;
  }
}

/** addPin(board, {kind, refId}, now) -> { board, status: 'added' | 'duplicate' | 'full', pin? }. */
export function addPin(board, { kind, refId }, now = new Date().toISOString()) {
  const existing = board.pins.find((p) => sameRef(p, kind, refId));
  if (existing) return { board, status: 'duplicate', pin: existing };
  if (board.pins.length >= PIN_BUDGET) return { board, status: 'full' };
  const pin = { pinId: nextPinId(board.pins), kind, refId, addedAt: now };
  return { board: { ...board, pins: [...board.pins, pin] }, status: 'added', pin };
}

/** Removing a pin removes the strings that touched it. */
export function removePin(board, pinId) {
  return { ...board, pins: board.pins.filter((p) => p.pinId !== pinId), strings: board.strings.filter((s) => s.a !== pinId && s.b !== pinId) };
}

export function findString(board, idA, idB) {
  const key = pairKey(idA, idB);
  return board.strings.find((s) => pairKey(s.a, s.b) === key) || null;
}

/** Keep: a `yours` string between two pins, with an optional one-line claim. It replaces any string already on
 *  that pair (one string per pair, as the server keeps). */
export function keepString(board, idA, idB, line, now = new Date().toISOString()) {
  const [a, b] = idA < idB ? [idA, idB] : [idB, idA];
  const text = String(line || '').trim().slice(0, MAX_LINE);
  const next = { a, b, owner: 'yours', keptAt: now, ...(text ? { line: text } : {}) };
  return { ...board, strings: [...board.strings.filter((s) => pairKey(s.a, s.b) !== pairKey(a, b)), next] };
}

/** Cut sets cutAt; it never deletes the string. */
export function cutString(board, idA, idB, now = new Date().toISOString()) {
  const key = pairKey(idA, idB);
  return { ...board, strings: board.strings.map((s) => (pairKey(s.a, s.b) === key ? { ...s, cutAt: now } : s)) };
}

export function restoreString(board, idA, idB) {
  const key = pairKey(idA, idB);
  return { ...board, strings: board.strings.map((s) => {
    if (pairKey(s.a, s.b) !== key) return s;
    const { cutAt, ...rest } = s; // eslint-disable-line no-unused-vars
    return rest;
  }) };
}

/** Pins on a circle (a point at the centre for one), ordered by kind then pin id so a pin keeps its place
 *  between renders. Returns { pinId: {x, y} } inside a width x height box. */
export function layoutPins(pins, width, height) {
  const order = { thread: 0, country: 1, actor: 2 };
  const sorted = [...pins].sort((p, q) => (order[p.kind] - order[q.kind]) || (p.pinId < q.pinId ? -1 : 1));
  const out = {};
  const n = sorted.length;
  const cx = width / 2;
  const cy = height / 2;
  if (n === 1) { out[sorted[0].pinId] = { x: cx, y: cy }; return out; }
  const rx = width * 0.385;
  const ry = height * 0.41;
  sorted.forEach((p, i) => {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    out[p.pinId] = { x: Math.round(cx + rx * Math.cos(t)), y: Math.round(cy + ry * Math.sin(t)) };
  });
  return out;
}

/** The pin's request body for `connect`. */
export const pinRef = (p) => ({ kind: p.kind, refId: p.refId });

export function countryName(iso3) {
  return COUNTRIES[iso3]?.name || iso3;
}

/** "What is missing": actors that appear on two or more of the board's pins (read from the connect results
 *  already fetched this session) and that the member does not follow. -> [{ name, pins: [pinId...] }]. */
export function missingActors(board, results, followedActors) {
  const followed = new Set((followedActors || []).map(normalizeActor));
  const pinOf = (ref) => board.pins.find((p) => sameRef(p, ref.kind, ref.refId));
  const seen = new Map(); // normalized -> { name, pins:Set }
  for (const r of results || []) {
    const a = pinOf(r.a);
    const b = pinOf(r.b);
    if (!a || !b) continue;
    for (const g of r.grounds || []) {
      if (g.kind !== 'actor' || !Array.isArray(g.detail)) continue;
      for (const name of g.detail) {
        const k = normalizeActor(name);
        if (!k || followed.has(k)) continue;
        if (!seen.has(k)) seen.set(k, { name, pins: new Set() });
        seen.get(k).pins.add(a.pinId).add(b.pinId);
      }
    }
  }
  return [...seen.values()].filter((v) => v.pins.size >= 2).map((v) => ({ name: v.name, pins: [...v.pins].sort() }))
    .sort((x, y) => y.pins.length - x.pins.length || (x.name < y.name ? -1 : 1));
}

const humanize = (id) => String(id).replace(/^thread-/, '').replace(/[-_]+/g, ' ').trim() || String(id);

/** What a pin shows: title / name, kind word, and the risk number where one exists. `titles` and `risks` are
 *  { refId: value } read from today's topics, the thread analyses or a preset. */
export function pinLabel(pin, titles = {}, risks = {}) {
  if (pin.kind === 'country') return { label: countryName(pin.refId), risk: null };
  if (pin.kind === 'actor') return { label: pin.refId, risk: null };
  const risk = Number.isFinite(Number(risks[pin.refId])) && risks[pin.refId] != null ? Number(risks[pin.refId]) : null;
  return { label: titles[pin.refId] || humanize(pin.refId), risk };
}
