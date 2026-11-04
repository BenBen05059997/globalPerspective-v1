// Reading the `readers` section of ops.json (written daily by newsHealth). Nothing here invents a number: null stays absent.

/** 1234 -> '1,234'; null for a missing number. */
export function count(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : null;
}

/** The families that count toward totals (the ops page itself is shown apart). */
export function countedFamilies(cf) {
  return (cf?.families || []).filter((f) => !f.excluded);
}

/** One row per family for the 14-day bars: [{ id, label, views, days:[{date, views}], max }] sorted by views. */
export function familyBars(cf) {
  const dates = cf?.days || [];
  return countedFamilies(cf)
    .map((f) => ({ id: f.id, label: f.label, views: f.views, max: Math.max(0, ...f.days), days: dates.map((date, i) => ({ date, views: f.days[i] ?? 0 })) }))
    .sort((a, b) => b.views - a.views);
}

/** New rows in the last 14 days of a { total, days:[{date,count}] } count, or null when there is none. */
export function recent(c) {
  return c && Array.isArray(c.days) ? c.days.reduce((a, d) => a + (d.count || 0), 0) : null;
}

/** 'thread-delhi-air-quality-worsens-to-v-9765a5' stays an id when a story has no title. */
export const storyLabel = (s) => s.title || s.threadId;
