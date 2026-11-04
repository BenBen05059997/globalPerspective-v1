'use strict';
// The whole newsThreadAnalysis handler, offline: fake DynamoDB (archive rows + stored analyses), a scripted model reply, fake S3 for the
// record note. What a reader of the site would notice: which stories get an analysis, the THREAD# row they read, the risk shown, and that one bad reply
// never stops the others.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { withLambda, fakeDdb, fakeS3, fakeLlm, dayAgo, archiveRows, inboxObjects } = require('../../../shared/test/pipelineHarness');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = { TOPICS_DDB_TABLE: 'topics', SUMMARIZE_PREDICT_TABLE: 'summary', XAI_API_KEY: 'k', MAX_THREADS: undefined, INTER_CALL_DELAY_MS: undefined, NOTES_PREFIX: undefined, WORLD_BUCKET: 'bkt', GROK_MODEL: undefined };
const today = new Date().toISOString().slice(0, 10);

const entry = (topicId, threadId, extra = {}) => ({
  topicId, threadId, title: `Headline ${topicId}`, regions: ['Ukraine'], category: 'conflict',
  sources: [{ source: 'Reuters', url: `https://www.reuters.com/${topicId}` }], ai: { summary: `Summary of ${topicId}` }, ...extra,
});
// thr-c is the newest thread (days 2 and 1), thr-a next (days 3 and 2), thr-b the oldest (days 5 and 4)
const archive = () => archiveRows({
  1: [entry('c-2', 'thr-c', { regions: ['Japan'] })],
  2: [entry('a-2', 'thr-a'), entry('c-1', 'thr-c', { regions: ['Japan'] })],
  3: [entry('a-1', 'thr-a', { regions: ['Ukraine', 'Russia'] })],
  4: [entry('b-2', 'thr-b')],
  5: [entry('b-1', 'thr-b')],
});

const GOOD = {
  threadTitle: 'Ceasefire talks stall again',
  entryShortTitles: [{ topicId: 'a-1', shortTitle: 'Talks open' }, { topicId: 'a-2', shortTitle: 'Talks stall' }],
  storyArc: 'The story began on day one.', trajectory: 'Heading to a pause.', rootCauseChain: 'Layers of cause.',
  watchQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?'], inflectionTopicId: 'a-2',
  dimensions: { conflict: { score: 72, why: ' Shelling continues ' }, political: { score: 40, why: 'Talks' }, economic: null, humanitarian: { score: 55, why: 'Displacement' } },
  sentiment: -0.6,
  keyActors: [1, 2, 3, 4, 5, 6].map((i) => ({ name: `Actor ${i}`, role: 'Minister', mentionCount: 10 - i })),
};
const reply = (o) => JSON.stringify(o);

const run = (opts, event, body) => withLambda(INDEX, { env: { ...ENV, ...(opts.env || {}) }, ddb: opts.ddb, s3: opts.s3, llm: opts.llm }, async (ctx) => body(ctx, await ctx.mod.handler(event)));
const threadRow = (ddb, id) => ddb.store.get(`THREAD#${id}|THREAD_ANALYSIS`);

