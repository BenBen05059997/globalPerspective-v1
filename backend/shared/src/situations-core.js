'use strict';

// situations-core — pure, no-I/O helpers shared by the situation subsystem
// (MAP_HOME_SITUATION_PLAN.md / DATA_STRATEGY.md). NO AWS, NO LLM.
//
//   buildObservation(feature)  — GDACS GeoJSON feature → a compact "observation" (a fact about the
//                                world right now). Openers write observations; they hold no state.
//   buildSituation / coolSituation — the FOLD: (prior situation state, observation) → next state
//                                with transition ('opened'|'raised'|'lowered'|'spread'|'unchanged'|
//                                'cooled'). Used by the tracker (S2), which is the sole writer of
//                                situation state in S3.
//
// Tiers are canonical utils/riskTiers.js bands: low · moderate · elevated · high. No 'critical'
// ("critical" on the map is display-only = high + escalating). GDACS Red→high, Orange→elevated.

const OPENING_LEVELS = new Set(['Orange', 'Red']);
const LEVEL_RANK = { Green: 0, Orange: 1, Red: 2 };
const LEVEL_TIER = { Red: 'high', Orange: 'elevated', Green: 'low' };
// Re-check cadence by tier (plan §4 WS2 cadence table), minutes.
const TIER_CADENCE_MIN = { high: 30, elevated: 120, moderate: 360, low: 360 };
const EVENT_LABEL = {
  EQ: 'earthquake', TC: 'tropical cyclone', FL: 'flood', VO: 'volcanic eruption',
  DR: 'drought', WF: 'wildfire', TS: 'tsunami',
};
const HISTORY_CAP = 200;

// ── feature → observation ────────────────────────────────────────────────────

