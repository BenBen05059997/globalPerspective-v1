'use strict';
// The refresh carries today's forecasts (0052 follow-up of 0050): today's forecasts-inbox lines become provisional forecast_drawn facts in memory,
// placed as forecastFactsFor places them, and the nightly fact of the same row replaces them. The inbox only: never a PredictionLog Scan.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const {buildViews} = require('../src/views');
const {forecastFactsFor} = require('../src/facts');
const forecasts = require('../../../shared/src/forecastsInbox');
const {fakeClient} = require('../../../shared/test/world.fake');

const P = 'record/shadow/';
const DAY = '2026-10-20';
const AT = `${DAY}T12:35:00.000Z`;
const pred = (topicId, extra = {}) => ({
  PK: `PRED#${topicId}`, SK: DAY, topicId, title: topicId, generatedAt: `${DAY}T04:26:07.851Z`, methodologyVersion: 1, questionSchema: 1,
  scenarios: [{label: 'L', probability: 0.5, triggers: [{id: '0-0', text: 'X happens', deadline: '2026-11-30', p: 40, question: true, qid: `q-${topicId}`}]}], ...extra,
});
const entry = (n) => ({topicId: `T ${n}-${n}`, threadId: 'thread-x', title: `Title ${n}`, sources: [{source: 'bbc.com', url: `https://bbc.com/${n}`}], archivedAt: `${DAY}T03:00:00.000Z`, generationId: 'g'});
const rows = [
  pred('T 1-1', {threadId: 'thread-a'}), // drawn under thread-a, moved to today's archive thread by the reconcile (a thread line)
  pred('Own-1', {threadId: 'thread-own'}), // a topic the archive never kept: placed by its own thread
  pred('T 2-2'), // no thread of its own: today's entry of its topic places it
  pred('Nowhere-1'), // no thread and no entry today: no fact
];
const lines = () => [
  ...rows.map((r) => forecasts.drawnLine(r)),
  forecasts.threadLine({PK: 'PRED#T 1-1', SK: DAY, threadId: 'thread-x', was: 'thread-a', at: `${DAY}T04:40:00.000Z`}),
];
function seed() {
  const c = fakeClient();
  c.put('NewsCache', {id: `archive#${DAY}`, entries: [entry(1), entry(2)]});
  // the same rows in the PredictionLog (with the reconcile applied): a refresh must not read them
  for (const r of rows) c.put('GlobalPerspectivePredictionLog', r.topicId === 'T 1-1' ? {...r, threadId: 'thread-x', drawnThreadId: 'thread-a'} : r);
  return c;
}
const putLines = (f, prefix, ls) => f.objs.set(`${prefix}inbox/forecasts/${DAY}.jsonl`, {body: ls.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: '"f"'});
const make = (c, f, {env = {}, at = AT} = {}) => makeHandler({store: makeStore(c, {env, s3json: f.s3json}), s3json: f.s3json, manifest: f.manifest, now: () => at});
const predCalls = (c) => c.calls.filter(([, t]) => t === 'GlobalPerspectivePredictionLog');

test('a refresh with today\'s inbox lines gives story and forecast views with the forks marked provisional, and no PredictionLog read', async () => {
  for (const FORECASTS_SOURCE of ['log', 'inbox', 'compare']) {
    const c = seed();
    const f = fakeS3();
    putLines(f, P, lines());
    const r = await make(c, f, {env: {FORECASTS_SOURCE}})({refresh: true});
    assert.deepEqual(predCalls(c), [], `${FORECASTS_SOURCE}: no Scan, no PredictionLog read at all`);
    assert.deepEqual([r.entries, r.forecasts, r.unplacedForecasts, r.provisional, r.provisionalForecasts, r.skipped.length], [2, 4, 1, 2, 3, 0], FORECASTS_SOURCE);
    assert.ok(f.puts.every((p) => p.Key.startsWith(`${P}views/`)), 'only views are written');
    const story = f.json(`${P}views/stories/thread-x.json`);
    assert.deepEqual(story.forks.map((k) => [k.forkId.split('/')[0], k.provisional]).sort(), [['PRED#T 1-1', true], ['PRED#T 2-2', true]]);
    assert.equal(story.builtFrom.provisionalThrough, DAY);
    assert.deepEqual(f.json(`${P}views/forecasts/thread-x.json`).forks.map((k) => k.provisional), [true, true]);
    assert.deepEqual(f.json(`${P}views/forecasts/thread-own.json`).forks.map((k) => k.provisional), [true]);
    assert.equal(f.objs.has(`${P}views/stories/thread-a.json`), false, 'the reconcile\'s thread line wins');
    const m = f.json(`${P}views/manifest.json`);
    assert.deepEqual([m.provisionalThrough, m.provisionalEntries, m.provisionalForecasts, m.forecastViews], [DAY, 2, 3, 2]);
    const none = fakeS3();
    await make(seed(), none, {env: {FORECASTS_SOURCE}})({refresh: true});
    assert.equal(f.objs.get(`${P}views/track-record.json`).body, none.objs.get(`${P}views/track-record.json`).body, 'the track record holds real facts only');
  }
});

