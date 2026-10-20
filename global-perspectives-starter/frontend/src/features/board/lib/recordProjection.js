// Projections over the record views; never synthesize a branch status from its deadline.
export function latestStatus(branch) {
  return [...(branch.status || [])].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null;
}
export function boardWeek(board, stories, now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const inWeek = (s) => s && s.slice(0, 10) >= start && s.slice(0, 10) <= end;
  return {
    moved: board.pins.filter((p) => inWeek(p.lastMoved)),
    strings: board.strings.flatMap((s) => ['keptAt', 'cutAt'].filter((k) => inWeek(s[k])).map((k) => ({ ...s, change: k === 'cutAt' ? 'cut' : 'kept', date: s[k] }))),
    branches: Object.values(stories).flatMap((s) => (s?.forks || []).flatMap((f) => f.branches.flatMap((b) => (b.status || []).filter((v) => inWeek(v.date) && ['fired', 'dead', 'resurrected'].includes(v.status)).map((v) => ({ ...v, branchId: b.branchId, text: b.text, threadId: s.threadId }))))),
    links: Object.values(stories).flatMap((s) => (s?.links || []).filter((l) => l.confirmed && inWeek(l.since)).map((l) => ({ ...l, threadId: s.threadId }))),
  };
}
