'use strict';
// The entries inbox (decision 0051): the agent appends the run's archived entries to <ENTRIES_INBOX_PREFIX>inbox/entries/DAY.jsonl, best-effort.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const I = require('../src/_shared/entriesInbox');

class Cmd { constructor(input) { this.input = input; } }
class Get extends Cmd {}
class Put extends Cmd {}
const err = (name, code) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: code } });

function harness({ prefix, failPut = false } = {}) {
  const objs = new Map();
  const calls = [];
  const real = createRequire(require.resolve('../src/index.js'));
  const s3 = {
    send: async (c) => {
      calls.push(c.constructor.name);
      if (c instanceof Get) {
        const o = objs.get(c.input.Key);
        if (!o) throw err('NoSuchKey', 404);
        return { Body: { transformToString: async () => o.body }, ETag: o.etag };
      }
      if (failPut) throw err('InternalError', 500);
      const o = objs.get(c.input.Key);
      if ((c.input.IfNoneMatch === '*' && o) || (c.input.IfMatch && (!o || o.etag !== c.input.IfMatch))) throw err('PreconditionFailed', 412);
      objs.set(c.input.Key, { body: c.input.Body, etag: `"e${objs.size}-${calls.length}"` });
      return {};
    },
  };
  const logs = [];
  const sdk = { S3Client: class { constructor() { return s3; } }, GetObjectCommand: Get, PutObjectCommand: Put };
  const context = {
    exports: {}, process: { env: prefix === undefined ? {} : { ENTRIES_INBOX_PREFIX: prefix } }, setTimeout, clearTimeout, Date,
    console: { log: (m) => logs.push(`log ${m}`), error: (m) => logs.push(`error ${m}`), warn: () => {}, info: () => {} },
    require: (n) => (n === '@aws-sdk/client-dynamodb' ? { DynamoDBClient: class {} } : n === '@aws-sdk/lib-dynamodb' ? { GetCommand: Cmd, PutCommand: Cmd, QueryCommand: Cmd, ScanCommand: Cmd, UpdateCommand: Cmd, BatchWriteCommand: Cmd, DynamoDBDocumentClient: { from: () => ({ send: async () => ({}) }) } } : n === '@aws-sdk/client-s3' ? sdk : real(n)),
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/index.js'), 'utf8'), context);
  return { write: context.exports._internal.writeEntriesInbox, objs, calls, logs };
}

const entry = (n, at, gen) => ({ topicId: `T${n}`, threadId: `thread-${n}`, title: `Title ${n}`, category: 'society', regions: [], search_keywords: [], iso3: ['FRA'], actors: [], event_type: 'other', sources: [{ source: 'bbc.com', url: `https://bbc.com/${n}` }], archivedAt: at, generationId: gen, ai: { summary: 'x'.repeat(1600) } });
const staging = { model: 'deepseek-v4-pro', limit: 13, updatedAt: '2026-10-31T04:16:09.805Z', generatedDate: 'October 31, 2026', generatedYear: 2026, topics: [{ id: 'T1', title: 'a', urgency: 'high', x_trending: true, primaryCountry: 'France', significance: 'high', sources: [] }, { id: 'T2', title: 'b', urgency: 'low', x_trending: false, primaryCountry: 'Peru' }] };
const archived = { dailyEntries: [entry(1, '2026-10-31T04:26:16.684Z', 'gen-1'), entry(2, '2026-10-31T04:26:16.685Z', 'gen-1')], archiveDate: '2026-10-31', batch: '2026-10-31T04:26:16.042Z' };
const KEY = 'record/shadow/inbox/entries/2026-10-31.jsonl';
const lines = (h) => h.objs.get(KEY).body.trim().split('\n').map((l) => JSON.parse(l));

test('with the prefix unset nothing is written and S3 is not touched', async () => {
  const h = harness();
  await h.write(archived, staging, 'gen-1');
  assert.deepEqual([h.calls.length, h.objs.size], [0, 0]);
});

test('one line per archived entry, as the daily row stores it, with the latest-only fields and the run', async () => {
  const h = harness({ prefix: 'record/shadow/' });
  await h.write(archived, staging, 'gen-1');
  const l = lines(h);
  assert.equal(l.length, 2);
  assert.deepEqual(l.map((x) => [x.inboxId, x.batch, x.n, x.topicId, x.threadId]), [['2026-10-31T04:26:16.042Z|0', archived.batch, 0, 'T1', 'thread-1'], ['2026-10-31T04:26:16.042Z|1', archived.batch, 1, 'T2', 'thread-2']]);
  assert.deepEqual(l[0].latest, { urgency: 'high', significance: 'high', x_trending: true, primaryCountry: 'France' });
  assert.deepEqual(l[0].run, { of: 2, model: 'deepseek-v4-pro', limit: 13, updatedAt: staging.updatedAt, generatedDate: 'October 31, 2026', generatedYear: 2026, generationId: 'gen-1' });
  assert.equal(l[0].ai.summary.length, 1503, 'the ai text is cut as in the archive row');
  assert.match(h.logs.join('\n'), /\[inbox\] entries: 2 lines, 2 appended, 0 already stored \(record\/shadow\/\)/);
  assert.equal(I.latestSelection(l).topicIds.join(), 'T1,T2');
});

test('a retried write adds nothing, and the file replays to the daily row', async () => {
  const h = harness({ prefix: 'record/shadow/' });
  await h.write(archived, staging, 'gen-1');
  await h.write(archived, staging, 'gen-1');
  assert.equal(lines(h).length, 2);
  assert.match(h.logs.at(-1), /0 appended, 2 already stored/);
  const second = { dailyEntries: [entry(1, '2026-10-31T12:26:16.684Z', 'gen-2'), entry(3, '2026-10-31T12:26:16.685Z', 'gen-2')], archiveDate: '2026-10-31', batch: '2026-10-31T12:26:16.042Z' };
  await h.write(second, { ...staging, topics: [staging.topics[0], { id: 'T3', title: 'c' }] }, 'gen-2');
  const row = I.mergeArchiveDay(I.mergeArchiveDay([], archived.dailyEntries), second.dailyEntries);
  assert.deepEqual(I.replayDay(lines(h)).entries, row);
  assert.deepEqual(row.map((e) => e.topicId), ['T2', 'T1', 'T3']);
});

test('a failing S3 never fails the run: logged as [inbox], nothing thrown', async () => {
  const h = harness({ prefix: 'record/', failPut: true });
  await h.write(archived, staging, 'gen-1');
  assert.match(h.logs.join('\n'), /error \[inbox\] entries not written/);
});

test('a manual single-topic run writes its one line, which is not a selection (run.of is the staging item\'s count)', async () => {
  const h = harness({ prefix: 'record/shadow/' });
  await h.write({ ...archived, dailyEntries: [archived.dailyEntries[0]], batch: '2026-10-31T13:00:00.000Z' }, staging, 'gen-1');
  assert.equal(I.latestSelection(lines(h)), null);
});
