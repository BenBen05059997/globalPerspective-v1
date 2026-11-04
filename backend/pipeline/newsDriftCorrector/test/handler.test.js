'use strict';
// The newsDriftCorrector handler, offline: fake DynamoDB (daily HISTORY# / THREAD_HISTORY# snapshots, archive rows, already-written notes),
// a scripted model and fake S3. The DRIFT# rows are what the country page's "what changed" band and the email sender read, so the
// tests pin: when a note is written (and when it is not), the two rows per note, and that a move is never noted twice.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { withLambda, fakeDdb, fakeS3, fakeLlm, dayAgo, archiveRows, inboxObjects } = require('../../../shared/test/pipelineHarness');

const { inboxLines } = require('../../../shared/src/entriesInbox');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = {
  TOPICS_DDB_TABLE: 'topics', SUMMARIZE_PREDICT_TABLE: 'summary', XAI_API_KEY: 'k', DRIFT_COUNTRIES: undefined, DRIFT_TTL_DAYS: undefined,
  DRIFT_LOOKBACK_DAYS: undefined, DRIFT_MAX_EVENTS: undefined, NOTES_PREFIX: undefined, NOTES_READS: undefined, GROK_MODEL: undefined,
};
const today = new Date().toISOString().slice(0, 10);
const D = (n) => dayAgo(n).date;

const hist = (country, daysAgo, f) => ({ PK: `COUNTRY#${country}`, SK: `HISTORY#${D(daysAgo)}`, dateKey: D(daysAgo), riskLevel: 'moderate', riskScore: 40, headline: `Headline ${daysAgo}`, trajectory: 'stable', ...f });
const thist = (id, daysAgo, f) => ({ PK: `THREAD#${id}`, SK: `THREAD_HISTORY#${D(daysAgo)}`, dateKey: D(daysAgo), riskScore: 40, threadTitle: 'Gaza ceasefire talks open', trajectory: 'stable', ...f });
const ev = (topicId, title, regions, extra = {}) => ({ topicId, title, regions, ...extra });
const answer = (o) => JSON.stringify({ triggerEventNumber: 1, whyChanged: 'The BOJ hike lifted the risk score.', noSingleDriver: false, ...o });

const JAPAN_ARCHIVE = () => ({
  4: [ev('j-1', 'BOJ surprises with a rate hike', ['Japan'], { threadId: 'thr-j' }), ev('f-1', 'French strike', ['France'])],
  3: [ev('j-2', 'Yen slides after the hike', ['Japan']), ev('j-1', 'BOJ surprises with a rate hike', ['Japan'], { threadId: 'thr-j' })],
});
// Japan rose from 40 (4 days ago) to 60 (3 days ago): one material move, with Japan and French events inside the window
const JAPAN_MOVE = () => [
  hist('Japan', 4), hist('Japan', 3, { riskLevel: 'elevated', riskScore: 60, headline: 'Japan under strain' }),
  ...archiveRows(JAPAN_ARCHIVE()),
];

const run = (opts, event, body) => withLambda(INDEX, { env: { ...ENV, ...(opts.env || {}) }, ddb: opts.ddb, s3: opts.s3, llm: opts.llm }, async (ctx) => body(ctx, await ctx.mod.handler(event)));
const country = (out, name) => out.countries.find((c) => c.country === name);
const noteRows = (ddb, pk, asOf) => ({ drift: ddb.store.get(`${pk}|DRIFT#${asOf}`), log: ddb.store.get(`${pk}|DRIFTLOG#${asOf}`) });

// ─── countries: processCountry / writeNote / putDriftNote ───────────────────────────