test('a valid reply is stored as the THREAD# row the thread page reads, plus a dated THREAD_HISTORY# snapshot', async () => {
  const ddb = fakeDdb(archive());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '1' } }, {}, ({ llm }, out) => {
    assert.equal(out.statusCode, 200);
    assert.match(out.body, /1 generated, 2 skipped .*, 0 failed/);
    // the model is asked once, for the newest thread, with JSON output and the entries in the prompt
    assert.equal(llm.calls.length, 1);
    assert.equal(llm.calls[0].step, 'thread_analysis');
    assert.equal(llm.calls[0].json, true);
    assert.match(llm.calls[0].user, /Headline c-1/);
    assert.match(llm.calls[0].user, /Summary of c-2/);
  });
  const row = threadRow(ddb, 'thr-c');
  assert.equal(row.PK, 'THREAD#thr-c');
  assert.equal(row.threadId, 'thr-c');
  assert.equal(row.threadTitle, 'Ceasefire talks stall again');
  assert.equal(row.storyArc, 'The story began on day one.');
  assert.equal(row.trajectory, 'Heading to a pause.');
  assert.equal(row.inflectionTopicId, 'a-2');
  assert.equal(row.entryCount, 2);
  assert.deepEqual(row.entryTopicIds, ['c-1', 'c-2']);
  assert.deepEqual(row.iso3, ['JPN']);
  assert.equal(row.model, 'fake-model');
  assert.equal(row.latencyMs, 7);
  assert.deepEqual(row.watchQuestions, ['Q1?', 'Q2?', 'Q3?']); // capped at 3
  assert.equal(row.keyActors.length, 5);                       // capped at 5
  assert.equal(row.sentiment, -0.6);
  assert.ok(Math.abs(row.ttl - (Date.now() / 1000 + 90 * 86400)) < 60, 'row lives 90 days');
  assert.ok(Date.parse(row.generatedAt) > Date.now() - 60000);

  const hist = ddb.store.get(`THREAD#thr-c|THREAD_HISTORY#${today}`);
  assert.equal(hist.dateKey, today);
  assert.equal(hist.threadTitle, row.threadTitle);
  assert.equal(hist.riskScore, row.riskScore);
  assert.deepEqual(hist.dimensions, row.dimensions);
  assert.equal(hist.entryCount, 2);
  assert.ok(Math.abs(hist.ttl - (Date.now() / 1000 + 60 * 86400)) < 60, 'history lives 60 days');
  assert.equal(ddb.puts.length, 2);
  assert.ok(ddb.puts.every((p) => p.table === 'summary'));
});

test('risk is the worst axis of the dimensions: score, lead, a missing axis stays null, why is trimmed', async () => {
  const ddb = fakeDdb(archive());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '1' } }, {}, () => {});
  const row = threadRow(ddb, 'thr-c');
  assert.equal(row.riskScore, 72);
  assert.equal(row.lead, 'conflict');
  assert.deepEqual(row.dimensions, {
    conflict: { score: 72, why: 'Shelling continues' },
    political: { score: 40, why: 'Talks' },
    economic: null,
    humanitarian: { score: 55, why: 'Displacement' },
  });
});

test('a reply with no dimensions falls back to a legacy riskScore (clamped to 0-100); with neither, risk is null, never 0', async () => {
  const noDims = (o) => { const { dimensions, ...rest } = GOOD; return reply({ ...rest, ...o }); };
  for (const [legacy, want] of [[82, 82], [150, 100], [-5, 0], [undefined, null]]) {
    const ddb = fakeDdb(archive());
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(noDims({ riskScore: legacy })), env: { MAX_THREADS: '1' } }, {}, () => {});
    const row = threadRow(ddb, 'thr-c');
    assert.equal(row.riskScore, want, `legacy ${legacy}`);
    assert.equal(row.lead, null);
    assert.deepEqual(row.dimensions, { conflict: null, political: null, economic: null, humanitarian: null });
  }
});

test('out-of-range dimension scores are clamped, a bare number counts as the score, a non-numeric score is no signal', async () => {
  const ddb = fakeDdb(archive());
  const llm = fakeLlm(reply({ ...GOOD, dimensions: { conflict: { score: 130, why: 'w' }, political: 30, economic: { score: 'high', why: 'x' }, humanitarian: { score: -4 } } }));
  await run({ ddb, s3: fakeS3(), llm, env: { MAX_THREADS: '1' } }, {}, () => {});
  const row = threadRow(ddb, 'thr-c');
  assert.deepEqual(row.dimensions, { conflict: { score: 100, why: 'w' }, political: { score: 30, why: null }, economic: null, humanitarian: { score: 0, why: null } });
  assert.equal(row.riskScore, 100);
});

