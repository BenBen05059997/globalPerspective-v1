'use strict';

// Batch 3 / C: give each daily-brief top story the REAL threadId of the archive entry it was
// written from (or null). The model is never asked for ids (so it cannot invent one); it copies
// the story title from the headline list, and every headline is an archive entry that already
// carries a threadId. Pure: no AWS, no network. Unit-tested in ../test/threadLinks.test.js.

const { iso3List } = require('./_shared/resolveIso3'); // TODO(L1-LINKS): resolveCountry

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'and', 'to', 'as', 'at', 'for', 'amid', 'with', 'by', 'is', 'are', 'its']);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i);
}

const MIN_CONTAIN_CHARS = 12;
const MIN_JACCARD = 0.6;

// -> string threadId, or null when there is no match or the best matches disagree (ambiguous is not a link).
function resolveStoryThreadId(title, entries, threadAnalyses = {}) {
  const t = norm(title);
  if (!t) return null;
  const cands = (Array.isArray(entries) ? entries : []).filter((e) => e && e.threadId && e.title);
  const pick = (ids) => {
    const uniq = [...new Set(ids)];
    if (uniq.length === 1) return uniq[0];
    if (uniq.length > 1) {
      // a thread that has an analysis row is the better-known one; only decisive if exactly one has it
      const withAnalysis = uniq.filter((id) => threadAnalyses && threadAnalyses[id]);
      return withAnalysis.length === 1 ? withAnalysis[0] : null;
    }
    return undefined; // no candidates at this tier
  };
  // 1 exact normalized title
  let r = pick(cands.filter((e) => norm(e.title) === t).map((e) => e.threadId));
  if (r !== undefined) return r;
  // 2 containment either way (min length so short titles cannot match everything)
  r = pick(cands.filter((e) => {
    const n = norm(e.title);
    const [short, long] = n.length <= t.length ? [n, t] : [t, n];
    return short.length >= MIN_CONTAIN_CHARS && long.includes(short);
  }).map((e) => e.threadId));
  if (r !== undefined) return r;
  // 3 token Jaccard, best tier only
  const tt = tokens(title);
  let best = 0; let bestIds = [];
  for (const e of cands) {
    const j = jaccard(tt, tokens(e.title));
    if (j > best + 1e-9) { best = j; bestIds = [e.threadId]; } else if (Math.abs(j - best) <= 1e-9 && j > 0) bestIds.push(e.threadId);
  }
  if (best < MIN_JACCARD) return null;
  r = pick(bestIds);
  return r === undefined ? null : r;
}

// topStories[] -> a copy where every story has threadId (string|null) and iso3[] (its regions through
// the resolver). Never throws.
function resolveStoryThreadIds(topStories, entries, threadAnalyses = {}) {
  if (!Array.isArray(topStories)) return [];
  return topStories.map((s) => (s && typeof s === 'object'
    ? { ...s, threadId: resolveStoryThreadId(s.title, entries, threadAnalyses), iso3: iso3List(s.regions) }
    : s));
}

// countryToWatch -> a copy with iso3[] and threadId: today's thread with the most entries in that country
// (first seen wins a tie), or null. The model's object is kept as is.
function linkCountryToWatch(ctw, entries) {
  if (!ctw || typeof ctw !== 'object') return ctw || null;
  const iso3 = iso3List([ctw.countryName]);
  const count = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (e && e.threadId && iso3.length && iso3List(e.regions).includes(iso3[0])) count.set(e.threadId, (count.get(e.threadId) || 0) + 1);
  }
  const [threadId = null] = [...count.keys()].sort((a, b) => count.get(b) - count.get(a));
  return { ...ctw, iso3, threadId };
}

module.exports = { resolveStoryThreadId, resolveStoryThreadIds, linkCountryToWatch, norm };
