// Post-LLM source enrichment.
//
// After the LLM clusters articles into topics, this module re-scans the
// FULL article pool and attaches additional matching articles (above a
// Jaccard similarity threshold) to each topic. The LLM-picked sources
// are kept as tier='primary'; enriched ones are tier='secondary'.
//
// Rationale: the LLM is told to pick the best few sources per topic and
// to keep article-to-topic exclusivity. Both rules cause it to drop
// matching articles. Deterministic post-pass re-attaches them.
//
// See SOURCE_DIVERSITY_PLAN.md for full design.

const { normalizeOutlet, getOutletMeta } = require('./outlet_metadata');

const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','are',
  'was','were','be','been','being','have','has','had','do','does','did','will','would','could',
  'should','may','might','must','shall','can','this','that','these','those','i','you','he','she',
  'it','we','they','what','which','who','when','where','why','how','all','each','every','both',
  'few','more','most','other','some','such','no','not','only','own','same','so','than','too','very',
  'just','his','her','its','their','our','your','my','says','said','new','also','one','two','about',
  'after','before','over','into','out','up','down','off','then','there','here','now','today',
]);

function tokenize(text) {
  return (text || '').toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersect = 0;
  for (const t of setA) if (setB.has(t)) intersect++;
  return intersect / (setA.size + setB.size - intersect);
}

function scoreMatch(topic, article) {
  const topicTokens = new Set([
    ...tokenize(topic.title),
    ...(topic.search_keywords || []).flatMap(tokenize),
    ...(topic.regions || []).flatMap(tokenize),
  ]);
  const articleTokens = new Set([
    ...tokenize(article.title),
    ...tokenize(article.snippet || article.description || ''),
  ]);
  const jac = jaccard(topicTokens, articleTokens);

  // Bonus: any topic keyword token appearing in the article title.
  const articleTitleTokens = new Set(tokenize(article.title));
  let keywordHits = 0;
  for (const kw of (topic.search_keywords || [])) {
    for (const kt of tokenize(kw)) {
      if (articleTitleTokens.has(kt)) { keywordHits++; break; }
    }
  }
  const keywordBoost = Math.min(keywordHits * 0.05, 0.15);

  return jac + keywordBoost;
}

/**
 * Enrich a single topic's sources from the full article pool.
 *
 * @param {object} topic                Topic with title, search_keywords, regions, sources
 * @param {Array}  allArticles          Full article pool (every article that the LLM saw)
 * @param {Set}    alreadyPrimaryUrls   URLs already attached as primary (any topic)
 * @param {object} opts
 * @param {number} opts.threshold       Min Jaccard+boost score to attach (default 0.20)
 * @param {number} opts.maxEnriched     Max enriched sources per topic (default 12)
 * @param {boolean} opts.allowCrossTopic If true, an article already attached to another topic
 *                                       can still be enriched into this one as secondary.
 *                                       Default false (preserves exclusivity for sanity).
 * @returns {Array} array of new source objects (tier='secondary')
 */
function enrichSourcesForTopic(topic, allArticles, alreadyPrimaryUrls, opts = {}) {
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.20;
  const maxEnriched = typeof opts.maxEnriched === 'number' ? opts.maxEnriched : 12;
  const allowCrossTopic = Boolean(opts.allowCrossTopic);

  const existingUrls = new Set((topic.sources || []).map(s => s.url));
  const existingOutlets = new Set(
    (topic.sources || []).map(s => normalizeOutlet(s.source))
  );

  // Score candidates
  const candidates = [];
  for (const a of allArticles) {
    if (!a?.url) continue;
    if (existingUrls.has(a.url)) continue;
    if (!allowCrossTopic && alreadyPrimaryUrls.has(a.url)) continue;
    const score = scoreMatch(topic, a);
    if (score >= threshold) {
      candidates.push({ article: a, score });
    }
  }

  // Sort by score desc, then prefer outlet diversity
  candidates.sort((x, y) => {
    if (Math.abs(x.score - y.score) > 0.02) return y.score - x.score;
    const xNew = !existingOutlets.has(normalizeOutlet(x.article.source));
    const yNew = !existingOutlets.has(normalizeOutlet(y.article.source));
    if (xNew !== yNew) return xNew ? -1 : 1;
    return y.score - x.score;
  });

  // Cap, return as source objects. Never produce undefined values — DDB v3 marshaller refuses them.
  return candidates.slice(0, maxEnriched).map(c => {
    const obj = {
      title: c.article.title || '',
      url: c.article.url,
      source: c.article.source || '',
      snippet: c.article.snippet || c.article.description || '',
      tier: 'secondary',
      enrichScore: Number(c.score.toFixed(3)),
    };
    if (c.article.age) obj.age = c.article.age;
    return obj;
  });
}

/**
 * Apply enrichment across all topics. Mutates each topic's `sources` array.
 *
 * @returns {object} stats — {before, after, gainedSources, gainedOutlets}
 */
function applyEnrichment(topics, allArticles, opts = {}) {
  const allowCrossTopic = Boolean(opts.allowCrossTopic);

  // Collect primary URLs across all topics (LLM-assigned)
  const primaryUrls = new Set();
  for (const t of topics) {
    for (const s of (t.sources || [])) {
      if (s.url) primaryUrls.add(s.url);
    }
  }

  let beforeTotal = 0;
  let afterTotal = 0;
  let outletsBefore = 0;
  let outletsAfter = 0;

  for (const t of topics) {
    const beforeSources = (t.sources || []).slice();
    beforeTotal += beforeSources.length;
    const outletsBeforeThis = new Set(beforeSources.map(s => normalizeOutlet(s.source))).size;
    outletsBefore += outletsBeforeThis;

    const enriched = enrichSourcesForTopic(t, allArticles, primaryUrls, {
      threshold: opts.threshold,
      maxEnriched: opts.maxEnriched,
      allowCrossTopic,
    });

    t.sources = [...beforeSources, ...enriched];

    afterTotal += t.sources.length;
    const outletsAfterThis = new Set(t.sources.map(s => normalizeOutlet(s.source))).size;
    outletsAfter += outletsAfterThis;
  }

  return {
    sourcesBefore: beforeTotal,
    sourcesAfter: afterTotal,
    gainedSources: afterTotal - beforeTotal,
    outletsBefore,
    outletsAfter,
    gainedOutlets: outletsAfter - outletsBefore,
  };
}

/**
 * Annotate each source with outlet metadata (country, type) so the
 * frontend can display flags without a second lookup.
 */
function annotateSourcesWithMetadata(topics) {
  for (const t of topics) {
    if (!Array.isArray(t.sources)) continue;
    for (const s of t.sources) {
      const meta = getOutletMeta(s.source);
      if (meta) {
        s.outletCountry = meta.country;
        s.outletType = meta.type;
      }
    }
  }
}

module.exports = {
  tokenize,
  jaccard,
  scoreMatch,
  enrichSourcesForTopic,
  applyEnrichment,
  annotateSourcesWithMetadata,
};
