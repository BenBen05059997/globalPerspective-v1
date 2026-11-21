// linkLine — the ONE link a story card shows (story page top, Home card). Pure; reads the record's links views
// (`judgedLinks` from the story web, `confirmedLinks` from the weekly review), never the shared-name `links`.
//   ids    the story's own ids: its id, and the id it is an alias of (a merged story keeps links on both records)
//   views  the links views of those ids (null where not generated)
// Direction and strength come ONLY from a judged link of medium or strong strength (a weak one stays off the card): the weekly
// review's `direction` is not defined in its prompt and has been used both ways, so it never sets an arrow. Among the judged
// links, one whose pair the weekly review also confirmed (any `confirmedLinks` entry naming the same other story, whatever its
// direction value) comes first and is marked `confirmed`; then the strongest; then the newest judgment. No medium/strong judged
// link: no line, even if confirmed links exist.
// `places` (signPlaces) comes from the web of the links view that holds the judged link: this story's `places` and
// `otherPlaces[otherId]`. Returns { dir: 'feeds'|'fed', otherId, title, strength, confirmed, places } or null.
const RANK = { strong: 3, medium: 2 };
const asc = (x) => String(x || '');
const MAX_PLACES = 2;

/** The places of the link sign: this story's countries and the other story's countries NOT already this story's, at most
 *  two each, in the order given (both are lists of { iso3, name }). `same` is true when the other story has countries and
 *  every one is this story's ("same places"). No countries in the data: empty lists and `same` false; nothing is invented. */
export function signPlaces(mine, other) {
  const ok = (list) => (Array.isArray(list) ? list.filter((p) => p && p.iso3 && p.name) : []);
  const m = ok(mine);
  const o = ok(other);
  const mineSet = new Set(m.map((p) => p.iso3));
  const fresh = o.filter((p) => !mineSet.has(p.iso3));
  return { mine: m.slice(0, MAX_PLACES).map((p) => p.name), other: fresh.slice(0, MAX_PLACES).map((p) => p.name), same: o.length > 0 && fresh.length === 0 };
}

/** The places of one pair, by the rule the story page uses: from the links view that holds the judged link between the story
 *  (any of `ids`, either direction, any strength) and `otherId`. Null when no view holds it: no places, never a guess. */
export function pairPlaces(ids, views, otherId) {
  const own = new Set((ids || []).filter(Boolean));
  for (const v of (views || []).filter(Boolean)) {
    const held = (Array.isArray(v.judgedLinks) ? v.judgedLinks : []).some((l) => (own.has(l.from) && l.to === otherId) || (own.has(l.to) && l.from === otherId));
    if (held) return signPlaces(v.web?.places, v.web?.otherPlaces?.[otherId]);
  }
  return null;
}

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
      judged.push({ dir: fromOwn ? 'feeds' : 'fed', otherId, title: l.otherTitle || null, strength: l.confidence, confirmed: confirmedIds.has(otherId), places: signPlaces(v.web?.places, v.web?.otherPlaces?.[otherId]), at: asc(l.generatedAt) });
    }
  }
  const best = judged.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || RANK[b.strength] - RANK[a.strength] || b.at.localeCompare(a.at))[0];
  if (!best) return null;
  const { at, ...line } = best; // eslint-disable-line no-unused-vars
  return line;
}
