// globeIcons — the globe's GDACS alert diamonds and HUD selection brackets as
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
const ATLAS_K = 4;
const CELL = 16 * ATLAS_K; // 64 atlas pixels
const DIAMOND_FILL = 28 / 32; // diamond half-diagonal as a share of the half-cell (AA margin)
const CORNER_CELL = 48;
const CORNER_ANCHOR = 8; // atlas px from the cell's top-left to the bracket corner's vertex
const CORNER_ARM = 7; // logical px
const CORNER_STROKE = 2; // logical px

/** HUD bracket box half-size = ring + this. */
export const BRACKET_GAP = 9;

export const ICON_MAPPING = {
  diamond: { x: 0, y: 0, width: CELL, height: CELL, anchorX: CELL / 2, anchorY: CELL / 2, mask: true },
  corner: { x: CELL, y: 0, width: CORNER_CELL, height: CORNER_CELL, anchorX: CORNER_ANCHOR, anchorY: CORNER_ANCHOR, mask: true },
};
export const ATLAS_W = CELL + CORNER_CELL;
export const ATLAS_H = CELL;

/** Bracket corner icon height in logical px (its cell is CORNER_CELL atlas px). */
export const CORNER_SIZE = CORNER_CELL / ATLAS_K;

/** Icon height for a diamond whose half-diagonal is `k` logical px. */
export const diamondSize = (k) => (k * 2) / DIAMOND_FILL;

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
 * The shared white atlas as a canvas (diamond and bracket corner). Null where there is no
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
  const d = ICON_MAPPING.diamond; const h = (CELL / 2) * DIAMOND_FILL;
  g.beginPath(); g.moveTo(d.x + CELL / 2, CELL / 2 - h); g.lineTo(d.x + CELL / 2 + h, CELL / 2); g.lineTo(d.x + CELL / 2, CELL / 2 + h); g.lineTo(d.x + CELL / 2 - h, CELL / 2); g.closePath(); g.fill();
  // Bracket corner: vertex at the anchor, arms going right and down.
  const c = ICON_MAPPING.corner; const arm = CORNER_ARM * ATLAS_K; const w = CORNER_STROKE * ATLAS_K;
  g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(c.x + CORNER_ANCHOR + arm, CORNER_ANCHOR); g.lineTo(c.x + CORNER_ANCHOR, CORNER_ANCHOR); g.lineTo(c.x + CORNER_ANCHOR, CORNER_ANCHOR + arm); g.stroke();
  atlas = cv;
  return atlas;
}
