'use strict';
// The forecasts inbox line format and replay rule (decision 0052).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/forecastsInbox');
const world = require('../src/world');

const row = (topic, day, extra = {}) => ({ PK: `PRED#${topic}`, SK: day, topicId: topic, title: topic, threadId: 'thread-a', generatedAt: `${day}T04:00:00.000Z`, questionSchema: 1, scenarios: [{ label: 'L', probability: 0.5, triggers: [{ id: '0-0', text: 't', deadline: '2026-11-20', p: 40, question: true, qid: `q-${topic}` }] }], ...extra });

test('a drawn line carries the row as put and an append key; a row without a day SK is refused', () => {
  const r = row('T-1', '2026-10-20', { gone: undefined });
  const l = F.drawnLine(r);
  assert.deepEqual([l.type, l.inboxId, l.day], ['drawn', 'PRED#T-1|2026-10-20|drawn', '2026-10-20']);
  assert.deepEqual(l.row, JSON.parse(JSON.stringify(r)));
  assert.equal('gone' in l.row, false, 'undefined fields are dropped as DynamoDB drops them');
  assert.throws(() => F.drawnLine({ PK: 'PRED#x', SK: 'latest' }), /day SK/);
});

test('replay: the first drawn line is the row, a thread line moves it (last wins) and keeps the first drawnThreadId', () => {
  const a = row('T-1', '2026-10-20');
  const lines = [
    F.drawnLine(a), F.drawnLine(row('T-2', '2026-10-20', { threadId: undefined })),
    F.drawnLine(row('T-1', '2026-10-20', { threadId: 'thread-OTHER' })), // a duplicate key: the first stands
    F.threadLine({ PK: a.PK, SK: a.SK, threadId: 'thread-b', was: 'thread-a', at: '2026-10-20T04:30:00.000Z' }),
    F.threadLine({ PK: a.PK, SK: a.SK, threadId: 'thread-c', was: 'thread-b', at: '2026-10-20T12:30:00.000Z' }),
    F.threadLine({ PK: 'PRED#T-2', SK: '2026-10-20', threadId: 'thread-z', was: undefined, at: '2026-10-20T04:30:00.000Z' }),
    F.threadLine({ PK: 'PRED#nope', SK: '2026-10-20', threadId: 'thread-q', was: 'x', at: '2026-10-20T04:30:00.000Z' }),
  ];
  const { rows, orphans } = F.replay(lines);
  assert.equal(orphans, 1);
  assert.deepEqual(rows.map((r) => [r.topicId, r.threadId, r.drawnThreadId]), [['T-1', 'thread-c', 'thread-a'], ['T-2', 'thread-z', 'none']]);
});

test('the replayed rows give the snapshots scenarios() gives for the same rows (provenance included)', () => {
  const rows = [row('T-1', '2026-10-20'), row('T-2', '2026-10-21', { drawnThreadId: 'thread-x' })];
  const lines = [F.drawnLine(rows[0]), F.drawnLine({ ...rows[1], threadId: 'thread-x', drawnThreadId: undefined }), F.threadLine({ PK: rows[1].PK, SK: rows[1].SK, threadId: 'thread-a', was: 'thread-x', at: '2026-10-21T05:00:00.000Z' })];
  const viaInbox = world.snapshotsOfRows(F.replay(lines).rows, { from: '2026-10-01', to: '2026-10-31' });
  const viaTable = world.snapshotsOfRows(rows, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(JSON.stringify(viaInbox), JSON.stringify(viaTable));
  assert.deepEqual(viaInbox.map((s) => s.sourceKey), ['PRED#T-1|2026-10-20', 'PRED#T-2|2026-10-21']);
});
