// RiskScoreBadge — 0-100 numeric risk score with risk-color coding.
// Falls back to riskLevel enum if numeric score absent.
// Bands come from the shared tier util (25/50/75) — see utils/riskTiers.js.
// Props:
//   score:     number 0-100 (from intel.riskScore)
//   level:     "high"|"elevated"|"moderate"|"low" (from intel.riskLevel) — used for color when score absent
//   size:      "sm" | "md" | "lg"  default "md"
import { tierFromScore, tierFromLevel } from '../../utils/riskTiers';

export default function RiskScoreBadge({ score, level, size = 'md' }) {
  const numScore = score != null ? Math.round(Number(score)) : null;
  const tier = numScore != null ? tierFromScore(numScore) : tierFromLevel(level);

  const display = numScore != null ? numScore : level || '—';
  const cls = `rsb rsb-${size} rsb-${tier || 'low'}`;

  return <span className={cls}>{display}</span>;
}
