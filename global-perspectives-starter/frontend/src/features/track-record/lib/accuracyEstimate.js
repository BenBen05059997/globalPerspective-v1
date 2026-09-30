// accuracyEstimate — "expected between <date> and <date>" for the accuracy score (and the
// calibration bands), computed from the real state of the sample. It is always an ESTIMATE and
// is rendered with that word. Pure and deterministic: no randomness, `now` is passed in.
//
// Model (all inputs real or the published method):
//   - questions already resolved count now; open sampled questions settle at the first Monday
//     on/after max(deadline + 3 days, today) (the weekly review day);
//   - every not-yet-drawn week (the committed ones, then later weeks up to the horizon) adds K
//     questions: K = the observed average sample size once 2 weeks are drawn, else the published K;
//     their deadlines follow the observed lead times (once 10 are observed), else the published
//     7-84 day window; they settle at the first Monday on/after max(deadline + 3 days, the draw);
//   - the earliest date assumes no voids, the latest assumes `voidHigh` (25%) voids.
// Returns null when there is nothing to base it on (no committed week).

const DAY = 86400000;
const GRACE = 3;
const ms = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const nextMondayOnOrAfter = (t) => t + ((8 - new Date(t).getUTCDay()) % 7) * DAY;

export function estimateAccuracyWindow({
  sampled = [], weeks = [], target = 150, now = new Date(), plannedK = 22,
  voidLow = 0, voidHigh = 0.25, minLead = 7, maxLead = 84, horizonWeeks = 90,
} = {}) {
  if (!Array.isArray(weeks) || weeks.length === 0) return null;
  const nowDay = ms(iso(new Date(now).getTime()));

  const resolvedNow = sampled.filter((s) => s.state === 'yes' || s.state === 'no').length;
  const events = [];
  for (const s of sampled) {
    if (s.state !== 'awaiting' && s.state !== 'past_deadline_unchecked') continue;
    events.push(nextMondayOnOrAfter(Math.max(ms(s.deadline) + GRACE * DAY, nowDay)));
  }

  const drawn = weeks.filter((w) => w.drawn && typeof w.picked === 'number');
  const perWeekSource = drawn.length >= 2 ? 'observed' : 'published';
  const K = drawn.length >= 2 ? Math.round(drawn.reduce((a, w) => a + w.picked, 0) / drawn.length) : plannedK;

  const leadsObserved = sampled
    .map((s) => (s.issuedAt && s.deadline ? Math.round((ms(s.deadline) - ms(s.issuedAt)) / DAY) : null))
    .filter((l) => l != null && l >= minLead && l <= maxLead)
    .sort((a, b) => a - b);
  const leadSource = leadsObserved.length >= 10 ? 'observed' : 'published';
  const L = leadsObserved.length >= 10 ? leadsObserved : Array.from({ length: maxLead - minLead + 1 }, (_, i) => minLead + i);

  const starts = weeks.filter((w) => !w.drawn).map((w) => ms(w.weekStart));
  let next = Math.max(...weeks.map((w) => ms(w.weekStart))) + 7 * DAY;
  while (starts.length < horizonWeeks) { starts.push(next); next += 7 * DAY; }
  starts.sort((a, b) => a - b);
  starts.forEach((start, wi) => {
    for (let i = 0; i < K; i++) {
      const issue = start + (i % 7) * DAY;
      const deadline = issue + L[(i * 37 + wi * 11) % L.length] * DAY;
      events.push(nextMondayOnOrAfter(Math.max(deadline + GRACE * DAY, start + 7 * DAY)));
    }
  });
  events.sort((a, b) => a - b);

  const reach = (v) => {
    for (let t = nextMondayOnOrAfter(nowDay); t <= nowDay + horizonWeeks * 7 * DAY; t += 7 * DAY) {
      let n = 0;
      while (n < events.length && events[n] <= t) n++;
      if (resolvedNow + n * (1 - v) >= target) return iso(t);
    }
    return null;
  };
  const earliest = reach(voidLow);
  const latest = reach(voidHigh);
  if (!earliest || !latest) return null;
  return {
    earliest, latest,
    basis: { locked: sampled.length, perWeek: K, perWeekSource, leadSource, voidLow, voidHigh },
  };
}
