// DirectionArrow — ↑/↓/→ glyph, color-tinted by direction.
// Props:
//   dir: "up" | "down" | "mixed" | "flat"
//   size: "sm" | "md"  default "sm"

const GLYPH = { up: '↑', down: '↓', mixed: '↕', flat: '→' };

export default function DirectionArrow({ dir = 'flat', size = 'sm' }) {
  const cls = `da da-${size} da-${dir}`;
  return <span className={cls} aria-label={dir}>{GLYPH[dir] || '→'}</span>;
}
