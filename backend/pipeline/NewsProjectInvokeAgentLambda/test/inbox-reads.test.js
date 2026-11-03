'use strict';
// The threading window, the freshness gate and the thread forks read from the inboxes (ARCHIVE_READS / FORKS_READS, decision 0035 step 5d):
// a fixture world is written by the agent's own code (archive rows, entries inbox, PRED# rows, thread pointers, reconciles, forecasts inbox),
// then read back with each switch value. inbox must answer what ddb answers, with no DynamoDB call for those families; compare answers ddb.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const threading = require('../src/threading');
const draw = require('../src/forecast-draw');
const { staleReason, lastArchiveWrite } = require('../src/run-guard');
const reads = require('../src/inbox-reads');
const F = require('../src/_shared/forecastsInbox');

class Cmd { constructor(input) { this.input = input; } }
class Get extends Cmd {}
class Put extends Cmd {}
const D = Object.fromEntries(['GetCommand', 'PutCommand', 'UpdateCommand', 'QueryCommand', 'ScanCommand', 'BatchWriteCommand', 'BatchGetCommand'].map((k) => [k, class extends Cmd { get kind() { return k; } }]));
const err = (name, code) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: code } });
const clone = (x) => (x === undefined ? undefined : structuredClone(x));

// One world (DynamoDB tables, the S3 bucket, a clock) shared by every agent instance loaded on it.
function world() {
  const w = { nowMs: 0, tables: new Map(), objs: new Map(), calls: [] };
  const table = (n) => w.tables.get(n) || w.tables.set(n, new Map()).get(n);
  const keyOf = (k) => (k.id !== undefined ? k.id : `${k.PK}|${k.SK}`);
  w.ddb = {
    send: async (c) => {
      w.calls.push({ kind: c.kind, table: c.input.TableName, key: c.input.Key ? keyOf(c.input.Key) : c.input.ExpressionAttributeValues && c.input.ExpressionAttributeValues[':pk'] });
      const t = table(c.input.TableName);
      if (c.kind === 'GetCommand') return { Item: clone(t.get(keyOf(c.input.Key))) };
      if (c.kind === 'PutCommand') {
        const k = keyOf(c.input.Item);
        if (c.input.ConditionExpression && t.has(k)) throw err('ConditionalCheckFailedException', 400);
        t.set(k, clone(c.input.Item));
        return {};
      }
      if (c.kind === 'UpdateCommand') {
        const k = keyOf(c.input.Key);
        const v = c.input.ExpressionAttributeValues;
        if (String(c.input.Key.PK).startsWith('THREAD#')) { // lib.threadPointerUpdate: SET ... ADD topicIds
          const row = t.get(k) || { ...c.input.Key };
          Object.assign(row, { threadId: v[':th'], topicId: v[':t'], title: v[':ti'], generationId: v[':g'], updatedAt: v[':n'] });
          row.topicIds = new Set([...(row.topicIds || []), ...v[':ids']]);
          t.set(k, row);
        } else { // lib.predThreadFix
          const row = t.get(k);
          row.threadId = v[':t'];
          if (row.drawnThreadId === undefined) row.drawnThreadId = v[':old'];
        }
        return {};
      }
      if (c.kind === 'QueryCommand') {
        const v = c.input.ExpressionAttributeValues;
        const fields = c.input.ProjectionExpression.split(',').map((s) => s.trim());
        const items = [...t.values()].filter((r) => r.PK === v[':pk'] && r.SK >= v[':from']).sort((a, b) => (a.SK < b.SK ? -1 : 1))
          .map((r) => Object.fromEntries(fields.filter((f) => r[f] !== undefined).map((f) => [f, clone(r[f])])));
        return { Items: items };
      }
      return {};
    },
  };
  w.s3 = {
    send: async (c) => {
      w.calls.push({ kind: c.constructor.name, key: c.input.Key });
      if (c instanceof Get) {
        const o = w.objs.get(c.input.Key);
        if (!o) throw err('NoSuchKey', 404);
        return { Body: { transformToString: async () => o.body }, ETag: o.etag };
      }
      const o = w.objs.get(c.input.Key);
      if ((c.input.IfNoneMatch === '*' && o) || (c.input.IfMatch && (!o || o.etag !== c.input.IfMatch))) throw err('PreconditionFailed', 412);
      w.objs.set(c.input.Key, { body: c.input.Body, etag: `"e${w.calls.length}"` });
      return {};
    },
  };
  return w;
}