test('a material move is noted: DRIFT# (60 day TTL) and DRIFTLOG# (no TTL) rows with the same grounded fields, plus the record note', async () => {
  const ddb = fakeDdb(JAPAN_MOVE());
  const llm = fakeLlm(answer({ triggerEventNumber: 2 }));
  await run({ ddb, s3: fakeS3(), llm }, { country: 'Japan' }, ({ s3 }, out) => {
    assert.deepEqual(out.threads, []);
    assert.deepEqual(country(out, 'Japan'), { country: 'Japan', status: 'noted', moves: 1, noted: 1, skipped: 0, triggers: ['Yen slides after the hike'] });

    // the model is asked once, for this move, with the Japan events of the window only (numbered, deduplicated)
    assert.equal(llm.calls.length, 1);
    assert.equal(llm.calls[0].step, 'drift_note');
    assert.match(llm.calls[0].user, /PRIOR \(.*\): risk moderate\/40/);
    assert.match(llm.calls[0].user, /NOW  \(.*\): risk elevated\/60/);
    assert.match(llm.calls[0].user, /\[1\] \(.*\) BOJ surprises with a rate hike\n  \[2\] \(.*\) Yen slides after the hike$/m);
    assert.doesNotMatch(llm.calls[0].user, /French strike/);

    const { drift, log } = noteRows(ddb, 'COUNTRY#Japan', D(3));
    assert.ok(drift && log, 'both rows written');
    assert.deepEqual(ddb.puts.map((p) => [p.table, p.item.SK]), [['summary', `DRIFT#${D(3)}`], ['summary', `DRIFTLOG#${D(3)}`]]);
    assert.ok(Math.abs(drift.ttl - (Date.now() / 1000 + 60 * 86400)) < 60, 'live row lives 60 days');
    assert.equal('ttl' in log, false, 'the permanent log has no TTL');
    const { SK: _a, ttl: _b, ...driftFields } = drift;
    const { SK: _c, ...logFields } = log;
    assert.deepEqual(driftFields, logFields);
    assert.equal(drift.PK, 'COUNTRY#Japan');
    assert.equal(drift.countryName, 'Japan');
    assert.equal(drift.asOf, D(3));
    assert.equal(drift.since, D(4));
    assert.deepEqual(drift.changeLevel, { from: 'moderate', to: 'elevated' });
    assert.deepEqual(drift.changeScore, { from: 40, to: 60, delta: 20 });
    assert.equal(drift.priorHeadline, 'Headline 4');
    assert.equal(drift.currentHeadline, 'Japan under strain');
    assert.equal(drift.currentRiskScore, 60);
    assert.equal(drift.currentRiskLevel, 'elevated');
    assert.deepEqual(drift.triggerEvent, { topicId: 'j-2', threadId: null, title: 'Yen slides after the hike', date: D(3) });
    assert.equal(drift.whyChanged, 'The BOJ hike lifted the risk score.');
    assert.equal(drift.noSingleDriver, false);
    assert.equal(drift.directionFlag, undefined);
    assert.ok(Date.parse(drift.generatedAt) > Date.now() - 60000);

    // the record's copy of the DRIFT# row (shadow prefix by default)
    const files = s3.keys('record/shadow/notes/drift/').filter((k) => k.endsWith('.jsonl'));
    assert.equal(files.length, 1, s3.keys().join());
    const [note] = s3.lines(files[0]);
    assert.equal(note.subtype, 'drift');
    assert.deepEqual(note.iso3, ['JPN']);
    assert.equal(note.payload.whyChanged, drift.whyChanged);
    assert.equal(note.producer.lambda, 'newsDriftCorrector');
  });
});

test('DRIFT_TTL_DAYS sets the live row lifetime; the level change is omitted when the level did not move', async () => {
  const ddb = fakeDdb([hist('Japan', 4), hist('Japan', 3, { riskScore: 55 }), ...archiveRows({ 4: [ev('j-1', 'Hike', ['Japan'])] })]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()), env: { DRIFT_TTL_DAYS: '7' } }, { country: 'Japan' }, () => {});
  const { drift } = noteRows(ddb, 'COUNTRY#Japan', D(3));
  assert.ok(Math.abs(drift.ttl - (Date.now() / 1000 + 7 * 86400)) < 60);
  assert.equal(drift.changeLevel, undefined);
});

