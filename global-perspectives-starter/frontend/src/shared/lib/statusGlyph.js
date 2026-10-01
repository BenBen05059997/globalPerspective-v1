// statusGlyph — the direction vocabulary shared by the map legend, alert cards, and every story
// row: ▲ escalating · ● new · ◆ steady · ▼ cooling. Text glyphs (so they work without colour),
// derived only from the tracker's own `state` / `escalating` fields. Lives in shared/ so shared UI
// (StatusGlyph, StoryRow) can read it; features/map/lib/legend.js re-exports it for the map.
const GLYPHS = {
  escalating: { glyph: '▲', key: 'escalating', label: 'escalating' },
  new: { glyph: '●', key: 'new', label: 'new' },
  steady: { glyph: '◆', key: 'steady', label: 'steady' },
  cooling: { glyph: '▼', key: 'cooling', label: 'cooling' },
};
export const STATUS_GLYPHS = GLYPHS;

/**
 * statusGlyph(situation) -> { glyph, key, label } | null
 * Read straight from the tracker's fields — nothing inferred:
 *   ▲ escalating  `escalating === true` or state 'escalating'
 *   ● new         state 'emerging'
 *   ▼ cooling     state 'cooling'
 *   ◆ steady      state 'peak' (the tracker's "ongoing")
 * A closed or unknown state gets no badge.
 */
export function statusGlyph(s) {
  if (!s || s.state === 'closed') return null;
  if (s.escalating === true || s.state === 'escalating') return GLYPHS.escalating;
  if (s.state === 'emerging') return GLYPHS.new;
  if (s.state === 'cooling') return GLYPHS.cooling;
  if (s.state === 'peak') return GLYPHS.steady;
  return null;
}