test('sentiment is clamped to [-1, 1] and only a number is kept; optional sections default to empty', async () => {
  for (const [given, want] of [[5, 1], [-3, -1], ['0.2', null], [undefined, null], [0, 0]]) {
    const ddb = fakeDdb(archive());
    const minimal = { threadTitle: 'T', storyArc: 'A', sentiment: given };
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(minimal)), env: { MAX_THREADS: '1' } }, {}, () => {});
    const row = threadRow(ddb, 'thr-c');
    assert.equal(row.sentiment, want, `sentiment ${given}`);
    assert.deepEqual([row.entryShortTitles, row.watchQuestions, row.keyActors], [[], [], []]);
    assert.deepEqual([row.trajectory, row.rootCauseChain, row.inflectionTopicId], [null, null, null]);
  }
});

test('a fenced reply and a reply with trailing commas are both parsed', async () => {
  const fenced = '```json\n' + reply(GOOD) + '\n```';
  const commas = reply(GOOD).replace(/\]/g, ',]').replace(/\}$/, ',}');
  for (const content of [fenced, commas]) {
    const ddb = fakeDdb(archive());
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(content), env: { MAX_THREADS: '1' } }, {}, (_, out) => assert.match(out.body, /1 generated/));
    assert.equal(threadRow(ddb, 'thr-c').threadTitle, 'Ceasefire talks stall again');
  }
});

test('a malformed reply fails that thread: nothing is stored, the failure is counted and logged with the raw text', async () => {
  const ddb = fakeDdb(archive());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm('Sorry, I cannot produce JSON here'), env: { MAX_THREADS: '1' } }, {}, ({ logs, s3 }, out) => {
    assert.match(out.body, /0 generated, 2 skipped .*, 1 failed/);
    assert.ok(logs.error.some((l) => /Failed to analyze thr-c/.test(l) && /Failed to parse/.test(l)), logs.error.join('\n'));
    assert.equal(s3.objs.size, 0, 'no record note for a failed thread');
  });
  assert.equal(ddb.puts.length, 0);
});

test('a reply missing threadTitle or storyArc is refused (required fields), whatever else it carries', async () => {
  for (const bad of [{ ...GOOD, threadTitle: undefined }, { ...GOOD, storyArc: '' }, {}, []]) {
    const ddb = fakeDdb(archive());
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(bad)), env: { MAX_THREADS: '1' } }, {}, ({ logs }, out) => {
      assert.match(out.body, /0 generated, .* 1 failed/);
      assert.ok(logs.error.some((l) => /Missing required fields/.test(l)), logs.error.join('\n'));
    });
    assert.equal(ddb.puts.length, 0);
  }
});

test('one thread failing does not stop the others (LLM error on the first, success on the second)', async () => {
  const ddb = fakeDdb(archive());
  const llm = fakeLlm([new Error('DeepSeek 503'), reply(GOOD)]);
  await run({ ddb, s3: fakeS3(), llm, env: { MAX_THREADS: '2' } }, {}, ({ logs }, out) => {
    assert.match(out.body, /1 generated, 1 skipped .*, 1 failed/);
    assert.ok(logs.error.some((l) => /Failed to analyze thr-c: DeepSeek 503/.test(l)));
  });
  assert.equal(threadRow(ddb, 'thr-c'), undefined, 'the failed thread stores nothing');
  assert.equal(threadRow(ddb, 'thr-a').threadTitle, 'Ceasefire talks stall again');
});

test('MAX_THREADS caps the model calls: newest activity first; the rest are counted as skipped (over-cap), not failed', async () => {
  const ddb = fakeDdb(archive());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '2' } }, {}, ({ llm }, out) => {
    assert.equal(llm.calls.length, 2);
    assert.match(out.body, /2 generated, 1 skipped .*, 0 failed/);
  });
  assert.ok(threadRow(ddb, 'thr-c'));
  assert.ok(threadRow(ddb, 'thr-a'));
  assert.equal(threadRow(ddb, 'thr-b'), undefined, 'the oldest changed thread waits for the next run');
});