test('a move that already has its DRIFT# note is skipped with no model call; only the not-yet-noted moves of a chain are noted (backfill)', async () => {
  const snaps = [hist('Japan', 5), hist('Japan', 4, { riskLevel: 'elevated', riskScore: 60 }), hist('Japan', 3, { riskLevel: 'high', riskScore: 80 })];
  const arch = archiveRows({ 5: [ev('j-0', 'Early event', ['Japan'])], 4: [ev('j-1', 'Hike', ['Japan'])], 3: [ev('j-2', 'Crash', ['Japan'])] });

  const allDone = fakeDdb([...snaps, ...arch, { PK: 'COUNTRY#Japan', SK: `DRIFT#${D(4)}` }, { PK: 'COUNTRY#Japan', SK: `DRIFT#${D(3)}` }]);
  await run({ ddb: allDone, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Japan' }, ({ llm }, out) => {
    assert.deepEqual(country(out, 'Japan'), { country: 'Japan', status: 'already-noted', moves: 2, noted: 0, skipped: 2, triggers: [] });
    assert.equal(llm.calls.length, 0);
  });
  assert.equal(allDone.puts.length, 0);

  const half = fakeDdb([...snaps, ...arch, { PK: 'COUNTRY#Japan', SK: `DRIFT#${D(4)}` }]);
  await run({ ddb: half, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Japan' }, ({ llm }, out) => {
    assert.deepEqual([country(out, 'Japan').status, country(out, 'Japan').noted, country(out, 'Japan').skipped], ['noted', 1, 1]);
    assert.equal(llm.calls.length, 1);
    assert.match(llm.calls[0].user, /NOW  \(.*\): risk high\/80/);
  });
  assert.deepEqual(half.puts.map((p) => p.item.SK), [`DRIFT#${D(3)}`, `DRIFTLOG#${D(3)}`]);
});

test('running the same day twice writes the note once', async () => {
  const ddb = fakeDdb(JAPAN_MOVE());
  const llm = fakeLlm(answer());
  await run({ ddb, s3: fakeS3(), llm }, { country: 'Japan' }, () => {});
  await run({ ddb, s3: fakeS3(), llm }, { country: 'Japan' }, (_, out) => assert.equal(country(out, 'Japan').status, 'already-noted'));
  assert.equal(llm.calls.length, 1);
  assert.equal(ddb.puts.length, 2);
});

test('no history, one snapshot, no material move, or a move older than the lookback window: no model call, no rows', async () => {
  const cases = [
    ['no-history', []],
    ['no-history', [hist('Japan', 3)]],
    ['no-recent-drift', [hist('Japan', 4), hist('Japan', 3, { riskScore: 44 })]], // +4 is below the 8 point threshold
    ['no-recent-drift', [hist('Japan', 40), hist('Japan', 30, { riskScore: 90 }), hist('Japan', 3, { riskScore: 90 })]], // the jump is outside 10 days of the latest snapshot
  ];
  for (const [status, rows] of cases) {
    const ddb = fakeDdb(rows);
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Japan' }, ({ llm }, out) => {
      assert.equal(country(out, 'Japan').status, status);
      assert.equal(llm.calls.length, 0);
    });
    assert.equal(ddb.puts.length, 0);
  }
});

test('DRIFT_LOOKBACK_DAYS widens the window that is considered', async () => {
  const rows = [hist('Japan', 40), hist('Japan', 30, { riskScore: 90 }), hist('Japan', 3, { riskScore: 90 })];
  const ddb = fakeDdb([...rows, ...archiveRows({ 40: [ev('j-1', 'Old event', ['Japan'])] })]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()), env: { DRIFT_LOOKBACK_DAYS: '40' } }, { country: 'Japan' }, ({ llm }, out) => {
    assert.equal(country(out, 'Japan').status, 'noted');
    assert.equal(llm.calls.length, 1);
  });
});

