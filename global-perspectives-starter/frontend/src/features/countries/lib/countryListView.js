// The country list's view of one block of countries: region filter, search, sort (the same for the briefed block and
// the "Other countries" block). `intelOf(name)` is the country's briefing or undefined.
export function applyListView(list, { region, query, sortBy }, intelOf = () => undefined) {
  const q = query.trim().toLowerCase();
  let out = region ? list.filter((c) => (c.region || 'World') === region) : list;
  if (q) out = out.filter((c) => c.name.toLowerCase().includes(q) || (intelOf(c.name)?.headline || '').toLowerCase().includes(q));
  if (sortBy === 'alpha') return [...out].sort((a, b) => a.name.localeCompare(b.name));
  if (sortBy === 'articles') return [...out].sort((a, b) => b.articles - a.articles);
  return out;
}
