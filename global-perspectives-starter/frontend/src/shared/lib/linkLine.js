// linkLine — the ONE link a story card shows (story page top, Home card). Pure; reads the record's links views
// (`judgedLinks` from the story web, `confirmedLinks` from the weekly review), never the shared-name `links`.
//   ids    the story's own ids: its id, and the id it is an alias of (a merged story keeps links on both records)
//   views  the links views of those ids (null where not generated)
// Direction and strength come ONLY from a judged link of medium or strong strength (a weak one stays off the card): the weekly
// review's `direction` is not defined in its prompt and has been used both ways, so it never sets an arrow. Among the judged
// links, one whose pair the weekly review also confirmed (any `confirmedLinks` entry naming the same other story, whatever its
// direction value) comes first and is marked `confirmed`; then the strongest; then the newest judgment. No medium/strong judged
// link: no line, even if confirmed links exist.
// Returns { dir: 'feeds'|'fed', otherId, title, strength, confirmed } or null.
const RANK = { strong: 3, medium: 2 };
const asc = (x) => String(x || '');

export function pickLinkLine(ids, views) {
  const own = new Set((ids || []).filter(Boolean));
  const list = (views || []).filter(Boolean);
  const confirmedIds = new Set(list.flatMap((v) => (Array.isArray(v.confirmedLinks) ? v.confirmedLinks : []).map((c) => c.otherThreadId).filter(Boolean)));
  const judged = [];
  for (const v of list) {
    for (const l of Array.isArray(v.judgedLinks) ? v.judgedLinks : []) {
      const fromOwn = own.has(l.from);
      const toOwn = own.has(l.to);
      if (fromOwn === toOwn || !RANK[l.confidence]) continue;
      const otherId = fromOwn ? l.to : l.from;
      judged.push({ dir: fromOwn ? 'feeds' : 'fed', otherId, title: l.otherTitle || null, strength: l.confidence, confirmed: confirmedIds.has(otherId), at: asc(l.generatedAt) });
    }
  }
  const best = judged.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || RANK[b.strength] - RANK[a.strength] || b.at.localeCompare(a.at))[0];
  if (!best) return null;
  const { at, ...line } = best; // eslint-disable-line no-unused-vars
  return line;
}
