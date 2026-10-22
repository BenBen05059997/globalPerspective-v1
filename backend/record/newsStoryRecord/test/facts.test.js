'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/facts');
const R = require('../src/_shared/record');

const entry = {
  date: '2026-10-20', archive: 'archive#2026-10-20', topicId: 'Topic-1', threadId: 'thread-a', title: 'Title', category: 'conflict', iso3: ['IRN', 'FRA', 'IRN'],
  actors: ['Emmanuel Macron', ' emmanuel  macron ', ''], eventType: 'unrest', archivedAt: '2026-10-20T04:00:00.000Z', continuesTopic: null,
  sources: [{source: 'www.bbc.co.uk', title: 'a', url: 'https://m.bbc.co.uk/n/2?utm_source=x'}, {source: 'unknown.example', title: 'b', url: 'https://unknown.example/z#f'}, {source: 'x.test', title: 'c', url: ''}],
  sourceKey: 'archive#2026-10-20|g|Topic-1', sourceRow: {store: 'NewsCache', key: {id: 'archive#2026-10-20'}, index: 0},
};

test('entry fact: content id, sorted unique ids, outlet from the table or null, day precision, evidence list', () => {
  const f = F.entryFact(entry, '2026-10-20-1');
  assert.equal(f.eventId, R.sha1('entryhttps://m.bbc.co.uk/n/2'), 'the smallest canonical url (m.bbc.co.uk < unknown.example)');
  assert.equal(f.eventId, R.entryIdentity({sources: entry.sources, date: entry.date, title: entry.title}).eventId);
  assert.deepEqual(f.iso3, ['FRA', 'IRN']);
  assert.deepEqual(f.actorIds, ['name:emmanuel macron']);
  assert.equal(f.precision, 'day');
  assert.equal(f.idBasis, 'url');
  assert.deepEqual(f.sources.map((s) => s.outlet), ['BBC', null, null]);
  assert.equal(f.sources[0].sourceId, R.sourceIdOf('bbc.co.uk'));
  assert.deepEqual(f.sourceIds, [...new Set(f.sources.map((s) => s.sourceId))].sort());
  assert.equal(f.sources[2].url, null);
  assert.equal(f.schemaVersion, 1);
  assert.equal(f.date, '2026-10-20');
});

test('entry without a usable url uses title basis; without archivedAt the day is the archive day', () => {
  const f = F.entryFact({...entry, sources: [], archivedAt: null}, 'r');
  assert.equal(f.idBasis, 'title');
  assert.equal(f.at, '2026-10-20T00:00:00.000Z');
  assert.deepEqual(f.sources, []);
});

test('entry time: the earliest valid publishedAt is the exact time; eventId and archive date are unchanged', () => {
  const src = (publishedAt) => ({source: 'bbc.com', title: 't', url: `https://bbc.com/${publishedAt}`, publishedAt});
  const base = F.entryFact(entry, 'r');
  const f = F.entryFact({...entry, sources: [src('2026-10-20T03:00:00+00:00'), src('2026-10-19T22:30:00Z'), {...src('x'), publishedAt: null}]}, 'r');
  assert.deepEqual([f.at, f.precision, f.date], ['2026-10-19T22:30:00.000Z', 'exact', '2026-10-19']);
  assert.equal(F.entryFact({...entry, sources: [{...entry.sources[0], publishedAt: '2026-10-20T03:00:00Z'}]}, 'r').eventId, base.eventId);
  assert.equal(base.precision, 'day');
});

test('entry time: malformed, future or stale publishedAt falls back to the archive time at day precision', () => {
  for (const publishedAt of ['not a date', '', '2026-10-20T05:00:00Z', '2026-09-01T00:00:00Z', 12345]) {
    const f = F.entryFact({...entry, sources: [{...entry.sources[0], publishedAt}]}, 'r');
    assert.deepEqual([f.at, f.precision], ['2026-10-20T04:00:00.000Z', 'day'], String(publishedAt));
  }
  const f = F.entryFact({...entry, sources: [{...entry.sources[0], publishedAt: 'bad'}, {...entry.sources[1], publishedAt: '2026-10-20T01:15:00Z'}]}, 'r');
  assert.deepEqual([f.at, f.precision], ['2026-10-20T01:15:00.000Z', 'exact'], 'one bad source does not hide a good one');
});

