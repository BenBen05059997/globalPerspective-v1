// pastDeadline — "Deadlines already passed but unresolved are shown as 'past deadline, not
// checked'... never 'awaiting'" (S6 build brief). Doing that split honestly needs a deadline per
// PENDING trigger; `prediction_track_record` only returns an aggregate `pendingTriggers` count
// plus up to 30 already-RESOLVED items in `recent` — no per-pending-trigger deadline list is
// served today (logged in the S6 report and REDESIGN_MASTER_PLAN.md §4 as a D6 gap). So this
// module never fabricates the split: with no per-item deadlines it returns `computable: false`
// and the caller must show the honest single count, not "awaiting" and not a guessed split.
// If a future public action ever serves per-pending-trigger deadlines, pass them as
// `pendingDeadlines` and this becomes exact.
export function pastDeadlineSummary({ pendingTriggers = 0, pendingDeadlines = null, now = new Date() }) {
  if (!Array.isArray(pendingDeadlines) || pendingDeadlines.length === 0) {
    return {
      computable: false,
      pendingTriggers: Math.max(0, Number(pendingTriggers) || 0),
      reason: 'no per-trigger deadline list is served by the public prediction_track_record action today',
    };
  }
  const nowMs = new Date(now).getTime();
  let pastDeadlineCount = 0;
  let notYetDueCount = 0;
  for (const d of pendingDeadlines) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (t < nowMs) pastDeadlineCount++;
    else notYetDueCount++;
  }
  return { computable: true, pastDeadlineCount, notYetDueCount, total: pendingDeadlines.length };
}
