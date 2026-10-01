// storyWeb — the pure logic behind the Stories WEB view (/weekly?view=web, REDESIGN_MASTER_PLAN §3.4):
// the union of every analysis's story links as ONE story graph. No React, no fetching, no clock
// reads (callers pass `now`), so every rule is unit-tested.
//
// Source: the whole `web_index` object (newsSystemsAnalysis, read by useWebIndex):
//   links[]    one row per ANALYSIS that linked a pair: { from, to, confidence, lagDays, mechanism,
//              cited:[{topicId, title?, date?}], country, generatedAt }
//   websUsed[] the analyses the index was built from: { country, generatedAt, nodes }
//   threads    { id: { title, state, places } }
//
// Honesty rules (master plan §1, STORY_WEB_RETHINK_PLAN §5): a link is a MODEL JUDGMENT ("judged to
// feed into", never "caused"); the mechanism text is verbatim; each analysis keeps its OWN
// confidence (the merged edge shows the strongest AND lists every analysis's word); analyses older
// than 30 days are hidden and COUNTED (S5; the table's TTL is off, so the cut is client-side); a
// story with no archive coverage has no date and is not drawn (never placed by a guess).
import { analysisTextState } from '@/features/threads/lib/storyMode.js';
import { crisisOf } from '@/features/threads/lib/storyGroups.js';

export const WEB_DEFAULT_NODES = 14;
export const WEB_MAX_NODES = 40; // "show all" is capped: past this the graph is unreadable
export const WEB_LIST_DEFAULT = 10;
export const WEB_LIST_MAX = 60;
export const WEB_HIDE_DAYS = 30;

export const CONF_RANK = { strong: 3, medium: 2, weak: 1 };
export const CONF_WIDTH = { strong: 3, medium: 2, weak: 1.2 };
const rankOf = (c) => CONF_RANK[c] || 0;

