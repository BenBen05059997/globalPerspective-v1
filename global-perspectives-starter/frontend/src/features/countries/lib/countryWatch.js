// countryWatch — the S4 WATCH flag (COUNTRY_VIEW_DISCUSSION.md): set when a live GDACS alert or
// an origin news situation touches the country. Pure function over the map's own `open`
// situations list (features/map/SituationHome.jsx already fetches this via useWorld()) so the
// country card never runs its own duplicate fetch.
//
//   - GDACS: situation.source === 'gdacs', iso3_affected includes this country, tier is
//     'elevated' or 'high'.
//   - News: situation.source !== 'gdacs', this country is the origin (iso3_affected[0] — the
//     situations payload carries no separate iso3_origin field today, so the first affected
//     country is the closest honest proxy), escalating is true, and it changed within 24h.
//
// Passed watch items are never shown (design rule) — a situation must still be OPEN in `open`
// (the map's own already-closed-filtered list) to qualify.
const GDACS_WATCH_TIERS = new Set(['elevated', 'high']);
const NEWS_WATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

export function countryWatchFlag(situations = [], iso3, now = Date.now()) {
  if (!iso3 || !Array.isArray(situations)) return null;

  for (const s of situations) {
    if (s?.source === 'gdacs' && GDACS_WATCH_TIERS.has(s.tier) && (s.iso3_affected || []).includes(iso3)) {
      return { kind: 'gdacs', tier: s.tier, label: s.verb_label || 'Disaster alert', situationId: s.id };
    }
  }

  for (const s of situations) {
    if (s?.source === 'gdacs' || !s?.escalating) continue;
    if ((s.iso3_affected || [])[0] !== iso3) continue;
    const ts = s.last_change_at || s.opened_at;
    if (!ts) continue;
    const age = now - new Date(ts).getTime();
    if (Number.isFinite(age) && age >= 0 && age < NEWS_WATCH_WINDOW_MS) {
      return { kind: 'news', label: s.verb_label || 'Escalating situation', situationId: s.id };
    }
  }

  return null;
}