test('makeFact rejects malformed facts', () => {
  const ok = {kind: 'entry', sourceKey: 'k', at: '2026-10-20T00:00:00Z', precision: 'day', payload: {}, sourceRow: {store: 's', key: 'k'}, runId: 'r'};
  assert.doesNotThrow(() => F.makeFact(ok));
  for (const bad of [{kind: 'chapter'}, {sourceKey: ''}, {at: 'nope'}, {precision: 'hour'}, {sourceRow: null}, {kind: 'verdict'}]) assert.throws(() => F.makeFact({...ok, ...bad}));
});

test('correction and story_merged builders enforce their required fields', () => {
  const base = {at: '2026-10-27T09:00:00Z', sourceKey: 'k', sourceRow: {store: 'operator', key: 'k'}, runId: 'r'};
  assert.throws(() => F.correctionFact({...base, threadId: 't', corrects: 'x', what: '', reason: 'r'}));
  assert.equal(F.mergedFact({...base, from: 'a', into: 'b', reason: 'same'}).threadId, 'b');
  assert.throws(() => F.mergedFact({...base, from: 'a', into: 'a', reason: 'same'}));
});

test('verdict fact accepts yes, no, void only', () => {
  const row = (result) => ({qid: 'q', result, decidedAt: '2026-10-26T06:00:00Z', revision: 1});
  for (const v of ['yes', 'no', 'void']) assert.equal(F.inboxVerdictFact(row(v), {threadId: 't', branchId: 'b'}, 'r').payload.result, v);
  assert.throws(() => F.inboxVerdictFact(row('not_yet'), {threadId: 't', branchId: 'b'}, 'r'));
});

// X1: the article kind
const {inboxArticleFact} = require('../src/facts');
const rawArticle = (o = {}) => ({schemaVersion: 1, rawId: 'r1', url: 'https://www.bbc.co.uk/news/a1?utm_source=rss', canonicalUrl: 'https://bbc.co.uk/news/a1', title: 'T', outlet: 'BBC', feed: 'bbc-world', publishedAt: '2026-10-20T03:58:12.000Z', fetchedAt: '2026-10-20T04:10:00.000Z', snippet: null, lang: null, ...o});
test('X1: article id is sha1("article"+canonicalUrl): a live and a recovered copy are one fact, and the url spelling does not matter', () => {
  const live = inboxArticleFact(rawArticle(), '2026-10-20-1');
  const rec = inboxArticleFact(rawArticle({publishedAt: null, fetchedAt: '2026-10-20T00:00:00.000Z', recoveredAt: '2026-10-25T09:00:00.000Z', recoveredFrom: 'wayback'}), '2026-10-26-1');
  const spelled = inboxArticleFact(rawArticle({canonicalUrl: undefined, url: 'HTTPS://www.bbc.co.uk/news/a1/#x'}), '2026-10-20-1');
  assert.equal(live.eventId, require('../src/_shared/record').sha1('articlehttps://bbc.co.uk/news/a1'));
  assert.deepEqual([rec.eventId, spelled.eventId], [live.eventId, live.eventId]);
  assert.deepEqual([live.threadId, live.iso3, live.actorIds, live.sourceIds], [null, [], [], ['69426f1f0b18d7daeb762f4404cf2884fdd43168']]);
  assert.deepEqual([live.payload.recoveredAt, live.payload.recoveredFrom, rec.payload.recoveredFrom, rec.payload.recoveredAt], [null, null, 'wayback', '2026-10-25T09:00:00.000Z']);
});
test('X1: precision is exact with publishedAt, day (fetch day) without it or when it is after fetchedAt; a bad line throws', () => {
  const exact = inboxArticleFact(rawArticle(), 'r');
  assert.deepEqual([exact.precision, exact.at, exact.date], ['exact', '2026-10-20T03:58:12.000Z', '2026-10-20']);
  for (const o of [{publishedAt: null}, {publishedAt: 'garbage'}, {publishedAt: '2026-10-21T00:00:00.000Z'}]) {
    const f = inboxArticleFact(rawArticle(o), 'r');
    assert.deepEqual([f.precision, f.at], ['day', '2026-10-20T00:00:00.000Z'], JSON.stringify(o));
  }
  for (const o of [{url: ''}, {url: 'ftp://x.test/a', canonicalUrl: null}, {title: ''}, {fetchedAt: 'nope'}]) assert.throws(() => inboxArticleFact(rawArticle(o), 'r'), /inbox article/, JSON.stringify(o));
  assert.throws(() => inboxArticleFact(null, 'r'), /inbox article/);
});
