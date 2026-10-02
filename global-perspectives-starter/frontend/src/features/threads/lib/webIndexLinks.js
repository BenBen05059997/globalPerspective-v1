// webIndexLinks — derives one story's links and state from the whole `web_index` object. The link
// rows keep the shape storyLinks.js (the pre-index derivation) produced, so FedIntoList and the
// slides did not change, and add `cited` (dated, titled headlines) when the web stored them.
// Each web keeps its OWN confidence: two webs that link the same pair give two rows, never the max
// (STORY_WEB_RETHINK_PLAN §5). Freshness: amber after 7 days, hidden after 30 (client-side, the
// table's TTL is off).
import { analysisTextState } from '@/features/threads/lib/storyMode.js';

const CONF_RANK = { strong: 3, medium: 2, weak: 1 };
const byConfidence = (a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0);

function row(l, otherKey, otherId, titles, now) {
  const freshness = analysisTextState(l.generatedAt, now);
  return {
    [`${otherKey}ThreadId`]: otherId,
    [`${otherKey}Title`]: titles?.[otherId]?.title || null,
    confidence: l.confidence || null,
    lagDays: l.lagDays ?? null,
    mechanism: l.mechanism || null,
    citedEntries: Array.isArray(l.cited) ? l.cited.map((c) => c.topicId) : [],
    cited: Array.isArray(l.cited) ? l.cited.filter((c) => c && c.title) : [],
    country: l.country || null,
    generatedAt: l.generatedAt || null,
    freshness,
  };
}

// shared actors (web_index.shared[] = { a, b, actors[], weight, country, generatedAt }): the named actors
// two stories' analyses both list. The backend already drops ambient actors (the country itself and any
// actor present in most stories). Merged per OTHER story: the actors are unioned across analyses
// (case-insensitive, first spelling kept), every contributing analysis keeps its own country and date,
// and `weight` is the number of distinct shared actors. Analyses older than 30 days are not used.
function mergeShared(rows, threadId, titles, now) {
  const byOther = new Map();
  for (const r of rows) {
    if (!r || r.a === r.b) continue;
    const other = r.a === threadId ? r.b : r.b === threadId ? r.a : null;
    if (!other) continue;
    const g = byOther.get(other) || { otherThreadId: other, otherTitle: titles?.[other]?.title || null, actors: [], seen: new Set(), webs: [] };
    for (const a of Array.isArray(r.actors) ? r.actors : []) {
      const k = String(a).trim().toLowerCase();
      if (k && !g.seen.has(k)) { g.seen.add(k); g.actors.push(String(a).trim()); }
    }
    g.webs.push({ country: r.country || null, generatedAt: r.generatedAt || null, freshness: analysisTextState(r.generatedAt, now) });
    byOther.set(other, g);
  }
  return [...byOther.values()]
    .map((g) => ({ otherThreadId: g.otherThreadId, otherTitle: g.otherTitle, actors: g.actors, webs: g.webs, weight: g.actors.length }))
    .filter((g) => g.weight > 0)
    .sort((x, y) => y.weight - x.weight || String(x.otherTitle).localeCompare(String(y.otherTitle)));
}

// "From analyses of <countries>, as of <newest date>": the analyses whose rows this story's page uses.
function provenanceOf(webLists) {
  const byCountry = new Map();
  for (const w of webLists.flat()) {
    if (!w?.generatedAt) continue;
    const t = Date.parse(w.generatedAt);
    if (!Number.isFinite(t)) continue;
    const name = w.country || null;
    if (!name) continue;
    if (!byCountry.has(name) || byCountry.get(name) < t) byCountry.set(name, t);
  }
  if (!byCountry.size) return null;
  const countries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  return { countries, asOf: new Date(Math.max(...byCountry.values())).toISOString() };
}

/**
 * @returns {{ fedInto:Array, fedFrom:Array, shared:Array, hiddenOlder:number, provenance:object|null,
 *             state:string|null, meta:object|null, hasIndex:boolean }}
 *   shared       "shares actors with" rows (see mergeShared), usable analyses only
 *   hiddenOlder  distinct (kind, other story) links dropped because their analysis is over 30 days old
 *   provenance   { countries[], asOf } of the analyses behind the rows shown, or null
 *   state: linked | analysed_no_links | single_update | country_not_analysed | null (unknown story) | 'no_index'
 */
export function deriveFromIndex(index, threadId, now = Date.now()) {
  if (!index) return { fedInto: [], fedFrom: [], shared: [], hiddenOlder: 0, provenance: null, state: 'no_index', meta: null, hasIndex: false };
  const meta = index.threads?.[threadId] || null;
  const links = index.links || [];
  const usable = (l) => analysisTextState(l.generatedAt, now) !== 'hidden';
  const fedInto = links.filter((l) => l.from === threadId && usable(l)).map((l) => row(l, 'target', l.to, index.threads, now)).sort(byConfidence);
  const fedFrom = links.filter((l) => l.to === threadId && usable(l)).map((l) => row(l, 'source', l.from, index.threads, now)).sort(byConfidence);
  const sharedUsable = (index.shared || []).filter((r) => (r.a === threadId || r.b === threadId) && usable(r));
  const shared = mergeShared(sharedUsable, threadId, index.threads, now);
  const hidden = new Set();
  for (const l of links) {
    if ((l.from === threadId || l.to === threadId) && !usable(l)) hidden.add(`l:${l.from === threadId ? l.to : l.from}`);
  }
  for (const r of index.shared || []) {
    if ((r.a === threadId || r.b === threadId) && r.a !== r.b && !usable(r)) hidden.add(`s:${r.a === threadId ? r.b : r.a}`);
  }
  const provenance = provenanceOf([
    links.filter((l) => (l.from === threadId || l.to === threadId) && usable(l)),
    sharedUsable,
  ]);
  // a story whose only links are older than 30 days is, for the reader, not linked
  const state = meta ? ((fedInto.length || fedFrom.length) ? 'linked' : (meta.state === 'linked' ? 'analysed_no_links' : meta.state)) : null;
  return { fedInto, fedFrom, shared, hiddenOlder: hidden.size, provenance, state, meta, hasIndex: true };
}

/** distinct linked stories in a row list (two webs can link the same target) */
export function distinctTargets(rows, key = 'targetThreadId') {
  return new Set((rows || []).map((r) => r[key])).size;
}
