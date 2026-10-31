'use strict';
// forecasts/{threadId}.json (decision 0052): the forks of a story that has drawn a question, in a file of their own.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/views');
const X = require('./views-fixture');

const build = (facts) => V.buildViews(facts, {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1});

test('a story that has drawn a question gets its forks (as its story view lists them); a story without one gets no file', () => {
  const v = build(X.golden());
  assert.deepEqual([...v.forecasts.keys()], ['thread-a', 'thread-c'], 'thread-c drew a question and was merged away: empty');
  assert.deepEqual(v.forecasts.get('thread-c').forks, []);
  const f = v.forecasts.get('thread-a');
  assert.deepEqual([f.schemaVersion, f.threadId, f.builtFrom], [1, 'thread-a', v.stories.get('thread-a').builtFrom]);
  assert.equal(JSON.stringify(f.forks), JSON.stringify(v.stories.get('thread-a').forks));
  assert.ok(f.forks[0].branches.every((b) => 'scoring' in b && 'state' in b), 'scoring and state ride along, as in the story view');
});

test('a story merged into another is written empty, so a file from before the merge does not outlive it; the survivor keeps only its own forks', () => {
  const facts = [
    X.entry('thread-x', '2026-10-18T04:00:00.000Z', 'X one', {id: 'ex1'}), X.entry('thread-y', '2026-10-18T05:00:00.000Z', 'Y one', {id: 'ey1'}),
    X.forecast('thread-x', '2026-10-19T05:00:00.000Z', 'PRED#X/2026-10-19', [X.branch('x-0', '2026-11-25')]),
    X.forecast('thread-y', '2026-10-19T06:00:00.000Z', 'PRED#Y/2026-10-19', [X.branch('y-0', '2026-11-26')]),
    X.merged('thread-y', '2026-10-21T04:00:00.000Z', 'thread-x'),
  ];
  const v = build(facts);
  assert.deepEqual([v.forecasts.get('thread-x').forks.length, v.forecasts.get('thread-y').forks.map((k) => k.forkId)], [0, ['PRED#Y/2026-10-19']]);
});

test('the view is written with the stories, before the indexes and the manifest', () => {
  const keys = V.writeGroups(build(X.golden())).flat().map(([k]) => k);
  assert.ok(keys.includes('forecasts/thread-a.json') && keys.indexOf('forecasts/thread-a.json') < keys.indexOf('index/active.json'));
});
