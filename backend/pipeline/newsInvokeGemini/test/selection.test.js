'use strict';
// selection.js: the selector's steps as functions of their inputs (decision 0061 lifted them out of the handler for the recovery script).
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/selection');
const { ageLabel } = require('../src/_shared/rss');

const NOW = Date.parse('2026-11-14T20:15:00Z');
const pool = [
  { title: 'Quake hits coast of Chile', url: 'https://a.example/1', source: 'bbc.com', description: 'A strong quake struck.', age: '1 hour ago', publishedAt: '2026-11-14T19:00:00.000Z', feed: 'BBC World' },
  { title: 'Parliament passes budget in Kenya', url: 'https://b.example/2', source: 'dw.com', description: 'Budget passed.', age: '3 hours ago', publishedAt: '2026-11-14T17:00:00.000Z', feed: 'DW English' },
];
const answer = (topics) => JSON.stringify({ topics });

test('ageLabel is the label parseRssXml gives, for a fixed clock', () => {
  const t = Date.parse('2026-11-14T10:00:00Z');
  assert.equal(ageLabel(t, t + 10 * 60000), 'Just now');
  assert.equal(ageLabel(t, t + 3 * 3600000), '3 hours ago');
  assert.equal(ageLabel(t, t + 50 * 3600000), '2 days ago');
});

test('selectionChatOptions is the live selection call: step, JSON, caps', () => {
  const o = S.selectionChatOptions({ prompt: 'P', model: 'm' });
  assert.deepEqual([o.step, o.model, o.user, o.json, o.temperature, o.maxTokens, o.timeoutMs, o.retries], ['topic_selection', 'm', 'P', true, 0.5, 12000, 600000, 2]);
});

test('selectionRequest builds the pool prompt, and the fallback prompt for an empty pool', () => {
  const a = S.selectionRequest({ articles: pool, limit: 13 });
  assert.match(a.prompt, /=== NEWS ARTICLES ===/);
  assert.match(a.prompt, /Quake hits coast of Chile/);
  assert.equal(a.promptCount, 2);
  const b = S.selectionRequest({ articles: [], limit: 13 });
  assert.match(b.prompt, /trending on X/);
});

test('processSelection validates urls against the pool, drops repeats of the last 24 h, caps to the limit', () => {
  const text = answer([
    { title: 'Strong quake strikes Chile coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }, { url: 'https://invented.example/x' }], iso3: ['CHL'] },
    { title: 'Kenya parliament passes budget', category: 'diplomacy', sources: [{ url: 'https://b.example/2' }] },
    { title: 'No valid source', category: 'politics', sources: [{ url: 'https://invented.example/y' }] },
  ]);
  const out = S.processSelection({ text, articles: pool, limit: 13, nowMs: NOW, env: { SOURCE_ENRICH_ENABLED: 'false' } });
  assert.equal(out.normalizedCount, 3);
  assert.deepEqual(out.topics.map((t) => [t.id, t.category, t.sources.length]), [['Strong quake strikes Chile coast-0', 'disaster', 1], ['Kenya parliament passes budget-1', 'politics', 1]]);
  assert.equal(out.topics[0].sources[0].publishedAt, '2026-11-14T19:00:00.000Z');
  const again = S.processSelection({ text, articles: pool, limit: 1, nowMs: NOW, env: { SOURCE_ENRICH_ENABLED: 'false' }, seenEntries: [{ title: 'Strong quake strikes Chile coast' }] });
  assert.deepEqual(again.topics.map((t) => t.title), ['Kenya parliament passes budget']);
  assert.equal(again.droppedRepeats.length, 1);
});

test('the yesterday cut of the repeat check follows nowMs, not the real clock', () => {
  const text = answer([{ title: 'Strong quake strikes Chile coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }] }]);
  const past = [{ date: '2026-11-13', title: 'Strong quake strikes Chile coast' }];
  const kept = S.processSelection({ text, articles: pool, limit: 5, nowMs: NOW, env: { SOURCE_ENRICH_ENABLED: 'false' }, pastArchiveTitles: past });
  assert.equal(kept.topics.length, 0, '11-13 is within 24 h of 11-14 20:15 by the day cut');
  const old = S.processSelection({ text, articles: pool, limit: 5, nowMs: NOW + 3 * 86400000, env: { SOURCE_ENRICH_ENABLED: 'false' }, pastArchiveTitles: past });
  assert.equal(old.topics.length, 1);
});

test('seen-today list: the 24 h window and the merge of a run', () => {
  const seen = [{ fingerprint: 'a', title: 'A', seenAt: NOW - 25 * 3600000 }, { fingerprint: 'b', title: 'B', seenAt: NOW - 3600000 }];
  assert.deepEqual(S.freshSeen(seen, NOW).map((e) => e.title), ['B']);
  const next = S.nextSeenEntries(S.freshSeen(seen, NOW), [{ title: 'B' }, { title: 'C' }], NOW);
  assert.deepEqual(next.map((e) => [e.title, e.seenAt]), [['B', NOW], ['C', NOW]]);
});

test('dedupeByUrl keeps the first of each url and drops rows without one', () => {
  assert.deepEqual(S.dedupeByUrl([{ url: 'u1', t: 1 }, { url: 'u1', t: 2 }, { t: 3 }, { url: 'u2', t: 4 }]).map((a) => a.t), [1, 4]);
});

test('the feed list is exported for the replay (feed name -> source domain)', () => {
  assert.equal(S.RSS_FEEDS.find((f) => f.name === 'BBC World').source, 'bbc.com');
});