function parseGeometry(feature) {
  const g = feature && feature.geometry;
  if (!g || !Array.isArray(g.coordinates)) return null;
  let pair = g.coordinates; // GeoJSON Point is [lon, lat]; drill into nested geometries.
  while (Array.isArray(pair) && Array.isArray(pair[0])) pair = pair[0];
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lon = Number(pair[0]);
  const lat = Number(pair[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function eventKeyOf(p) { return `${p.eventtype}#${p.eventid}`; }

function eventLabel(p) {
  const t = String(p.eventtype || '').toUpperCase();
  return EVENT_LABEL[t] || t.toLowerCase() || 'disaster event';
}

function affectedIso3(p) {
  const out = [];
  const push = (v) => { const s = String(v || '').toUpperCase(); if (s && !out.includes(s)) out.push(s); };
  push(p.iso3);
  for (const c of Array.isArray(p.affectedcountries) ? p.affectedcountries : []) push(c && c.iso3);
  return out;
}

function affectedNames(p) {
  const out = [];
  const push = (v) => { const s = String(v || '').trim(); if (s && !out.includes(s)) out.push(s); };
  push(p.country);
  for (const c of Array.isArray(p.affectedcountries) ? p.affectedcountries : []) push(c && c.countryname);
  return out;
}

// GDACS severitytext is often a placeholder like "Magnitude 0" (no real scale, e.g. floods).
function cleanSeverity(sevText) {
  const s = String(sevText || '').trim();
  if (!s) return '';
  if (/^magnitude\s*0(\.0+)?\b/i.test(s)) return '';
  return s;
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function verbLabel(p) {
  const place = p.country || (p.name || '').replace(/^.* in /, '') || 'Unknown';
  const sev = cleanSeverity(p.severitydata && p.severitydata.severitytext);
  const base = `${place} — ${eventLabel(p)}`;
  return sev && sev.length <= 40 ? `${base} (${sev})` : base;
}

// A GDACS feature → a compact, provider-neutral observation (the inbox event payload).
function buildObservation(feature, observedAt) {
  const p = feature.properties || {};
  const label = eventLabel(p);
  const affected = affectedIso3(p);
  return {
    source: 'gdacs',
    eventKey: eventKeyOf(p),
    eventType: p.eventtype,
    level: p.alertlevel || 'Green',
    score: typeof p.alertscore === 'number' ? p.alertscore : null,
    episodeLevel: p.episodealertlevel || null,
    title: p.name || `${label[0].toUpperCase()}${label.slice(1)} in ${p.country || 'unknown location'}`,
    verb_label: verbLabel(p),
    axis: 'humanitarian',
    iso3_origin: p.iso3 ? [String(p.iso3).toUpperCase()] : affected.slice(0, 1),
    iso3_affected: affected,
    affected_names: affectedNames(p),
    centroid: parseGeometry(feature),
    severityText: cleanSeverity(p.severitydata && p.severitydata.severitytext),
    description: stripHtml(p.htmldescription || p.description).slice(0, 400) || null,
    reportUrl: (p.url && p.url.report) || null,
    dateModified: p.datemodified || null,
    observed_at: observedAt || null,
  };
}

// ── the fold: (prev state, observation) → next state ─────────────────────────

function nextCheckAt(nowIso, tier) {
  const mins = TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low;
  return new Date(new Date(nowIso).getTime() + mins * 60000).toISOString();
}

function appendHistory(prev, entry) {
  const h = Array.isArray(prev && prev.history) ? prev.history.slice(-(HISTORY_CAP - 1)) : [];
  h.push(entry);
  return h;
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

// Fold an Orange/Red observation into situation state. Pure; returns { item, change }.
function buildSituation(prev, obs, nowIso, ttl) {
  const level = obs.level || 'Green';
  const tier = LEVEL_TIER[level] || 'low';
  const affected = Array.isArray(obs.iso3_affected) ? obs.iso3_affected : [];
  const sevText = obs.severityText || '';
  const evidence = {
    gdacs_level: level,
    gdacs_score: typeof obs.score === 'number' ? obs.score : null,
    gdacs_episode_level: obs.episodeLevel || null,
    gdacs_severity_text: sevText,
    gdacs_report_url: obs.reportUrl || null,
    gdacs_date_modified: obs.dateModified || null,
    gdacs_description: obs.description || null,
    gdacs_listed: true, // GDACS lists the event right now (coolSituation sets false when it drops off)
    affected_count: affected.length,
  };
  const base = {
    situationId: `gdacs#${obs.eventKey}`,
    source: 'gdacs',
    gdacsEventKey: obs.eventKey,
    threadId: (prev && prev.threadId) || null,
    title: obs.title,
    verb_label: obs.verb_label,
    axis: obs.axis || 'humanitarian',
    tier,
    iso3_origin: obs.iso3_origin && obs.iso3_origin.length ? obs.iso3_origin : affected.slice(0, 1),
    iso3_affected: affected,
    affected_names: obs.affected_names || [],
    centroid: obs.centroid || (prev && prev.centroid) || null,
    spread_arcs: Array.isArray(prev && prev.spread_arcs) ? prev.spread_arcs : [],
    opened_at: (prev && prev.opened_at) || nowIso,
    updated_at: nowIso,
    last_checked_at: nowIso,
    check_count: ((prev && prev.check_count) || 0) + (prev ? 1 : 0),
    cadence_min: TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low,
    next_check_at: nextCheckAt(nowIso, tier),
    evidence,
    ttl,
  };

  if (!prev) {
    const what = `GDACS ${level} alert opened · ${eventLabel({ eventtype: obs.eventType })}${sevText ? ` · ${sevText}` : ''} · ${plural(affected.length, 'country', 'countries')} affected`;
    return { change: 'opened', item: { ...base, state: 'emerging', last_change_at: nowIso, what_changed: what, history: [{ at: nowIso, tier, level, score: evidence.gdacs_score, state: 'emerging', note: what }] } };
  }

  // Compare against the last REAL level. coolSituation keeps it when an event drops off the feed; a
  // pre-2026-11 'Gone' level (not a rank) never counts as a raise.
  const prevLevel = (prev.evidence && prev.evidence.gdacs_level) || 'Green';
  const rank = LEVEL_RANK[level] ?? 0;
  const prevRank = LEVEL_RANK[prevLevel] ?? rank;
  // Back in the feed after dropping off (cooling) or after closing: the same event re-opens.
  const returning = prev.state === 'closed' || (prev.evidence && prev.evidence.gdacs_listed === false);
  const prevAffected = Array.isArray(prev.iso3_affected) ? prev.iso3_affected : [];
  const newIso3 = affected.filter((c) => !prevAffected.includes(c));

  if (rank > prevRank) {
    const what = `Alert raised ${prevLevel}→${level}${sevText ? ` · ${sevText}` : ''}`;
    return { change: 'raised', item: { ...base, state: 'escalating', last_change_at: nowIso, what_changed: what, history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'escalating', note: what }) } };
  }
  if (rank < prevRank) {
    const what = `Alert lowered ${prevLevel}→${level}`;
    return { change: 'lowered', item: { ...base, state: 'cooling', last_change_at: nowIso, what_changed: what, history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'cooling', note: what }) } };
  }
  if (newIso3.length) {
    const origin = base.iso3_origin[0] || affected[0];
    const arcs = base.spread_arcs.concat(newIso3.filter((c) => c !== origin).map((c) => ({ from: origin, to: c, since: nowIso })));
    const what = `Spread to ${plural(newIso3.length, 'new country', 'new countries')}: ${newIso3.join(', ')}`;
    return { change: 'spread', item: { ...base, state: 'escalating', spread_arcs: arcs, last_change_at: nowIso, what_changed: what, history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'escalating', note: what }) } };
  }
  if (returning) {
    const what = `Back in GDACS · ${level} alert${sevText ? ` · ${sevText}` : ''}`;
    return { change: 'reopened', item: { ...base, state: 'peak', last_change_at: nowIso, what_changed: what, history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'peak', note: what }) } };
  }
  // Nothing moved. One-sweep repair of the pre-2026-11 false "Alert raised Gone→X" (a blink-out read as a
  // raise, escalating forever): drop it back to a plain peak. Delete once no state carries that text.
  const falseRaise = /^Alert raised Gone→/.test(prev.what_changed || '');
  return { change: 'unchanged', item: { ...base, state: falseRaise ? 'peak' : (prev.state || 'peak'), last_change_at: prev.last_change_at || prev.opened_at || nowIso, what_changed: falseRaise ? `GDACS ${level} alert` : (prev.what_changed || null), history: Array.isArray(prev.history) ? prev.history : [] } };
}