test('dry run: counts the moves still lacking a note, with no model call and no writes', async () => {
  const ddb = fakeDdb([...JAPAN_MOVE(), hist('Japan', 5, { riskScore: 20 }), { PK: 'COUNTRY#Japan', SK: `DRIFT#${D(4)}` }]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Japan', dryRun: true }, ({ llm }, out) => {
    assert.deepEqual(country(out, 'Japan'), { country: 'Japan', status: 'dry-run', moves: 2, pending: 1 });
    assert.equal(llm.calls.length, 0);
  });
  assert.equal(ddb.puts.length, 0);
});

test('without an API key a country with a move reports no-llm-key and writes nothing', async () => {
  const ddb = fakeDdb(JAPAN_MOVE());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()), env: { XAI_API_KEY: '' } }, { country: 'Japan' }, ({ llm }, out) => {
    assert.equal(country(out, 'Japan').status, 'no-llm-key');
    assert.equal(llm.calls.length, 0);
  });
  assert.equal(ddb.puts.length, 0);
});

test('an unparseable reply writes no note (parse-fail); a reply with no reason is the same', async () => {
  for (const content of ['I cannot tell', JSON.stringify({ triggerEventNumber: 1, whyChanged: '   ' })]) {
    const ddb = fakeDdb(JAPAN_MOVE());
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(content) }, { country: 'Japan' }, (_, out) => assert.equal(country(out, 'Japan').status, 'parse-fail'));
    assert.equal(ddb.puts.length, 0);
  }
});

test('the model cannot invent a cause: an out-of-range event number, or noSingleDriver, stores a note with no trigger event', async () => {
  for (const reply of [answer({ triggerEventNumber: 9 }), answer({ triggerEventNumber: 0, noSingleDriver: true }), answer({ triggerEventNumber: 1, noSingleDriver: true })]) {
    const ddb = fakeDdb(JAPAN_MOVE());
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply) }, { country: 'Japan' }, (_, out) => assert.deepEqual(country(out, 'Japan').triggers, []));
    const { drift, log } = noteRows(ddb, 'COUNTRY#Japan', D(3));
    for (const r of [drift, log]) {
      assert.equal(r.noSingleDriver, true);
      assert.equal(r.triggerEvent, undefined);
      assert.equal(r.whyChanged, 'The BOJ hike lifted the risk score.');
    }
  }
});

test('a note that contradicts the stored numbers is retried once, then stored as numbers only with a directionFlag (both rows)', async () => {
  const dims = (c, h) => ({ conflict: { score: 80, why: 'w' }, humanitarian: { score: h, why: 'w' } });
  const rows = [hist('Iran', 4, { riskLevel: 'high', riskScore: 80, dimensions: dims(80, 90) }), hist('Iran', 3, { riskLevel: 'high', riskScore: 80, dimensions: dims(80, 70) }),
    ...archiveRows({ 4: [ev('i-1', 'UAE announces indefinite trade embargo on Iran', ['Iran'])] })];
  const ddb = fakeDdb(rows);
  // the cited event is said to WORSEN humanitarian risk although the score FELL by 20
  const contradiction = answer({ whyChanged: 'The embargo shifts the humanitarian score down.', axisEffects: { humanitarian: 'worsens' } });
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(contradiction) }, { country: 'Iran' }, ({ llm }) => {
    assert.equal(llm.calls.length, 2);
    assert.match(llm.calls[1].user, /YOUR PREVIOUS ANSWER WAS REJECTED/);
  });
  const { drift, log } = noteRows(ddb, 'COUNTRY#Iran', D(3));
  for (const r of [drift, log]) {
    assert.equal(r.noSingleDriver, true);
    assert.equal(r.triggerEvent, undefined);
    assert.equal(r.whyChanged, 'Humanitarian risk fell 20 points (90 to 70). No listed event explains a move in this direction.');
    assert.deepEqual(r.directionFlag.axes, ['humanitarian']);
    assert.equal(r.directionFlag.attempts, 2);
    assert.deepEqual(r.changeDimensions, { humanitarian: { from: 90, to: 70, delta: -20 } });
    assert.deepEqual(r.currentDimensions, dims(80, 70));
  }
});

