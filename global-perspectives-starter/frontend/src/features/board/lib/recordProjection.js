import { branchStatus } from '@/shared/lib/branchWording.js';
// ISO week label of a date, e.g. '2026-W43' (UTC).
export function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
// Projections over the record views (0037). Facts only: verdicts are decisions on dated branches, never inferred
// from a deadline.
export function boardWeek(board, stories, links = {}, now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const isoWeek = isoWeekOf(now);
  const inWeek = (s) => s && s.slice(0, 10) >= start && s.slice(0, 10) <= end;
  return {
    moved: board.pins.filter((p) => inWeek(p.lastMoved)),
    strings: board.strings.flatMap((s) => ['keptAt', 'cutAt'].filter((k) => inWeek(s[k])).map((k) => ({ ...s, change: k === 'cutAt' ? 'cut' : 'kept', date: s[k] }))),
    branches: Object.values(stories).flatMap((s) => (s?.forks || []).flatMap((f) => f.branches.filter((b) => inWeek(b.verdict?.at)).map((b) => ({ branchId: b.branchId, text: b.text, threadId: s.threadId, date: b.verdict.at.slice(0, 10), result: b.verdict.result, status: branchStatus(b).text })))),
    links: Object.entries(links).flatMap(([threadId, v]) => (v?.confirmedLinks || []).filter((l) => l.week === isoWeek).map((l) => ({ ...l, threadId }))),
  };
}

/** Sum counts over `dates` for the given story ids: { newEntries, branchesDue, verdicts }. Missing days add nothing. */
export function sumCounts(byDate, dates, ids) {
  const total = { newEntries: 0, branchesDue: 0, verdicts: 0 };
  for (const d of dates) for (const id of ids) {
    const c = byDate[d]?.byStory?.[id];
    for (const k of Object.keys(total)) total[k] += Number.isInteger(c?.[k]) ? c[k] : 0;
  }
  return total;
}
