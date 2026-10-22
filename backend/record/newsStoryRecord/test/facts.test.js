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
  const row = (verdict) => ({qid: 'q', n: 1, sk: 'VERDICT', verdict, decidedAt: '2026-10-26T06:00:00Z', sourceKey: 'Q#q|VERDICT', sourceRow: {store: 's', key: 'k'}});
  for (const v of ['yes', 'no', 'void']) assert.equal(F.verdictFact(row(v), {threadId: 't', branchId: 'b'}, 'r').payload.result, v);
  assert.throws(() => F.verdictFact(row('not_yet'), {threadId: 't', branchId: 'b'}, 'r'));
});
