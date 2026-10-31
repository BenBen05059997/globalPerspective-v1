// mapPlaces — the board map's geography and layout. Pure: the frame (projection) is built per render from the pins.
// Outlines are the site's own coastlines (shared/map/landGeometry) in an equal-earth projection fitted to the pins'
// extent; a place is a country's centre from the shared coordinate table, as [lng, lat] until a frame projects it.
// A pin with no country gets no place: it is never guessed.
import { geoEqualEarth, geoPath } from 'd3-geo';
import { land, FRAME } from '@/shared/map/landGeometry.js';
import { COUNTRY_COORDINATES } from '@/shared/map/countryCoordinates.js';
import { COUNTRIES, resolveCountry } from '@/shared/lib/countries.js';

export const MAP_W = 900;
const MIN_LNG = 40; // degrees, padded: one or two pins never zoom closer than this
const MIN_LAT = 25;
const PAD_LNG = 0.15; // of the span on each side (ring labels sit beside their rings and flip inward at the edge)
const PAD_LAT = 0.3;

const REGIONS = [['Americas', -92, 14], ['Europe', 14, 56], ['Africa', 20, 2], ['Asia', 100, 45], ['Middle East', 45, 27]];

/** The map frame for a set of [lng, lat] points: { h, project, worldPath, regions }. The projection is fitted to the
 *  points' bounding box, padded and kept at least MIN_LNG x MIN_LAT wide; no points -> the whole world. */
export function mapFrame(points = []) {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  let box = FRAME;
  if (points.length) {
    const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    const dLat = Math.max((Math.max(...lats) - Math.min(...lats)) * (1 + 2 * PAD_LAT), MIN_LAT);
    const dLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * (1 + 2 * PAD_LNG), MIN_LNG);
    const hw = Math.max(dLng, dLat * 1.5) / 2; // never taller than 2:3, however far apart north-south
    const hh = Math.min(dLat / 2, 85);
    const [w, e, s, n] = [Math.max(cx - hw, -180), Math.min(cx + hw, 180), Math.max(cy - hh, -85), Math.min(cy + hh, 85)];
    box = { type: 'MultiPoint', coordinates: [[w, s], [e, s], [e, n], [w, n], [(w + e) / 2, s], [(w + e) / 2, n], [w, (s + n) / 2], [e, (s + n) / 2]] };
  }
  const projection = geoEqualEarth().fitWidth(MAP_W, box);
  const h = Math.ceil(geoPath(projection).bounds(box)[1][1]);
  projection.clipExtent([[0, 0], [MAP_W, h]]);
  const project = (p) => { const at = projection(p); return at && Number.isFinite(at[0]) && Number.isFinite(at[1]) ? at : null; };
  const regions = REGIONS.map(([name, lng, lat]) => { const at = project([lng, lat]); return at && at[0] > 0 && at[0] < MAP_W && at[1] > 0 && at[1] < h ? { name, x: at[0], y: at[1] } : null; }).filter(Boolean);
  return { h, project, worldPath: geoPath(projection)(land) || '', regions };
}

/** [lng, lat] for an ISO3 country, or null when the country table has no position for it. */
export function placeOfCountry(iso3) {
  const c = COUNTRY_COORDINATES[COUNTRIES[iso3]?.iso2];
  return c && Number.isFinite(c.lng) && Number.isFinite(c.lat) ? [c.lng, c.lat] : null;
}

/** A story's countries, most-named first: how many of its entries name each country (the story view's own `iso3` list
 *  is sorted, so its order means nothing), ties alphabetical. Every one is a place the story touches (operator rule
 *  2026-10-31: a place involved is a place affected). Falls back to the story's or the feed's `iso3` as given. */
export function storyCountries(story, pin = {}) {
  const all = story?.iso3?.length ? story.iso3 : (pin.iso3 || []);
  const named = {};
  for (const e of story?.entries || []) for (const c of e.iso3 || []) named[c] = (named[c] || 0) + 1;
  return [...new Set(all)].sort((a, b) => (named[b] || 0) - (named[a] || 0) || (a < b ? -1 : 1));
}

