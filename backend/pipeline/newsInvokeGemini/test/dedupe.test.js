'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { collapseSameEvent, dropRepeatTopics, jaccard, titleTokens } = require('../src/dedupe');

const art = (title, url, description = '') => ({ title, url, description, source: 'x' });

test('collapse: the same canonical url (tracking params, www, &amp; variants) is one item', () => {
  const out = collapseSameEvent([
    art('Quake hits Peru', 'https://www.bbc.co.uk/news/articles/abc?at_medium=RSS&at_campaign=rss'),
    art('Different headline entirely about tariffs', 'https://bbc.co.uk/news/articles/abc?at_campaign=rss&at_medium=RSS&utm_source=x'),
  ]);
  assert.equal(out.items.length, 1);
  assert.equal(out.collapsed, 1);
});

test('collapse: near-identical titles (Jaccard >= 0.6) are one event; the longer description wins and keeps the first slot', () => {
  const a = art('Houthi attack on Riyadh airport kills 12', 'https://a.example/1', 'short');
  const b = art('Houthi attack on Riyadh airport kills 12, injures 300', 'https://b.example/2', 'a much longer description of it');
  const c = art('Brazil runoff: Lula leads Bolsonaro Jr', 'https://c.example/3');
  const out = collapseSameEvent([a, c, b]);
  assert.deepEqual(out.items.map((x) => x.url), ['https://b.example/2', 'https://c.example/3']);
  assert.equal(out.collapsed, 1);
});

test('collapse: different events with a shared place stay apart', () => {
  const out = collapseSameEvent([
    art('Russia strikes Kyiv power grid overnight', 'https://a.example/1'),
    art('Russia and Ukraine swap prisoners in Istanbul talks', 'https://a.example/2'),
  ]);
  assert.equal(out.items.length, 2);
});

test('collapse: bad urls and empty input do not throw', () => {
  assert.deepEqual(collapseSameEvent([]).items, []);
  assert.equal(collapseSameEvent([art('A story', 'not a url'), art('A story', 'not a url')]).items.length, 1);
});

test('jaccard and tokens: stop words and thousands separators are normalised', () => {
  assert.deepEqual([...titleTokens('The Death Toll in Sudan Rises to 1,200')], ['death', 'toll', 'sudan', 'rises', '1200']);
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['a', 'b'])), 1);
  assert.equal(jaccard(new Set(), new Set(['a'])), 0);
});

test('post: a topic repeating an earlier entry is dropped', () => {
  const { topics, dropped } = dropRepeatTopics(
    [{ title: 'Trump waives Russia sanctions under new law' }, { title: 'Chile floods displace thousands' }],
    ['Trump Waives Russia Sanctions Under New Law']);
  assert.deepEqual(topics.map((t) => t.title), ['Chile floods displace thousands']);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].repeats, 'Trump Waives Russia Sanctions Under New Law');
});

test('post: a new number in the title keeps the topic (toll update), the same number does not', () => {
  const earlier = ['Migrant boat capsizes off Djibouti, killing 109'];
  const upd = dropRepeatTopics([{ title: 'Migrant boat capsizes off Djibouti, killing 139' }], earlier);
  assert.equal(upd.topics.length, 1);
  const same = dropRepeatTopics([{ title: 'Migrant boat capsizes off Djibouti killing 109 people' }], earlier);
  assert.equal(same.topics.length, 0);
});

test('post: no earlier titles keeps everything', () => {
  const t = [{ title: 'Anything' }];
  assert.deepEqual(dropRepeatTopics(t, []).topics, t);
});

test('newestPerFeed: keeps the newest n per feed, input order kept, undated items last', () => {
  const { newestPerFeed } = require('../src/dedupe');
  const mk = (feed, n, publishedAt) => ({ feed, title: `${feed}${n}`, publishedAt });
  const list = [mk('A', 1, '2026-10-22T01:00:00Z'), mk('A', 2, '2026-10-22T03:00:00Z'), mk('A', 3, null), mk('A', 4, '2026-10-22T02:00:00Z'), mk('B', 1, null)];
  assert.deepEqual([...newestPerFeed(list, 2)].map((x) => x.title), ['A2', 'A4', 'B1']);
});