test('the window events are limited by DRIFT_MAX_EVENTS (the latest kept), and archive regions are matched by canonical name', async () => {
  const rows = [hist('United States', 4), hist('United States', 3, { riskScore: 60 }), ...archiveRows({
    4: [ev('u-1', 'First', ['USA']), ev('u-2', 'Second', ['United States'])],
    3: [ev('u-3', 'Third', ['USA', 'Canada']), ev('u-4', 'Fourth', ['Mexico'])],
  })];
  await run({ ddb: fakeDdb(rows), s3: fakeS3(), llm: fakeLlm(answer()), env: { DRIFT_MAX_EVENTS: '2' } }, { country: 'United States' }, ({ llm }) => {
    const lines = llm.calls[0].user.split('\n').filter((l) => /^  \[\d+\]/.test(l));
    assert.equal(lines.length, 2);
    assert.match(lines[0], /Second/);
    assert.match(lines[1], /Third/);
    assert.doesNotMatch(llm.calls[0].user, /Fourth/);
  });
});

test('a failed archive read in the window only removes that day\'s events', async () => {
  const bad = dayAgo(3).key;
  const ddb = fakeDdb(JAPAN_MOVE(), { fail: (name, input) => (name === 'GetCommand' && input.Key.id === bad ? new Error('throttled') : null) });
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Japan' }, ({ llm }, out) => {
    assert.equal(country(out, 'Japan').status, 'noted');
    assert.doesNotMatch(llm.calls[0].user, /Yen slides/);
    assert.match(llm.calls[0].user, /BOJ surprises/);
  });
});

test('the handler isolates countries: a DynamoDB error or an empty model answer on one is reported on that country only', async () => {
  const rows = [...JAPAN_MOVE(), hist('France', 4), hist('France', 3, { riskScore: 70 }), ...archiveRows({ 4: [ev('f-9', 'Pension reform passes', ['France'])] })];
  const ddb = fakeDdb(rows, { fail: (name, input) => (name === 'QueryCommand' && input.ExpressionAttributeValues[':pk'] === 'COUNTRY#Italy' ? new Error('throttled') : null) });
  const llm = fakeLlm((o) => (/Japan/.test(o.user) ? '' : answer()));
  await run({ ddb, s3: fakeS3(), llm, env: { DRIFT_COUNTRIES: 'Italy, Japan ,France,' } }, {}, (_, out) => {
    assert.deepEqual(out.countries.map((c) => [c.country, c.status]), [['Italy', 'error'], ['Japan', 'error'], ['France', 'noted']]);
    assert.equal(country(out, 'Italy').error, 'throttled');
    assert.equal(country(out, 'Japan').error, 'llm empty response');
  });
  assert.ok(ddb.store.get(`COUNTRY#France|DRIFT#${D(3)}`));
  assert.equal(ddb.store.get(`COUNTRY#Japan|DRIFT#${D(3)}`), undefined);
});

test('a failed record-note write is logged [notes] and the DynamoDB rows stay', async () => {
  const ddb = fakeDdb(JAPAN_MOVE());
  await run({ ddb, s3: fakeS3({}, { fail: () => new Error('S3 down') }), llm: fakeLlm(answer()) }, { country: 'Japan' }, ({ logs }, out) => {
    assert.equal(country(out, 'Japan').status, 'noted');
    assert.ok(logs.error.some((l) => l.startsWith('[notes] drift note not written: S3 down')), logs.error.join('\n'));
  });
  assert.ok(noteRows(ddb, 'COUNTRY#Japan', D(3)).log);
});

// ─── threads: processThread / discoverThreadIds ─────────────────────────────────────

