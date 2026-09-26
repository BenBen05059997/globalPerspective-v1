// hudCompact — M7 phone layout: the situation brief + sensor status panels (a slim row above the
// map on desktop, M6) collapse into one compact line above the map on the MAP tab, expandable
// inline (no popover). Pure string builder so the wording is unit-testable without rendering.
import { TIER_LABEL } from '@/features/map/lib/situationLabels.js';

const TIERS = ['high', 'elevated', 'moderate', 'low'];

export function hudCompactSummary(tierCounts, sensorRows, paused) {
  const counts = tierCounts || {};
  const openCount = TIERS.reduce((n, t) => n + (counts[t] || 0), 0);
  const leadTier = TIERS.find((t) => counts[t] > 0);
  const headline = leadTier ? `${counts[leadTier]} ${(TIER_LABEL[leadTier] || leadTier).toLowerCase()}` : (openCount ? `${openCount} open` : 'quiet');

  const bits = [headline];
  const gdacs = (sensorRows || []).find((r) => r.key === 'gdacs');
  if (gdacs) bits.push(`sensors: GDACS ${gdacs.ok ? 'live' : 'down'}`);
  const hasNews = (sensorRows || []).some((r) => r.key === 'news');
  if (paused) bits.push(paused.beyondLookback ? `news ${paused.text}` : `news paused since ${paused.label}`);
  else if (hasNews) bits.push('news live');

  return bits.join(' · ');
}

export default hudCompactSummary;
