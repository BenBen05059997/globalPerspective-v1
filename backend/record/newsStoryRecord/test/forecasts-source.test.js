'use strict';
// Forecasts from the inbox (decision 0052): FORECASTS_SOURCE=log|inbox|compare in the store and the nightly run.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const {compareSnapshots} = require('../src/inboxForecasts');
const forecasts = require('../../../shared/src/forecastsInbox');
const {fakeClient} = require('../../../shared/test/world.fake');

const P = 'record/shadow/';
const DAY = '2026-10-20';
const PREV = '2026-10-19';
const pred = (topicId, day, extra = {}) => ({
  PK: `PRED#${topicId}`, SK: day, topicId, title: topicId, generatedAt: `${day}T04:26:07.851Z`, methodologyVersion: 1, questionSchema: 1, threadId: 'thread-a',
  scenarios: [{label: 'L', probability: 0.5, triggers: [{id: '0-0', text: 'X happens', deadline: '2026-11-30', p: 40, question: true, qid: `q-${topicId}`}]}], ...extra,
});
const entry = (n) => ({topicId: `T ${n}-${n}`, threadId: 'thread-x', title: `Title ${n}`, sources: [{source: 'bbc.com', url: `https://bbc.com/${n}`}], archivedAt: `${DAY}T03:00:00.000Z`, generationId: 'g'});

// What the agent leaves: a row first drawn under thread-a and moved to the archive thread by the reconcile. The log holds the final row, the inbox the two lines.
const rows = [
  pred('T 1-1', DAY, {threadId: 'thread-x', drawnThreadId: 'thread-a'}), // moved by the reconcile
  pred('Elsewhere-1', DAY, {threadId: 'thread-own'}), // a topic the archive never kept: still a fact
  pred('T 2-2', PREV, {threadId: undefined}), // an older row with no thread: the topic's archive entry gives it
];
function linesFor(day) {
  const out = [];
  for (const r of rows.filter((x) => x.SK === day)) out.push(forecasts.drawnLine(r.drawnThreadId ? {...r, threadId: r.drawnThreadId, drawnThreadId: undefined} : r));
  for (const r of rows.filter((x) => x.SK === day && x.drawnThreadId)) out.push(forecasts.threadLine({PK: r.PK, SK: r.SK, threadId: r.threadId, was: r.drawnThreadId, at: `${day}T04:40:00.000Z`}));
  return out;
}
function seed() {
  const c = fakeClient();
  c.put('NewsCache', {id: `archive#${DAY}`, entries: [entry(1), entry(2)]});
  for (const r of rows) c.put('GlobalPerspectivePredictionLog', r);
  return c;
}
function putLines(f, day, lines) { f.objs.set(`${P}inbox/forecasts/${day}.jsonl`, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: `"f${day}"`}); }
const noWarn = () => ({warnings: [], logs: [], log(m) { this.logs.push(m); }, warn(m) { this.warnings.push(m); }});

test('inbox mode: the forecast_drawn facts of a nightly run are byte-identical to the log mode\'s, and PredictionLog is not read', async () => {
  const c = seed();
  const out = {};
  for (const mode of ['log', 'inbox']) {
    const f = fakeS3();
    putLines(f, DAY, linesFor(DAY));
    putLines(f, PREV, linesFor(PREV));
    const calls0 = c.calls.length;
    const handler = makeHandler({store: makeStore(c, {env: {FORECASTS_SOURCE: mode}, s3json: f.s3json}), s3json: f.s3json, manifest: f.manifest, now: () => `${DAY}T23:45:00.000Z`});
    const r = await handler({date: DAY});
    assert.equal(r.status, 'ok', mode);
    out[mode] = f.lines(`${P}facts/${DAY}.jsonl`).filter((x) => x.kind === 'forecast_drawn');
    if (mode === 'inbox') assert.deepEqual(c.calls.slice(calls0).filter(([m, t]) => t === 'GlobalPerspectivePredictionLog'), [], 'no PredictionLog read');
  }
  assert.equal(JSON.stringify(out.inbox), JSON.stringify(out.log));
  assert.deepEqual(out.log.map((x) => [x.payload.topicId, x.threadId]).sort(), [['Elsewhere-1', 'thread-own'], ['T 1-1', 'thread-x']]);
});

test('compare mode serves the log and says nothing when the two agree; days before the first inbox day are skipped, not different', async () => {
  const c = seed();
  const f = fakeS3();
  putLines(f, DAY, linesFor(DAY)); // the inbox starts today: PREV has no file
  const log = noWarn();
  const input = await makeStore(c, {env: {FORECASTS_SOURCE: 'compare'}, s3json: f.s3json, log}).load(DAY, {prefix: P});
  assert.equal(input.snapshots.length, 3, 'the log is used (it holds the older row too)');
  assert.equal(log.warnings.length, 0);
  assert.match(log.logs[0], /^\[forecasts-compare\] .*"differing":0.*"skippedDays":2[0-9]/);
});

test('compare mode names a forecast only in the log, a changed thread and an orphan thread line', async () => {
  const c = seed();
  const f = fakeS3();
  const lines = linesFor(DAY).filter((l) => !(l.type === 'drawn' && l.row.topicId === 'Elsewhere-1')).map((l) => (l.type === 'thread' ? {...l, threadId: 'thread-y'} : l));
  lines.push(forecasts.threadLine({PK: 'PRED#ghost', SK: DAY, threadId: 'thread-g', was: 'none', at: `${DAY}T05:00:00.000Z`}));
  putLines(f, DAY, lines);
  putLines(f, PREV, linesFor(PREV));
  const log = noWarn();
  const input = await makeStore(c, {env: {FORECASTS_SOURCE: 'compare'}, s3json: f.s3json, log}).load(DAY, {prefix: P});
  assert.equal(input.snapshots.length, 3);
  assert.equal(log.warnings.length, 1);
  const body = JSON.parse(log.warnings[0].replace('[forecasts-compare] ', ''));
  assert.equal(body.differing, 2);
  assert.equal(body.orphans, 1);
  assert.deepEqual(body.differences.map((d) => [d.sourceKey, d.only || d.fields.join()]).sort(), [['PRED#Elsewhere-1|2026-10-20', 'log'], ['PRED#T 1-1|2026-10-20', 'threadId']]);
});

test('inbox mode without the bucket, and an unknown mode, are refused', () => {
  assert.throws(() => makeStore(seed(), {env: {FORECASTS_SOURCE: 'inbox'}}), /needs the record bucket/);
  assert.throws(() => makeStore(seed(), {env: {FORECASTS_SOURCE: 'nope'}}), /must be one of/);
});

test('compareSnapshots: equal lists differ nowhere; the order of a list does not matter', () => {
  const a = [{sourceKey: 'k1', date: DAY, x: 1}, {sourceKey: 'k2', date: DAY, x: 2}];
  assert.equal(compareSnapshots(a, [...a].reverse()).differing, 0);
});