test('only threads with two or more entries are analysed; entries without a threadId are ignored', async () => {
  const ddb = fakeDdb(archiveRows({
    1: [entry('s-1', 'solo'), entry('n-1', undefined), entry('n-2', null)],
    2: [entry('t-1', 'duo')], 3: [entry('t-2', 'duo')],
  }));
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }, out) => {
    assert.equal(llm.calls.length, 1);
    assert.match(out.body, /1 generated, 0 skipped/);
  });
  assert.ok(threadRow(ddb, 'duo'));
  assert.equal(threadRow(ddb, 'solo'), undefined);
});

test('a thread whose entries were all analysed already is skipped; a new entry re-runs it', async () => {
  const stored = (ids) => ({ PK: 'THREAD#thr-a', SK: 'THREAD_ANALYSIS', threadId: 'thr-a', entryTopicIds: ids, entryCount: ids.length });
  const only = archiveRows({ 1: [entry('a-2', 'thr-a')], 3: [entry('a-1', 'thr-a')] });
  const same = fakeDdb([...only, stored(['a-1', 'a-2'])]);
  await run({ ddb: same, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }, out) => {
    assert.equal(llm.calls.length, 0);
    assert.match(out.body, /0 generated, 1 skipped .*, 0 failed/);
  });
  assert.equal(same.puts.length, 0);

  const grown = fakeDdb([...only, stored(['a-1'])]);
  await run({ ddb: grown, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }, out) => {
    assert.equal(llm.calls.length, 1);
    assert.match(out.body, /1 generated/);
  });
  assert.deepEqual(threadRow(grown, 'thr-a').entryTopicIds, ['a-1', 'a-2']);
});

test('a failed read of the stored analysis counts as "none yet" (the thread is analysed), and a failed archive day is skipped', async () => {
  const bad = dayAgo(7).key;
  const ddb = fakeDdb(archive(), {
    fail: (name, input) => ((input.Key && input.Key.PK === 'THREAD#thr-c' && name === 'GetCommand') || (input.Key && input.Key.id === bad) ? new Error('throttled') : null),
  });
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '1' } }, {}, ({ logs }, out) => {
    assert.match(out.body, /1 generated/);
    assert.ok(logs.warn.some((l) => l.includes(`Failed to read ${bad}`)), logs.warn.join('\n'));
  });
  assert.ok(threadRow(ddb, 'thr-c'));
});

test('dry run: no model call, no writes; the plan says what would run and what would be skipped', async () => {
  const stored = { PK: 'THREAD#thr-a', SK: 'THREAD_ANALYSIS', threadId: 'thr-a', entryTopicIds: ['a-1', 'a-2'], entryCount: 2 };
  const ddb = fakeDdb([...archive(), stored]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '1' } }, { dryRun: true }, ({ llm, s3 }, out) => {
    assert.equal(out.dryRun, true);
    assert.equal(out.threads, 3);
    assert.equal(llm.calls.length, 0);
    assert.equal(s3.objs.size, 0);
    const byId = Object.fromEntries(out.plan.map((p) => [p.threadId, p]));
    assert.equal(byId['thr-c'].run, true);
    assert.equal(byId['thr-c'].reason, 'new-thread');
    assert.equal(byId['thr-b'].run, false);
    assert.equal(byId['thr-b'].reason, 'over-cap');
    assert.equal(byId['thr-a'].run, false);
    assert.equal(byId['thr-a'].reason, 'no-new-events');
    assert.deepEqual(out.counts, { 'analyse:new-thread': 1, 'skip:over-cap': 1, 'skip:no-new-events': 1 });
  });
  assert.equal(ddb.puts.length, 0);
});

