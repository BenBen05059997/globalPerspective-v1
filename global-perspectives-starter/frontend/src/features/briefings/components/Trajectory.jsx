import { trajectoryOf } from '@/shared/lib/trajectory';
import DirectionArrow from '@/shared/ui/DirectionArrow';

// Trajectory — a brief's `trajectory` as arrow glyph + word in neutral ink (never a status or tier
// colour); nothing when the record has none. Used by the read mode and the present-mode slides.
export default function Trajectory({ value, className }) {
  const t = trajectoryOf(value);
  if (!t) return null;
  return <span className={className}><DirectionArrow dir={t.dir} /> {t.label}</span>;
}
