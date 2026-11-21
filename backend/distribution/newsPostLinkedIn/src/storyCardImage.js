'use strict';

// storyCardImage — the story card picture (1200 x 630 PNG) of the approved drawing
// .board/reviews/story-card-2026-11-21/accent/accent-and-link.html. Pure of data fetching: the caller passes one plain object,
// buildStoryCardSvg() returns SVG text, renderStoryCardPng() rasterises it with sharp. index.js does not call this yet.
//
// data = {
//   headline: string,
//   kind: 'start' | 'move' | 'measure' | null,          the newest step's role (kind chip)
//   category: string,                                    the story's category; picks the crisis colour and word
//   newestDate: 'YYYY-MM-DD', firstDate?: 'YYYY-MM-DD', stepCount?: number, stepDays?: number,   the since line
//   countries: [ISO3],                                   this story's places, the most "where it happens" first (solid on the map)
//   linkPlaces?: [ISO3],                                 this story's top places from its links view (web.places); with a link they are framed first
//   contextCountries?: [ISO3],                           other countries of the newest step, named dim when they are in frame
//   link?: { direction: 'feeds' | 'fed', strength: 'medium' | 'strong', confirmed: boolean,
//            title: string, category?: string, countries: [ISO3], places?: [ISO3] },   countries = the other story's newest-step countries;
//            places = its top places from the links view (web.otherPlaces[otherId]); the newest-step countries are kept to them when any match
//   forecast?: { chance: number, text: string, due: 'YYYY-MM-DD' },
//   sourceCount?: number,
// }
// A link leads the picture; the forecast is drawn only when there is no link. Rules in the drawing's "Rules the builder follows".

const { setupFonts } = require('./fontSetup');
const { textWidth, wrapText } = require('./fontMetrics');
const { WORLD, landPaths, countryShape, insideShape } = require('./storyCardGeo');

const W = 1200;
const H = 630;
const MAP_W = 504; // 42% of the picture
const EDGE = 10; // crisis-colour edge down the text side
const MIN_TEXT = 30; // 9 px when the picture is shown 360 px wide
const DOT_MIN = 20; // a country under 6 px at 360 px wide (20 px here) is drawn as a dot
const DOT_R = 13;

// Site tokens (tokens.css and the drawing's card), fixed: the picture is a dark card in both themes.
const C = { sea: '#0a1017', panel: '#101923', land: '#2a3541', landEdge: '#0a1017', fg: '#f1f4f6', muted: '#aebbc6', rule: '#26333f', amber: '#ffb347', halo: '#06090d', ink: '#06131c', light: '#f4f1ea' };
const HUE = { conflict: '#ee7754', political: '#9b8cf8', economic: '#8fd46a', humanitarian: '#d987e0', neutral: '#9aa4b2' };
const CRISIS_LABEL = { conflict: 'Conflict', political: 'Political', economic: 'Economic', humanitarian: 'Humanitarian', neutral: 'Other' };
// Copy of CATEGORY_MAP in the site's shared/lib/crisisHue.js (the back end cannot import the front end): category -> crisis type.
const CATEGORY_TO_CRISIS = {
  conflict: 'conflict', military: 'conflict', security: 'conflict', war: 'conflict',
  politics: 'political', political: 'political', election: 'political', elections: 'political', diplomacy: 'political', diplomatic: 'political',
  economy: 'economic', economic: 'economic', energy: 'economic', business: 'economic', markets: 'economic', market: 'economic', trade: 'economic', finance: 'economic',
  humanitarian: 'humanitarian', disaster: 'humanitarian', health: 'humanitarian', climate: 'humanitarian',
};
const KIND_WORD = { start: 'Starts a story', move: 'Moves a story', measure: 'Measured change' };
const LINK_WORD = { feeds: 'Feeds into', fed: 'Fed by' };
const STRENGTH_ON = { medium: 2, strong: 3 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const crisisOf = (category) => CATEGORY_TO_CRISIS[String(category || '').trim().toLowerCase()] || 'neutral';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;

/** '2026-11-20' -> 'Nov 20' (read from the string, never through a time zone); anything else -> ''. */
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '');
  return m && MONTHS[Number(m[2]) - 1] ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : '';
}

/** The since line: '64 steps on 37 days', 'first step of a new story', '2 steps on 1 day'. */
function sinceLine({ stepCount, stepDays, kind }) {
  if (!(stepCount >= 1)) return '';
  if (stepCount === 1) return kind === 'start' ? 'first step of a new story' : '1 step';
  return stepDays >= 1 ? `${stepCount} steps on ${stepDays} ${stepDays === 1 ? 'day' : 'days'}` : `${stepCount} steps`;
}

// ───────────────────────────── the map ─────────────────────────────

