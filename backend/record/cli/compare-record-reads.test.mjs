import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tally, byPath, simulateInbox } from './compare-record-reads.mjs';

const require = createRequire(import.meta.url);
const R = require('../../shared/src/recordReads.js');
const { todayIndex } = require('../newsStoryRecord/src/todayView.js');

const src = (n) => ({ source: `s${n}.com`, url: `https://s${n}.com/a` });
const entry = (n, at, gen, sources = [src(1)]) => ({ topicId: `Topic ${n}-${n}`, threadId: `thread-${n}`, title: `Title ${n}`, category: 'conflict', regions: ['France'], sources, archivedAt: at, generationId: gen, ai: { summary: `s${n}` } });

test('tally counts equal and differing results and folds array indexes into one path', () => {
  const t = tally([[], [{ path: '.a[0].b' }, { path: '.a[1].b' }], [{ path: '.c' }]]);
  assert.deepEqual([t.equal, t.differ], [1, 2]);
  assert.deepEqual(t.paths, { '.a[].b': 2, '.c': 1 });
});

test('byPath keeps the first example of each path', () => {
  const out = byPath([{ path: '.e[0].x', a: '1', b: '2' }, { path: '.e[1].x', a: '3', b: '4' }]);
  assert.deepEqual(out, { '.e[].x': { n: 2, example: { a: '1', b: '2' } } });
});

test('simulateInbox: the last run is ordered as `latest` orders it, carries the latest-only fields and every source of the topic', () => {
  const twelve = [...Array(12).keys()].map(src);
  const latest = {
    model: 'm', limit: 13, updatedAt: '2026-10-31T04:16:00.000Z', generatedDate: 'October 31, 2026', generatedYear: 2026, generationId: 'g2',
    topics: [{ topicId: 'Topic 2-2', urgency: 'high', sources: twelve.slice(0, 1) }, { topicId: 'Topic 1-1', urgency: 'low', sources: twelve }],
  };
  const rows = [
    { day: '2026-10-30', entries: [entry(3, '2026-10-30T20:00:01.000Z', 'g1')] },
    { day: '2026-10-31', entries: [entry(1, '2026-10-31T04:00:01.000Z', 'g2', twelve.slice(0, 10)), entry(2, '2026-10-31T04:00:02.000Z', 'g2')] },
  ];
  const days = simulateInbox(rows, latest);
  const view = todayIndex(days, new Map(), {});
  assert.deepEqual(view.latest.topicIds, ['Topic 2-2', 'Topic 1-1']);
  assert.equal(view.entries.find((e) => e.topicId === 'Topic 3-3').latest, undefined, 'an older run has no latest fields');
  const item = R.latestItemOfView(view);
  assert.deepEqual(item.topics.map((t) => [t.topicId, t.urgency]), [['Topic 2-2', 'high'], ['Topic 1-1', 'low']]);
  assert.equal(item.topics[1].sources.length, 12);
});