test('missing table config or API key answers 500 and reads nothing', async () => {
  for (const [env, body] of [[{ TOPICS_DDB_TABLE: undefined }, 'Missing table config'], [{ SUMMARIZE_PREDICT_TABLE: undefined }, 'Missing table config'], [{ XAI_API_KEY: '' }, 'Missing API key']]) {
    const ddb = fakeDdb(archive());
    await run({ ddb, llm: fakeLlm(reply(GOOD)), env }, {}, ({ llm }, out) => {
      assert.deepEqual(out, { statusCode: 500, body });
      assert.equal(llm.calls.length, 0);
    });
    assert.equal(ddb.sent.length, 0);
  }
});

// ─── The record note ────────────────────────────────────────────────────────────

test('the stored analysis is also written as one story_analysis note under NOTES_PREFIX (default record/shadow/), citing the thread entries', async () => {
  const ddb = fakeDdb(archive());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '1' } }, {}, ({ s3 }) => {
    const day = threadRow(ddb, 'thr-c').generatedAt.slice(0, 10);
    assert.deepEqual(s3.keys(), [`record/shadow/notes/story_analysis/${day}.jsonl`, 'record/shadow/notes/story_analysis/manifest.json']);
    const [note] = s3.lines(`record/shadow/notes/story_analysis/${day}.jsonl`);
    assert.equal(note.subtype, 'story_analysis');
    assert.deepEqual(note.subject, { kind: 'story', id: 'thr-c' });
    assert.equal(note.payload.threadTitle, 'Ceasefire talks stall again');
    assert.equal(note.payload.riskScore, 72);
    assert.equal(note.cites.length, 2);
    assert.deepEqual(note.producer.lambda, 'newsThreadAnalysis');
    assert.deepEqual(note.iso3, ['JPN']);
    for (const k of ['PK', 'SK', 'ttl']) assert.equal(k in note.payload, false, k);
  });
});

test('NOTES_PREFIX moves the note to the record', async () => {
  const ddb = fakeDdb(archive());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '1', NOTES_PREFIX: 'record/' } }, {}, ({ s3 }) => {
    assert.ok(s3.keys().length === 2 && s3.keys().every((k) => k.startsWith('record/notes/story_analysis/')), s3.keys().join());
  });
});

test('a failed note write is logged [notes] and never fails the run or the DynamoDB rows', async () => {
  const ddb = fakeDdb(archive());
  const s3 = fakeS3({}, { fail: () => new Error('S3 down') });
  await run({ ddb, s3, llm: fakeLlm(reply(GOOD)), env: { MAX_THREADS: '1' } }, {}, ({ logs }, out) => {
    assert.match(out.body, /1 generated, .* 0 failed/);
    assert.ok(logs.error.some((l) => l.startsWith('[notes] story_analysis note not written: S3 down')), logs.error.join('\n'));
  });
  assert.ok(threadRow(ddb, 'thr-c'));
});

test('ARCHIVE_READS=inbox reads the window from the entries inbox: no archive row in DynamoDB, the same THREAD# row', async () => {
  const days = { 1: [entry('c-2', 'thr-c', { regions: ['Japan'] })], 2: [entry('a-2', 'thr-a'), entry('c-1', 'thr-c', { regions: ['Japan'] })], 3: [entry('a-1', 'thr-a')] };
  const ddb = fakeDdb();
  const s3 = fakeS3(inboxObjects(days));
  const env = { MAX_THREADS: '1', ARCHIVE_READS: 'inbox', ENTRIES_INBOX_PREFIX: 'record/' };
  await run({ ddb, s3, llm: fakeLlm(reply(GOOD)), env }, {}, ({ llm }, out) => {
    assert.equal(out.statusCode, 200);
    assert.match(llm.calls[0].user, /Headline c-1/);
    assert.match(llm.calls[0].user, /Summary of c-2/);
  });
  assert.equal(threadRow(ddb, 'thr-c').entryCount, 2);
  assert.ok(!ddb.sent.some((c) => c.name === 'GetCommand' && c.input.TableName === 'topics'), 'no NewsCache read');
});
