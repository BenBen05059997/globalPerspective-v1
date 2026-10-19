import { TIER_ORDER, tierFromLevel, tierFromScore } from '@/shared/lib/riskTiers';

// countryTier — the one tier for a country briefing: score-first (so the chip, the band and the
// sort agree with the number shown), the riskLevel word only when there is no score. null = not
// scored (TierChip then says so).
export function countryTier(intel) {
  if (!intel) return null;
  return tierFromScore(scoreOf(intel)) ?? tierFromLevel(intel.riskLevel);
}

function scoreOf(intel) {
  const n = intel?.riskScore == null || intel.riskScore === '' ? NaN : Number(intel.riskScore);
  return Number.isFinite(n) ? n : null;
}

// compareByRisk — riskiest first: by riskScore (a scored country before an unscored one), then by
// tier for level-only records. 0 when the two are level, so the caller adds its own tie-break.
export function compareByRisk(a, b) {
  const sa = scoreOf(a);
  const sb = scoreOf(b);
  if (sa != null && sb != null) return sb - sa;
  if (sa != null || sb != null) return sa == null ? 1 : -1;
  return (TIER_ORDER[countryTier(a)] ?? 4) - (TIER_ORDER[countryTier(b)] ?? 4);
}
