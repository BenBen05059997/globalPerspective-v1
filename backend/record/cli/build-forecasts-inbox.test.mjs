import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inboxFromRows, writeInbox, localLines, prove } from './build-forecasts-inbox.mjs';

const require = createRequire(import.meta.url);
const world = require('../../shared/src/world');
const { readForecastDays, snapshotsOfDays } = require('../newsStoryRecord/src/inboxForecasts.js');

const pred = (topic, day, hour, extra = {}) => ({
  PK: `PRED#${topic}`, SK: day, topicId: topic, title: topic, generatedAt: `${day}T${hour}:00:00.000Z`, questionSchema: 1, threadId: 'thread-a',
  scenarios: [{ label: 'L', probability: 0.5, triggers: [{ id: '0-0', text: 'X', deadline: '2026-11-30', p: 40, question: true, qid: `q-${topic}` }] }], ...extra,
});
const rows = [
  pred('T-1', '2026-10-09', '04'),
  pred('T-2', '2026-10-10', '12', { threadId: 'thread-final', drawnThreadId: 'thread-a' }), // moved by the reconcile
  pred('T-3', '2026-10-10', '04', { threadId: 'thread-final', drawnThreadId: 'none' }), // had no thread when drawn
  pred('T-4', '2026-10-10', '20', { threadId: undefined }),
];
const entriesByDay = new Map([['2026-10-10', [{ topicId: 'T-4', threadId: 'thread-e', iso3: ['FRA'], actors: ['Macron'], sources: [] }]]]);
const threadOfTopic = new Map([['T-4', 'thread-e']]);
const days = ['2026-10-09', '2026-10-10'];

test('inboxFromRows: a moved row is a drawn line (the thread it was drawn under) and a later thread line; the replay is the log\'s row', () => {
  const map = inboxFromRows(rows);
  const lines = map.get('2026-10-10');
  assert.deepEqual(lines.map((l) => [l.type, l.row ? l.row.topicId : l.PK.slice(5)]), [['drawn', 'T-3'], ['drawn', 'T-2'], ['drawn', 'T-4'], ['thread', 'T-3'], ['thread', 'T-2']]);
  assert.equal(lines[0].row.threadId, undefined);
  assert.equal(lines[1].row.threadId, 'thread-a');
  const F = require('../../shared/src/forecastsInbox.js');
  const byTopic = Object.fromEntries(F.replay(lines).rows.map((r) => [r.topicId, r]));
  assert.deepEqual([byTopic['T-2'].threadId, byTopic['T-2'].drawnThreadId, byTopic['T-3'].threadId, byTopic['T-3'].drawnThreadId], ['thread-final', 'thread-a', 'thread-final', 'none']);
});

test('prove: the facts built from the inbox files are byte-identical to the facts built from the log rows', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'finbox-'));
  try {
    writeInbox(dir, inboxFromRows(rows));
    assert.equal(readFileSync(path.join(dir, 'record/inbox/forecasts/2026-10-10.jsonl'), 'utf8').trim().split('\n').length, 5);
    const read = snapshotsOfDays(await readForecastDays(localLines(dir), 'record/', '2026-10-08', '2026-10-11'), { from: '2026-10-08', to: '2026-10-11' });
    const log = world.snapshotsOfRows(rows, { from: '2026-10-08', to: '2026-10-11' });
    const proof = prove({ log, fromInbox: read.snapshots, days, entriesByDay, threadOfTopic });
    assert.deepEqual([proof.identical, proof.snapshots, proof.snapshotsDiffering, proof.mismatched, read.orphans], [true, 4, 0, [], 0]);
    assert.ok(proof.factsCompared >= 4 && proof.factBytesCompared > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prove: a forecast missing from the inbox and a changed thread are told apart', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'finbox-'));
  try {
    const map = inboxFromRows(rows);
    map.set('2026-10-10', map.get('2026-10-10').filter((l) => !(l.type === 'drawn' && l.row.topicId === 'T-4')).map((l) => (l.type === 'thread' && l.PK === 'PRED#T-2' ? { ...l, threadId: 'thread-x' } : l)));
    writeInbox(dir, map);
    const read = snapshotsOfDays(await readForecastDays(localLines(dir), 'record/', '2026-10-08', '2026-10-11'), { from: '2026-10-08', to: '2026-10-11' });
    const log = world.snapshotsOfRows(rows, { from: '2026-10-08', to: '2026-10-11' });
    const proof = prove({ log, fromInbox: read.snapshots, days, entriesByDay, threadOfTopic });
    assert.equal(proof.identical, false);
    assert.deepEqual(proof.differences.map((d) => [d.sourceKey, d.only || d.fields.join()]).sort(), [['PRED#T-2|2026-10-10', 'threadId'], ['PRED#T-4|2026-10-10', 'log']]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