const iso = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** "2026-10-01T05:01:43Z" -> "Oct 1" (the analysis's UTC day, so the label is the same in every timezone). */
export function webDateLabel(isoStr) {
  const d = iso(isoStr);
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const analysisKey = (country, generatedAt) => `${country || ''}|${generatedAt || ''}`;

/**
 * mergeWebLinks(index, now) -> { edges, analyses, hiddenLinks }
 *   edges: one per from->to pair (links of the same pair from different analyses are merged):
 *     { key, from, to, confidence (strongest), webs:[{country, confidence, lagDays, generatedAt}]
 *       (one per analysis, each with its own word), mechanism (verbatim, from the strongest analysis,
 *       newest on a tie), mechanismCountry, cited:[{title, date|null}] (union, newest first),
 *       newest (ISO of the newest analysis), older (true when EVERY analysis behind it is > 7 days old) }
 *   analyses: { merged, hidden, newest (ISO|null), total } — merged = analyses used, hidden = analyses
 *     older than 30 days (counted, never drawn), total = merged + hidden.
 *   hiddenLinks: link rows dropped for age.
 * A link row without a from/to, or linking a story to itself, is ignored (nothing to draw).
 */
export function mergeWebLinks(index, now = Date.now()) {
  const links = Array.isArray(index?.links) ? index.links : [];
  const stateOf = (g) => analysisTextState(g, now);
  // analyses: from websUsed when the index carries it, else derived from the link rows themselves
  const seen = new Map();
  if (Array.isArray(index?.websUsed) && index.websUsed.length) {
    for (const w of index.websUsed) seen.set(analysisKey(w.country, w.generatedAt), { country: w.country || null, generatedAt: w.generatedAt || null });
  } else {
    for (const l of links) seen.set(analysisKey(l.country, l.generatedAt), { country: l.country || null, generatedAt: l.generatedAt || null });
  }
  let merged = 0; let hidden = 0; let newestT = -Infinity;
  for (const a of seen.values()) {
    if (stateOf(a.generatedAt) === 'hidden') { hidden += 1; continue; }
    merged += 1;
    const t = Date.parse(a.generatedAt);
    if (Number.isFinite(t) && t > newestT) newestT = t;
  }

  const byKey = new Map();
  let hiddenLinks = 0;
  for (const l of links) {
    if (!l || !l.from || !l.to || l.from === l.to) continue;
    if (stateOf(l.generatedAt) === 'hidden') { hiddenLinks += 1; continue; }
    const key = `${l.from}->${l.to}`;
    const e = byKey.get(key) || { key, from: l.from, to: l.to, confidence: null, webs: [], mechanism: null, mechanismCountry: null, cited: [], newest: null, _mechRank: -1, _mechT: -Infinity };
    const t = Date.parse(l.generatedAt);
    const web = { country: l.country || null, confidence: l.confidence || null, lagDays: l.lagDays ?? null, generatedAt: l.generatedAt || null };
    if (!e.webs.some((w) => analysisKey(w.country, w.generatedAt) === analysisKey(web.country, web.generatedAt))) e.webs.push(web);
    const r = rankOf(l.confidence);
    if (r > rankOf(e.confidence)) e.confidence = l.confidence;
    const tt = Number.isFinite(t) ? t : -Infinity;
    if (l.mechanism && (r > e._mechRank || (r === e._mechRank && tt > e._mechT))) {
      e.mechanism = l.mechanism; e.mechanismCountry = l.country || null; e._mechRank = r; e._mechT = tt;
    }
    if (Number.isFinite(t) && (!e.newest || t > Date.parse(e.newest))) e.newest = new Date(t).toISOString();
    for (const c of (Array.isArray(l.cited) ? l.cited : [])) {
      if (!c || !c.title) continue; // a cite with no headline has nothing to show
      if (!e.cited.some((x) => x.title === c.title)) e.cited.push({ title: c.title, date: c.date || null });
    }
    byKey.set(key, e);
  }
  const edges = [...byKey.values()].map((e) => {
    const { _mechRank, _mechT, ...rest } = e;
    rest.cited.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    rest.webs.sort((a, b) => rankOf(b.confidence) - rankOf(a.confidence) || String(a.country).localeCompare(String(b.country)));
    rest.older = rest.webs.length > 0 && rest.webs.every((w) => stateOf(w.generatedAt) === 'older');
    return rest;
  });
  return {
    edges,
    analyses: { merged, hidden, total: merged + hidden, newest: Number.isFinite(newestT) ? new Date(newestT).toISOString() : null },
    hiddenLinks,
  };
}

/** The footnote under the graph, computed from the merge (no hard-coded numbers). */
export function webFootnote(analyses) {
  const { merged, hidden, newest } = analyses;
  const parts = [
    'Dashed = model judgment (thicker = stronger)',
    'never “caused”',
    `merged from ${merged} ${merged === 1 ? 'analysis' : 'analyses'}${newest ? `, newest ${webDateLabel(newest)}` : ''}`,
    `${hidden} older than ${WEB_HIDE_DAYS} days hidden`,
  ];
  return parts.join(' · ');
}

/** peakDate(thread) -> the day key with the most archive entries (ties -> the latest); null with no dates. */
export function peakDate(thread) {
  const counts = new Map();
  for (const e of thread?.entries || []) if (e.date) counts.set(e.date, (counts.get(e.date) || 0) + 1);
  let best = null; let bestN = 0;
  for (const [d, n] of counts) {
    if (n > bestN || (n === bestN && best && d > best)) { best = d; bestN = n; }
  }
  return best;
}

const dayMs = (d) => Date.parse(`${d}T00:00:00Z`);

/**
 * pickWebNodes({ edges, threadsById, limit }) -> { nodes, edges, outside }
 *   threadsById: Map/obj id -> archive thread, ONLY the stories that pass the page's filters (so a
 *   story with no archive coverage, or one the filters hide, is never a node).
 *   edges considered: both ends in threadsById AND with at least one archive day (x needs a date). degree = merged edges touching a story. The `limit`
 *   most-linked become nodes (ties: later peak date, then id); edges kept = both ends among them.
 *   outside = edges dropped because an end is not shown (filters / no archive coverage).
 */
export function pickWebNodes({ edges, threadsById, limit = WEB_DEFAULT_NODES }) {
  const get = (id) => (threadsById instanceof Map ? threadsById.get(id) : threadsById?.[id]);
  const drawable = (id) => { const t = get(id); return !!(t && peakDate(t)); }; // no archive day = no x position
  const usable = edges.filter((e) => drawable(e.from) && drawable(e.to));
  const degree = new Map();
  for (const e of usable) {
    degree.set(e.from, (degree.get(e.from) || 0) + 1);
    degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }
  const ranked = [...degree.entries()].map(([id, deg]) => ({ id, deg, peak: peakDate(get(id)) }))
    .sort((a, b) => b.deg - a.deg || String(b.peak).localeCompare(String(a.peak)) || a.id.localeCompare(b.id))
    .slice(0, limit);
  const chosen = new Set(ranked.map((n) => n.id));
  const kept = usable.filter((e) => chosen.has(e.from) && chosen.has(e.to));
  const shownDeg = new Map();
  for (const e of kept) { shownDeg.set(e.from, (shownDeg.get(e.from) || 0) + 1); shownDeg.set(e.to, (shownDeg.get(e.to) || 0) + 1); }
  const nodes = ranked.map((n) => ({ id: n.id, thread: get(n.id), degree: n.deg, shownDegree: shownDeg.get(n.id) || 0, peak: n.peak }));
  return { nodes, edges: kept, outside: edges.length - usable.length, totalLinked: degree.size };
}

/** strongestLinks(edges) -> the list twin order: strongest word, then more analyses, then newest. */
export function strongestLinks(edges) {
  return [...edges].sort((a, b) => rankOf(b.confidence) - rankOf(a.confidence)
    || b.webs.length - a.webs.length
    || String(b.newest || '').localeCompare(String(a.newest || ''))
    || a.key.localeCompare(b.key));
}

export const LANE_ORDER = ['conflict', 'political', 'economic', 'humanitarian', 'neutral'];
export const LAYOUT = { width: 1000, minWidth: 760, padLeft: 150, padRight: 60, laneTop: 6, rowH: 40, lanePad: 18, axisH: 34, labelChars: 34, charPx: 6.4 };

/**
 * layoutWeb(nodes) -> { width, height, lanes, nodes, ticks }
 *   lanes: only the crisis types that have a node, fixed order (CONFLICT, POLITICAL, ECONOMIC,
 *   HUMANITARIAN, then neutral "Other"); each lane is as tall as its stagger rows need.
 *   width = the container's pixel width (>= minWidth; the frame scrolls below that), so 1 unit = 1 px.
 *   x = peak date on the nodes' own span (min..max peak): real dates, nothing padded; a single date
 *   centres. Rows: nodes in a lane sorted by x; a node takes the first row whose last label has
 *   ended (so labels never overlap). Node diameter grows with degree (12..30 px).
 *   ticks: real day keys, <= 6, evenly spaced from the first to the last peak date.
 */
export function layoutWeb(nodes, widthPx = LAYOUT.width) {
  const width = Math.max(LAYOUT.minWidth, widthPx);
  const { padLeft, padRight, laneTop, rowH, lanePad, axisH, labelChars, charPx } = LAYOUT;
  const dates = nodes.map((n) => dayMs(n.peak));
  const t0 = Math.min(...dates); const t1 = Math.max(...dates);
  const span = t1 - t0;
  const xOf = (d) => (span === 0 ? (padLeft + (width - padRight)) / 2 : padLeft + ((dayMs(d) - t0) / span) * (width - padLeft - padRight));
  const byLane = new Map();
  for (const n of nodes) {
    const k = crisisOf(n.thread);
    if (!byLane.has(k)) byLane.set(k, []);
    byLane.get(k).push(n);
  }
  const lanes = []; const placed = [];
  let y = laneTop;
  for (const key of LANE_ORDER) {
    const list = byLane.get(key);
    if (!list) continue;
    list.sort((a, b) => dayMs(a.peak) - dayMs(b.peak) || b.degree - a.degree || a.id.localeCompare(b.id));
    const rowEnd = [];
    const items = list.map((n) => {
      const x = xOf(n.peak);
      const d = Math.min(30, Math.max(12, 10 + 3 * n.degree));
      const labelW = Math.min(labelChars, 34) * charPx + d + 14; // label estimate: only used to stagger rows
      let row = rowEnd.findIndex((end) => x >= end);
      if (row < 0) { row = rowEnd.length; rowEnd.push(0); }
      rowEnd[row] = x + labelW;
      return { ...n, x, row, diameter: d, lane: key };
    });
    const rows = Math.max(1, rowEnd.length);
    const height = rows * rowH + lanePad;
    for (const it of items) placed.push({ ...it, y: y + 14 + it.row * rowH + rowH / 2 - 6 });
    lanes.push({ key, top: y, height, rows });
    y += height;
  }
  const ticks = [];
  const days = Math.round(span / 86400000);
  const count = Math.min(6, days + 1);
  for (let i = 0; i < count; i += 1) {
    const ms = count === 1 ? t0 : t0 + (span * i) / (count - 1);
    const key = new Date(Math.round(ms / 86400000) * 86400000).toISOString().slice(0, 10);
    if (!ticks.some((t) => t.date === key)) ticks.push({ date: key, x: xOf(key) });
  }
  return { width, height: y + axisH, axisY: y + 10, lanes, nodes: placed, ticks };
}

/** What the node's peek says about its links: "Feeds into 2, fed by 1 · strongest: medium". Words only. */
export function nodeLinkWords(id, edges) {
  const out = edges.filter((e) => e.from === id);
  const inn = edges.filter((e) => e.to === id);
  if (!out.length && !inn.length) return null;
  const best = [...out, ...inn].reduce((b, e) => (rankOf(e.confidence) > rankOf(b) ? e.confidence : b), null);
  const bits = [];
  if (out.length) bits.push(`judged to feed into ${out.length}`);
  if (inn.length) bits.push(`judged fed by ${inn.length}`);
  return `${bits.join(', ')} · strongest ${best || 'unrated'} (model judgment)`;
}
