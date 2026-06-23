// Single owner of the /weekly/thread/:id URL convention.
//
// Thread links were hand-built at ~20 sites with inconsistent encoding — some
// used encodeURIComponent, some didn't (e.g. WorldMapV2 encoded the economic
// row but not the editorial/leaderboard nav). Centralize the path + encoding so
// the convention can't drift again. Callers still choose <Link> vs navigate()
// themselves — only the string is shared.
//
// opts: { tab, from, country } map to query params (?tab=economy,
// ?from=country&country=…). Returns "/weekly" when threadId is missing so a
// blank id never produces a broken "/weekly/thread/?…" link.
export function threadPath(threadId, opts = {}) {
  if (!threadId) return '/weekly';
  const base = `/weekly/thread/${encodeURIComponent(threadId)}`;
  const params = new URLSearchParams();
  if (opts.tab) params.set('tab', opts.tab);
  if (opts.from) params.set('from', opts.from);
  if (opts.country) params.set('country', opts.country);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