// An open situation whose event is no longer Orange/Red (Green observation, or gone from the feed →
// obs === null). Marks it cooling once, keeping its tier (checked at the low cadence); the tracker
// closes it after 3 checks.
function coolSituation(prev, obs, nowIso, ttl) {
  const isNews = prev.source === 'news';
  // Keep the pre-cool tier through its cooldown window — `state: 'cooling'` already conveys
  // ended-ness; snapping to 'low' hid still-significant events during their cooldown (audit F3).
  const tier = prev.tier || 'low';
  const base = {
    ...prev, tier, updated_at: nowIso, last_checked_at: nowIso,
    check_count: ((prev.check_count) || 0) + 1,
    cadence_min: TIER_CADENCE_MIN.low, next_check_at: nextCheckAt(nowIso, 'low'), ttl,
  };
  if (prev.state === 'cooling') return { change: 'unchanged', item: base };
  // Source-aware wording: never leak GDACS vocabulary / gdacs_* fields onto a news situation (audit F3).
  const prevLevel = (prev.evidence && prev.evidence.gdacs_level) || 'Orange';
  const what = isNews
    ? 'No longer in active coverage'
    : (obs ? `Alert lowered ${prevLevel}→Green` : 'Event no longer current in GDACS');
  const evidence = isNews
    ? { ...(prev.evidence || {}) }
    : {
        ...(prev.evidence || {}),
        // Gone from the feed keeps the last real level, so a return compares against it.
        gdacs_level: obs ? 'Green' : ((prev.evidence && prev.evidence.gdacs_level) || 'Orange'),
        gdacs_listed: false,
        gdacs_score: obs && typeof obs.score === 'number' ? obs.score : (prev.evidence && prev.evidence.gdacs_score) || null,
        gdacs_date_modified: (obs && obs.dateModified) || (prev.evidence && prev.evidence.gdacs_date_modified) || null,
      };
  return {
    change: 'cooled',
    item: {
      ...base, state: 'cooling', last_change_at: nowIso, what_changed: what,
      evidence,
      history: appendHistory(prev, { at: nowIso, tier, level: isNews ? null : (obs ? 'Green' : 'Gone'), score: obs && typeof obs.score === 'number' ? obs.score : null, state: 'cooling', note: what }),
    },
  };
}

