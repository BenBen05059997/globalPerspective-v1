'use strict';

// Pure, deterministic recommendation scoring — no AWS, no I/O, so it unit-tests
// in isolation AND is imported verbatim by the digest sender (one algorithm, two
// consumers: see RECOMMENDATIONS_AND_DIGEST_PLAN.md).
//
// Content-based, no ML. Inputs are already-resolved plain objects:
//   topic        = { topicId, threadId, category, regions[], sources[] | sourceCount }
//   savedItems[] = { itemType: 'thread'|'country'|'daily'|'pair', itemId, metadata? }
//   profile      = { categories:{tag:weight}, countries:{name:weight}, threads:[threadId] }

// Tunable weights — kept as named constants, not magic numbers in the formula.
// Note: there is deliberately no "thread" term. This rail is *discovery* — topics whose
// thread the user already follows are excluded up front (see rankRecommendations), so a
// thread-match term could never fire. "Latest in threads you follow" is a separate
// future surface, not this one.
const WEIGHTS = Object.freeze({
  category: 3,
  country: 3,
  recency: 2,
  popularity: 1,
});

// How fast recency decays. A topic loses half its recency credit every HALF_LIFE_DAYS.
const HALF_LIFE_DAYS = 2;
const DAY_MS = 86400000;

function norm(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

function sourceCount(topic) {
  if (Array.isArray(topic.sources)) return topic.sources.length;
  if (Number.isFinite(topic.sourceCount)) return topic.sourceCount;
  return 0;
}

// Build a weighted interest profile from a user's saved items. `threadTagIndex` maps a
// threadId → { category, regions[] } (built by the caller from the current topic pool),
// letting a saved thread contribute its category/region tags, not just its id.
function buildInterestProfile(savedItems, threadTagIndex = {}) {
  const profile = { categories: {}, countries: {}, threads: [] };
  if (!Array.isArray(savedItems)) return profile;

  const bump = (bag, key, by = 1) => {
    const k = norm(key);
    if (!k) return;
    bag[k] = (bag[k] || 0) + by;
  };

  for (const item of savedItems) {
    if (!item || typeof item !== 'object') continue;
    const { itemType, itemId, metadata } = item;

    if (itemType === 'thread' && itemId) {
      if (!profile.threads.includes(itemId)) profile.threads.push(itemId);
      const tags = threadTagIndex[itemId] || {};
      if (tags.category) bump(profile.categories, tags.category);
      for (const r of tags.regions || []) bump(profile.countries, r);
      // Fall back to any tags the frontend stored on the save itself.
      if (metadata && typeof metadata === 'object') {
        if (metadata.category) bump(profile.categories, metadata.category);
        for (const r of metadata.regions || []) bump(profile.countries, r);
      }
    } else if (itemType === 'country' && itemId) {
      bump(profile.countries, itemId, 2);
    }
    // daily / pair carry no reliable tags for v1 — ignored.
  }
  return profile;
}

function categoryOverlap(topic, profile) {
  return profile.categories[norm(topic.category)] || 0;
}

function regionOverlap(topic, profile) {
  let hits = 0;
  for (const r of topic.regions || []) hits += profile.countries[norm(r)] || 0;
  return hits;
}

// Exponential recency decay in [0,1] from a topic timestamp. Missing/garbage ts → 0.5
// (neutral) so undated topics aren't unfairly buried or boosted.
function recencyDecay(topic, now = Date.now()) {
  const ts = Date.parse(topic.archivedAt || topic.publishedAt || topic.updatedAt || '');
  if (!Number.isFinite(ts)) return 0.5;
  const ageDays = Math.max(0, (now - ts) / DAY_MS);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// Popularity in [0,1] — source count squashed so a few extra sources don't dominate.
function popularity(topic) {
  const n = sourceCount(topic);
  return n <= 0 ? 0 : Math.min(1, Math.log10(1 + n) / Math.log10(11)); // 10 sources ≈ 1.0
}

function scoreItem(topic, profile, now = Date.now(), w = WEIGHTS) {
  return (
    w.category * categoryOverlap(topic, profile) +
    w.country * regionOverlap(topic, profile) +
    w.recency * recencyDecay(topic, now) +
    w.popularity * popularity(topic)
  );
}

// Whether a profile carries any personal signal. Empty → caller serves "Trending".
function isColdStart(profile) {
  return (
    !profile ||
    (profile.threads.length === 0 &&
      Object.keys(profile.categories).length === 0 &&
      Object.keys(profile.countries).length === 0)
  );
}

// Rank candidates for a user. Returns [{ topic, score, personalized }] sorted desc.
// Excludes threads the user already saved. On cold start, falls back to a popularity ×
// recency "Trending" ranking (an empty `profile` makes the personal terms zero anyway,
// but we flag it so the UI can label the rail honestly).
function rankRecommendations(topics, profile, opts = {}) {
  const { limit = 8, now = Date.now() } = opts;
  const cold = isColdStart(profile);
  const savedThreads = new Set((profile && profile.threads) || []);

  const ranked = (topics || [])
    .filter((t) => t && t.topicId && !savedThreads.has(t.threadId))
    .map((topic) => ({ topic, score: scoreItem(topic, profile || {}, now), personalized: !cold }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit);
}

module.exports = {
  WEIGHTS,
  HALF_LIFE_DAYS,
  buildInterestProfile,
  scoreItem,
  isColdStart,
  rankRecommendations,
  // exported for tests
  _internals: { categoryOverlap, regionOverlap, recencyDecay, popularity, sourceCount },
};
