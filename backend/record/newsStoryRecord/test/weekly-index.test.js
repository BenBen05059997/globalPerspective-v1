'use strict';
// The weekly index (indexViews.js weeklyIndex): the archive_range days built from the entry facts.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/views');
const IV = require('../src/indexViews');
const X = require('./views-fixture');

const opts = {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1, notes: []};
const archived = (f, day, index) => ({...f, sourceKey: `archive#${day}|gen-1|${f.eventId}`, sourceRow: {store: 'NewsCache', key: {id: `archive#${day}`}, index}});
const e = (thread, at, title, id, day, index, o = {}) => archived(X.entry(thread, at, title, {id, iso3: ['FRA'], sources: ['s1', 's2'], ...o}), day, index);
const facts = () => [
  X.born('thread-a', '2026-10-20T04:00:00.000Z', '2026-10-20'), X.born('thread-b', '2026-10-20T04:00:00.000Z', '2026-10-20'), X.born('thread-c', '2026-10-20T04:00:00.000Z', '2026-10-20'),
  // listed on the 21st although its first article was published on the 20th: the day is the archive day
  e('thread-a', '2026-10-20T22:00:00.000Z', 'A late', 'w1', '2026-10-21', 1),
  e('thread-b', '2026-10-21T04:00:00.000Z', 'B first in list', 'w2', '2026-10-21', 0, {iso3: ['DEU', 'FRA']}),
  e('thread-c', '2026-10-21T05:00:00.000Z', 'C merged into B', 'w3', '2026-10-21', 2),
  X.merged('thread-b', '2026-10-22T01:00:00.000Z', 'thread-c'),
  e('thread-a', '2026-10-22T06:00:00.000Z', 'A on the 22nd', 'w4', '2026-10-22', 0),
  e('thread-old', '2026-07-01T04:00:00.000Z', 'Out of the window', 'w5', '2026-07-01', 0),
  X.run('2026-10-22T07:00:00.000Z'),
];
const build = (f = facts(), today = '2026-10-22') => V.buildViews(f, {...opts, today});
const weekly = (f, today) => build(f, today).indexes['weekly.json'];

test('archiveRefOf reads the archive day and place in the day from the entry fact, null for any other key', () => {
  assert.deepEqual(IV.archiveRefOf(e('t', '2026-10-21T04:00:00.000Z', 'x', 'id', '2026-10-21', 7)), {day: '2026-10-21', index: 7});
  assert.equal(IV.archiveRefOf({sourceKey: 'k1', sourceRow: {}}), null);
});

test('days are archive days in the archive order, stories as placed now (a merged story under its survivor), only the fields the readers show', () => {
  const w = weekly();
  assert.deepEqual(Object.keys(w.days), ['2026-10-21', '2026-10-22']);
  assert.deepEqual([w.from, w.to], ['2026-09-23', '2026-10-22']);
  assert.deepEqual(w.days['2026-10-21'].entries.map((x) => [x.title, x.threadId]), [['B first in list', 'thread-b'], ['A late', 'thread-a'], ['C merged into B', 'thread-b']]);
  assert.deepEqual(w.days['2026-10-21'].entries[0], {topicId: 'B first in list-1', threadId: 'thread-b', title: 'B first in list', category: 'conflict', iso3: ['DEU', 'FRA'], sources: [{outlet: 'S1', url: 'https://s1.test/a'}, {outlet: 'S2', url: 'https://s2.test/a'}]});
  assert.equal(w.days['2026-10-21'].updatedAt, '2026-10-21T05:00:00.000Z'); // the newest entry time of the day
});

test('only the last 30 days are in it, and an entry without an archive key falls back to its fact date', () => {
  assert.deepEqual(weekly(facts(), '2026-11-25').days, {}); // window 2026-10-27 .. 2026-11-25: the fixture is older
  const noKey = weekly([X.born('thread-a', '2026-10-20T04:00:00.000Z', '2026-10-20'), X.entry('thread-a', '2026-10-20T04:00:00.000Z', 'No archive key', {id: 'k1'})]);
  assert.deepEqual(Object.keys(noKey.days), ['2026-10-20']);
});

test('the same facts in another order build the same index', () => {
  assert.equal(JSON.stringify(weekly(facts())), JSON.stringify(weekly([...facts()].reverse())));
});

test('the index is the story views: every entry of it is an entry of the story it names', () => {
  const v = build();
  for (const day of Object.values(v.indexes['weekly.json'].days)) {
    for (const x of day.entries) assert.ok(v.stories.get(x.threadId).entries.some((s) => s.title === x.title && s.topicId === x.topicId), x.title);
  }
});

test('an index over its cap fails the build instead of truncating', () => {
  const big = [X.born('thread-a', '2026-10-20T04:00:00.000Z', '2026-10-20'), e('thread-a', '2026-10-21T04:00:00.000Z', 'x', 'w1', '2026-10-21', 0, {sources: ['s'.repeat(IV.INDEX_MAX_BYTES)]})];
  assert.throws(() => build(big), /index\/weekly\.json is \d+ bytes, over the/);
});
