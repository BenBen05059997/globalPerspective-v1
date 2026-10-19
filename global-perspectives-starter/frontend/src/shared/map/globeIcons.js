// globeIcons — the globe's ▲●◆▼ status badges, ◆ GDACS alert diamonds and HUD selection brackets as
// PIXEL-SPACE icons (deck.gl IconLayer), so each is a constant screen size at every zoom, sits at a
// fixed pixel offset from its own marker while the globe spins/drags, and is culled by the same
// depth test that hides the dots and halos on the far side.
//
// They used to be tiny lon/lat polygons sized with a degrees-per-pixel guess. A polygon on the
// sphere is a fixed patch of ground: it can be the right size at one latitude/view angle only
// (deck's GlobeViewport scale is 2^(zoom - log2(pi*cos(viewLat))), not the 2^zoom the guess used),
// it foreshortens towards the limb, and sub-pixel tessellation/depth at the marker's lift made
// some of them detach. Pixel-space billboards have none of that. All shapes share ONE small white
// atlas drawn here; the layer tints them per marker (`mask`), so hue/dimming stay data-driven.

/** Atlas pixels per logical (CSS) pixel: sprites are drawn 4x and minified, so they stay crisp. */
export const ATLAS_K = 4;
/** Glyph cells span this many logical px (badge shapes are <= 9px wide; the dark edge is 1.45x). */
export const GLYPH_SPAN = 16;
const CELL = GLYPH_SPAN * ATLAS_K; // 64
const DIAMOND_FILL = 28 / 32; // diamond half-diagonal as a share of the half-cell (AA margin)
const CORNER_CELL = 48;
const CORNER_ANCHOR = 8; // atlas px from the cell's top-left to the bracket corner's vertex
const CORNER_ARM = 7; // logical px
const CORNER_STROKE = 2; // logical px

/** The four badge glyph outlines, in logical px around the glyph origin (+y = up). */
export const GLYPH_PTS = {
  escalating: [[0, 4.5], [4.5, -3.5], [-4.5, -3.5]],
  cooling: [[-4.5, 3.5], [4.5, 3.5], [0, -4.5]],
  steady: [[0, 4.5], [4.5, 0], [0, -4.5], [-4.5, 0]],
  new: Array.from({ length: 10 }, (_, i) => [3.8 * Math.cos((i / 10) * 2 * Math.PI), 3.8 * Math.sin((i / 10) * 2 * Math.PI)]),
};
/** The dark edge is the same glyph 1.45x larger (the approved look). */
export const EDGE_SCALE = 1.45;
/** Badge sits up-right of the mark's outer ring by this many px (centre-to-centre = ring + 6). */
export const BADGE_GAP = 6;
/** HUD bracket box half-size = ring + this. */
export const BRACKET_GAP = 9;

export const ICON_MAPPING = {
  escalating: { x: 0, y: 0, width: CELL, height: CELL, anchorX: CELL / 2, anchorY: CELL / 2, mask: true },
  cooling: { x: CELL, y: 0, width: CELL, height: CELL, anchorX: CELL / 2, anchorY: CELL / 2, mask: true },
  steady: { x: CELL * 2, y: 0, width: CELL, height: CELL, anchorX: CELL / 2, anchorY: CELL / 2, mask: true },
  new: { x: CELL * 3, y: 0, width: CELL, height: CELL, anchorX: CELL / 2, anchorY: CELL / 2, mask: true },
  diamond: { x: CELL * 4, y: 0, width: CELL, height: CELL, anchorX: CELL / 2, anchorY: CELL / 2, mask: true },
  corner: { x: CELL * 5, y: 0, width: CORNER_CELL, height: CORNER_CELL, anchorX: CORNER_ANCHOR, anchorY: CORNER_ANCHOR, mask: true },
};
export const ATLAS_W = CELL * 5 + CORNER_CELL;
export const ATLAS_H = CELL;

/** Icon height (logical px) for a cell whose drawn shape must match `ICON_SCALE` 1:1. */
export const GLYPH_SIZE = GLYPH_SPAN;
/** Bracket corner icon height in logical px (its cell is CORNER_CELL atlas px). */
export const CORNER_SIZE = CORNER_CELL / ATLAS_K;

/** Icon height for a diamond whose half-diagonal is `k` logical px. */
export const diamondSize = (k) => (k * 2) / DIAMOND_FILL;

/** Pixel offset [dx, dy] (deck convention: +y = DOWN) of a badge relative to its marker. */
export function badgeOffset(outerR) {
  const o = outerR + BADGE_GAP;
  return [o, -o];
}

/** The four bracket corners for a box of half-size `b` px: offset (+y down) and rotation in degrees. */
export function bracketCorners(b) {
  return [
    { offset: [-b, -b], angle: 0 },
    { offset: [b, -b], angle: -90 },
    { offset: [b, b], angle: -180 },
    { offset: [-b, b], angle: -270 },
  ];
}

let atlas = null;
/**
 * The shared white atlas as a canvas (glyph cells, diamond, bracket corner). Null where there is no
 * 2D canvas (jsdom) — callers then draw no icons rather than a wrong stand-in.
 */
export function getIconAtlas() {
  if (atlas) return atlas;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = ATLAS_W; cv.height = ATLAS_H;
  let g = null;
  try { g = cv.getContext('2d'); } catch { g = null; }
  if (!g) return null;
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  const poly = (pts, cx, cy) => {
    g.beginPath();
    pts.forEach(([x, y], i) => { const px = cx + x * ATLAS_K; const py = cy - y * ATLAS_K; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.closePath(); g.fill();
  };
  ['escalating', 'cooling', 'steady', 'new'].forEach((key) => {
    const m = ICON_MAPPING[key];
    poly(GLYPH_PTS[key], m.x + CELL / 2, CELL / 2);
  });
  const d = ICON_MAPPING.diamond; const h = (CELL / 2) * DIAMOND_FILL;
  g.beginPath(); g.moveTo(d.x + CELL / 2, CELL / 2 - h); g.lineTo(d.x + CELL / 2 + h, CELL / 2); g.lineTo(d.x + CELL / 2, CELL / 2 + h); g.lineTo(d.x + CELL / 2 - h, CELL / 2); g.closePath(); g.fill();
  // Bracket corner: vertex at the anchor, arms going right and down.
  const c = ICON_MAPPING.corner; const arm = CORNER_ARM * ATLAS_K; const w = CORNER_STROKE * ATLAS_K;
  g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(c.x + CORNER_ANCHOR + arm, CORNER_ANCHOR); g.lineTo(c.x + CORNER_ANCHOR, CORNER_ANCHOR); g.lineTo(c.x + CORNER_ANCHOR, CORNER_ANCHOR + arm); g.stroke();
  atlas = cv;
  return atlas;
}