const THREAD_MOVE = (id = 'thr-g') => [
  thist(id, 4), thist(id, 3, { riskScore: 70, threadTitle: 'Gaza ceasefire collapses amid strikes' }),
  ...archiveRows({
    4: [ev('g-1', 'Talks open in Cairo', ['Israel'], { threadId: id }), ev('x-1', 'Unrelated', ['Israel'], { threadId: 'other' })],
    3: [ev('g-2', 'Ceasefire collapses', ['Israel'], { threadId: id })],
  }),
];

test('a story whose conclusion moved is noted like a country: THREAD# DRIFT# and DRIFTLOG# rows with titles and a story record note', async () => {
  const ddb = fakeDdb(THREAD_MOVE());
  const llm = fakeLlm(answer({ triggerEventNumber: 2, whyChanged: 'The ceasefire collapsed.' }));
  await run({ ddb, s3: fakeS3(), llm }, { country: 'Nowhere', threadId: 'thr-g' }, ({ s3 }, out) => {
    assert.deepEqual(out.threads, [{ threadId: 'thr-g', status: 'noted', moves: 1, noted: 1, skipped: 0, triggers: ['Ceasefire collapses'] }]);
    assert.match(llm.calls[0].user, /Our automated read on the story "Gaza ceasefire collapses amid strikes" moved/);
    assert.match(llm.calls[0].user, /\[1\] \(.*\) Talks open in Cairo\n  \[2\] \(.*\) Ceasefire collapses$/m);
    assert.doesNotMatch(llm.calls[0].user, /Unrelated/);

    const { drift, log } = noteRows(ddb, 'THREAD#thr-g', D(3));
    assert.ok(drift && log);
    assert.equal(drift.threadId, 'thr-g');
    assert.equal(drift.asOf, D(3));
    assert.equal(drift.since, D(4));
    assert.deepEqual(drift.changeScore, { from: 40, to: 70, delta: 30 });
    assert.equal(drift.priorTitle, 'Gaza ceasefire talks open');
    assert.equal(drift.currentTitle, 'Gaza ceasefire collapses amid strikes');
    assert.deepEqual(drift.triggerEvent, { topicId: 'g-2', threadId: 'thr-g', title: 'Ceasefire collapses', date: D(3) });
    assert.equal(drift.whyChanged, 'The ceasefire collapsed.');
    assert.ok(Math.abs(drift.ttl - (Date.now() / 1000 + 60 * 86400)) < 60);
    assert.equal('ttl' in log, false);

    const files = s3.keys('record/shadow/notes/drift/').filter((k) => k.endsWith('.jsonl'));
    const [note] = s3.lines(files[0]);
    assert.deepEqual(note.subject, { kind: 'story', id: 'thr-g' });
    assert.equal(note.payload.whyChanged, 'The ceasefire collapsed.');
  });
});

test('a story move that is already noted is skipped; no history or no move gives no rows; dry run only counts', async () => {
  const done = fakeDdb([...THREAD_MOVE(), { PK: 'THREAD#thr-g', SK: `DRIFT#${D(3)}` }]);
  await run({ ddb: done, s3: fakeS3(), llm: fakeLlm(answer()) }, { threadId: 'thr-g', country: 'Nowhere' }, ({ llm }, out) => {
    assert.deepEqual(out.threads[0], { threadId: 'thr-g', status: 'already-noted', moves: 1, noted: 0, skipped: 1, triggers: [] });
    assert.equal(llm.calls.length, 0);
  });
  assert.equal(done.puts.length, 0);

  for (const [status, rows] of [['no-history', [thist('thr-g', 3)]], ['no-recent-drift', [thist('thr-g', 4), thist('thr-g', 3, { riskScore: 43 })]]]) {
    const ddb = fakeDdb(rows);
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()) }, { threadId: 'thr-g', country: 'Nowhere' }, (_, out) => assert.equal(out.threads[0].status, status));
    assert.equal(ddb.puts.length, 0);
  }

  const dry = fakeDdb(THREAD_MOVE());
  await run({ ddb: dry, s3: fakeS3(), llm: fakeLlm(answer()) }, { threadId: 'thr-g', country: 'Nowhere', dryRun: true }, ({ llm }, out) => {
    assert.deepEqual(out.threads[0], { threadId: 'thr-g', status: 'dry-run', moves: 1, pending: 1 });
    assert.equal(llm.calls.length, 0);
  });
  assert.equal(dry.puts.length, 0);
});