test('the refresh reads the inbox of its own prefix: live reads record/inbox/forecasts/, shadow record/shadow/inbox/forecasts/', async () => {
  const c = seed();
  const f = fakeS3();
  putLines(f, 'record/', lines());
  const live = await make(c, f)({refresh: true, shadow: false});
  assert.equal(live.provisionalForecasts, 3);
  assert.ok(f.objs.has('record/views/forecasts/thread-x.json'));
  const shadow = await make(c, f)({refresh: true});
  assert.deepEqual([shadow.forecasts, shadow.provisionalForecasts], [0, 0]);
});

test('an unplaceable row (no thread of its own, no entry of its topic today) gives no fact and no view', async () => {
  const c = seed();
  const f = fakeS3();
  putLines(f, P, [forecasts.drawnLine(pred('Nowhere-1'))]);
  const r = await make(c, f)({refresh: true});
  assert.deepEqual([r.forecasts, r.unplacedForecasts, r.provisionalForecasts], [1, 1, 0]);
  assert.equal([...f.objs.keys()].some((k) => k.includes('/forecasts/') && !k.includes('/inbox/')), false);
  assert.equal(f.json(`${P}views/manifest.json`).provisionalForecasts, undefined);
});

test('the nightly fact of the same row replaces the provisional one: same eventId, whatever thread the refresh saw', async () => {
  const c = seed();
  const f = fakeS3();
  putLines(f, P, lines());
  await make(c, f)({refresh: true});
  // the nightly run (FORECASTS_SOURCE=log here: the PredictionLog row) appends the facts
  const night = await make(c, f, {at: `${DAY}T23:45:00.000Z`})({date: DAY});
  assert.equal(night.status, 'ok');
  const drawn = f.lines(`${P}facts/${DAY}.jsonl`).filter((x) => x.kind === 'forecast_drawn');
  assert.equal(drawn.length, 3);
  assert.ok(drawn.every((x) => !x.provisional));
  // a refresh after the nightly run adds nothing: every provisional forecast is already a fact
  const r = await make(c, f, {at: `${DAY}T23:55:00.000Z`})({refresh: true});
  assert.equal(r.provisionalForecasts, 0);
  const story = f.json(`${P}views/stories/thread-x.json`);
  assert.equal(story.forks.length, 2);
  assert.ok(story.forks.every((k) => !k.provisional));
  assert.equal(f.json(`${P}views/manifest.json`).provisionalForecasts, undefined);

  // pure: a provisional fact made before the reconcile (thread-a) and the nightly fact (thread-x) share the eventId; only the nightly one shows
  const before = forecastFactsFor({snapshots: require('../src/inboxForecasts').snapshotsOfDays(new Map([[DAY, [forecasts.drawnLine(rows[0])]]]), {from: DAY, to: DAY}).snapshots, entries: []}, 'refresh-x')
    .map((x) => ({...x, provisional: true}));
  assert.equal(before[0].threadId, 'thread-a');
  const nightly = drawn.find((x) => x.payload.topicId === 'T 1-1');
  assert.equal(before[0].eventId, nightly.eventId);
  const opts = {today: DAY, builtAt: AT, runId: 'r', factsManifestDays: 1};
  const views = buildViews(drawn, {...opts, provisional: before});
  assert.equal(views.stories.has('thread-a'), false);
  assert.equal(JSON.stringify(views.stories), JSON.stringify(buildViews(drawn, opts).stories));
  assert.equal(views.manifest.provisionalThrough, undefined);
});

test('a failed forecasts-inbox read is in skipped and the entries still publish', async () => {
  const c = seed();
  const f = fakeS3();
  putLines(f, P, lines());
  const send = f.client.send;
  f.client.send = async (cmd) => {
    if (cmd.input.Key && cmd.input.Key.includes('inbox/forecasts/') && !cmd.input.Body) throw Object.assign(new Error('InternalError'), {name: 'InternalError', $metadata: {httpStatusCode: 500}});
    return send(cmd);
  };
  const r = await make(c, f)({refresh: true});
  assert.deepEqual([r.entries, r.provisional, r.forecasts, r.provisionalForecasts], [2, 2, 0, 0]);
  assert.deepEqual(r.skipped.map((s) => s.what), ['forecasts']);
  const story = f.json(`${P}views/stories/thread-x.json`);
  assert.deepEqual(story.entries.filter((e) => e.provisional).map((e) => e.title).sort(), ['Title 1', 'Title 2']);
  assert.deepEqual(story.forks, []);
  assert.deepEqual(predCalls(c), [], 'no fallback to the PredictionLog');
});
