// countryTriggers — the card's "<=2 future dated triggers" row. Pure filter over a prediction
// snapshot's dated triggers (features/threads/lib/storyMode.js's buildDeadlines shape), aggregated
// from this country's stories. Only FUTURE triggers with a real deadline are ever shown — a
// passed trigger is never shown on the card (COUNTRY_VIEW_DISCUSSION.md: "Passed watch items are
// never shown on the card").
export function futureDatedTriggers(deadlines = [], now = Date.now(), limit = 2) {
  if (!Array.isArray(deadlines)) return [];
  const nowDay = new Date(now).setUTCHours(0, 0, 0, 0);
  return deadlines
    .filter((d) => d?.deadline)
    .map((d) => ({ ...d, deadlineMs: new Date(d.deadline).getTime() }))
    .filter((d) => Number.isFinite(d.deadlineMs) && d.deadlineMs >= nowDay)
    .sort((a, b) => a.deadlineMs - b.deadlineMs)
    .slice(0, limit)
    .map((d) => ({ ...d, daysLeft: Math.max(0, Math.round((d.deadlineMs - nowDay) / 86400000)) }));
}