test('without event.threadId the stories are discovered from the "latest" topics (deduplicated, unthreaded topics ignored)', async () => {
  const ddb = fakeDdb([
    { id: 'latest', topics: [{ threadId: 'thr-g' }, { threadId: 'thr-g' }, { title: 'no thread' }, { threadId: 'thr-q' }] },
    ...THREAD_MOVE(),
  ]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Nowhere' }, (_, out) => {
    assert.deepEqual(out.threads.map((t) => [t.threadId, t.status]), [['thr-g', 'noted'], ['thr-q', 'no-history']]);
  });
});

test('discovery also reads the data.topics shape; a missing row or a failed read means no stories, and the countries still run', async () => {
  const wrapped = fakeDdb([{ id: 'latest', data: { topics: [{ threadId: 'thr-q' }] } }]);
  await run({ ddb: wrapped, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Nowhere' }, (_, out) => assert.deepEqual(out.threads.map((t) => t.threadId), ['thr-q']));

  for (const ddb of [fakeDdb([]), fakeDdb([], { fail: (name, input) => (input.Key && input.Key.id === 'latest' ? new Error('boom') : null) })]) {
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Nowhere' }, (_, out) => {
      assert.deepEqual(out.threads, []);
      assert.equal(out.countries.length, 1);
    });
  }
});

test('an explicit threadId skips discovery (the latest row is not read) and a story failure is reported on that story', async () => {
  const ddb = fakeDdb([{ id: 'latest', topics: [{ threadId: 'thr-q' }] }, ...THREAD_MOVE()], { fail: (name, input) => (name === 'QueryCommand' && input.ExpressionAttributeValues[':pk'] === 'THREAD#thr-bad' ? new Error('throttled') : null) });
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(answer()) }, { country: 'Nowhere', threadId: 'thr-bad' }, (_, out) => {
    assert.deepEqual(out.threads, [{ threadId: 'thr-bad', status: 'error', error: 'throttled' }]);
  });
  assert.ok(!ddb.sent.some((s) => s.name === 'GetCommand' && s.input.Key.id === 'latest'));
});

test('the default country list is used when the event names none', async () => {
  await run({ ddb: fakeDdb([]), s3: fakeS3(), llm: fakeLlm(answer()) }, {}, (_, out) => {
    assert.deepEqual(out.countries.map((c) => c.country), ['Iran', 'Israel', 'United States', 'Venezuela', 'China', 'Japan', 'Ukraine', 'Russia', 'France', 'Germany', 'DR Congo', 'South Africa']);
    assert.ok(out.countries.every((c) => c.status === 'no-history'));
  });
});

// ─── ARCHIVE_READS (decision 0035 step 5d): the archive days and `latest` from the entries inbox ───────────────────────────────────────────

const INBOX_ENV = { ARCHIVE_READS: 'inbox', ENTRIES_INBOX_PREFIX: 'record/' };
const noArchiveRead = (ddb) => !ddb.sent.some((c) => c.name === 'GetCommand' && c.input.TableName === 'topics');

test('ARCHIVE_READS=inbox: the window events come from the entries inbox, the same note, no NewsCache read', async () => {
  const ddb = fakeDdb(JAPAN_MOVE().filter((r) => r.id === undefined));
  const llm = fakeLlm(answer({ triggerEventNumber: 2 }));
  await run({ ddb, s3: fakeS3(inboxObjects(JAPAN_ARCHIVE())), llm, env: INBOX_ENV }, { country: 'Japan' }, (_, out) => {
    assert.deepEqual(country(out, 'Japan'), { country: 'Japan', status: 'noted', moves: 1, noted: 1, skipped: 0, triggers: ['Yen slides after the hike'] });
    assert.match(llm.calls[0].user, /\[1\] \(.*\) BOJ surprises with a rate hike\n  \[2\] \(.*\) Yen slides after the hike$/m);
    assert.doesNotMatch(llm.calls[0].user, /French strike/);
  });
  assert.ok(noArchiveRead(ddb));
});

