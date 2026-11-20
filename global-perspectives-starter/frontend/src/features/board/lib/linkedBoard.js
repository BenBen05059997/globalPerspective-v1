// linkedBoard: the reading of one public board (a theme from index/themes.json, or a region preset) as a list of story
// cards (board look SPEC, 2026-11-20). Pure functions; the page only arranges what these return.
//   story  { id, title, category, tier, riskScore, born, newest: { date, role } | null, stepCount }
//   link   { from, to, strength: 'weak'|'medium'|'strong'|null, reason }   a judged link, one way
//   shared { a, b, names: [..] }                                           only named in both, never a line
// Days are UTC 'YYYY-MM-DD' compared as text (branchDays' rule).
import { isoWeekStart } from '@/features/board/lib/recordViews.js';
import { iso3Name } from '@/shared/lib/situationLabels.js';

const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');
const STRENGTHS = ['weak', 'medium', 'strong'];
export const strengthOf = (s) => (STRENGTHS.includes(s) ? s : null);

/** One card's facts: the theme row's own step facts (themes.json stamps them) or the story view, else what the theme or
 *  preset row carries; never today's topics. A fact neither has is null, and the card leaves it out. */
export function storyFacts(id, row = {}, view = null) {
  const step = row.newestStep?.date ? row.newestStep : view?.newestStep;
  const newest = step?.date ? { date: day(step.date), role: step.role || null } : null;
  return {
    id,
    title: view?.title || row.title || id,
    category: view?.category || row.category || null,
    tier: view?.tier || row.tier || null,
    riskScore: view?.riskScore ?? row.riskScore ?? null,
    // "began": the first step's date where stamped (design review 1: `born` can precede it), else `born`
    born: day(row.firstStep?.date || view?.firstStep?.date || view?.born || row.born) || null,
    newest,
    stepCount: Number(row.stepCount ?? view?.stepCount) || null,
  };
}

/** The judged links among `ids`, each pair once per direction: theme links ({from,to,strength,reason,judgedAt}) or a
 *  region preset's `links` mapped to story ids. */