const MAX_W = WORLD.w / 3; // this story and the link never stretch the frame past a third of the world
const MAX_H = WORLD.h / 3;
const MIN_FRAME_W = 110;
const MIN_ARROW = 70; // the least visible arrow length (px at 1200)
const MIN_ZOOM_W = 10; // the tightest frame a zoom for the arrow may reach (map units; the panel is 504 px wide)
const ZOOM_FILL = 0.9; // zooming in for the arrow keeps drawn countries within 90% of the frame
const FILL = 0.76; // the drawn countries take at most this share of the frame: the rest is margin on every side

const boxUnion = (a, b) => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b);
const fits = (box) => box[2] - box[0] <= MAX_W && box[3] - box[1] <= MAX_H;

/**
 * Decide what the map draws. Pure; exported for tests.
 * Returns { own, striped, dotted, notes, placeNames, frame: {x, y, w, h, scale}, arrow, arrowFault }:
 *   arrow       { tail, target, headShape } in map units, set on every link card that has a new place to point at; arrowFault says why
 *               an arrow is missing or shorter than MIN_ARROW (the generator zooms in first; it never hides the case)
 *   own      this story's countries that are drawn solid (first = most "where it happens"); the first is always drawn, the others only
 *            while the frame stays within a third of the world
 *   notes    names of this story's countries left off the map for that reason ("Also in this story")
 *   striped  the other story's new countries drawn striped (newest-step countries minus those already drawn solid, at most two)
 *   placeNames  the names the link block says ("a story in ..."); [] when the other story is in the same places
 */
function planMap(data) {
  const link = data.link;
  // A link frames the two linked stories first. This story's countries are ordered: the ones the links view names as its places
  // (`data.linkPlaces`, web.places) first, then by distance to the other story's places (`link.places` = web.otherPlaces[otherId],
  // kept to the other story's newest-step countries; else those countries). The first is always drawn, the rest while the frame stays
  // within a third of the world; a main country far from the other story is therefore not drawn and falls into "Also in this story".
  // Without a link the order is the story's own (the main country leads).
  let order = [...new Set(data.countries || [])];
  const otherIsos = (() => {
    if (!link) return [];
    const all = [...new Set(link.countries || [])];
    const top = all.filter((c) => (link.places || []).includes(c));
    return top.length ? top : all;
  })();
  if (link) {
    const targets = otherIsos.map((c) => countryShape(c)).filter(Boolean).map((sh) => sh.anchor);
    const dist = (iso) => { const sh = countryShape(iso); return sh && targets.length ? Math.min(...targets.map((t) => Math.hypot(t[0] - sh.anchor[0], t[1] - sh.anchor[1]))) : 0; };
    const key = (iso) => [(data.linkPlaces || []).includes(iso) ? 0 : 1, dist(iso)];
    order = order.map((iso, i) => ({ iso, i, k: key(iso) })).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.i - b.i).map((o) => o.iso);
  }
  const own = [];
  const notes = [];
  let box = null;
  const joinOwn = (shape) => { own.push(shape); box = boxUnion(box, shape.box); };
  // Countries that take part in the link (named in the links view's places, or shared with the other story) join while the frame stays within
  // a third of the world. Any other country of this story joins only after the other story is placed, and only if it hardly widens that frame.
  const takesPart = (iso) => !link || (data.linkPlaces || []).includes(iso) || otherIsos.includes(iso);
  const later = [];
  for (const iso of order) {
    const shape = countryShape(iso);
    if (!shape) continue;
    if (link && box && !takesPart(iso)) later.push(shape);
    else if (!box || fits(boxUnion(box, shape.box))) joinOwn(shape);
    else notes.push(shape.name);
  }
  const striped = [];
  let placeNames = [];
  if (link && box) {
    const onMap = new Set(own.map((s) => s.iso3));
    const fresh = otherIsos.filter((iso) => !onMap.has(iso));
    // the link's own countries come first, then any other newest-step country
    for (const iso of link.countries || []) if (!onMap.has(iso) && !fresh.includes(iso)) fresh.push(iso);
    const named = fresh.slice(0, 2).map((iso) => ({ iso, shape: countryShape(iso) })).filter((c) => c.shape);
    placeNames = named.map((c) => c.shape.name);
    for (const { shape } of named) if (fits(boxUnion(box, shape.box))) { striped.push(shape); box = boxUnion(box, shape.box); }
  }
  // the other countries of this story: drawn when they widen the link frame by no more than half (+40 map units), else named in the note
  for (const shape of later) {
    const u = boxUnion(box, shape.box);
    if (fits(u) && u[2] - u[0] <= (box[2] - box[0]) * 1.5 + 40 && u[3] - u[1] <= (box[3] - box[1]) * 1.5 + 40) joinOwn(shape);
    else notes.push(shape.name);
  }
  if (!box) return { own, striped, dotted: new Set(), notes, placeNames, frame: null, arrow: null };

  const all = [...own, ...striped];
  const arrow = link && striped.length ? arrowEnds(own, striped, link.direction === 'feeds') : null;
  // frame: fit the boxes (a dot is padded by its radius) with a margin; solve a few times since the dot radius depends on the scale
  const frameAt = (fwMin, fill) => {
    let fw = fwMin;
    let dotted = new Set();
    for (let pass = 0; pass < 3; pass++) {
      const scale = MAP_W / fw;
      dotted = new Set(all.filter((s) => s.kind === 'point' || Math.max(s.box[2] - s.box[0], s.box[3] - s.box[1]) * scale < DOT_MIN).map((s) => s.iso3));
      let b = null;
      for (const s of all) {
        const pad = dotted.has(s.iso3) ? (DOT_R + 4) / scale : 0;
        b = boxUnion(b, dotted.has(s.iso3) ? [s.anchor[0] - pad, s.anchor[1] - pad, s.anchor[0] + pad, s.anchor[1] + pad] : s.box);
      }
      fw = Math.max(fwMin, (b[2] - b[0]) / fill, ((b[3] - b[1]) / fill) * (MAP_W / H));
      if (pass === 2) {
        const scale2 = MAP_W / fw;
        const fh = H / scale2;
        const fx = Math.max(Math.min((b[0] + b[2]) / 2 - fw / 2, WORLD.w - fw), 0);
        const fy = fh >= WORLD.h ? (WORLD.h - fh) / 2 : Math.max(Math.min((b[1] + b[3]) / 2 - fh / 2, WORLD.h - fh), 0);
        return { dotted, frame: { x: fx, y: fy, w: fw, h: fh, scale: scale2 } };
      }
    }
    return null;
  };
  let cur = frameAt(MIN_FRAME_W, FILL);
  // The arrow is always drawn on a link card. If its visible length is under the minimum, zoom in (smaller frame, less margin) until
  // it is long enough; countries are never cut (the content keeps 90% of the frame at most). If that cannot be done, report it.
  let arrowFault = link && !arrow ? (placeNames.length ? 'the other story\'s new places do not fit the map frame (a third of the world): no arrow' : 'the other story is in the same places as this one: no arrow') : null;
  if (arrow) {
    const visible = (c) => { const g = arrowGeometry(arrow, c.frame, c.dotted); return g ? g.visible : 0; };
    if (visible(cur) < MIN_ARROW) {
      let fwMin = cur.frame.w;
      let best = cur;
      for (let i = 0; i < 40 && visible(best) < MIN_ARROW; i++) {
        fwMin *= 0.93;
        const next = frameAt(Math.max(fwMin, MIN_ZOOM_W), ZOOM_FILL);
        if (next.frame.w >= best.frame.w - 0.01) break; // the content already fills the frame: cannot zoom in further
        best = next;
      }
      cur = best;
      if (visible(cur) < MIN_ARROW) arrowFault = `the arrow is ${Math.round(visible(cur))} px long at best (minimum ${MIN_ARROW}): the two stories' places are too close to zoom in further without cutting a country`;
    }
  }
  return { own, striped, dotted: cur.dotted, notes, placeNames, frame: cur.frame, arrow, arrowFault };
}

const rectsOverlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Quadratic curve point and tangent. */
const bez = (p0, c, p1, t) => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
];

/** Where the arrow goes, in map units: { tail, target, headShape }. Feeds: from the middle of this story's drawn countries to the other
 *  story's farthest new country. Fed: from that country to this story's nearest drawn country. */
function arrowEnds(own, striped, feeds) {
  const ownMid = [own.reduce((a, o) => a + o.anchor[0], 0) / own.length, own.reduce((a, o) => a + o.anchor[1], 0) / own.length];
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const far = [...striped].sort((a, b) => d(b.anchor, ownMid) - d(a.anchor, ownMid))[0];
  if (feeds) return { tail: ownMid, target: far.anchor, headShape: far };
  const near = [...own].sort((a, b) => d(a.anchor, far.anchor) - d(b.anchor, far.anchor))[0];
  return { tail: far.anchor, target: near.anchor, headShape: near };
}

/** The arrow in pixels for a frame: { d, tri, tail, tip, along, visible } or null when the ends are under 24 px apart. The head stops
 *  8 px short of the border of the head's country (walks the curve against the real outline). `visible` = tail to tip. */
function arrowGeometry(arrow, frame, dotted) {
  const s = frame.scale;
  const P = ([x, y]) => [(x - frame.x) * s, (y - frame.y) * s];
  const tail = P(arrow.tail);
  const target = P(arrow.target);
  const { headShape } = arrow;
  const len = Math.hypot(target[0] - tail[0], target[1] - tail[1]);
  if (len <= 24) return null;
  const nx = -(target[1] - tail[1]) / len;
  const ny = (target[0] - tail[0]) / len;
  const sign = ny <= 0 ? 1 : -1; // bend upwards
  const ctrl = [(tail[0] + target[0]) / 2 + nx * sign * len * 0.2, (tail[1] + target[1]) / 2 + ny * sign * len * 0.2];
  const inv = ([x, y]) => [x / s + frame.x, y / s + frame.y];
  let tStop = 1;
  const dotStop = dotted.has(headShape.iso3);
  for (let i = 1; i <= 200; i++) {
    const t = i / 200;
    const q = bez(tail, ctrl, target, t);
    const hit = dotStop ? Math.hypot(q[0] - target[0], q[1] - target[1]) <= DOT_R + 8 : insideShape(headShape, ...inv(q));
    if (hit && t > 0.2) { tStop = t; break; }
  }
  // back off 8 px (map-border gap) along the curve
  let tEnd = tStop;
  for (let i = 0; i < 200 && tEnd > 0.1; i++) { if (Math.hypot(...bez(tail, ctrl, target, tEnd).map((v, k) => v - bez(tail, ctrl, target, tStop)[k])) >= 8) break; tEnd -= 0.005; }
  const tip = bez(tail, ctrl, target, tEnd);
  const before = bez(tail, ctrl, target, Math.max(tEnd - 0.04, 0));
  const ang = Math.atan2(tip[1] - before[1], tip[0] - before[0]);
  const HL = 30; const HW = 26;
  const base = [tip[0] - Math.cos(ang) * HL, tip[1] - Math.sin(ang) * HL];
  const l = [base[0] + Math.cos(ang + Math.PI / 2) * HW / 2, base[1] + Math.sin(ang + Math.PI / 2) * HW / 2];
  const rr = [base[0] - Math.cos(ang + Math.PI / 2) * HW / 2, base[1] - Math.sin(ang + Math.PI / 2) * HW / 2];
  // the line ends inside the head: re-solve the curve to end at `base`
  let tb = tEnd;
  for (let i = 0; i < 200 && tb > 0.05; i++) { const q = bez(tail, ctrl, target, tb); if (Math.hypot(q[0] - tip[0], q[1] - tip[1]) >= HL - 2) break; tb -= 0.005; }
  const e = bez(tail, ctrl, target, tb);
  const c2 = [tail[0] + (ctrl[0] - tail[0]) * tb, tail[1] + (ctrl[1] - tail[1]) * tb]; // sub-curve control point by de Casteljau
  const along = [];
  for (let i = 0; i <= 24; i++) along.push(bez(tail, ctrl, target, (i / 24) * tb));
  return {
    d: `M${r1(tail[0])},${r1(tail[1])} Q${r1(c2[0])},${r1(c2[1])} ${r1(e[0])},${r1(e[1])}`,
    tri: `${r1(tip[0])},${r1(tip[1])} ${r1(l[0])},${r1(l[1])} ${r1(rr[0])},${r1(rr[1])}`,
    tail, tip, along, visible: Math.hypot(tip[0] - tail[0], tip[1] - tail[1]),
  };
}


