'use strict';

// Themes and the region summary (decision 0058 rule 4): groups of stories connected by judged links, and one entry per board region.
// Pure: the links are the web index's judged links, the stamps are the shared story fields (storyStamp.js). Shared-actor pairs are not
// links (0012, 0037) and never reach this file. The builder (views.js) stamps `themeId` on every story from the result.
const {REGIONS} = require('./_shared/regions');

const MIN_STORIES = 3; // a theme is shown from 3 stories; a pair or a lone story has no theme
const STRENGTH_RANK = {strong: 0, medium: 1, weak: 2}; // any other value (including null) ranks after weak
const TIER_RANK = {high: 0, elevated: 1, moderate: 2, low: 3}; // null ranks after low
const rankOf = (table, v) => (Object.prototype.hasOwnProperty.call(table, v) ? table[v] : 99);

// "(E17, E20)" groups: evidence codes numbered per model run, meaningless outside it. The note keeps the model's text (0042); this is the published copy.
const EVIDENCE_GROUP = /\s*\(\s*E\d+(?:\s*(?:,|;|&|and)\s*E\d+)*\s*\)/g;
const cleanReason = (text) => (typeof text === 'string' ? text.replace(EVIDENCE_GROUP, '').trim() || null : null);

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** A story id followed through the merges to its survivor (a loop guard in case a cycle ever got in). */
function survivorOf(id, aliases) {
  const seen = new Set();
  let cur = id;
  while (aliases.has(cur) && !seen.has(cur)) { seen.add(cur); cur = aliases.get(cur); }
  return cur;
}

/**
 * One link per story pair after merges are resolved: a link whose two ends are one story is dropped; of the rows of one pair (the
 * two directions, and the webs of several countries) the strongest is kept, ties by the newest `generatedAt`, then by country and
 * direction so the choice never depends on input order. Returns [{from, to, strength, reason, cited, generatedAt}], ends resolved.
 */
