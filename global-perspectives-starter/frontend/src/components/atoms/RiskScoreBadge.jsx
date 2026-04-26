// RiskScoreBadge — 0-100 numeric risk score with risk-color coding.
// Falls back to riskLevel enum if numeric score absent.
// Props:
//   score:     number 0-100 (from intel.riskScore)
//   level:     "high"|"elevated"|"low" (from intel.riskLevel) — used for color when score absent
//   size:      "sm" | "md" | "lg"  default "md"

const LEVEL_FROM_SCORE = (n) =>
  n >= 70 ? 'high' : n >= 40 ? 'elevated' : 'low';

const LEVEL_FROM_STRING = (s = '') => {
  const l = s.toLowerCase();
  if (l === 'high' || l === 'critical') return 'high';
  if (l === 'elevated' || l === 'medium' || l === 'moderate') return 'elevated';
  return 'low';
};

export default function RiskScoreBadge({ score, level, size = 'md' }) {
  const numScore = score != null ? Math.round(Number(score)) : null;
  const riskLevel = numScore != null
    ? LEVEL_FROM_SCORE(numScore)
    : LEVEL_FROM_STRING(level);

  const display = numScore != null ? numScore : level || '—';
  const cls = `rsb rsb-${size} rsb-${riskLevel}`;

  return <span className={cls}>{display}</span>;
}
