import { STATUS_GLYPHS, statusGlyph } from '@/shared/lib/statusGlyph.js';
import '@/shared/ui/blocks.css';

// StatusGlyph — ▲ escalating · ● new · ◆ steady · ▼ cooling (the map legend's vocabulary).
// Pass `status` (a key) or `situation` (a tracker record). Renders nothing for an unknown/closed
// status. The glyph is text, so it reads without colour; `showLabel` adds the word beside it.
export default function StatusGlyph({ status, situation, showLabel = false, className = '' }) {
  const g = status ? STATUS_GLYPHS[status] : statusGlyph(situation);
  if (!g) return null;
  return (
    <span className={`gp-glyph gp-glyph--${g.key} ${className}`.trim()}>
      <span role="img" aria-label={g.label}>{g.glyph}</span>
      {showLabel ? <span className="gp-glyph__label"> {g.label}</span> : null}
    </span>
  );
}