function pairLinks(links, aliases) {
  const best = new Map();
  const order = (l) => [rankOf(STRENGTH_RANK, l.confidence ?? null), -Date.parse(l.generatedAt || 0) || 0, l.country || '', l.from, l.to];
  const better = (a, b) => { const x = order(a); const y = order(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
  for (const l of links) {
    const from = survivorOf(l.from, aliases);
    const to = survivorOf(l.to, aliases);
    if (from === to) continue;
    const row = {...l, from, to};
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (!best.has(key) || better(row, best.get(key))) best.set(key, row);
  }
  return [...best.values()].map((l) => ({from: l.from, to: l.to, strength: l.confidence ?? null, reason: cleanReason(l.mechanism), cited: l.cited || [], generatedAt: l.generatedAt}))
    .sort((a, b) => cmp(rankOf(STRENGTH_RANK, a.strength), rankOf(STRENGTH_RANK, b.strength)) || cmp(a.from, b.from) || cmp(a.to, b.to));
}

const newestCited = (p) => (p.cited || []).reduce((m, c) => (typeof c.date === 'string' && c.date > m ? c.date : m), '');

/** Order of links of equal strength: most cited entries first, then the newest cited date, then `from`, then `to`. Orders the weak pairs (so the grouping never depends on input order) and picks a theme's strongest link. */
const evidenceOrder = (a, b) => (b.cited || []).length - (a.cited || []).length || cmp(newestCited(b), newestCited(a)) || cmp(a.from, b.from) || cmp(a.to, b.to);

const isFirm = (p) => p.strength === 'strong' || p.strength === 'medium';
const WEAK_JOIN_MAX = 2; // a weak link joins two groups only when the smaller has at most this many stories

/**
 * Groups of stories over the pairs (no hub splitting). Strong and medium pairs join first. Then each other pair (weak, or no strength) in
 * evidenceOrder joins its two groups only if the smaller one has at most WEAK_JOIN_MAX stories: a weak link attaches one story or one pair,
 * never two bigger groups. Returns the groups as sorted id lists, in the order of their smallest id.
 */
function groupStories(pairs) {
  const parent = new Map();
  const size = new Map();
  const find = (x) => {
    if (!parent.has(x)) { parent.set(x, x); size.set(x, 1); }
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  const join = (a, b) => {
    if (a === b) return;
    parent.set(a, b);
    size.set(b, size.get(a) + size.get(b));
  };
  for (const p of pairs.filter(isFirm)) join(find(p.from), find(p.to));
  for (const p of pairs.filter((q) => !isFirm(q)).sort(evidenceOrder)) {
    const a = find(p.from);
    const b = find(p.to);
    if (a !== b && Math.min(size.get(a), size.get(b)) <= WEAK_JOIN_MAX) join(a, b);
  }
  const groups = new Map();
  for (const id of [...parent.keys()].sort()) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  return [...groups.values()];
}

const NEW_FACTS_DAYS = 7;

/**
 * The themes: groups of 3 stories or more (groupStories).
 *  - themeId = "theme-" + threadId of the anchor, the story with the earliest `born` (ties: smaller threadId; a story with no `born` comes last).
 *  - lead: the story with the most judged links (pairs) inside the theme; ties by highest tier, then newest lastFactAt, then smaller threadId.
 *  - pairs: the links with both ends in the theme. A refused weak link (its ends in two groups) belongs to no theme.
 *  - stamps, set once here so no reader recomputes them: newFacts (stories whose stamp `lastEntryAt` is within 7 days before `now`; only news
 *    entries move it, forecasts, verdicts, merges and placed articles do not), linkCounts by strength, strongest (the link with the best strength, ties by evidenceOrder).
 *  - order: most stories with new facts first, then most strong links, then most stories, then themeId.
 * @param links    the web index's judged links ({from, to, confidence, mechanism, cited, country, generatedAt})
 * @param stampOf  threadId -> the story's shared fields (storyStamp.js)
 * @param aliases  Map merged id -> surviving id
 * @param now      ISO time the "last 7 days" end at (the web index's generatedAt); null counts no story as new
 * @returns {themes: [{themeId, anchor, lead, ids, pairs, newFacts, linkCounts, strongest}], pairs: every resolved pair (themes or not)}
 */
function groupThemes({links, stampOf, aliases = new Map(), now = null}) {
  const pairs = pairLinks(links, aliases);
  const since = now ? Date.parse(now) - NEW_FACTS_DAYS * 864e5 : Infinity;
  const themes = [];
  for (const ids of groupStories(pairs)) {
    if (ids.length < MIN_STORIES) continue;
    const inside = new Set(ids);
    const mine = pairs.filter((p) => inside.has(p.from) && inside.has(p.to));
    const degree = new Map(ids.map((id) => [id, 0]));
    for (const p of mine) { degree.set(p.from, degree.get(p.from) + 1); degree.set(p.to, degree.get(p.to) + 1); }
    const born = (id) => stampOf(id).born || '9999-99-99';
    const anchor = [...ids].sort((a, b) => cmp(born(a), born(b)) || cmp(a, b))[0];
    const lead = [...ids].sort((a, b) => degree.get(b) - degree.get(a)
      || rankOf(TIER_RANK, stampOf(a).tier) - rankOf(TIER_RANK, stampOf(b).tier)
      || cmp(stampOf(b).lastFactAt || '', stampOf(a).lastFactAt || '')
      || cmp(a, b))[0];
    const linkCounts = {strong: 0, medium: 0, weak: 0};
    for (const p of mine) if (Object.prototype.hasOwnProperty.call(linkCounts, p.strength)) linkCounts[p.strength]++;
    const {from, to, strength} = [...mine].sort((a, b) => rankOf(STRENGTH_RANK, a.strength) - rankOf(STRENGTH_RANK, b.strength) || evidenceOrder(a, b))[0];
    const newFacts = ids.filter((id) => stampOf(id).lastEntryAt && Date.parse(stampOf(id).lastEntryAt) >= since).length;
    themes.push({themeId: `theme-${anchor}`, anchor, lead, ids, pairs: mine, newFacts, linkCounts, strongest: {from, to, strength}});
  }
  themes.sort((a, b) => b.newFacts - a.newFacts || b.linkCounts.strong - a.linkCounts.strong || b.ids.length - a.ids.length || cmp(a.themeId, b.themeId));
  return {themes, pairs};
}

const TITLE_COUNTRIES_MAX = 4;

const highestTier = (tiers) => [...tiers].filter((t) => t !== null && t !== undefined).sort((a, b) => rankOf(TIER_RANK, a) - rankOf(TIER_RANK, b))[0] ?? null;

/**
 * index/themes.json. Per theme: the countries by story count (the stamp's `iso3` of each story), the lead story id, the stories (each the full
 * stamp plus `liveBranchCount`, the open forecast questions of the index rows, null when the story has no row), the links (strength is the
 * model's `confidence`; the reason has the evidence codes removed; `cited` is the data the codes pointed at), the regions of the stories and the
 * highest tier among them (null when none is scored), the title countries (`titleCountries`: the countries of two or more stories, in `countries` order, at most 4; when none is in two stories, the first 4 of `countries`; `moreCountries`: the other countries left out) and the stamps of groupThemes (`newFacts`, `linkCounts`, `strongestLink`). The links carry no line style and no confirmed state: the web notes hold neither. Each story also carries the story view's `stepCount`, `stepDays`, `firstStep` and `newestStep` (null with no view), and each link `judgedAt`, the `generatedAt` of the web note that judged it (board look 2026-11-20).
 */
/** The story view's step stamps (decision 0058; board look 2026-11-20): null for a story the record holds no view of, or a merged-away one. */
const stepsOf = (v) => (v && !v.aliasOf
  ? {stepCount: v.stepCount ?? null, stepDays: v.stepDays ?? null, firstStep: v.firstStep ?? null, newestStep: v.newestStep ?? null}
  : {stepCount: null, stepDays: null, firstStep: null, newestStep: null});

/**
 * The shared-name pairs of a theme (index/web.json `shared`, ids resolved to survivors): both stories in the theme and no judged link between
 * them. One row per pair (a < b) with the names of every country web that saw it, sorted. Never a link: the page shows it as a note.
 */
function sharedIn(t, shared) {
  const ids = new Set(t.ids);
  const judged = new Set(t.pairs.map((p) => [p.from, p.to].sort().join('|')));
  const out = new Map();
  for (const x of shared) {
    const [a, b] = [x.a, x.b].sort();
    const key = `${a}|${b}`;
    if (a === b || !ids.has(a) || !ids.has(b) || judged.has(key)) continue;
    const row = out.get(key) || out.set(key, {a, b, actors: new Set()}).get(key);
    for (const n of x.actors || []) row.actors.add(n);
  }
  return [...out.values()].map((r) => ({a: r.a, b: r.b, actors: [...r.actors].sort()})).sort((x, y) => cmp(x.a, y.a) || cmp(x.b, y.b));
}

function themesIndex({themes}, stampOf, liveOf, builtFrom, viewOf = () => null, webShared = []) {
  const out = themes.map((t) => {
    const stamps = t.ids.map(stampOf).sort((a, b) => cmp(a.born || '9999-99-99', b.born || '9999-99-99') || cmp(a.threadId, b.threadId));
    const counts = new Map();
    for (const s of stamps) for (const c of s.iso3) counts.set(c, (counts.get(c) || 0) + 1);
    const countries = [...counts].map(([iso3, stories]) => ({iso3, stories})).sort((a, b) => b.stories - a.stories || cmp(a.iso3, b.iso3));
    const shared = countries.filter((c) => c.stories >= 2);
    const titleCountries = (shared.length ? shared : countries).slice(0, TITLE_COUNTRIES_MAX).map((c) => c.iso3);
    return {
      themeId: t.themeId,
      lead: t.lead,
      newFacts: t.newFacts,
      linkCounts: t.linkCounts,
      strongestLink: t.strongest,
      countries, titleCountries, moreCountries: countries.length - titleCountries.length,
      regions: [...new Set(stamps.flatMap((s) => s.regions))].sort(),
      tier: highestTier(stamps.map((s) => s.tier)),
      stories: stamps.map((s) => ({...s, liveBranchCount: liveOf(s.threadId), ...stepsOf(viewOf(s.threadId))})),
      links: t.pairs.map(({from, to, strength, reason, cited, generatedAt}) => ({from, to, strength, reason, cited, judgedAt: generatedAt ?? null})),
      shared: sharedIn(t, webShared),
    };
  });
  return {schemaVersion: 1, builtFrom, themes: out};
}

const NO_STORIES = 'no stories';
const NO_LINKS = 'no links judged';
const LINKS = 'links';

/**
 * index/regions.json: one entry for each of the 10 board regions, always all of them, in the region table's order. `storyIds`: the surviving
 * stories of index/web.json threads. A story counts in every region its countries fall in. `state`: "no stories" (none in the region), "no links
 * judged" (stories, but no judged link has an end in the region), "links" (at least one judged pair has an end in the region; the pair
 * need not be in a theme, so `themeIds` can be empty). `scored`: its stories with a tier; `highTier`: those with tier high; `linked`: its stories that are an end of any judged pair (theme or not).
 */
function regionsIndex({themes, pairs}, storyIds, stampOf, builtFrom) {
  const stamps = storyIds.map(stampOf);
  const inRegion = (region) => (s) => s.regions.includes(region);
  const linked = new Set(pairs.flatMap((p) => [p.from, p.to]));
  const regions = Object.keys(REGIONS).map((region) => {
    const mine = stamps.filter(inRegion(region));
    const linkedMine = mine.filter((s) => linked.has(s.threadId)).length;
    const state = !mine.length ? NO_STORIES : linkedMine ? LINKS : NO_LINKS;
    return {
      region, state, stories: mine.length, scored: mine.filter((s) => s.tier).length, highTier: mine.filter((s) => s.tier === 'high').length, linked: linkedMine,
      themeIds: themes.filter((t) => t.ids.some((id) => stampOf(id).regions.includes(region))).map((t) => t.themeId).sort(),
    };
  });
  return {schemaVersion: 1, builtFrom, regions};
}

module.exports = {groupThemes, groupStories, evidenceOrder, themesIndex, regionsIndex, pairLinks, cleanReason};
