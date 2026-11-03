// mapLabels — where the radar's marker labels go (pure, unit-tested). Everything is in SCREEN
// pixels: the radar lays labels out outside its zoomed group, from each marker's on-screen
// position, and runs this again after every zoom/pan, so a label never scales away from its box.
//
// For each label (priority order, most important first) the first of four positions that fits
// is taken: right of the marker, left of it, above it, below it. "Fits" = fully inside the map
// (EDGE px in from the left/right edges) and overlapping neither an already-placed label nor
// any marker (circle obstacles, the label's own marker excepted). A label with no free position
// is dropped; the marker and its feed row still carry the name. At most `max` labels are drawn.
// Text width comes from `measure` (a real text measure, see canvasMeasure); the 6.2 px/char
// guess is only the fallback where no canvas exists.
const FALLBACK_CHAR_W = 6.2;   // average glyph width at the 11px label size (fallback only)
const LINE_H = 14;             // label box height
const PAD = 3;                 // halo (paint-order stroke) around the glyphs
const GAP = 6;                 // marker edge -> label
const EDGE = 8;                // keep this far inside the map
const MAX_TEXT_W = 220;        // longer labels are ellipsized (full text stays in a <title>)

/** A measure(text) -> px function from a canvas 2D context, or the char-count fallback. */
export function canvasMeasure(font) {
  let ctx = null;
  try {
    ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (ctx) ctx.font = font;
  } catch { ctx = null; }
  if (ctx && typeof ctx.measureText === 'function') {
    return (text) => ctx.measureText(String(text)).width;
  }
  return (text) => String(text).length * FALLBACK_CHAR_W;
}

function ellipsize(text, measure) {
  if (measure(text) <= MAX_TEXT_W) return text;
  let t = text;
  while (t.length > 1 && measure(`${t}…`) > MAX_TEXT_W) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

const hits = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/**
 * items: [{ id, x, y, r, text }] screen position + radius of the marker, priority order.
 * obstacles: [{ id, x, y, r }] every marker on screen (circles; the item's own id is skipped).
 * Returns [{ id, x, y, anchor: 'start'|'middle'|'end', text, full }]; y is the text baseline.
 */
export function placeMapLabels(items, { width, height = Infinity, obstacles = [], measure = null, max = Infinity }) {
  const m = measure || ((t) => String(t).length * FALLBACK_CHAR_W);
  const markerBoxes = obstacles.map((o) => ({ id: o.id, x0: o.x - o.r, x1: o.x + o.r, y0: o.y - o.r, y1: o.y + o.r }));
  const boxes = [];
  const placed = [];
  for (const it of items) {
    if (placed.length >= max) break;
    if (it.x < 0 || it.x > width || it.y < 0 || it.y > height) continue; // marker panned off screen
    const text = ellipsize(String(it.text || ''), m);
    if (!text) continue;
    const w = m(text) + PAD * 2;
    const d = it.r + GAP;
    const spots = [
      { anchor: 'start', x0: it.x + d, y: it.y },
      { anchor: 'end', x0: it.x - d - w, y: it.y },
      { anchor: 'middle', x0: it.x - w / 2, y: it.y - d - LINE_H / 2 },
      { anchor: 'middle', x0: it.x - w / 2, y: it.y + d + LINE_H / 2 },
    ];
    for (const sp of spots) {
      const box = { x0: sp.x0, x1: sp.x0 + w, y0: sp.y - LINE_H / 2, y1: sp.y + LINE_H / 2 };
      if (box.x0 < EDGE || box.x1 > width - EDGE || box.y0 < 0 || box.y1 > height) continue;
      if (boxes.some((b) => hits(box, b)) || markerBoxes.some((b) => b.id !== it.id && hits(box, b))) continue;
      boxes.push(box);
      const x = sp.anchor === 'start' ? box.x0 + PAD : sp.anchor === 'end' ? box.x1 - PAD : sp.x0 + w / 2;
      placed.push({ id: it.id, x, y: sp.y + 4, anchor: sp.anchor, text, full: it.text });
      break;
    }
  }
  return placed;
}
