// SeverityBadge — economic disruption severity pill
// Mirrors RiskScoreBadge visual vocabulary. Reuses risk color tokens:
//   severe   → --risk-h (high)
//   moderate → --risk-e (elevated)
//   minor    → --risk-l (low)
// Props:
//   level: "minor" | "moderate" | "severe"
//   score: optional 0-100 (rendered alongside level if present)
//   size:  "sm" | "md" | "lg"  default "md"

const LEVEL_LABEL = {
  severe: 'SEVERE',
  moderate: 'MODER.',
  minor: 'MINOR',
};

const LEVEL_TO_RISK = {
  severe: 'high',
  moderate: 'elevated',
  minor: 'low',
};

export default function SeverityBadge({ level = 'moderate', score, size = 'md' }) {
  const key = LEVEL_TO_RISK[level] || 'elevated';
  const display = LEVEL_LABEL[level] || level.toUpperCase();
  const cls = `sev-badge sev-${size} sev-${key}`;

  return (
    <span className={cls}>
      <span className="sev-label">{display}</span>
      {score != null && <span className="sev-score">{Math.round(score)}</span>}
    </span>
  );
}
