import '@/shared/ui/TierChip.css';

// TierChip — risk shown as tier WORD + ring weight (+ the number when the data has one), never a
// traffic-light fill (REDESIGN_MASTER_PLAN §3.1). Weight climbs LOW (hairline) -> MODERATE ->
// ELEVATED (double-weight ring) -> HIGH (heaviest ring + outer ring, the legend's HIGH-only double
// ring). No tier = a dashed, dim "not scored" chip: it never claims a tier it doesn't have.
// The ring and word read the neutral --tier-* tokens only: a crisis hue never tints a tier (DS1).
const WORD = { low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High' };

export default function TierChip({ tier, score = null, className = '' }) {
  const known = tier && WORD[tier] ? tier : null;
  const n = score != null && score !== '' && Number.isFinite(Number(score)) ? Math.round(Number(score)) : null;
  return (
    <span
      className={`gp-tier gp-tier--${known || 'none'} ${className}`.trim()}
      data-tier={known || 'none'}
    >
      {known ? WORD[known] : 'Not scored'}
      {known && n != null ? <span className="gp-tier__n">{n}</span> : null}
    </span>
  );
}