// An agent instance on the world: env ARCHIVE_READS / FORKS_READS as given, both inbox prefixes record/.
function agent(w, { archive = 'ddb', forks = 'ddb' } = {}) {
  const logs = [];
  const real = createRequire(require.resolve('../src/index.js'));
  class Clock extends Date { constructor(...a) { super(...(a.length ? a : [w.nowMs])); } static now() { return w.nowMs; } }
  const sdk = { S3Client: class { constructor() { return w.s3; } }, GetObjectCommand: Get, PutObjectCommand: Put };
  const env = { TOPICS_DDB_TABLE: 'NewsCache', SUMMARIZE_PREDICT_TABLE: 'SummarizeAndPredict', ENTRIES_INBOX_PREFIX: 'record/', FORECASTS_INBOX_PREFIX: 'record/', ARCHIVE_READS: archive, FORKS_READS: forks };
  const context = {
    exports: {}, process: { env }, setTimeout, clearTimeout, Date: Clock,
    console: Object.fromEntries(['log', 'warn', 'error', 'info'].map((k) => [k, (...a) => logs.push(`${k} ${a.join(' ')}`)])),
    require: (n) => (n === '@aws-sdk/client-dynamodb' ? { DynamoDBClient: class {} } : n === '@aws-sdk/lib-dynamodb' ? { ...D, DynamoDBDocumentClient: { from: () => w.ddb } } : n === '@aws-sdk/client-s3' ? sdk : real(n)),
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/index.js'), 'utf8'), context);
  // answers cross the vm boundary as plain data (the context has its own Array / Object prototypes)
  const plain = (x) => (x === undefined || x === null || typeof x !== 'object' ? x : JSON.parse(JSON.stringify(x)));
  const fns = Object.fromEntries(Object.entries(context.exports._internal).map(([k, f]) => [k, async (...a) => plain(await f(...a))]));
  return { ...fns, logs };
}

const topic = (id, title, extra = {}) => ({ id, title, categories: ['economy'], regions: ['Germany'], search_keywords: title.toLowerCase().split(' '), iso3: ['DEU'], actors: [], event_type: 'other', sources: [{ source: 'reuters.com', url: `https://reuters.com/${encodeURIComponent(id)}` }], ...extra });
const content = JSON.stringify({ scenarios: [{ scenario: 'Likely', triggers: [] }] });

// One agent run as the handler does it, by the ddb instance: window -> joinRun -> forecasts (PRED# put, line queued) -> archive -> entries
// inbox -> thread pointers -> reconcile -> forecasts flush. `drawn` = topic ids that get a forecast; `drawThread` = the thread the forecaster
// saw (a later reconcile moves it to the archive's).
async function run(w, a, at, topics, { drawn = [], drawThread = {} } = {}) {
  w.nowMs = Date.parse(at);
  const gen = `gen-${w.nowMs - 600000}`;
  const past = await a.readPastArchiveEntries(7);
  const threadIdById = {};
  for (const r of threading.joinRun(topics, past)) threadIdById[r.topicId] = r.threadId;
  for (const id of drawn) await a.logPredictionSnapshot(topics.find((t) => t.id === id), content, { modelId: 'fake' }, gen, 2026, { threadIdById: { [id]: drawThread[id] || threadIdById[id] }, forks: [] });
  const archived = await a.buildAndWriteArchive(topics, gen, threadIdById);
  await a.writeEntriesInbox(archived, { topics }, gen);
  await a.writeThreadPointers(topics, threadIdById, gen);
  await a.reconcilePredictionThreads(topics, threadIdById, at.slice(0, 10));
  await a.flushForecastsInbox();
  return threadIdById;
}

// A forecast row as the agent puts it (with triggers, for the near-duplicate gate), its drawn line and its topic in the thread pointer (what
// that run's writeThreadPointers adds), written straight to the stores.
async function seedRow(w, row) {
  w.tables.get('GlobalPerspectivePredictionLog').set(`${row.PK}|${row.SK}`, clone(row));
  const pointer = w.tables.get('SummarizeAndPredict').get(`THREAD#${row.threadId}|TOPICS`);
  pointer.topicIds = new Set([...pointer.topicIds, row.topicId]);
  const key = `record/inbox/forecasts/${row.SK}.jsonl`;
  const o = w.objs.get(key);
  w.objs.set(key, { body: `${o ? o.body : ''}${JSON.stringify(F.drawnLine(row))}\n`, etag: `"s${Math.random()}"` });
}

const PORT = 'Hamburg port strike widens';
async function fixture() {
  const w = world();
  const a = agent(w);
  w.tables.set('GlobalPerspectivePredictionLog', new Map());
  const r1 = await run(w, a, '2026-10-30T04:25:00.000Z', [topic('port-0', PORT), topic('peru-1', 'Peru election runoff set')], { drawn: ['port-0'] });
  // a row of the port thread drawn 10 days before the read, with an open branch (deadline after today)
  await seedRow(w, { PK: 'PRED#port-old', SK: '2026-10-22', topicId: 'port-old', threadId: r1['port-0'], scenarios: [{ label: 'x', triggers: [{ text: 'Hamburg dockworkers sign a new wage deal', deadline: '2026-12-01' }] }] });
  // next day: the story continues under a new topic id; Peru's forecast was drawn under a thread the archive then replaces (a reconcile)
  await run(w, a, '2026-10-31T12:25:00.000Z', [topic('port-2', 'Hamburg port strike spreads to Bremen', { continues_topic: PORT }), topic('peru-0', 'Peru election runoff set')], { drawn: ['peru-0'], drawThread: { 'peru-0': 'thread-drawn-elsewhere' } });
  // today, an earlier run: same-day lines and rows the next run must see
  await run(w, a, '2026-11-01T04:25:00.000Z', [topic('port-0', 'Hamburg port strike spreads to Bremen'), topic('chile-1', 'Chile copper mine flooded')], { drawn: ['chile-1'] });
  w.nowMs = Date.parse('2026-11-01T12:25:00.000Z'); // the run that reads
  return { w, writer: a, threads: r1 };
}

const familyCalls = (w) => w.calls.filter((c) => (c.table === 'NewsCache' && /^(archive#|today-archive)/.test(c.key)) || (c.table === 'SummarizeAndPredict' && /^THREAD#/.test(c.key)) || c.table === 'GlobalPerspectivePredictionLog');

test('readMode: ddb by default, unknown values and a missing inbox prefix fall back to ddb', () => {
  const log = { warn: () => {} };
  assert.equal(reads.readMode('ARCHIVE_READS', undefined, 'record/', log), 'ddb');
  assert.equal(reads.readMode('ARCHIVE_READS', ' Inbox ', 'record/', log), 'inbox');
  assert.equal(reads.readMode('ARCHIVE_READS', 'compare', 'record/', log), 'compare');
  assert.equal(reads.readMode('ARCHIVE_READS', 'record', 'record/', log), 'ddb');
  assert.equal(reads.readMode('FORKS_READS', 'inbox', '', log), 'ddb');
});

test('the threading window from the inbox equals the archive rows, today\'s earlier run included, and assigns the same threads', async () => {
  const { w } = await fixture();
  const ddb = await agent(w).readPastArchiveEntries(7);
  const inbox = await agent(w, { archive: 'inbox' }).readPastArchiveEntries(7);
  assert.deepEqual(inbox, ddb);
  assert.deepEqual([...new Set(ddb.map((e) => e.date))], ['2026-11-01', '2026-10-31', '2026-10-30'], 'newest day first');
  assert.deepEqual(ddb.filter((e) => e.date === '2026-11-01').map((e) => e.topicId), ['chile-1', 'port-0'], 'today\'s earlier run, newest first');
  const next = [topic('port-1', 'Hamburg port strike spreads to Bremen'), topic('chile-0', 'Chile copper mine flooded'), topic('new-2', 'Iceland volcano erupts')];
  assert.deepEqual(threading.joinRun(next, inbox), threading.joinRun(next, ddb));
  assert.equal(threading.joinRun(next, inbox)[0].threadId, ddb.find((e) => e.topicId === 'port-0').threadId, 'the story keeps its thread');
});

test('the freshness gate reads the same last write from the inbox, before and after a run of the day', async () => {
  const { w } = await fixture();
  const [ddb, inbox] = [await agent(w).readFreshnessArchives(), await agent(w, { archive: 'inbox' }).readFreshnessArchives()];
  assert.equal(lastArchiveWrite(inbox), lastArchiveWrite(ddb));
  assert.equal(lastArchiveWrite(ddb), Date.parse('2026-11-01T04:25:00.000Z'), 'the earlier run of the day');
  const staging = (at) => ({ id: 'staging', generationId: `gen-${Date.parse(at)}` });
  for (const at of ['2026-11-01T04:15:00.000Z', '2026-11-01T12:15:00.000Z']) {
    assert.equal(staleReason(staging(at), inbox, new Date(w.nowMs)), staleReason(staging(at), ddb, new Date(w.nowMs)));
  }
  assert.equal(staleReason(staging('2026-11-01T04:15:00.000Z'), inbox, new Date(w.nowMs)), 'generation-already-archived');
  assert.deepEqual(reads.diffFreshness(ddb, inbox), []);
});

test('the thread forks from the inbox equal the PRED# rows the pointer reaches, a reconciled row and an old open branch included', async () => {
  const { w, threads } = await fixture();
  const today = '2026-11-01';
  const [ddbA, inboxA] = [agent(w), agent(w, { forks: 'inbox' })];
  const port = threads['port-0'];
  const peruThread = w.tables.get('NewsCache').get('archive#2026-10-31').entries.find((e) => e.topicId === 'peru-0').threadId;
  for (const [t, thread] of [[topic('port-9', 'x'), port], [topic('peru-0', 'x'), peruThread], [topic('peru-0', 'x'), 'thread-drawn-elsewhere'], [topic('chile-1', 'x'), undefined], [topic('none-1', 'x'), 'thread-none']]) {
    const ddb = await ddbA.readThreadForks(t, thread, today);
    const inbox = await inboxA.readThreadForks(t, thread, today, {});
    assert.deepEqual(inbox, reads.forkRows(ddb.map((r) => ({ ...r, threadId: thread })), { topicId: t.id, threadId: thread, from: '2026-08-03' }), `${t.id} ${thread}`);
    assert.deepEqual(reads.diffForks(today)(ddb, inbox), []);
  }
  const portRows = await inboxA.readThreadForks(topic('port-9', 'x'), port, today, {});
  assert.deepEqual(portRows.map((r) => `${r.PK}|${r.SK}`), ['PRED#port-0|2026-10-30', 'PRED#port-old|2026-10-22']);
  const peru = await inboxA.readThreadForks(topic('peru-x', 'x'), peruThread, today, {});
  assert.deepEqual(peru.map((r) => r.PK), ['PRED#peru-0'], 'the row drawn under another thread follows its reconcile line');
  assert.equal(w.tables.get('GlobalPerspectivePredictionLog').get('PRED#peru-0|2026-10-31').drawnThreadId, 'thread-drawn-elsewhere');
});

test('the cadence and near-duplicate gates decide the same from either source', async () => {
  const { w, threads } = await fixture();
  const today = '2026-11-01';
  const moved = { reuse: false, reason: 'sources-changed' };
  const decide = (forks) => draw.drawDecision({ decision: moved, existing: null, lastForkDay: draw.latestForkDay(forks), today });
  const port = threads['port-0'];
  const [ddb, inbox] = [await agent(w).readThreadForks(topic('port-9', 'x'), port, today), await agent(w, { forks: 'inbox' }).readThreadForks(topic('port-9', 'x'), port, today, {})];
  assert.deepEqual(decide(inbox), decide(ddb));
  assert.equal(decide(inbox).reason, 'fork-within-7d', 'the port thread forked on 2026-10-30');
  assert.deepEqual(draw.openBranchTexts(inbox, today), draw.openBranchTexts(ddb, today));
  assert.deepEqual(draw.openBranchTexts(inbox, today), ['Hamburg dockworkers sign a new wage deal']);
  // ten days later the 2026-10-30 fork no longer blocks a draw, from either source
  const later = '2026-11-09';
  w.nowMs = Date.parse(`${later}T04:25:00.000Z`);
  const [d2, i2] = [await agent(w).readThreadForks(topic('port-9', 'x'), port, later), await agent(w, { forks: 'inbox' }).readThreadForks(topic('port-9', 'x'), port, later, {})];
  const at = (forks) => draw.drawDecision({ decision: moved, existing: null, lastForkDay: draw.latestForkDay(forks), today: later });
  assert.deepEqual(at(i2), at(d2));
  assert.equal(at(i2).draw, true);
});

test('a forecast drawn earlier in the same run (in DynamoDB, its line still queued) is in the inbox forks too', async () => {
  const { w, threads } = await fixture();
  const today = '2026-11-01';
  const port = threads['port-0'];
  const inboxA = agent(w, { forks: 'inbox' });
  const ctx = { reads: {} };
  w.calls.length = 0;
  const before = await inboxA.readThreadForks(topic('port-7', 'x'), port, today, ctx);
  // port-0 (on the pointer) draws today: DynamoDB has the row at once, the inbox line waits for the end of the run
  await inboxA.logPredictionSnapshot(topic('port-0', 'Hamburg port strike spreads to Bremen'), content, { modelId: 'fake' }, 'gen-x', 2026, { threadIdById: { 'port-0': port }, forks: [] });
  assert.ok(!w.objs.get('record/inbox/forecasts/2026-11-01.jsonl').body.includes('PRED#port-0|2026-11-01'), 'not flushed yet');
  const ddb = await agent(w).readThreadForks(topic('port-7', 'x'), port, today);
  const after = await inboxA.readThreadForks(topic('port-7', 'x'), port, today, ctx);
  assert.deepEqual(reads.diffForks(today)(ddb, after), []);
  assert.deepEqual(after.map((r) => `${r.PK}|${r.SK}`), [...before.map((r) => `${r.PK}|${r.SK}`), 'PRED#port-0|2026-11-01'].sort());
  assert.equal(draw.drawDecision({ decision: { reuse: false, reason: 'x' }, existing: null, lastForkDay: draw.latestForkDay(after), today }).reason, 'fork-within-7d');
  assert.equal(w.calls.filter((c) => c.kind === 'Get' && /inbox\/forecasts/.test(c.key)).length, 91, 'the 91 day files are read once per run (ctx.reads)');
  // a topic id new to the thread in this run is on the pointer only after the run: DynamoDB misses its row until then, the inbox does not
  await inboxA.logPredictionSnapshot(topic('port-5', 'Hamburg port strike spreads to Bremen'), content, { modelId: 'fake' }, 'gen-x', 2026, { threadIdById: { 'port-5': port }, forks: [] });
  const ddb5 = await agent(w).readThreadForks(topic('port-7', 'x'), port, today);
  const inbox5 = await inboxA.readThreadForks(topic('port-7', 'x'), port, today, ctx);
  assert.deepEqual(reads.diffForks(today)(ddb5, inbox5), [{ row: 'PRED#port-5|2026-11-01', only: 'inbox' }]);
});

test('inbox mode makes no DynamoDB call for the archive rows, the thread pointer or the PRED# rows', async () => {
  const { w, threads } = await fixture();
  const a = agent(w, { archive: 'inbox', forks: 'inbox' });
  w.calls.length = 0;
  await a.readPastArchiveEntries(7);
  await a.readFreshnessArchives();
  await a.readThreadForks(topic('port-9', 'x'), threads['port-0'], '2026-11-01', {});
  assert.deepEqual(familyCalls(w), []);
  assert.ok(w.calls.some((c) => c.kind === 'Get' && c.key === 'record/inbox/entries/2026-11-01.jsonl'));
  w.calls.length = 0;
  await agent(w).readPastArchiveEntries(7);
  assert.equal(familyCalls(w).length, 8, 'ddb mode: one archive row per day');
});

test('compare answers from DynamoDB and logs each difference as [archive-compare] / [forks-compare]', async () => {
  const { w, threads } = await fixture();
  const today = '2026-11-01';
  // the archive row of today has an entry the inbox never got (an inbox append that failed), and a PRED# row has no line
  w.tables.get('NewsCache').get('archive#2026-11-01').entries.push({ topicId: 'lost-3', threadId: 'thread-lost', title: 'Lost', archivedAt: '2026-11-01T04:30:00.000Z', generationId: 'gen-lost' });
  w.tables.get('GlobalPerspectivePredictionLog').set('PRED#port-9|2026-10-29', { PK: 'PRED#port-9', SK: '2026-10-29', threadId: threads['port-0'], scenarios: [] });
  const c = agent(w, { archive: 'compare', forks: 'compare' });
  assert.deepEqual(await c.readPastArchiveEntries(7), await agent(w).readPastArchiveEntries(7));
  assert.deepEqual(await c.readFreshnessArchives(), await agent(w).readFreshnessArchives());
  assert.deepEqual(await c.readThreadForks(topic('port-9', 'x'), threads['port-0'], today, {}), await agent(w).readThreadForks(topic('port-9', 'x'), threads['port-0'], today));
  const out = c.logs.join('\n');
  assert.match(out, /warn \[archive-compare\] window 2026-10-25\.\.2026-11-01: DIFFER 1 .*"onlyDdb":\["lost-3"\]/);
  assert.match(out, /warn \[archive-compare\] freshness: DIFFER 1 .*"lastWrite"/);
  assert.match(out, /warn \[forks-compare\] port-9 .*: DIFFER 1 .*PRED#port-9\|2026-10-29","only":"ddb"/);
  // with nothing missing, compare says equal
  const { w: w2, threads: t2 } = await fixture();
  const c2 = agent(w2, { archive: 'compare', forks: 'compare' });
  await c2.readPastArchiveEntries(7);
  await c2.readFreshnessArchives();
  await c2.readThreadForks(topic('port-9', 'x'), t2['port-0'], today, {});
  assert.deepEqual(c2.logs.filter((l) => /-compare\]/.test(l)).map((l) => l.replace(/^(\w+) \[(\w+-compare)\] .*: (\w+).*$/, '$1 $2 $3')), ['log archive-compare equal', 'log archive-compare equal', 'log forks-compare equal']);
});

test('a missing inbox day is an empty day, never a failure; a failing S3 read leaves the day out with a warning', async () => {
  const { w } = await fixture();
  w.objs.delete('record/inbox/entries/2026-10-30.jsonl');
  const a = agent(w, { archive: 'inbox' });
  const got = await a.readPastArchiveEntries(7);
  assert.deepEqual([...new Set(got.map((e) => e.date))], ['2026-11-01', '2026-10-31']);
  const send = w.s3.send;
  w.s3.send = async (c) => { if (c instanceof Get && /2026-10-31/.test(c.input.Key)) throw err('InternalError', 500); return send(c); };
  const got2 = await a.readPastArchiveEntries(7);
  assert.deepEqual([...new Set(got2.map((e) => e.date))], ['2026-11-01']);
  assert.match(a.logs.join('\n'), /warn \[inbox\] entries 2026-10-31 not read: InternalError/);
});
