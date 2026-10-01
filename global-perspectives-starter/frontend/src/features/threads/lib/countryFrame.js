// countryFrame — where the country page's map strip should look. The hero is a short band
// (~200 px) with an overlay bar across its top, so "centre on the country" means: fit the country's
// bounds inside the VISIBLE part of the band (below the overlay), not the whole strip.
//
// Bounds come from the bundled 110m coastline data (the same file the console map draws): the
// polygon that contains the country's catalogue centroid (else a name match) -> a bbox over its main
// landmass plus any sizeable polygon within 30 deg of it (Honshu + Hokkaido + Kyushu; not French
// Guiana, not Alaska's far end). A country absent from the 110m mesh (Malta, Singapore ...) gets a
// small box around its catalogue centroid and `source: 'centroid'`. Nothing here is invented: no
// code / no catalogue entry -> null and the caller keeps the old framing.
import { land } from '@/features/map/lib/landGeometry';
import { COUNTRY_COORDINATES } from '@/features/threads/lib/mapConstants';

const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

function ringBox(ring) {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return { w, e, s, n };
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

const CATALOGUE_NAMES = new Set(Object.values(COUNTRY_COORDINATES).map((c) => norm(c.name)));

// The feature for a catalogue country: an exact (normalised) name match first; else the polygon that
// contains its centroid, unless that polygon is itself ANOTHER catalogue country (Singapore's point
// falls inside the 110m Malaysia polygon: that must not frame Singapore as Malaysia).
function featureFor(name, lat, lng) {
  const n = norm(name);
  const byName = land.features.find((f) => norm(f.properties?.name) === n);
  if (byName) return byName;
  for (const f of land.features) {
    if (!f.geometry) continue;
    const fn = norm(f.properties?.name);
    if (CATALOGUE_NAMES.has(fn) && fn !== n) continue;
    for (const poly of polysOf(f.geometry)) {
      if (inRing(poly[0], lng, lat) && !poly.slice(1).some((h) => inRing(h, lng, lat))) return f;
    }
  }
  return null;
}

/** Bounds of the feature's main landmass + near, sizeable parts: { west, south, east, north }. */
export function featureBounds(feature) {
  const boxes = polysOf(feature.geometry).map((p) => {
    const b = ringBox(p[0]);
    return { ...b, area: Math.max(0.01, (b.e - b.w) * (b.n - b.s)), cx: (b.e + b.w) / 2, cy: (b.n + b.s) / 2 };
  });
  if (!boxes.length) return null;
  const main = boxes.reduce((a, b) => (b.area > a.area ? b : a));
  const keep = boxes.filter((b) => b === main || (b.area >= main.area * 0.03 && Math.hypot(b.cx - main.cx, b.cy - main.cy) <= 30));
  return {
    west: Math.min(...keep.map((b) => b.w)),
    east: Math.max(...keep.map((b) => b.e)),
    south: Math.min(...keep.map((b) => b.s)),
    north: Math.max(...keep.map((b) => b.n)),
  };
}

const cache = new Map();

/**
 * countryFrameBounds(code) -> { west, south, east, north, source: 'polygon' | 'centroid', lat, lng } | null
 * `code` = the ISO-2 code the map already uses (regionToCountryCode).
 */
export function countryFrameBounds(code) {
  if (!code) return null;
  if (cache.has(code)) return cache.get(code);
  const c = COUNTRY_COORDINATES[code];
  let out = null;
  if (c) {
    const f = featureFor(c.name, c.lat, c.lng);
    const b = f ? featureBounds(f) : null;
    out = b
      ? { ...b, source: 'polygon', lat: c.lat, lng: c.lng }
      : { west: c.lng - 3, east: c.lng + 3, south: c.lat - 3, north: c.lat + 3, source: 'centroid', lat: c.lat, lng: c.lng };
  }
  cache.set(code, out);
  return out;
}

// ─── SVG fallback framing ───────────────────────────────────────────────────────────────────────
// The fallback map draws an equirectangular world in a 1000 x 500 viewBox.
export const WORLD_W = 1000;
export const WORLD_H = 500;
const MIN_SPAN = { x: 80, y: 40 }; // viewBox units (about 29 x 14 deg): a small country keeps its surroundings
const MARGIN = 14; // px of air around the country inside the visible band

/**
 * frameViewBox(bounds, size, insets) -> { x, y, w, h, scale } — the viewBox that puts the bounds'
 * centre at the centre of the visible band (container minus `insets`) and fits them with a margin.
 * `size` = { w, h } px of the SVG; `insets` = { top, right, bottom, left } px covered by overlays.
 * `scale` = px per viewBox unit (callers divide pixel-sized marks by it).
 */
export function frameViewBox(bounds, size, insets = {}) {
  const { top = 0, right = 0, bottom = 0, left = 0 } = insets;
  const vw = Math.max(40, size.w - left - right - 2 * MARGIN);
  const vh = Math.max(30, size.h - top - bottom - 2 * MARGIN);
  const x0 = ((bounds.west + 180) / 360) * WORLD_W;
  const x1 = ((bounds.east + 180) / 360) * WORLD_W;
  const y0 = ((90 - bounds.north) / 180) * WORLD_H;
  const y1 = ((90 - bounds.south) / 180) * WORLD_H;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const bw = Math.max(MIN_SPAN.x, x1 - x0);
  const bh = Math.max(MIN_SPAN.y, y1 - y0);
  const scale = Math.min(vw / bw, vh / bh);
  const w = size.w / scale;
  const h = size.h / scale;
  const bandCx = left + (size.w - left - right) / 2;
  const bandCy = top + (size.h - top - bottom) / 2;
  return { x: cx - bandCx / scale, y: cy - bandCy / scale, w, h, scale };
}