export function judgedLinks(rows, ids) {
  const on = new Set(ids);
  const seen = new Set();
  const out = [];
  for (const l of rows || []) {
    if (!on.has(l.from) || !on.has(l.to) || l.from === l.to) continue;
    const key = `${l.from}>${l.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: l.from, to: l.to, strength: strengthOf(l.strength), reason: l.reason || '', judgedAt: day(l.judgedAt) || null });
  }
  return out;
}

/** Shared-name pairs among `ids` that have NO judged link either way and at least two names (SPEC §3.3). */
export function sharedPairs(rows, ids, links) {
  const on = new Set(ids);
  const linked = new Set(links.flatMap((l) => [`${l.from}|${l.to}`, `${l.to}|${l.from}`]));
  const byPair = new Map();
  for (const s of rows || []) {
    if (!on.has(s.a) || !on.has(s.b) || s.a === s.b || linked.has(`${s.a}|${s.b}`)) continue;
    const key = s.a < s.b ? `${s.a}|${s.b}` : `${s.b}|${s.a}`;
    const names = byPair.get(key) || new Set();
    (s.actors || []).forEach((n) => names.add(n));
    byPair.set(key, names);
  }
  return [...byPair].filter(([, names]) => names.size >= 2).map(([key, names]) => {
    const [a, b] = key.split('|');
    return { a, b, names: [...names].sort() };
  });
}

/** A judged reason as stored, with the evidence codes like "(E12)" or "(E1, E3)" taken out. */
export const stripEvidence = (text) => String(text || '').replace(/\s*\((?:E\d+[,;\s]*)+\)/g, '').replace(/\s+([.,;:])/g, '$1').trim();

const newestDay = (s) => s?.newest?.date || '';
const byNewest = (stories) => (a, b) => (newestDay(stories[b]) < newestDay(stories[a]) ? -1 : newestDay(stories[b]) > newestDay(stories[a]) ? 1 : (a < b ? -1 : 1));

/** Link order (SPEC §4): a story before every story it feeds; ties and cycles by newest step, newest first. Stories
 *  with no judged link are returned apart, by newest step. Returns { linked: [id], alone: [id] }. */
export function linkOrder(ids, links, stories) {
  const cmp = byNewest(stories);
  const touched = new Set(links.flatMap((l) => [l.from, l.to]));
  const alone = ids.filter((id) => !touched.has(id)).sort(cmp);
  const left = new Set(ids.filter((id) => touched.has(id)));
  const into = Object.fromEntries([...left].map((id) => [id, 0]));
  links.forEach((l) => { into[l.to] += 1; });
  const linked = [];
  while (left.size) {
    const ready = [...left].filter((id) => into[id] === 0);
    const pick = (ready.length ? ready : [...left]).sort(cmp)[0]; // a cycle: break it at its newest story
    linked.push(pick);
    left.delete(pick);
    links.forEach((l) => { if (l.from === pick && left.has(l.to)) into[l.to] -= 1; });
  }
  return { linked, alone };
}

/** The rows of one card: what it feeds, what feeds it, and its shared-name notes. */
export function cardLinks(id, links, shared) {
  return {
    feeds: links.filter((l) => l.from === id),
    fedBy: links.filter((l) => l.to === id),
    notes: shared.filter((s) => s.a === id || s.b === id).map((s) => ({ other: s.a === id ? s.b : s.a, names: s.names })),
  };
}

/** 'Feeds 2 · Fed by 1'; '' with neither. */
export function linkCountText({ feeds, fedBy }) {
  return [feeds.length && `Feeds ${feeds.length}`, fedBy.length && `Fed by ${fedBy.length}`].filter(Boolean).join(' · ');
}

const IS_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One board's visit record (SPEC §3.6 as amended): `{ seen, prev }` per board, all boards in one map. A view on a
 *  later day moves `seen` to `prev` and sets `seen` to today; another view the same day keeps both, so a reload or a
 *  look at another board never wipes what this board compares against. Returns { since: prev or null, next: map }. */
export function visitBoard(map, key, today) {
  const all = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  const rec = all[key] || {};
  const seen = IS_DAY.test(rec.seen || '') ? rec.seen : null;
  const prev = IS_DAY.test(rec.prev || '') ? rec.prev : null;
  const now = seen && seen < today ? { seen: today, prev: seen } : { seen: today, prev: seen === today ? prev : null };
  return { since: now.prev, next: { ...all, [key]: now } };
}

/** What moved (SPEC §3.6). With `lastSeen` (a returning reader): stories born after it, and stories whose newest
 *  step is after it. Without: the same from this ISO week's Monday (UTC), inclusive.
 *  Returns { mode: 'since'|'week', from, stepped: [{id, date}], joined: [{id, date}], mark: { id: kind } }. */
export function whatMoved(ids, stories, lastSeen, today) {
  const since = /^\d{4}-\d{2}-\d{2}$/.test(lastSeen || '') ? lastSeen : null;
  const from = since || isoWeekStart(today);
  const after = (d) => Boolean(d) && (since ? d > from : d >= from);
  const joined = [];
  const stepped = [];
  for (const id of ids) {
    const s = stories[id];
    if (after(s?.born)) joined.push({ id, date: s.born });
    else if (after(s?.newest?.date)) stepped.push({ id, date: s.newest.date });
  }
  const order = (a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0);
  joined.sort(order);
  stepped.sort(order);
  const mark = {
    ...Object.fromEntries(stepped.map((r) => [r.id, 'stepped'])),
    ...Object.fromEntries(joined.map((r) => [r.id, 'joined'])),
  };
  return { mode: since ? 'since' : 'week', from, stepped, joined, mark };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The box's leading glyph: ● when any story took a new step, ✦ when the only news is new stories, none otherwise. */
export const movedGlyph = ({ stepped, joined }) => (stepped.length ? '●' : joined.length ? '✦' : null);

/** The box's summary line, without its leading mark. */
export function movedSummary({ mode, from, stepped, joined }, fmt) {
  const parts = [
    stepped.length && `${plural(stepped.length, 'story', 'stories')} took a new step`,
    joined.length && `${plural(joined.length, 'story', 'stories')} ${mode === 'since' ? 'joined' : 'began'}`,
  ].filter(Boolean).join(', ');
  return mode === 'since' ? `Since your last visit (${fmt(from)}): ${parts || 'nothing new'}` : `This week: ${parts || 'nothing new'}`;
}

/** The change mark on a card: ✦ wins over ●, one per card. */
export function markText(kind, mode) {
  if (kind === 'joined') return mode === 'since' ? '✦ New since your visit' : '✦ Began this week';
  if (kind === 'stepped') return mode === 'since' ? '● New step since your visit' : '● New step this week';
  return '';
}

/** A theme's title (SPEC §2.2): '8 linked stories: A, B, C, D and 14 more countries' (or '…, C and D'). */
export function themeTitle(theme) {
  const names = (theme.titleCountries || []).map(iso3Name).filter(Boolean);
  const n = (theme.stories || []).length;
  const more = Number(theme.moreCountries) || 0;
  let list = names.join(', ');
  if (more > 0) list = `${list} and ${more} more ${more === 1 ? 'country' : 'countries'}`;
  else if (names.length > 1) list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${n} linked ${n === 1 ? 'story' : 'stories'}${list ? `: ${list}` : ''}`;
}

/** A theme's newest step: the latest `newestStep.date` of its stories, or `lastEntryAt` where a row has no step stamp
 *  (QUESTIONS 4: no builder field for the theme itself). */
export const themeNewest = (theme) => (theme.stories || []).map((s) => day(s.newestStep?.date || s.lastEntryAt)).filter(Boolean).sort().pop() || null;

/** The day the links were judged: the newest `judgedAt` (QUESTIONS 4), or null. */
export const judgedOn = (links) => links.map((l) => l.judgedAt).filter(Boolean).sort().pop() || null;

/** A region preset's links and shared pairs in story ids (they come keyed by pin id). Null `links` when the preset
 *  carries none (a newsBoard from before the board look). */
export function presetLinks(preset) {
  const ref = Object.fromEntries((preset.pins || []).map((p) => [p.pinId, p.refId]));
  const mapLink = (l) => ({ ...l, from: ref[l.from], to: ref[l.to] });
  const mapShared = (s) => ({ ...s, a: ref[s.a], b: ref[s.b] });
  return {
    links: Array.isArray(preset.links) ? preset.links.map(mapLink) : null,
    shared: Array.isArray(preset.shared) ? preset.shared.map(mapShared) : [],
  };
}

/** Themes newest first (SPEC §1.3). */
export function themesByNewest(themes) {
  return [...(themes || [])].sort((a, b) => {
    const x = themeNewest(a) || '';
    const y = themeNewest(b) || '';
    return x === y ? (a.themeId < b.themeId ? -1 : 1) : (y < x ? -1 : 1);
  });
}

/** The categories of a theme's stories, each once, in story order. */
export const themeCategories = (theme) => [...new Set((theme.stories || []).map((s) => s.category).filter(Boolean))];
