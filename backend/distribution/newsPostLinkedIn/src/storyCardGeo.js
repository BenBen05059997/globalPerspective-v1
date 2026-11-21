'use strict';

const fs = require('fs');
const path = require('path');
const COUNTRIES = require('./_shared/iso3Names.json');
const POINTS = require('./storyCardPoints.json').points;

// Country shapes for the story card, read from the poster's own world-map-template.svg (1200 x 630, plain equirectangular:
// x = (lon + 180) * 10 / 3, y = (90 - lat) * 3.5). Pure of network and AWS; the template is read once.

const WORLD = { w: 1200, h: 630 };
const project = (lat, lng) => [(lng + 180) * (WORLD.w / 360), (90 - lat) * (WORLD.h / 180)];

// The template carries 30 outlines by ISO numeric code only. 27 are named here; the other three have no code and stay plain land.
const NUMERIC_TO_ISO2 = {
  '732': 'EH', '032': 'AR', '044': 'BS', '238': 'FK', '304': 'GL', '260': 'TF', '076': 'BR', '068': 'BO', '084': 'BZ', '630': 'PR',
  '072': 'BW', '024': 'AO', '012': 'DZ', '050': 'BD', '064': 'BT', '004': 'AF', '051': 'AM', '040': 'AT', '008': 'AL', '056': 'BE',
  '540': 'NC', '090': 'SB', '036': 'AU', '031': 'AZ', '096': 'BN', '010': 'AQ', '070': 'BA',
};

// An island group counts as one country shape: pieces farther than this (map units, about 30 degrees) from the main landmass
// are left as plain land, so Alaska, French Guiana or Chukotka never stretch a frame.
const NEAR = 100;

const gap = (a, b) => Math.max(0, Math.max(a[0], b[0]) - Math.min(a[2], b[2]), Math.max(a[1], b[1]) - Math.min(a[3], b[3]));

function ringInfo(d) {
  const pts = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]]);
  let area = 0; let cx = 0; let cy = 0;
  let box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const c = x1 * y2 - x2 * y1;
    area += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
    box = [Math.min(box[0], x1), Math.min(box[1], y1), Math.max(box[2], x1), Math.max(box[3], y1)];
  }
  area /= 2;
  return { d, pts, area: Math.abs(area), box, centroid: area ? [cx / (6 * area), cy / (6 * area)] : pts[0] };
}

// Outlines that cross the date line (Russia, Fiji, Antarctica) are drawn in the template with a straight stroke across the whole
// world. Split such a ring at every jump of more than this many map units, so each piece is a plain closed polygon at one edge.
const JUMP = 500;

function splitDateLine(sub) {
  const pts = [...sub.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [m[1], m[2]]);
  const n = pts.length;
  const at = [];
  for (let i = 0; i < n; i++) if (Math.abs(pts[i][0] - pts[(i + 1) % n][0]) > JUMP) at.push(i);
  if (!at.length) return [sub];
  const out = [];
  for (let k = 0; k < at.length; k++) {
    const from = (at[k] + 1) % n;
    const to = at[(k + 1) % at.length];
    const run = [];
    for (let i = from; ; i = (i + 1) % n) { run.push(pts[i]); if (i === to) break; }
    if (run.length > 2) out.push(`M${run.map(([x, y]) => `${x},${y}`).join(' L')} Z`);
  }
  return out;
}

let template = null;
function load() {
  if (template) return template;
  const svg = fs.readFileSync(path.join(__dirname, 'world-map-template.svg'), 'utf8');
  const land = [];
  const byIso2 = new Map();
  for (const m of svg.matchAll(/<path ([^>]*?)\/>/g)) {
    const attrs = m[1];
    const d = (attrs.match(/ d="([^"]*)"/) || attrs.match(/^d="([^"]*)"/) || [])[1];
    if (!d) continue;
    const fixed = d.split(/(?=M)/).filter((x) => x.trim()).flatMap(splitDateLine).join(' ');
    land.push(fixed);
    const iso2 = (attrs.match(/(?:^| )id="(\w+)"/) || [])[1] || NUMERIC_TO_ISO2[(attrs.match(/data-numeric="(\d+)"/) || [])[1]];
    if (iso2) byIso2.set(iso2, fixed);
  }
  template = { land, byIso2, shapes: new Map() };
  return template;
}

/** Every outline of the world map, as path data: the grey land under a card. */
function landPaths() { return load().land; }

const unionBox = (boxes) => boxes.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])], [Infinity, Infinity, -Infinity, -Infinity]);

/**
 * The shape of one country, by ISO3: { iso3, name, kind: 'shape'|'point', d, rings, box [x0,y0,x1,y1], anchor [x,y] } or null when the
 * map has neither an outline nor a point for it. `d` and `rings` hold only the main landmass and the pieces near it. A point
 * (country with no outline, e.g. Bahrain) has an empty box at its position.
 */
function countryShape(iso3) {
  const t = load();
  if (t.shapes.has(iso3)) return t.shapes.get(iso3);
  const c = COUNTRIES[iso3];
  let shape = null;
  if (c) {
    const d = t.byIso2.get(c.iso2);
    if (d) {
      const rings = d.split(/(?=M)/).filter((s) => s.trim()).map(ringInfo).filter((r) => r.pts.length > 2);
      const main = rings.reduce((a, b) => (b.area > a.area ? b : a));
      const kept = rings.filter((r) => r === main || gap(r.box, main.box) <= NEAR);
      const box = unionBox(kept.map((r) => r.box));
      const [ax, ay] = main.centroid;
      // a piece that wraps the date line (Russia) has its centroid off the map: fall back to the middle of the box
      const anchor = ax >= box[0] && ax <= box[2] && ay >= box[1] && ay <= box[3] ? main.centroid : [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
      shape = { iso3, name: c.name, kind: 'shape', d: kept.map((r) => r.d).join(' '), rings: kept.map((r) => r.pts), box, anchor };
    } else if (POINTS[c.iso2]) {
      const [x, y] = project(...POINTS[c.iso2]);
      shape = { iso3, name: c.name, kind: 'point', d: '', rings: [], box: [x, y, x, y], anchor: [x, y] };
    }
  }
  t.shapes.set(iso3, shape);
  return shape;
}

/** Even-odd point-in-outline test in map units; a point has no inside. */
function insideShape(shape, x, y) {
  let inside = false;
  for (const ring of shape.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

module.exports = { WORLD, project, landPaths, countryShape, insideShape, unionBox };
