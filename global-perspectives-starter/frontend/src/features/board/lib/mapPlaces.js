// mapPlaces — the board map's geography and layout. Pure apart from the projection built at load.
// Outlines are the site's own coastlines (shared/map/landGeometry) in an equal-earth projection; a place is a
// country's centre from the shared coordinate table. A pin with no country gets no place: it is never guessed.
import { geoEqualEarth, geoPath } from 'd3-geo';
import { land, FRAME } from '@/shared/map/landGeometry.js';
import { COUNTRY_COORDINATES } from '@/shared/map/countryCoordinates.js';
import { COUNTRIES, resolveCountry } from '@/shared/lib/countries.js';

export const MAP_W = 900;
const projection = geoEqualEarth().fitWidth(MAP_W, FRAME);
const path = geoPath(projection);
export const MAP_H = Math.ceil(path.bounds(FRAME)[1][1]);
export const WORLD_PATH = path(land) || '';

const REGIONS = [['Americas', -92, 14], ['Europe', 14, 56], ['Africa', 20, 2]];
export const REGION_LABELS = REGIONS.map(([name, lng, lat]) => { const [x, y] = projection([lng, lat]); return { name, x, y }; });

/** [x, y] on the map for an ISO3 country, or null when the country table has no position for it. */
export function placeOfCountry(iso3) {
  const c = COUNTRY_COORDINATES[COUNTRIES[iso3]?.iso2];
  const at = c ? projection([c.lng, c.lat]) : null;
  return at && Number.isFinite(at[0]) && Number.isFinite(at[1]) ? at : null;
}

/** Where a pin sits: a country pin on its country; a story on the first country of its story view (or of the board
 *  feed's `iso3`); an actor nowhere. -> [x, y] or null. */
export function placeOfPin(pin, story) {
  if (pin.kind === 'country') { const iso3 = resolveCountry(pin.refId)?.iso3; return iso3 ? placeOfCountry(iso3) : null; }
  if (pin.kind !== 'thread') return null;
  const iso3 = (story?.iso3 || pin.iso3 || [])[0];
  return iso3 ? placeOfCountry(iso3) : null;
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