// ── news stories → situations (S3·T3) ────────────────────────────────────────
// A clustered news story (from newsSituationIngest) → situation state. Tier from severity, axis from
// the story; escalating when coverage is accelerating or spreading.
// Situation id (L2 linking, 2026-10-19): a story on a story thread keys by country + thread,
// `news#<ISO3>#<threadId>`, so every story of one country and thread (storyIds split by axis and
// entity, e.g. conflict#AFG#afghan / #afghan-taliban) folds into one situation; a story without a
// thread keeps `news#<storyId>`. The country is the storyId's ISO3 (`<axis>#<ISO3>#<entity>`).
function storyCountry(story) {
  const m = /^[^#]+#([A-Z]{3})#/.exec(String((story && story.storyId) || ''));
  return m ? m[1] : ((story && story.iso3) || [])[0] || null;
}
function newsSituationId(story, threadId) {
  const iso = storyCountry(story);
  return threadId && iso ? `news#${iso}#${threadId}` : `news#${story.storyId}`;
}
// Several stories → the one story buildStorySituation folds. The most significant story (outlets ×
// severity) leads (title, axis, centroid); counts take the max (outlets may overlap across stories,
// so they are not summed); countries and headlines are the union.
function mergeStories(stories) {
  if (stories.length === 1) return { ...stories[0], storyIds: [stories[0].storyId] };
  const weight = (s) => (Number(s.outlets) || 0) * (Number(s.max_severity) || 0);
  const lead = stories.slice().sort((a, b) => weight(b) - weight(a))[0];
  const union = (key) => [...new Set(stories.flatMap((s) => s[key] || []))];
  const seen = new Set();
  const headlines = [];
  for (const h of [lead, ...stories.filter((s) => s !== lead)].flatMap((s) => s.headlines || [])) {
    if (h && !seen.has(h.url)) { seen.add(h.url); headlines.push(h); }
  }
  const max = (key) => Math.max(...stories.map((s) => Number(s[key]) || 0));
  return {
    ...lead,
    storyIds: stories.map((s) => s.storyId),
    iso3: [...new Set([...(lead.iso3 || []), ...union('iso3')])],
    spread_new_iso3: union('spread_new_iso3'),
    outlets: max('outlets'), max_severity: max('max_severity'), velocity: max('velocity'),
    headlines: headlines.slice(0, 5),
  };
}
// ── news grouping (one event, one situation) ────────────────────────────────
// Strict, evidence-only rules (never country overlap or title words alone). Two news situations or
// stories join when (a) they share at least 2 normalised, non-live article URLs (a story's URLs against
// the URLs a situation has ever held), or (b) they have an identical normalised title AND a shared country.
// Once joined they stay one situation: the survivor persists `member_story_ids[]` / `member_urls[]`,
// and a story whose id or URL is in those sets joins it on every later sweep. GDACS never comes here.
const MEMBER_URL_CAP = 200; // last 200 distinct URLs (an event rarely has more; keeps the state object small)
const MEMBER_STORY_CAP = 200;
const ALSO_REPORTED_CAP = 6;

/** Lowercase scheme+host, drop query and fragment, strip trailing slash(es); null for a non-http(s) or bad URL. */
function normalizeUrl(u) {
  if (typeof u !== 'string' || !u.trim()) return null;
  try {
    const x = new URL(u.trim());
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return null;
    return `${x.protocol}//${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, '')}`;
  } catch { return null; }
}
/** Lowercase, collapsed whitespace; '' when empty. */
function normalizeTitle(t) {
  return String(t == null ? '' : t).toLowerCase().replace(/\s+/g, ' ').trim();
}
const lastN = (arr, n) => (arr.length > n ? arr.slice(arr.length - n) : arr);
const uniq = (arr) => [...new Set(arr)];

function storyWeight(s) { return (Number(s.outlets) || 0) * (Number(s.max_severity) || 0); }
function leadStory(stories) { return stories.slice().sort((a, b) => storyWeight(b) - storyWeight(a))[0]; }

// Live blogs and rolling coverage pages are updated all day and cover several events, so a shared one
// proves nothing. A URL matching any of these (tested on host+path, lowercase) is ignored by the URL rule.
// One list, in one place: add a pattern here and a case in situationsGrouping.test.mjs.
const LIVE_URL_PATTERNS = [
  /\/live(\/|$)/,            // /live/, /news/live/...
  /\/live-?blog(\/|-|$)/,    // /liveblog/, /live-blog/, /liveblog-...
  /live-?updates?/,          // live-updates, liveupdates
  /\/live-news(\/|-|$)/,     // /live-news/
  /\/live-coverage/,         // /live-coverage
  /-live-/,                  // ...-live-... slugs ("iran-war-live-vance-sees-progress")
  /-live$/,                  // slug ending in -live
  /\/live-/,                 // /live-... slugs
  /en-direct/,               // French live pages ("en-direct-guerre-en-ukraine")
  /\/direct(\/|$)/,          // /direct/
  /as-it-happened/,          // "as it happened" rolling pages
  /minute-by-minute/,
];
/** True for a live-blog / rolling-coverage URL (raw or normalised). */
function isLiveUrl(u) {
  const n = normalizeUrl(u);
  if (!n) return false;
  const hostPath = n.replace(/^https?:\/\//, '').toLowerCase();
  return LIVE_URL_PATTERNS.some((re) => re.test(hostPath));
}
// A URL join needs at least this many shared, non-live article URLs (one shared article is common
// between two different events: a roundup that mentions both).
const MIN_SHARED_URLS = 2;
function articleUrl(u) { const n = normalizeUrl(u); return n && !isLiveUrl(n) ? n : null; }

// A comparable node: a current-sweep group of stories, or a prior open news situation.
function groupNode(g, stories = g.stories) {
  const urls = new Set(); const titles = new Map(); const iso = new Set(); const ids = new Set();
  for (const st of stories) {
    for (const h of st.headlines || []) { const n = articleUrl(h && h.url); if (n) urls.add(n); }
    const nt = normalizeTitle(st.title); if (nt && !titles.has(nt)) titles.set(nt, st.title);
    for (const c of st.iso3 || []) iso.add(c);
    ids.add(st.storyId);
  }
  return { kind: 'group', id: g.id, g, urls, titles, iso, ids, title: leadStory(stories).title };
}
function priorNode(st) {
  const urls = new Set(); const titles = new Map(); const ids = new Set();
  for (const u of st.member_urls || []) { const n = articleUrl(u); if (n) urls.add(n); }
  for (const h of (st.evidence && st.evidence.headlines) || []) { const n = articleUrl(h && h.url); if (n) urls.add(n); }
  for (const t of [st.title, ...(st.also_reported_as || [])]) { const nt = normalizeTitle(t); if (nt && !titles.has(nt)) titles.set(nt, t); }
  // Only a situation that has already merged holds story ids as members; a lone situation's own story id
  // (entity-level, can be broad) is never a join key by itself.
  for (const i of st.member_story_ids || []) ids.add(i);
  return { kind: 'prior', id: st.situationId, st, urls, titles, iso: new Set(st.iso3_affected || []), ids, title: st.title };
}
const sharedOf = (a, b) => [...a].filter((x) => b.has(x));
/** The strict rule by which candidate `a` matches lead `b`, or null: >=2 shared article URLs, or an
 *  identical title + a shared country. Grouped-for-life membership is checked separately. */
function evidenceEdge(a, b, minUrls = MIN_SHARED_URLS) {
  const urls = sharedOf(a.urls, b.urls);
  if (urls.length >= minUrls) return { rule: 'url', urls, sharedCount: urls.length };
  for (const [nt, raw] of a.titles) {
    if (!b.titles.has(nt)) continue;
    const countries = [...a.iso].filter((c) => b.iso.has(c));
    if (countries.length) return { rule: 'title+country', title: raw, countries };
  }
  return null;
}
const mergeNodes = (nodes) => ({
  urls: new Set(nodes.flatMap((n) => [...n.urls])), iso: new Set(nodes.flatMap((n) => [...n.iso])), ids: new Set(nodes.flatMap((n) => [...n.ids])),
  titles: new Map(nodes.flatMap((n) => [...n.titles])),
});
const priorWeight = (st) => (Number(st.evidence && st.evidence.outlets) || 0) * (Number(st.evidence && st.evidence.max_severity) || 0);

/**
 * planNewsGrouping(groups, priorStates, opts) -> { groups, merges, absorbed }
 *   groups      the per-story/thread groups from the tracker ({id, threadId, stories, aliases, prev});
 *   priorStates {id: state}; only open news situations can be joined.
 * Returns the groups to build (same shape plus `grouping` = the fields to persist: member_story_ids,
 * member_urls, threadIds, also_reported_as), `absorbed` = prior ids folded into a survivor (the
 * caller archives them), and `merges` = one row per absorbed unit: { survivor, absorbed, via, rule,
 * urls + sharedCount | title + countries | storyId, isNew }. isNew is false when the survivor already
 * lists the absorbed id as an alias (a standing group re-confirmed this sweep).
 * NO CHAINING: clusters are taken heaviest first (the lead story's outlets x severity). A cluster joins
 * a group only when it matches that group's LEAD directly (never through another member); otherwise it
 * becomes the lead of a group of its own. Grouped-for-life members (story ids a merged situation
 * already holds) always stay.
 * Survivor id rule: the OLDEST existing open situation in the group (opened_at, then id), so a saved
 * link to the long-lived situation keeps working; a group with no prior situation uses its lead
 * story's group id. The other ids become aliases.
 */
function planNewsGrouping(groups, priorStates, opts = {}) {
  const urlCap = opts.urlCap || MEMBER_URL_CAP;
  const minUrls = opts.minSharedUrls || MIN_SHARED_URLS;
  const priors = Object.values(priorStates || {}).filter((st) => st && st.source === 'news' && st.state !== 'closed' && st.situationId);
  const nodes = [...groups.map((g) => groupNode(g)), ...priors.map(priorNode)];
  // Continuity (a group and the prior situations it already carries by id or alias): one cluster, not a merge.
  const parent = nodes.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const byId = new Map(); nodes.forEach((n, i) => { if (n.kind === 'prior') byId.set(n.id, i); });
  nodes.forEach((n, i) => {
    if (n.kind !== 'group') return;
    for (const pid of [n.id, ...n.g.aliases]) if (byId.has(pid)) parent[find(byId.get(pid))] = find(i);
  });
  const byRoot = new Map();
  nodes.forEach((n, i) => { const r = find(i); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(n); });
  const clusters = [...byRoot.values()].map((ns) => {
    const gs = ns.filter((n) => n.kind === 'group'); const ps = ns.filter((n) => n.kind === 'prior');
    const stories = gs.flatMap((n) => n.g.stories);
    const lead = stories.length ? leadStory(stories) : null;
    const leadNodes = [...ps, ...(lead ? [groupNode(gs.find((n) => n.g.stories.includes(lead)).g, [lead])] : [])];
    const sortId = (gs[0] || ps[0]).id;
    return {
      gs, ps, agg: mergeNodes(ns), leadNodes, sortId,
      weight: lead ? storyWeight(lead) : Math.max(0, ...ps.map((p) => priorWeight(p.st))),
      label: lead ? { id: gs[0].id, title: lead.title } : { id: ps[0].id, title: ps[0].title },
      joined: [],
    };
  });
  const heads = clusters.filter((c) => !c.gs.length); // a cooling situation with no story this sweep can still be joined
  const cands = clusters.filter((c) => c.gs.length).sort((a, b) => b.weight - a.weight || (a.sortId < b.sortId ? -1 : 1));
  const matchLead = (c, h) => {
    // grouped for life: a story id a merged situation already holds (either side's prior)
    const gIds = (x) => new Set(x.gs.flatMap((n) => [...n.ids]));
    const mine = [...gIds(c)].find((i) => h.ps.some((p) => p.ids.has(i)));
    if (mine) return { rule: 'member', storyId: mine };
    const theirs = [...gIds(h)].find((i) => c.ps.some((p) => p.ids.has(i)));
    if (theirs) return { rule: 'member', storyId: theirs };
    for (const ln of h.leadNodes) { const e = evidenceEdge(c.agg, ln, minUrls); if (e) return e; }
    return null;
  };
  for (const c of cands) {
    let joined = false;
    for (const h of heads) {
      const e = matchLead(c, h);
      if (e) { h.joined.push({ c, ...e }); joined = true; break; }
    }
    if (!joined) heads.push(c);
  }

  const out = []; const merges = []; const absorbed = [];
  for (const h of heads) {
    const all = [h, ...h.joined.map((j) => j.c)];
    const gs = all.flatMap((c) => c.gs); const ps = all.flatMap((c) => c.ps);
    if (!gs.length) continue; // priors with no current story: the caller's fold cools them as before
    const allStories = gs.flatMap((n) => n.g.stories);
    let id; let prev; let threadId; let aliases; let abs;
    if (!h.joined.length && gs.length === 1) {
      ({ id, threadId, aliases, prev } = gs[0].g);
      abs = gs[0].g.aliases.filter((a) => priorStates[a]);
    } else {
      const oldest = ps.slice().sort((x, y) => String(x.st.opened_at || '').localeCompare(String(y.st.opened_at || '')) || (x.id < y.id ? -1 : 1))[0] || null;
      const lead = gs.slice().sort((x, y) => storyWeight(leadStory(y.g.stories)) - storyWeight(leadStory(x.g.stories)) || (x.id < y.id ? -1 : 1))[0];
      id = oldest ? oldest.id : lead.id;
      prev = oldest ? oldest.st : (priorStates[id] || null);
      threadId = (oldest && oldest.st.threadId) || lead.g.threadId || gs.map((n) => n.g.threadId).find(Boolean) || null;
      aliases = uniq([
        ...gs.flatMap((n) => [n.id, ...n.g.aliases, ...n.g.stories.map((st) => `news#${st.storyId}`)]),
        ...ps.flatMap((n) => [n.id, ...(n.st.aliases || [])]),
      ]).filter((a) => a !== id);
      abs = ps.filter((n) => n.id !== id).map((n) => n.id);
      const survivorTitle = oldest ? oldest.title : lead.title;
      for (const j of h.joined) {
        // the survivor may sit in the joined cluster (it is the older situation): then the lead's side is the absorbed one
        const [abLabel, viaLabel] = j.c.label.id === id ? [h.label, j.c.label] : [j.c.label, h.label];
        const row = { survivor: { id, title: survivorTitle }, absorbed: abLabel, via: viaLabel, rule: j.rule };
        if (j.rule === 'url') { row.urls = j.urls; row.sharedCount = j.sharedCount; } else if (j.rule === 'title+country') { row.title = j.title; row.countries = j.countries; } else row.storyId = j.storyId;
        row.isNew = !(prev && Array.isArray(prev.aliases) && prev.aliases.includes(row.absorbed.id));
        merges.push(row);
      }
    }
    absorbed.push(...abs);
    // Persisted membership (grows). Every news situation carries it so a later sweep can match against it.
    const leadTitle = leadStory(allStories).title;
    const seenTitle = new Set([normalizeTitle(leadTitle)]);
    const also = [];
    for (const t of [...allStories.map((st) => st.title), ...ps.flatMap((n) => [n.st.title, ...(n.st.also_reported_as || [])])]) {
      const nt = normalizeTitle(t);
      if (nt && !seenTitle.has(nt)) { seenTitle.add(nt); also.push(t); }
    }
    out.push({
      id, threadId, stories: allStories, aliases, prev, absorbedIds: abs, groupIds: gs.map((n) => n.id),
      grouping: {
        // set only once the situation has merged (now or earlier); empty for a lone situation
        member_story_ids: (h.joined.length || ps.some((n) => n.ids.size))
          ? lastN(uniq([...ps.flatMap((n) => [...n.ids, ...(n.st.storyIds || []), n.st.storyId]), ...allStories.map((st) => st.storyId)].filter(Boolean)), MEMBER_STORY_CAP)
          : [],
        member_urls: lastN(uniq([...ps.flatMap((n) => [...n.urls]), ...gs.flatMap((n) => [...n.urls])]), urlCap),
        threadIds: uniq([...ps.flatMap((n) => [...(n.st.threadIds || []), n.st.threadId]), ...gs.map((n) => n.g.threadId), threadId].filter(Boolean)),
        also_reported_as: also.slice(0, ALSO_REPORTED_CAP),
      },
    });
  }
  return { groups: out, merges, absorbed: uniq(absorbed) };
}

const SEV_TIER = { 5: 'high', 4: 'elevated', 3: 'moderate', 2: 'low', 1: 'low' };
const TIER_ORDER = ['low', 'moderate', 'elevated', 'high'];
// Corroboration cap (audit F2): a single-outlet story can't claim 'high' on one LLM severity call.
// 1 outlet → moderate max, 2 → elevated max, ≥3 → uncapped. GDACS disasters never flow through here
// (they carry official severity, not outlet counts), so this can never touch their tiers.
const OUTLET_TIER_CAP = { 1: 'moderate', 2: 'elevated' };
function capTierByOutlets(tier, outlets, capMap = OUTLET_TIER_CAP) {
  const cap = capMap[Number(outlets) || 0];
  if (!cap) return tier; // ≥3 outlets (or unknown) → no cap
  return TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(cap) ? cap : tier;
}
function buildStorySituation(prev, story, nowIso, ttl, opts = {}) {
  const rawTier = SEV_TIER[story.max_severity] || 'moderate';
  const tier = opts.corroborationCap === false ? rawTier : capTierByOutlets(rawTier, story.outlets, opts.outletTierCap);
  const affected = Array.isArray(story.iso3) ? story.iso3 : [];
  // Escalation hysteresis (audit F4): a 1→2 outlet bump reads as velocity 2.0 — require prior
  // corroboration (prev outlets ≥ 2) before velocity counts; ignore spread on a brand-new story
  // (prev === null re-announces its whole country set); rate-limit repeat 'raised' via a cooldown.
  const prevOutlets = prev && prev.evidence ? Number(prev.evidence.outlets) || 0 : 0;
  const velEscalating = (Number(story.velocity) || 1) >= 1.5 && prevOutlets >= 2;
  const spreadEscalating = !!prev && Array.isArray(story.spread_new_iso3) && story.spread_new_iso3.length > 0;
  const escalating = velEscalating || spreadEscalating;
  const parts = [`${plural(story.outlets || 1, 'outlet', 'outlets')}`];
  if (velEscalating) parts.push(`coverage ${story.velocity}× prior`);
  if (spreadEscalating) parts.push(`spreading to ${story.spread_new_iso3.join(', ')}`);
  const what = parts.join(' · ');
  // An unchanged sweep keeps the earlier line, but a "spreading to" part only stays when the current
  // story backs it (>=2-outlet spread_new_iso3); older one-outlet spreads must not linger. State is
  // recomputed from the current story every sweep, so it never stays escalating on a stale spread.
  const keptWhat = () => {
    if (!prev.what_changed) return what;
    const kept = String(prev.what_changed).split(' · ').filter((p) => !/^spreading to /i.test(p.trim()));
    if (spreadEscalating) kept.push(parts[parts.length - 1]);
    return kept.join(' · ') || what;
  };
  const label = String(story.title || '').slice(0, 90);
  // Reopen handling (audit F6): a closed situation whose storyId reappears re-opens fresh — it does
  // not silently resume at 'peak' with a stale opened_at.
  const reopened = !!prev && prev.state === 'closed';
  const tierChanged = !prev || reopened || prev.tier !== tier;
  const raiseCooldownMs = (opts.raiseCooldownMin ?? 180) * 60000;
  const lastRaisedAt = prev && prev.last_raised_at ? new Date(prev.last_raised_at).getTime() : 0;
  const raiseCooledDown = (new Date(nowIso).getTime() - lastRaisedAt) >= raiseCooldownMs;
  let change = 'unchanged';
  if (!prev) change = 'opened';
  else if (reopened) change = 'reopened';
  else if (escalating && prev.state !== 'escalating' && raiseCooledDown) change = 'raised';
  const state = (!prev || reopened) ? 'emerging' : (escalating ? 'escalating' : 'peak');
  const situationId = opts.situationId || `news#${story.storyId}`;
  // Old ids this situation answers to (folded storyIds, pre-2026-10-19 `news#<storyId>` keys), so a
  // saved `/?focus=<old id>` still resolves. Never the situation's own id.
  const aliases = [...new Set([...((prev && prev.aliases) || []), ...(opts.aliases || [])])].filter((a) => a !== situationId);
  const base = {
    situationId, source: 'news', storyId: story.storyId,
    storyIds: story.storyIds || [story.storyId],
    aliases,
    // Event-registry link (Phase 1): the current map wins when present; otherwise LATCH the
    // previously-proven threadId for the situation's lifetime. Latching (not mirroring) because
    // topics rotate every ~4h while the thread page lives 90 days — a URL-proven link shouldn't
    // blink off when its topic ages out. Situations close in days ≪ 90d, so a latched link can't
    // outlive its page.
    threadId: opts.threadId || (prev && prev.threadId) || null,
    title: story.title, verb_label: label, axis: story.axis || 'political', tier,
    iso3_origin: affected.slice(0, 1), iso3_affected: affected, affected_names: [],
    centroid: story.centroid || (prev && prev.centroid) || null,
    spread_arcs: Array.isArray(prev && prev.spread_arcs) ? prev.spread_arcs : [],
    // reopen resets the age clock; a continuing story keeps its original opened_at.
    opened_at: (prev && !reopened && prev.opened_at) || nowIso,
    tier_changed_at: tierChanged ? nowIso : (prev.tier_changed_at || prev.opened_at || nowIso),
    last_raised_at: change === 'raised' ? nowIso : ((prev && prev.last_raised_at) || null),
    updated_at: nowIso, last_checked_at: nowIso,
    check_count: ((prev && prev.check_count) || 0) + (prev ? 1 : 0),
    cadence_min: TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low, next_check_at: nextCheckAt(nowIso, tier),
    ...(opts.grouping || {}), // member_story_ids / member_urls / threadIds / also_reported_as (grouping on only)
    evidence: { outlets: story.outlets, max_severity: story.max_severity, velocity: story.velocity, coverage_ratio: Number(story.velocity) || null, spread_new_iso3: story.spread_new_iso3 || [], category: story.category, headlines: story.headlines || [] },
    ttl,
  };
  return {
    change,
    item: {
      ...base, state,
      last_change_at: change === 'unchanged' ? (prev.last_change_at || nowIso) : nowIso,
      what_changed: change === 'unchanged' ? keptWhat() : what,
      history: change === 'unchanged' ? (Array.isArray(prev.history) ? prev.history : []) : appendHistory(prev, { at: nowIso, tier, state, note: what }),
    },
  };
}

module.exports = {
  OPENING_LEVELS, LEVEL_TIER,
  parseGeometry, eventKeyOf, affectedIso3,
  buildObservation, nextCheckAt, buildSituation, coolSituation, buildStorySituation,
  storyCountry, newsSituationId, mergeStories,
  normalizeUrl, normalizeTitle, planNewsGrouping, isLiveUrl, LIVE_URL_PATTERNS, MIN_SHARED_URLS, MEMBER_URL_CAP,
};
