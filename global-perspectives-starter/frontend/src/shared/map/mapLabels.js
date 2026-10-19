// mapLabels — where the radar's marker labels go (pure, unit-tested). A label sits to the right
// of its marker; when it would run past the map's right edge it flips to the left of the marker
// (it used to clip: "Guam, Northern M…"). A label that would overlap one already placed (the
// Europe cluster) is dropped; the marker itself and its feed row still carry the name.
// Width is estimated from the character count (no DOM measuring during the draw).
const CHAR_W = 6.2;   // average glyph width at the 11px label size
const LINE_H = 14;    // label box height
const EDGE = 8;       // keep this far inside the map

/**
 * items: [{ id, x, y, off, text }] in priority order (most important first); `off` = gap from
 * the marker centre to the label. Returns [{ id, x, y, anchor: 'start'|'end', text }].
 */
export function placeMapLabels(items, { width }) {
  const placed = [];
  const boxes = [];
  for (const it of items) {
    const w = String(it.text || '').length * CHAR_W;
    const flip = it.x + it.off + w > width - EDGE;
    const x0 = flip ? it.x - it.off - w : it.x + it.off;
    if (x0 < EDGE) continue;
    const box = { x0, x1: x0 + w, y0: it.y - LINE_H / 2, y1: it.y + LINE_H / 2 };
    if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
    boxes.push(box);
    placed.push({ id: it.id, x: flip ? it.x - it.off : it.x + it.off, y: it.y, anchor: flip ? 'end' : 'start', text: it.text });
  }
  return placed;
}
