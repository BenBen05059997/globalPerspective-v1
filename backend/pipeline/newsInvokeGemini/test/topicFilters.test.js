'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIndex } = require('./load');

const { normalizeSourceUrl, filterTopics, capTopics, extractJson } = loadIndex()._internal;
const topic = (n, category = 'politics', sources = [{ url: 'https://x/' + n }]) => ({ title: 'T' + n, category, sources });

test('diplomacy is mapped to politics, not dropped; other unknown categories are still dropped', () => {
  const out = filterTopics([topic(1, 'diplomacy'), topic(2, 'sports'), topic(3, 'conflict')]);
  assert.equal(JSON.stringify(out.map((t) => [t.title, t.category])), JSON.stringify([['T1', 'politics'], ['T3', 'conflict']]));
});

test('a topic without sources is dropped', () => {
  assert.equal(filterTopics([topic(1, 'politics', [])]).length, 0);
});

test('source URLs compare equal across &amp; / & and surrounding spaces', () => {
  const a = 'https://www.bbc.com/news/x?at_medium=RSS&at_campaign=rss';
  assert.equal(normalizeSourceUrl(a.replace(/&/g, '&amp;')), a);
  assert.equal(normalizeSourceUrl(`  ${a}\n`), a);
  assert.equal(normalizeSourceUrl('https://x/?a=1&#38;b=2&#x26;c=3'), 'https://x/?a=1&b=2&c=3');
  assert.equal(normalizeSourceUrl('https://x/?a&amp;amp;b'), 'https://x/?a&amp;b', 'decoded once only');
  assert.equal(normalizeSourceUrl(undefined), '');
});

test('a salvaged truncated reply goes through the same filters and the limit as a whole one', () => {
  const items = Array.from({ length: 30 }, (_, i) => JSON.stringify({ title: 'T' + i, category: i % 5 === 0 ? 'diplomacy' : i % 7 === 0 ? 'sports' : 'conflict', sources: [{ url: 'https://x/' + i }] }));
  const truncated = '{"topics":[' + items.join(',') + ',{"title":"cut off","categ';
  const parsed = extractJson(truncated);
  assert.equal(parsed.topics.length, 30);
  const kept = capTopics(filterTopics(parsed.topics), 13);
  assert.equal(kept.length, 13);
  assert.ok(kept.every((t) => ['politics', 'conflict'].includes(t.category)));
  assert.equal(kept[0].category, 'politics'); // T0 was diplomacy
  assert.ok(!kept.some((t) => t.title === 'T7'), 'sports topic dropped');
  assert.equal(capTopics([1, 2], 13).length, 2);
});

// ---- the whole handler ---------------------------------------------------------------------------------------
const { runHandler } = require('./fakes');
const stagingTopics = (written) => written.find((i) => i.id === 'staging').topics;

test('handler: diplomacy topic kept as politics; a source whose & / &amp; differs from the pool still validates', async () => {
  const flip = (u) => (u.includes('&amp;') ? u.replace(/&amp;/g, '&') : u.replace(/&/g, '&amp;'));
  const topics = (urls) => {
    const withAmp = urls.find((u) => u.includes('&')) || urls[0];
    return [
      { title: 'Chancellor hosts envoys in Berlin', category: 'diplomacy', sources: [{ url: ` ${flip(withAmp)} ` }] },
      { title: 'Totally fresh event in Chile', category: 'sports', sources: [{ url: urls[2] }] },
    ];
  };
  const { written } = await runHandler({ topics });
  const kept = stagingTopics(written);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].category, 'politics');
  assert.ok(kept[0].sources.length >= 1);
});

test('handler: more topics than the limit are cut to the limit', async () => {
  const topics = (urls) => Array.from({ length: 30 }, (_, i) => ({ title: `Distinct event number ${i} alpha${i}x`, category: 'conflict', sources: [{ url: urls[i] }] }));
  const { written } = await runHandler({ topics, env: { TOPICS_LIMIT: '13' } });
  assert.equal(stagingTopics(written).length, 13);
});
