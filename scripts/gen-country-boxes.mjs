#!/usr/bin/env node
/**
 * Regenerates backend/situations/newsSituationIngest/src/countryBoxes.json:
 *   ISO3 -> { c: [lat, lon], b: [[south, west, north, east], ...] }
 *
 * Source: the frontend's shared/map/countries-110m.json (topojson, decoded by hand: delta-encoded arcs + transform).
 * Feature names resolve to ISO3 through backend/shared/src/countries.js, same as scripts/gen-country-geo.mjs.
 *
 *  - b = one BOUNDING BOX PER POLYGON (rounded to 0.1 deg), not one box per country. The topojson already splits
 *    polygons at the antimeridian, so USA (Alaska/Aleutians, Hawaii), Russia (Chukotka) and Fiji get separate small
 *    boxes instead of one box spanning the world. A box is coarser than the border: a point near a border can fall
 *    in a neighbour's box; that is accepted (the news pin only needs "roughly in the country").
 *  - c = planar area-weighted centroid of the country's largest polygon. If that falls outside (concave shapes) the
 *    midpoint of the longest interior stretch of the latitude line through it is used; the generator checks the
 *    result lies inside the polygon and exits 1 if not.
 *
 *   node scripts/gen-country-boxes.mjs           # write the file
 *   node scripts/gen-country-boxes.mjs --check   # exit 1 if out of date
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'backend/situations/newsSituationIngest/src/countryBoxes.json');
const BUNDLE = path.join(ROOT, 'global-perspectives-starter/frontend/src/shared/map/countries-110m.json');
const { resolveCountry } = createRequire(import.meta.url)(path.join(ROOT, 'backend/shared/src/countries.js'));
const SKIP = new Set(['Antarctica', 'N. Cyprus', 'Somaliland']);

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale; const [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
}
function ring(arcs, idxs) {
  const pts = [];
  for (const i of idxs) {
    const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
}
function area(pts) { let s = 0; for (let i = 0; i < pts.length - 1; i++) s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]; return s / 2; }
function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length - 1; i++) { const f = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]; a += f; cx += (pts[i][0] + pts[i + 1][0]) * f; cy += (pts[i][1] + pts[i + 1][1]) * f; }
  return [cx / (3 * a), cy / (3 * a)];
}
function inRing(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A ring that crosses the antimeridian jumps ~360 deg in longitude between neighbours (Russia/Chukotka, Fiji).
// Unwrap it to continuous longitudes (may exceed 180) so its centroid and bbox are sane; boxes are split back at 180.
function unwrap(pts) {
  let off = 0; let prev = pts[0][0];
  return pts.map(([x, y], i) => {
    if (i) { if (x - prev > 180) off -= 360; else if (x - prev < -180) off += 360; }
    prev = x; return [x + off, y];
  });
}
const wrap = (x) => (x > 180 ? x - 360 : x < -180 ? x + 360 : x);

// Concave countries (Norway, Chile-like shapes) can put the plain centroid outside: use the midpoint of the longest
// interior stretch of the horizontal line through the centroid instead.
function innerPoint(pts, y) {
  const xs = [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  xs.sort((a, b) => a - b);
  let best = [xs[0], xs[1]];
  for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > best[1] - best[0]) best = [xs[k], xs[k + 1]];
  return [(best[0] + best[1]) / 2, y];
}

export function build(topo) {
  const arcs = decodeArcs(topo);
  const out = {}; const bad = [];
  for (const g of topo.objects.countries.geometries) {
    const name = g.properties?.name;
    if (SKIP.has(name)) continue;
    const iso3 = resolveCountry(name)?.iso3;
    if (!iso3) { bad.push(`${g.id} ${name}`); continue; }
    const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    const outers = polys.map((p) => unwrap(ring(arcs, p[0])));
    const boxes = outers.flatMap((pts) => {
      const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
      const [s, w, n, e] = [r1(Math.min(...ys)), r1(Math.min(...xs)), r1(Math.max(...ys)), r1(Math.max(...xs))];
      if (e > 180) return [[s, w, n, 180], [s, -180, n, r1(e - 360)]];
      if (w < -180) return [[s, r1(w + 360), n, 180], [s, -180, n, e]];
      return [[s, w, n, e]];
    });
    let big = 0; outers.forEach((p, i) => { if (Math.abs(area(p)) > Math.abs(area(outers[big]))) big = i; });
    let [cx, cy] = centroid(outers[big]);
    if (!inRing(cx, cy, outers[big])) [cx, cy] = innerPoint(outers[big], cy);
    if (!inRing(cx, cy, outers[big])) { bad.push(`${iso3} centroid outside its largest polygon`); continue; }
    if (out[iso3]) out[iso3].b.push(...boxes); // two features for one ISO3: keep the first centre
    else out[iso3] = { c: [r2(cy), r2(wrap(cx))], b: boxes };
  }
  return { out, bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { out, bad } = build(JSON.parse(fs.readFileSync(BUNDLE, 'utf8')));
  if (bad.length) { console.error('problems:\n' + bad.join('\n')); process.exit(1); }
  const keys = Object.keys(out).sort();
  const text = '{\n' + keys.map((k) => `"${k}":${JSON.stringify(out[k])}`).join(',\n') + '\n}\n';
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) { console.error('countryBoxes.json is out of date: run node scripts/gen-country-boxes.mjs'); process.exit(1); }
    console.log('countryBoxes.json up to date');
  } else { fs.writeFileSync(OUT, text); console.log(`wrote ${OUT} (${keys.length} countries, ${text.length} bytes)`); }
}
