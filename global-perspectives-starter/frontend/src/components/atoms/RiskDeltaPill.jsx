// RiskDeltaPill — shows 24h riskScore delta (e.g. "↗ +5" or "↘ -3").
// Props:
//   snapshots: array of { riskScore, date } sorted oldest→newest
//              (from useCountryHistory — HISTORY#YYYY-MM-DD keys)
//   size:      "sm" | "md"  default "sm"

export default function RiskDeltaPill({ snapshots, size = 'sm' }) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return null;

  const key = (s) => s?.dateKey || s?.date || '';
  const sorted = [...snapshots].sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const a = latest?.riskScore;
  const b = prev?.riskScore;
  if (a == null || b == null) return null;

  const delta = a - b;
  if (delta === 0) return null;

  const up = delta > 0;
  const arrow = up ? '↗' : '↘';
  const sign = up ? '+' : '';
  const cls = `rdp rdp-${size} rdp-${up ? 'up' : 'dn'}`;

  return (
    <span className={cls}>
      {arrow} {sign}{delta}
    </span>
  );
}