/** Where a pin sits: a country pin on its country; a story on its most-named country with a place; an actor nowhere.
 *  -> [lng, lat] or null. */
export function placeOfPin(pin, story) {
  if (pin.kind === 'country') { const iso3 = resolveCountry(pin.refId)?.iso3; return iso3 ? placeOfCountry(iso3) : null; }
  if (pin.kind !== 'thread') return null;
  for (const iso3 of storyCountries(story, pin)) { const at = placeOfCountry(iso3); if (at) return at; }
  return null;
}

/** The other countries a story pin touches, as places: [{ iso3, name, at: [lng, lat] }] (the ring's own country left out). */
export function touchesOfPin(pin, story) {
  if (pin.kind !== 'thread') return [];
  const at = placeOfPin(pin, story);
  return storyCountries(story, pin)
    .map((iso3) => ({ iso3, name: COUNTRIES[iso3]?.name || iso3, p: placeOfCountry(iso3) }))
    .filter((t) => t.p && !(at && t.p[0] === at[0] && t.p[1] === at[1]))
    .map((t) => ({ iso3: t.iso3, name: t.name, at: t.p }));
}

export const RING_R = 9;
const STACK = 16;

/** Ring centres by pinId. Pins on the same spot fan out on a small circle so each stays clickable.
 *  `placed` is [{ pinId, at: [x, y] }]. -> { pinId: { x, y } } */
export function ringCentres(placed) {
  const groups = new Map();
  for (const p of placed) {
    const k = `${Math.round(p.at[0])}:${Math.round(p.at[1])}`;
    groups.set(k, [...(groups.get(k) || []), p]);
  }
  const out = {};
  for (const g of groups.values()) {
    g.forEach((p, i) => {
      const a = (2 * Math.PI * i) / g.length - Math.PI / 2;
      out[p.pinId] = g.length === 1 ? { x: p.at[0], y: p.at[1] } : { x: p.at[0] + Math.cos(a) * STACK, y: p.at[1] + Math.sin(a) * STACK };
    });
  }
  return out;
}

export const LABEL_H = 30;
const CHAR_W = 6.6;
export const labelWidth = (text) => Math.min(text.length, 30) * CHAR_W;

/** Each ring's label: right or left of the ring, slid up or down until it clears the rings and the labels already
 *  placed. `labels` is [{ pinId, text }] in the order to place. -> { pinId: { x, y, w, h, side } } (x, y = centre) */
export function placeRingLabels(labels, centres, width, height) {
  const rings = Object.values(centres).map((c) => ({ x: c.x, y: c.y, w: RING_R * 2 + 4, h: RING_R * 2 + 4 }));
  const hit = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  const placed = [];
  const out = {};
  for (const l of labels) {
    const c = centres[l.pinId];
    const w = labelWidth(l.text);
    let pick = null;
    for (const dy of [0, 1, -1, 2, -2, 3, -3]) {
      for (const side of ['right', 'left']) {
        const r = { x: c.x + (side === 'right' ? 1 : -1) * (RING_R + 6 + w / 2), y: c.y + dy * LABEL_H, w, h: LABEL_H, side };
        const inside = r.x - w / 2 >= 0 && r.x + w / 2 <= width && r.y - r.h / 2 >= 0 && r.y + r.h / 2 <= height;
        if (!pick && inside && ![...rings, ...placed].some((o) => hit(r, o))) pick = r;
      }
    }
    if (!pick) pick = { x: c.x + RING_R + 6 + w / 2, y: c.y, w, h: LABEL_H, side: 'right' };
    placed.push(pick);
    out[l.pinId] = pick;
  }
  return out;
}

const BOW = 0.2;
const control = (a, b) => ({ x: (a.x + b.x) / 2 - (b.y - a.y) * BOW, y: (a.y + b.y) / 2 + (b.x - a.x) * BOW });

/** The arc between two ring centres as an SVG path, bowed to one side by a fifth of its length. */
export function arcPath(a, b) {
  const c = control(a, b);
  return `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
}

/** The point halfway along that arc (a quadratic's midpoint). */
export function arcMid(a, b) {
  const c = control(a, b);
  return { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y };
}