function buildMapSvg(data, plan) {
  const { frame, own, striped, dotted, notes } = plan;
  const hue = HUE[crisisOf(data.category)];
  const otherHue = HUE[crisisOf(data.link?.category)] || hue;
  const s = frame.scale;
  const P = ([x, y]) => [(x - frame.x) * s, (y - frame.y) * s];
  const tpath = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${r1((x - frame.x) * s)},${r1((y - frame.y) * s)}`);

  const parts = [];
  parts.push(`<defs><clipPath id="mapclip"><rect x="0" y="0" width="${MAP_W}" height="${H}"/></clipPath>`);
  parts.push(`<pattern id="hatch" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)"><rect width="12" height="12" fill="${C.land}"/><rect width="5.5" height="12" fill="${otherHue}"/></pattern></defs>`);
  parts.push(`<g clip-path="url(#mapclip)"><rect width="${MAP_W}" height="${H}" fill="${C.sea}"/>`);
  parts.push(`<path d="${landPaths().map(tpath).join(' ')}" fill="${C.land}" stroke="${C.landEdge}" stroke-width="1.2" stroke-linejoin="round"/>`);
  for (const sh of striped) if (!dotted.has(sh.iso3)) parts.push(`<path d="${tpath(sh.d)}" fill="url(#hatch)" stroke="${otherHue}" stroke-width="2.6" stroke-dasharray="8 5" stroke-linejoin="round"/>`);
  for (const sh of own) if (!dotted.has(sh.iso3)) parts.push(`<path d="${tpath(sh.d)}" fill="${hue}" stroke="${C.light}" stroke-width="2" stroke-linejoin="round"/>`);

  // pixel-space items
  const obstacles = [];
  const circ = (cx, cy, r) => obstacles.push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });
  for (const sh of striped) if (dotted.has(sh.iso3)) { const [x, y] = P(sh.anchor); parts.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${DOT_R}" fill="url(#hatch)" stroke="${otherHue}" stroke-width="3" stroke-dasharray="6 4"/>`); circ(x, y, DOT_R); }
  for (const sh of own) if (dotted.has(sh.iso3)) { const [x, y] = P(sh.anchor); parts.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${DOT_R}" fill="${hue}" stroke="${C.light}" stroke-width="3"/>`); circ(x, y, DOT_R); }

  // the arrow: from the feeding story to the fed one (planMap decided its ends and made the frame long enough for it)
  let arrowSvg = '';
  const g = plan.arrow ? arrowGeometry(plan.arrow, frame, dotted) : null;
  if (g) {
    const color = data.link.direction === 'feeds' ? hue : otherHue;
    arrowSvg = `<path d="${g.d}" fill="none" stroke="${C.halo}" stroke-width="15" stroke-linecap="round" opacity=".85"/><polygon points="${g.tri}" fill="${C.halo}" stroke="${C.halo}" stroke-width="7" stroke-linejoin="round" opacity=".85"/>`
      + `<path d="${g.d}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><polygon points="${g.tri}" fill="${color}"/>`
      + `<circle cx="${r1(g.tail[0])}" cy="${r1(g.tail[1])}" r="9" fill="${color}" stroke="${C.halo}" stroke-width="3"/>`;
    for (const [x, y] of g.along) circ(x, y, 12);
    circ(g.tip[0], g.tip[1], 20);
  }
  parts.push(arrowSvg);

  // the "Also in this story" note (this story's countries left off the map)
  let noteSvg = '';
  if (notes.length) {
    const names = notes.length > 2 ? `${notes.slice(0, 2).join(', ')} +${notes.length - 2}` : notes.join(', ');
    const lines = [{ t: 'Also in this story', w: 600 }, ...wrapText(names, { size: MIN_TEXT, weight: 600, maxWidth: MAP_W - 52, maxLines: 2 }).lines.map((t) => ({ t, w: 600 }))];
    const widest = Math.max(...lines.map((l) => textWidth(l.t, MIN_TEXT, l.w)));
    const bw = widest + 24;
    const bh = lines.length * 36 + 16;
    const bx = 14; const by = H - 14 - bh;
    noteSvg = `<rect x="${bx}" y="${by}" width="${r1(bw)}" height="${bh}" rx="6" fill="${C.halo}" fill-opacity=".82"/>`
      + lines.map((l, i) => `<text x="${bx + 12}" y="${by + 8 + i * 36 + 26}" font-family="Inter" font-size="${MIN_TEXT}" font-weight="${i ? 600 : 400}" fill="${i ? C.fg : C.muted}">${esc(l.t)}</text>`).join('');
    obstacles.push({ x: bx, y: by, w: bw, h: bh });
  }

  // labels: own countries first, then the striped ones, then dim context. Each takes the first spot that touches nothing.
  const labelH = 36;
  const labels = [];
  const wanted = [
    ...own.map((sh) => ({ sh, kind: 'own' })),
    ...striped.map((sh) => ({ sh, kind: 'other' })),
  ];
  const ownIso = new Set(own.map((o) => o.iso3));
  const stripedIso = new Set(striped.map((o) => o.iso3));
  for (const iso of data.contextCountries || []) {
    if (ownIso.has(iso) || stripedIso.has(iso)) continue;
    const sh = countryShape(iso);
    if (!sh) continue;
    const [x0, y0] = P([sh.box[0], sh.box[1]]);
    const [x1, y1] = P([sh.box[2], sh.box[3]]);
    if (Math.min(x1, MAP_W) - Math.max(x0, 0) >= 120 && Math.min(y1, H) - Math.max(y0, 0) >= 60) wanted.push({ sh, kind: 'dim' });
  }
  const placed = [];
  for (const { sh, kind } of wanted) {
    const weight = kind === 'dim' ? 600 : 700;
    const lw = textWidth(sh.name, MIN_TEXT, weight) + 4;
    // only the part of the country inside the map takes a label: clip its box to the panel and keep the anchor in it
    const [ox0, oy0] = P([sh.box[0], sh.box[1]]);
    const [ox1, oy1] = P([sh.box[2], sh.box[3]]);
    const [bx0, by0, bx1, by1] = [Math.max(ox0, 0), Math.max(oy0, 0), Math.min(ox1, MAP_W), Math.min(oy1, H)];
    const [pax, pay] = P(sh.anchor);
    const ax = Math.min(Math.max(pax, bx0), bx1);
    const ay = Math.min(Math.max(pay, by0), by1);
    const isDot = dotted.has(sh.iso3) || sh.kind === 'point';
    const cands = [];
    if (!isDot && bx1 - bx0 >= lw + 16 && by1 - by0 >= labelH + 12) cands.push([ax, ay]);
    const r = isDot ? DOT_R + 4 : 6;
    const ty = isDot ? ay : (by0 + by1) / 2;
    const bot = isDot ? ay + DOT_R : by1;
    const top = isDot ? ay - DOT_R : by0;
    cands.push([ax, bot + r + labelH / 2], [ax, top - r - labelH / 2], [(isDot ? ax + DOT_R : bx1) + r + lw / 2, ty], [(isDot ? ax - DOT_R : bx0) - r - lw / 2, ty]);
    // second ring, one label further out, for crowded corners
    cands.push([ax, bot + r + labelH * 1.5 + 4], [ax, top - r - labelH * 1.5 - 4], [(isDot ? ax + DOT_R : bx1) + r + lw / 2 + 24, ty + labelH], [(isDot ? ax - DOT_R : bx0) - r - lw / 2 - 24, ty + labelH]);
    let best = null;
    for (const [cx0, cy0] of cands) {
      const cx = Math.min(Math.max(cx0, 8 + lw / 2), MAP_W - 8 - lw / 2);
      const cy = Math.min(Math.max(cy0, 8 + labelH / 2), H - 8 - labelH / 2);
      const rect = { x: cx - lw / 2, y: cy - labelH / 2, w: lw, h: labelH };
      const hit = [...obstacles, ...placed].reduce((a, o) => a + rectsOverlap(rect, o), 0) + Math.max(0, Math.abs(cx - cx0) - 1) * 4 + Math.max(0, Math.abs(cy - cy0) - 1) * 4;
      if (!best || hit < best.hit) best = { hit, cx, cy, rect };
      if (hit === 0) break;
    }
    placed.push(best.rect);
    labels.push({ kind, name: sh.name, x: best.cx, y: best.cy });
  }
  parts.push(noteSvg);
  for (const l of labels) {
    const fill = l.kind === 'dim' ? C.muted : C.fg;
    const attrs = `x="${r1(l.x)}" y="${r1(l.y + MIN_TEXT * 0.36)}" font-family="Inter" font-size="${MIN_TEXT}" font-weight="${l.kind === 'dim' ? 600 : 700}"${l.kind === 'other' ? ' font-style="italic"' : ''} text-anchor="middle"`;
    parts.push(`<text ${attrs} fill="none" stroke="${C.halo}" stroke-width="7" stroke-linejoin="round">${esc(l.name)}</text><text ${attrs} fill="${fill}">${esc(l.name)}</text>`);
  }
  parts.push('</g>');
  return { svg: parts.join(''), labels };
}

// ───────────────────────────── the text side ─────────────────────────────

const X0 = MAP_W + EDGE + 42;
const X1 = W - 41;
const TW = X1 - X0;
// The headline is Fraunces SemiBold (static "Fraunces 72pt" in src/fonts, weight 600); everything else is Inter.
// Quoted: unquoted, "72pt" is not a valid CSS identifier and the whole family is dropped (the headline falls back to Times).
const HEAD_FONT = "'Fraunces 72pt'";
const text = (x, y, size, weight, fill, str, extra = '', family = 'Inter') => `<text x="${r1(x)}" y="${r1(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${esc(str)}</text>`;
/** Baseline for a line box [top, top + lineH). */
const base = (top, lineH, size) => top + lineH / 2 + size * 0.36;

function chip(x, y, label, { stroke, fill, color, upper, dot }) {
  const sp = upper ? 1.2 : 0;
  const str = upper ? label.toUpperCase() : label;
  const tw = textWidth(str, MIN_TEXT, 600, sp);
  const w = tw + 28 + (dot ? 24 : 0);
  const h = 46;
  let svg = `<rect x="${r1(x)}" y="${y}" width="${r1(w)}" height="${h}" rx="5" fill="${fill || 'none'}" stroke="${stroke}" stroke-width="2.5"/>`;
  if (dot) svg += `<circle cx="${r1(x + 22)}" cy="${y + h / 2}" r="7" fill="${dot}"/>`;
  svg += text(x + 14 + (dot ? 24 : 0), base(y, h, MIN_TEXT), MIN_TEXT, 600, color, str, sp ? ` letter-spacing="${sp}"` : '');
  return { svg, w };
}

function bars(x, y, strength, color) {
  const on = STRENGTH_ON[strength] || 0;
  let svg = '';
  for (let i = 0; i < 3; i++) svg += `<rect x="${x + i * 17}" y="${y}" width="12" height="28" fill="${i < on ? C.fg : 'none'}" stroke="${i < on ? C.fg : color}" stroke-width="2.4"/>`;
  return { svg, w: 46 };
}

/** The three-part sign of the link block: this story (solid), the arrow, the other story (striped). Reads in the arrow's direction. */
function glyph(x, y, direction, hue, otherHue) {
  const solid = (gx) => `<rect x="${gx}" y="${y + 3}" width="22" height="22" fill="${hue}" stroke="${C.light}" stroke-width="2"/>`;
  const hatched = (gx) => `<rect x="${gx}" y="${y + 3}" width="22" height="22" fill="url(#hatch)" stroke="${otherHue}" stroke-width="2.4" stroke-dasharray="5 3"/>`;
  const arrowColor = direction === 'feeds' ? hue : otherHue;
  const arrow = `<path d="M${x + 30} ${y + 14} H${x + 54}" stroke="${arrowColor}" stroke-width="5"/><polygon points="${x + 68},${y + 14} ${x + 54},${y + 5} ${x + 54},${y + 23}" fill="${arrowColor}"/>`;
  return { svg: direction === 'feeds' ? solid(x) + arrow + hatched(x + 72) : hatched(x) + arrow + solid(x + 72), w: 96 };
}

function layoutText(data, plan, opts) {
  const hue = HUE[crisisOf(data.category)];
  const otherHue = HUE[crisisOf(data.link?.category)] || hue;
  const out = [];
  let y = 34;

  // chips
  let kc = KIND_WORD[data.kind] ? chip(X0, y, KIND_WORD[data.kind], data.kind === 'start' ? { stroke: C.fg, fill: C.fg, color: C.ink } : { stroke: C.fg, color: C.fg }) : null;
  if (kc) out.push(kc.svg);
  const cat = chip(X0 + (kc ? kc.w + 12 : 0), y, CRISIS_LABEL[crisisOf(data.category)], { stroke: hue, color: hue, upper: true, dot: hue });
  out.push(cat.svg);
  y += 46 + 12;

  // headline: at most four lines, then an ellipsis
  const title = wrapText(data.headline, { size: opts.titleSize, weight: 600, family: 'serif', maxWidth: TW - 6, maxLines: 4 });
  title.lines.forEach((ln, i) => out.push(text(X0, base(y + i * opts.titleLead, opts.titleLead, opts.titleSize), opts.titleSize, 600, C.fg, ln, '', HEAD_FONT)));
  y += title.lines.length * opts.titleLead + 14;

  // since line: first date, a rule, the newest date in amber with its dot and words
  const newest = fmtDate(data.newestDate);
  const first = fmtDate(data.firstDate);
  const newWord = 'NEWEST STEP';
  const newW = textWidth(newWord, MIN_TEXT, 600, 1.2);
  const dateW = textWidth(newest, MIN_TEXT, 600);
  const groupW = 22 + dateW + 16 + newW;
  const rowH = 36;
  const cy = y + rowH / 2;
  let gx = X0;
  if (first && first !== newest) {
    const fw = textWidth(first, MIN_TEXT, 500);
    out.push(text(X0, base(y, rowH, MIN_TEXT), MIN_TEXT, 500, C.muted, first));
    gx = X1 - groupW;
    out.push(`<rect x="${r1(X0 + fw + 14)}" y="${r1(cy - 1.5)}" width="${r1(Math.max(gx - 14 - (X0 + fw + 14), 0))}" height="3" fill="#8796a3"/>`);
  }
  if (newest) {
    out.push(`<circle cx="${r1(gx + 8)}" cy="${cy}" r="8" fill="${C.amber}" fill-opacity="1"/><circle cx="${r1(gx + 8)}" cy="${cy}" r="12" fill="none" stroke="${C.amber}" stroke-opacity=".3" stroke-width="3"/>`);
    out.push(text(gx + 26, base(y, rowH, MIN_TEXT), MIN_TEXT, 600, C.amber, newest));
    out.push(text(gx + 26 + dateW + 16, base(y, rowH, MIN_TEXT), MIN_TEXT, 600, C.amber, newWord, ' letter-spacing="1.2"'));
  }
  y += rowH;
  const since = sinceLine(data);
  if (since) { out.push(text(X0, base(y, 36, MIN_TEXT), MIN_TEXT, 400, C.muted, since)); y += 36; }
  const topEnd = y;

  // footer
  const footTop = H - 20 - 36;
  const src = data.sourceCount >= 1 ? `${data.sourceCount} ${data.sourceCount === 1 ? 'source' : 'sources'} · globalperspective.net` : 'globalperspective.net';
  out.push(text(X0, base(footTop, 36, MIN_TEXT), MIN_TEXT, 400, C.muted, src));

  // the one focal block, pinned above the footer: the link, else the forecast
  let focalTop = footTop - 8;
  let focal = '';
  if (data.link) {
    const lk = data.link;
    const other = wrapText(lk.title, { size: MIN_TEXT, weight: 400, maxWidth: TW, maxLines: opts.otherLines });
    const placeStr = plan.placeNames.length ? `a story in ${plan.placeNames.join(' and ')}` : 'a story in the same places';
    const place = wrapText(placeStr, { size: 32, weight: 700, maxWidth: TW, maxLines: opts.placeLines });
    const h = 14 + 40 + 36 + place.lines.length * 40 + other.lines.length * 36 + 4;
    const top = focalTop - h;
    let ly = top;
    focal += `<rect x="${X0}" y="${ly}" width="${TW}" height="2" fill="${C.rule}"/>`;
    ly += 14;
    const g = glyph(X0, ly + 6, lk.direction, hue, otherHue);
    focal += g.svg;
    const word = LINK_WORD[lk.direction].toUpperCase();
    focal += text(X0 + g.w + 14, base(ly, 40, MIN_TEXT), MIN_TEXT, 700, C.fg, word, ' letter-spacing="1.5"');
    const wx = X0 + g.w + 14 + textWidth(word, MIN_TEXT, 700, 1.5) + 18;
    const b = bars(wx, ly + 6, lk.strength, C.muted);
    focal += b.svg + text(wx + b.w + 14, base(ly, 40, MIN_TEXT), MIN_TEXT, 400, C.muted, lk.strength);
    ly += 40;
    focal += text(X0, base(ly, 36, MIN_TEXT), MIN_TEXT, 400, C.muted, lk.confirmed ? 'Confirmed in our weekly review' : 'Model judgment');
    ly += 36;
    place.lines.forEach((ln, i) => { focal += text(X0, base(ly + i * 40, 40, 32), 32, 700, C.fg, ln); });
    ly += place.lines.length * 40;
    other.lines.forEach((ln, i) => { focal += text(X0, base(ly + i * 36, 36, MIN_TEXT), MIN_TEXT, 400, C.muted, ln); });
    focalTop = top;
  } else if (data.forecast && Number.isFinite(data.forecast.chance)) {
    const f = data.forecast;
    const body = wrapText(`that ${String(f.text || '').trim().replace(/[.?]$/, '')}`, { size: 32, weight: 400, maxWidth: TW, maxLines: opts.forecastLines });
    const pctSize = 104;
    const h = 16 + 104 + 8 + body.lines.length * 40 + 4;
    const top = focalTop - h;
    let ly = top;
    focal += `<rect x="${X0}" y="${ly}" width="${TW}" height="2" fill="${C.rule}"/>`;
    ly += 16;
    const pct = `${Math.round(f.chance)}%`;
    focal += text(X0, ly + pctSize * 0.8, pctSize, 700, C.fg, pct, ' letter-spacing="-2"');
    const px = X0 + textWidth(pct, pctSize, 700, -2) + 24;
    focal += text(px, ly + 36, MIN_TEXT, 600, C.muted, 'OUR FORECAST', ' letter-spacing="1.2"');
    if (fmtDate(f.due)) focal += text(px, ly + 36 + 46, 36, 700, C.fg, `by ${fmtDate(f.due)}`);
    ly += 104 + 8;
    body.lines.forEach((ln, i) => { focal += text(X0, base(ly + i * 40, 40, 32), 32, 400, C.fg, ln); });
    focalTop = top;
  }
  out.push(focal);
  return { svg: out.join(''), overflow: Math.max(0, topEnd + (focal ? 12 : 0) - focalTop), kc };
}

// Fit the text side: shrink the least important things first (the other story's title, then the forecast words, then the headline).
const FITS = [
  { titleSize: 34, titleLead: 40, otherLines: 2, placeLines: 1, forecastLines: 3 },
  { titleSize: 34, titleLead: 40, otherLines: 1, placeLines: 1, forecastLines: 2 },
  { titleSize: 32, titleLead: 38, otherLines: 1, placeLines: 1, forecastLines: 2 },
  { titleSize: 30, titleLead: 36, otherLines: 1, placeLines: 1, forecastLines: 1 },
];

/** The card as SVG text (1200 x 630). */
function buildStoryCardSvg(data) {
  const plan = planMap(data);
  const hue = HUE[crisisOf(data.category)];
  let t = null;
  for (const opts of FITS) { t = layoutText(data, plan, opts); if (t.overflow <= 0) break; }
  const map = plan.frame ? buildMapSvg(data, plan) : { svg: `<rect width="${MAP_W}" height="${H}" fill="${C.sea}"/>` };
  const defs = plan.frame ? '' : `<defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)"><rect width="12" height="12" fill="${C.land}"/><rect width="5.5" height="12" fill="${hue}"/></pattern></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${C.panel}"/>${map.svg}<rect x="${MAP_W}" y="0" width="${EDGE}" height="${H}" fill="${hue}"/>${t.svg}</svg>`;
}

/** The card as a PNG buffer. `width` 1200 is full size; 360 gives the phone view. sharp is required here so tests of the pure parts never load it. */
async function renderStoryCardPng(data, { width = W, sharp = require('sharp') } = {}) {
  setupFonts('storyCardImage');
  const svg = buildStoryCardSvg(data);
  const full = sharp(Buffer.from(svg));
  return width === W ? full.png().toBuffer() : full.resize(width, Math.round((H * width) / W), { kernel: 'lanczos3' }).png().toBuffer();
}

module.exports = { buildStoryCardSvg, renderStoryCardPng, planMap, arrowGeometry, crisisOf, fmtDate, sinceLine, FITS };