test('ARCHIVE_READS=inbox: a story\'s events come from the inbox too', async () => {
  const ddb = fakeDdb(THREAD_MOVE().filter((r) => r.id === undefined));
  const days = {};
  for (const r of THREAD_MOVE().filter((x) => x.id !== undefined && x.entries)) {
    const n = [4, 3, 2, 1, 0].find((k) => dayAgo(k).key === r.id);
    if (n !== undefined) days[n] = r.entries;
  }
  await run({ ddb, s3: fakeS3(inboxObjects(days)), llm: fakeLlm(answer({ triggerEventNumber: 2 })), env: INBOX_ENV }, { country: 'Nowhere', threadId: 'thr-g' }, ({ llm }, out) => {
    assert.equal(out.threads[0].status, 'noted');
    assert.match(llm.calls[0].user, /\[1\] \(.*\) Talks open in Cairo\n  \[2\] \(.*\) Ceasefire collapses$/m);
  });
  assert.ok(noArchiveRead(ddb));
});

// today's day file with a run of two topics: `of` = how many topics the run's staging item had
const latestFile = (of) => {
  const batch = `${today}T04:50:00.000Z`;
  const topics = { 'g-1': { threadId: 'thr-g' }, 'q-1': { threadId: 'thr-q' } };
  const lines = inboxLines([{ topicId: 'g-1', threadId: 'thr-g', title: 'a' }, { topicId: 'q-1', threadId: 'thr-q', title: 'b' }], { batch, selection: { topics, run: { of, model: 'm' } } });
  return { [`record/inbox/entries/${today}.jsonl`]: { body: lines.map((l) => JSON.stringify(l)).join('\n') + '\n', etag: '"i"' } };
};

test('ARCHIVE_READS=inbox: stories are discovered from the last complete run of the inbox; an incomplete run gives none (honest empty)', async () => {
  const rows = [{ id: 'latest', topics: [{ threadId: 'thr-zzz' }] }, ...THREAD_MOVE()];
  await run({ ddb: fakeDdb(rows), s3: fakeS3(latestFile(2)), llm: fakeLlm(answer()), env: INBOX_ENV }, { country: 'Nowhere' }, (_, out) => {
    assert.deepEqual(out.threads.map((t) => t.threadId).sort(), ['thr-g', 'thr-q']);
  });
  await run({ ddb: fakeDdb(rows), s3: fakeS3(latestFile(5)), llm: fakeLlm(answer()), env: INBOX_ENV }, { country: 'Nowhere' }, (_, out) => {
    assert.deepEqual(out.threads, []);
  });
});

test('ARCHIVE_READS=compare: DynamoDB answers; [archive-compare] and [latest-compare] lines are logged', async () => {
  const rows = [{ id: 'latest', topics: [{ threadId: 'thr-g' }, { threadId: 'thr-q' }] }, ...JAPAN_MOVE()];
  const s3 = fakeS3({ ...inboxObjects(JAPAN_ARCHIVE()), ...latestFile(2) });
  await run({ ddb: fakeDdb(rows), s3, llm: fakeLlm(answer({ triggerEventNumber: 2 })), env: { ARCHIVE_READS: 'compare', ENTRIES_INBOX_PREFIX: 'record/' } }, { country: 'Japan' }, ({ logs }, out) => {
    assert.equal(country(out, 'Japan').status, 'noted');
    assert.ok(logs.log.some((l) => l.startsWith('[archive-compare] archive#') && l.endsWith('equal')), logs.log.concat(logs.warn).join('\n'));
    assert.ok(logs.log.some((l) => l === '[latest-compare] threadIds: equal'), logs.log.concat(logs.warn).join('\n'));
  });
});
