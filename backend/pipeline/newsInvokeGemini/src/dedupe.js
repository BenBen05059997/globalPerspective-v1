'use strict';

// Code-side dedupe for the topic selector (selection audit 2026-10-22: 11.3% of same-day entries repeated an
// earlier one, clusters of up to 10). Two pure steps; the model is still asked not to repeat, this makes it hold.
//   collapseSameEvent: before the model call, one prompt row per event (same canonical url, or title token Jaccard >= 0.6).
//   dropRepeatTopics:  after the model call, drop a topic that repeats an entry of today or yesterday, unless its title
//                      carries a number the earlier entry lacks (a toll or count update is news).

const { canonicalUrl } = require('./_shared/record');

const PRE_JACCARD = 0.6;   // feed items: same event
const POST_JACCARD = 0.5;  // selected topic vs earlier entry (audit method; titles are model-written, so looser)

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'to', 'at', 'as', 'for', 'and', 'by', 'with', 'is', 'are', 'after', 'amid', 'says']);

/** Lower-case words and numbers of a title, stop words dropped. */
function titleTokens(title) {
  const words = String(title || '').toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1').split(/[^\p{L}\p{N}.]+/u)
    .map((w) => w.replace(/^\.+|\.+$/g, '')).filter((w) => w && !STOP.has(w));
  return new Set(words);
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** The numbers in a title as a set of strings ("1,200" -> "1200", "48°C" -> "48"). */
function titleNumbers(title) {
  const nums = String(title || '').replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/g) || [];
  return new Set(nums);
}

/**
 * Collapse feed items that are the same event: the same canonical url, or title Jaccard >= 0.6 with an item already kept.
 * Order is kept; of two items the one with the longer description stays in the first one's place.
 * -> { items: the rows for the prompt, collapsed: n }. The caller keeps the full pool for source validation and enrichment.
 */
function collapseSameEvent(articles) {
  const kept = [];
  let collapsed = 0;
  for (const a of articles || []) {
    const canon = canonicalUrl(a.url) || a.url;
    const tokens = titleTokens(a.title);
    const hit = kept.findIndex((k) => k.canon === canon || jaccard(k.tokens, tokens) >= PRE_JACCARD);
    if (hit < 0) { kept.push({ a, canon, tokens }); continue; }
    collapsed += 1;
    if ((a.description || '').length > (kept[hit].a.description || '').length) kept[hit] = { a, canon: kept[hit].canon, tokens: kept[hit].tokens };
  }
  return { items: kept.map((k) => k.a), collapsed };
}

/**
 * Drop selected topics that repeat an earlier title (today or yesterday): Jaccard >= 0.5 with it, and no number in the
 * topic title that the earlier title lacks. -> { topics: kept, dropped: [{ title, repeats }] }.
 */
function dropRepeatTopics(topics, earlierTitles) {
  const earlier = (earlierTitles || []).filter(Boolean).map((title) => ({ title, tokens: titleTokens(title), nums: titleNumbers(title) }));
  const keptTopics = [];
  const dropped = [];
  for (const t of topics || []) {
    const tokens = titleTokens(t.title);
    const nums = titleNumbers(t.title);
    const match = earlier.find((e) => jaccard(e.tokens, tokens) >= POST_JACCARD);
    if (match && ![...nums].some((n) => !match.nums.has(n))) dropped.push({ title: t.title, repeats: match.title });
    else keptTopics.push(t);
  }
  return { topics: keptTopics, dropped };
}

/** Keep the newest `n` items of each feed (by publishedAt, items without a date after dated ones, feed order breaks ties).
 *  The input order is kept. Items without a feed name share one group. */
function newestPerFeed(articles, n) {
  const byFeed = new Map();
  (articles || []).forEach((a, i) => {
    const k = a.feed || a.source || '';
    if (!byFeed.has(k)) byFeed.set(k, []);
    byFeed.get(k).push({ a, i, t: a.publishedAt ? Date.parse(a.publishedAt) : -Infinity });
  });
  const keep = new Set();
  for (const rows of byFeed.values()) {
    rows.sort((x, y) => (y.t - x.t) || (x.i - y.i)).slice(0, n).forEach((r) => keep.add(r.i));
  }
  return (articles || []).filter((_, i) => keep.has(i));
}

module.exports = { newestPerFeed, collapseSameEvent, dropRepeatTopics, titleTokens, jaccard, titleNumbers, PRE_JACCARD, POST_JACCARD };
