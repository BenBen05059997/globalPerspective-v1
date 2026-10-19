#!/usr/bin/env node
// Local test for source_enrichment.js
// Run: node test_enrichment.js
// No DDB, no LLM. Pure logic + tiny fixture.

const {
  tokenize, jaccard, scoreMatch,
  enrichSourcesForTopic, applyEnrichment, annotateSourcesWithMetadata,
} = require('./source_enrichment');

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name}`, extra || ''); fail++; }
}

console.log('\n# tokenize');
t('lowercases + splits + drops stopwords',
  JSON.stringify(tokenize('The Iran Hormuz Strait is contested')) === JSON.stringify(['iran','hormuz','strait','contested']));
t('handles null/empty',
  tokenize(null).length === 0 && tokenize('').length === 0);
t('drops short tokens',
  !tokenize('a b ccc').includes('a') && !tokenize('a b ccc').includes('b'));

console.log('\n# jaccard');
t('identical sets = 1',
  jaccard(new Set(['a','b']), new Set(['a','b'])) === 1);
t('disjoint sets = 0',
  jaccard(new Set(['a','b']), new Set(['c','d'])) === 0);
t('half overlap',
  jaccard(new Set(['a','b']), new Set(['a','c'])) === 1/3);

console.log('\n# scoreMatch');
const sampleTopic = {
  title: 'Iran forms new body to manage Strait of Hormuz amid US war deadlock',
  search_keywords: ['iran','hormuz','strait'],
  regions: ['Iran','United States'],
};
const matchingArticle = {
  title: 'Iran officially announces new body to manage Strait of Hormuz',
  snippet: 'Iran Supreme National Security Council formed a new authority for the Hormuz Strait.',
};
const irrelevantArticle = {
  title: 'Samsung Electronics union wage talks resume',
  snippet: 'Korea Herald reports on Samsung labor dispute.',
};
const matchScore = scoreMatch(sampleTopic, matchingArticle);
const irrelevantScore = scoreMatch(sampleTopic, irrelevantArticle);
t('matching article scores above 0.2', matchScore >= 0.2, `score=${matchScore}`);
t('irrelevant article scores below 0.1', irrelevantScore < 0.1, `score=${irrelevantScore}`);

console.log('\n# enrichSourcesForTopic');
const topic = {
  ...sampleTopic,
  sources: [
    { url: 'https://example.com/a', source: 'reuters.com', title: 'Existing primary' },
  ],
};
const allArticles = [
  // already attached — should be ignored
  { url: 'https://example.com/a', source: 'reuters.com', title: 'Existing primary', snippet: 'iran hormuz strait' },
  // strong match, new outlet
  { url: 'https://example.com/b', source: 'aljazeera.com', title: 'Iran Hormuz strait new authority announced', snippet: 'Iran forms new body for Hormuz' },
  // another strong match, different outlet
  { url: 'https://example.com/c', source: 'bbc.com', title: 'Iran Strait of Hormuz body created amid US tensions', snippet: 'Hormuz authority Iran' },
  // off-topic
  { url: 'https://example.com/d', source: 'koreaherald.com', title: 'Samsung union talks', snippet: 'wage' },
  // same outlet as existing — should still be added if it matches
  { url: 'https://example.com/e', source: 'reuters.com', title: 'Iran Hormuz tensions rise as US warns', snippet: 'Iran Hormuz strait' },
];
const enriched = enrichSourcesForTopic(topic, allArticles, new Set(['https://example.com/a']), { threshold: 0.2 });
t('returns array of enriched sources', Array.isArray(enriched) && enriched.length >= 2, `len=${enriched.length}`);
t('does not include already-attached url', !enriched.find(s => s.url === 'https://example.com/a'));
t('does not include already-primary url', !enriched.find(s => s.url === 'https://example.com/a'));
t('excludes off-topic article', !enriched.find(s => s.url === 'https://example.com/d'));
t('every enriched source is tier=secondary', enriched.every(s => s.tier === 'secondary'));
t('prefers new outlets when scores tied — first enriched is not reuters',
  enriched[0]?.source !== 'reuters.com', `first=${enriched[0]?.source}`);
t('enrichScore is present and reasonable',
  enriched.every(s => typeof s.enrichScore === 'number' && s.enrichScore >= 0.2));

console.log('\n# enrichSourcesForTopic — cap');
const flood = Array.from({ length: 30 }, (_, i) => ({
  url: `https://flood.example/${i}`,
  source: `outlet${i}.com`,
  title: 'Iran Hormuz strait new authority announced',
  snippet: 'iran hormuz strait',
}));
const capped = enrichSourcesForTopic(topic, flood, new Set(), { threshold: 0.2, maxEnriched: 5 });
t('respects maxEnriched cap', capped.length === 5, `len=${capped.length}`);

console.log('\n# applyEnrichment — aggregate stats');
const topics = [
  { title: 'Iran Hormuz body', search_keywords: ['iran','hormuz'], regions: ['Iran'],
    sources: [{ url: 'https://example.com/a', source: 'reuters.com' }] },
  { title: 'Samsung union strike', search_keywords: ['samsung','union'], regions: ['South Korea'],
    sources: [{ url: 'https://example.com/k', source: 'koreaherald.com' }] },
];
const articles = [
  { url: 'https://example.com/a', source: 'reuters.com', title: 'Existing', snippet: '' },
  { url: 'https://example.com/k', source: 'koreaherald.com', title: 'Existing', snippet: '' },
  { url: 'https://example.com/iran1', source: 'bbc.com', title: 'Iran Hormuz strait new body', snippet: 'iran hormuz' },
  { url: 'https://example.com/iran2', source: 'aljazeera.com', title: 'Iran Hormuz body announced', snippet: 'iran hormuz' },
  { url: 'https://example.com/sams1', source: 'bloomberg.com', title: 'Samsung union strike threat', snippet: 'samsung union wage' },
];
const stats = applyEnrichment(topics, articles, { threshold: 0.2 });
t('aggregate sources increased', stats.sourcesAfter > stats.sourcesBefore,
  `before=${stats.sourcesBefore} after=${stats.sourcesAfter}`);
t('aggregate outlets increased', stats.outletsAfter > stats.outletsBefore,
  `before=${stats.outletsBefore} after=${stats.outletsAfter}`);
t('topic 0 picked up Iran articles', topics[0].sources.length >= 3,
  `len=${topics[0].sources.length}`);
t('topic 1 picked up Samsung Bloomberg', topics[1].sources.some(s => s.source === 'bloomberg.com'));
t('primary tier preserved', topics[0].sources[0].source === 'reuters.com');

console.log('\n# annotateSourcesWithMetadata');
annotateSourcesWithMetadata(topics);
const bbcSource = topics[0].sources.find(s => s.source === 'bbc.com');
t('bbc gets country GB',
  bbcSource && bbcSource.outletCountry === 'GB',
  bbcSource ? JSON.stringify(bbcSource) : 'no bbc found');
const reutersSource = topics[0].sources.find(s => s.source === 'reuters.com');
t('reuters gets type wire',
  reutersSource && reutersSource.outletType === 'wire');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
