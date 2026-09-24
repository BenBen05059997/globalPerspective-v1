export function getTrend(entries) {
  if (!entries || entries.length === 0) return 'new';
  const dates = [...new Set(entries.map(e => e.date))].sort();
  if (dates.length <= 1) return 'new';
  const mid = Math.floor(dates.length / 2);
  const olderDates = new Set(dates.slice(0, mid));
  const recentDates = new Set(dates.slice(mid));
  let olderCount = 0;
  let recentCount = 0;
  for (const e of entries) {
    if (olderDates.has(e.date)) olderCount++;
    if (recentDates.has(e.date)) recentCount++;
  }
  const ratio = olderCount > 0 ? recentCount / olderCount : 2;
  if (ratio > 1.3) return 'rising';
  if (ratio < 0.7) return 'fading';
  return 'stable';
}

const TREND_LABELS = { rising: '\u25B2 Rising', fading: '\u25BC Fading', stable: '\u25CF Stable', new: 'New' };
const TREND_CLASS = { rising: 'trend-rising', fading: 'trend-fading', stable: 'trend-stable', new: 'trend-new' };

export default function TrendBadge({ entries }) {
  const trend = getTrend(entries);
  return <span className={`trend-badge ${TREND_CLASS[trend]}`}>{TREND_LABELS[trend]}</span>;
}
