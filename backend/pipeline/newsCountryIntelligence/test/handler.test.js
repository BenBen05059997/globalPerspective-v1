'use strict';
// The newsCountryIntelligence handler, offline: fake DynamoDB (archive rows, thread analyses, previous briefings, drift notes, facts),
// a fake world file (global fetch), a scripted model and fake S3. What a reader would notice: which countries get a briefing, the
// COUNTRY# row the country page and the map read, what the model is told (corrections, facts), and that one failure never stops the rest.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { withLambda, fakeDdb, fakeS3, fakeLlm, archiveRows } = require('../../../shared/test/pipelineHarness');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = {
  TOPICS_DDB_TABLE: 'topics', SUMMARIZE_PREDICT_TABLE: 'summary', XAI_API_KEY: 'k', LLM_CONCURRENCY: undefined, COUNTRY_TOP_N: undefined,
  NOTES_PREFIX: undefined, NOTES_READS: undefined, WORLD_LATEST_URL: 'https://world.test/latest.json', GROK_MODEL: undefined,
};
const today = new Date().toISOString().slice(0, 10);
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

const entry = (topicId, regions, extra = {}) => ({ topicId, title: `Headline ${topicId}`, regions, category: 'politics', sources: [{ url: `https://example.com/${topicId}` }], ai: {}, ...extra });
const ARCHIVE = () => archiveRows({
  1: [entry('j-2', ['Japan'], { threadId: 'thr-j' }), entry('f-2', ['France'])],
  2: [entry('j-1', ['Japan'], { threadId: 'thr-j' }), entry('f-1', ['France']), entry('e-1', ['Europe']), entry('e-2', ['Europe']), entry('b-1', ['Brazil'])],
});
const THREAD_J = { PK: 'THREAD#thr-j', SK: 'THREAD_ANALYSIS', threadTitle: 'Japan rate path', storyArc: 'The BOJ moved.', trajectory: 'Gradual hikes ahead.', keyActors: [{ name: 'Kazuo Ueda', role: 'BOJ Governor' }] };

const GOOD = {
  headline: 'Japan weighs its next rate move', bluf: 'Tokyo is edging toward tighter policy.',
  keyDevelopments: Array.from({ length: 9 }, (_, i) => ({ date: `2026-10-${10 + i}`, text: `Development ${i}` })),
  whyItMatters: 'It matters.', backgroundTimeline: Array.from({ length: 17 }, (_, i) => ({ date: '2026-10-01', event: `E${i}`, category: 'economy', topicId: null })),
  crossThreadInsight: 'Linked.', trajectory: 'escalating', trajectoryDetail: 'Detail.',
  riskSignals: ['s1', 's2', 's3', 's4', 's5'],
  dimensions: { conflict: null, political: { score: 35, why: 'Coalition strain' }, economic: { score: 61, why: ' Yen slide ' }, humanitarian: null },
  keyActors: Array.from({ length: 10 }, (_, i) => ({ name: `Actor ${i}`, role: 'Minister', threadCount: 1 })),
};
const reply = (o) => JSON.stringify(o);

async function withFetch(fn, body) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return fn(url); };
  try { return await body(calls); } finally { globalThis.fetch = original; }
}
const worldOk = (world) => async () => ({ ok: true, status: 200, json: async () => world });
const world = (situations = []) => worldOk({ situations });

const run = (opts, event, body) => withFetch(opts.fetch || world(), (fetchCalls) => withLambda(INDEX, { env: { ...ENV, ...(opts.env || {}) }, ddb: opts.ddb, s3: opts.s3, llm: opts.llm }, async (ctx) => body({ ...ctx, fetchCalls }, await ctx.mod.handler(event))));
const row = (ddb, country) => ddb.store.get(`COUNTRY#${country}|COUNTRY_INTELLIGENCE`);
// pick the scripted reply by the country named in the prompt
const byCountry = (map) => (o) => { const m = /Country: (.+)\n/.exec(o.user); const r = map[m && m[1]]; if (r === undefined) throw new Error(`no reply for ${m && m[1]}`); return r; };

test('a briefing is stored as COUNTRY#<name> plus a HISTORY# snapshot; regions and one-article places get none', async () => {
  const ddb = fakeDdb([...ARCHIVE(), THREAD_J]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(byCountry({ Japan: reply(GOOD), France: reply(GOOD) })) }, {}, ({ llm, logs }, out) => {
    assert.equal(out.statusCode, 200);
    assert.match(out.body, /2 generated \(new 2\), 0 skipped, 0 failed/);
    assert.deepEqual(llm.calls.map((c) => c.step), ['country_intel', 'country_intel']);
    assert.ok(logs.log.some((l) => /Found 3 keys with 2\+ articles: 2 countries, 1 excluded as regions \/ aggregates \(Europe\)/.test(l)), logs.log.join('\n'));
  });
  assert.equal(row(ddb, 'Europe'), undefined);
  assert.equal(row(ddb, 'Brazil'), undefined);
  const r = row(ddb, 'Japan');
  assert.equal(r.PK, 'COUNTRY#Japan');
  assert.equal(r.countryName, 'Japan');
  assert.equal(r.headline, GOOD.headline);
  assert.equal(r.bluf, GOOD.bluf);
  assert.equal(r.trajectory, 'escalating');
  assert.equal(r.totalArticles, 2);
  assert.equal(r.activeArcCount, 1);
  assert.deepEqual(r.threadIds, ['thr-j']);
  assert.equal(r.dayCount, 2);
  assert.equal(r.model, 'fake-model');
  assert.ok(Math.abs(r.ttl - (Date.now() / 1000 + 90 * 86400)) < 60);
  // the model reply is trimmed to what the page can show
  assert.equal(r.keyDevelopments.length, 7);
  assert.equal(r.backgroundTimeline.length, 15);
  assert.equal(r.riskSignals.length, 4);
  assert.equal(r.keyActors.length, 8);
  // risk comes from the worst axis, not from anything the model says about the overall score
  assert.equal(r.riskScore, 61);
  assert.equal(r.riskLevel, 'elevated');
  assert.equal(r.lead, 'economic');
  assert.deepEqual(r.dimensions, { conflict: null, political: { score: 35, why: 'Coalition strain' }, economic: { score: 61, why: 'Yen slide' }, humanitarian: null });

  const h = ddb.store.get(`COUNTRY#Japan|HISTORY#${today}`);
  assert.equal(h.dateKey, today);
  assert.equal(h.riskScore, 61);
  assert.equal(h.riskLevel, 'elevated');
  assert.equal(h.lead, 'economic');
  assert.equal(h.trajectory, 'escalating');
  assert.equal(h.headline, GOOD.headline);
  assert.deepEqual(h.dimensions, r.dimensions);
  assert.equal(h.ttl, r.ttl);
  assert.equal(ddb.puts.filter((p) => p.table === 'summary').length, 4); // 2 countries x (briefing + history)
});

test('the model sees the thread analysis, the single articles and the archive window of the country', async () => {
  const ddb = fakeDdb([...ARCHIVE(), THREAD_J]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }) => {
    const japan = llm.calls.map((c) => c.user).find((u) => /Country: Japan/.test(u));
    assert.match(japan, /Thread 1: "Japan rate path" \[politics\] — 2 articles/);
    assert.match(japan, /Story arc: The BOJ moved\./);
    assert.match(japan, /Trajectory: Gradual hikes ahead\./);
    assert.match(japan, /Actors: Kazuo Ueda \(BOJ Governor\)/);
    assert.match(japan, /Total articles: 2 across 2 days/);
    const france = llm.calls.map((c) => c.user).find((u) => /Country: France/.test(u));
    assert.match(france, /SINGLE ARTICLES/);
    assert.match(france, /"Headline f-1" \[politics\] \(topicId: f-1\)/);
  });
});

test('"USA" and "United States" are one record under the canonical name', async () => {
  const ddb = fakeDdb(archiveRows({ 1: [entry('u-1', ['USA'])], 2: [entry('u-2', ['United States'])] }));
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }, out) => {
    assert.match(out.body, /1 generated/);
    assert.match(llm.calls[0].user, /Country: United States/);
  });
  assert.ok(row(ddb, 'United States'));
  assert.equal(row(ddb, 'USA'), undefined);
  assert.equal(row(ddb, 'United States').totalArticles, 2);
});

// ─── reply handling ──────────────────────────────────────────────────────────────

test('a fenced reply is parsed', async () => {
  const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }));
  await run({ ddb, s3: fakeS3(), llm: fakeLlm('```json\n' + reply(GOOD) + '\n```') }, {}, (_, out) => assert.match(out.body, /1 generated/));
  assert.equal(row(ddb, 'Japan').headline, GOOD.headline);
});

test('a malformed reply, or one without bluf or keyDevelopments, fails that country and stores nothing', async () => {
  for (const [content, why] of [['not json at all', /Failed to parse/], [reply({ ...GOOD, bluf: '' }), /Missing required fields/], [reply({ ...GOOD, keyDevelopments: undefined }), /Missing required fields/]]) {
    const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }));
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(content) }, {}, ({ logs, s3 }, out) => {
      assert.match(out.body, /0 generated \(none\), 0 skipped, 1 failed/);
      assert.ok(logs.error.some((l) => /Failed to analyze Japan/.test(l) && why.test(l)), logs.error.join('\n'));
      assert.equal(s3.objs.size, 0);
    });
    assert.equal(ddb.puts.length, 0);
  }
});

test('without dimensions a legacy riskScore/riskLevel is used (score clamped, level derived when absent); with neither, risk is null and the level "moderate"', async () => {
  const noDims = (o) => { const { dimensions, ...rest } = GOOD; return reply({ ...rest, ...o }); };
  for (const [legacy, want] of [
    [{ riskScore: 88, riskLevel: 'severe' }, { riskScore: 88, riskLevel: 'severe' }],
    [{ riskScore: 130 }, { riskScore: 100, riskLevel: 'high' }],
    [{ riskScore: 30 }, { riskScore: 30, riskLevel: 'moderate' }],
    [{}, { riskScore: null, riskLevel: 'moderate' }],
  ]) {
    const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }));
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(noDims(legacy)) }, {}, () => {});
    const r = row(ddb, 'Japan');
    assert.equal(r.riskScore, want.riskScore, JSON.stringify(legacy));
    assert.equal(r.riskLevel, want.riskLevel, JSON.stringify(legacy));
    assert.equal(r.lead, null);
    assert.equal(ddb.store.get(`COUNTRY#Japan|HISTORY#${today}`).riskScore, want.riskScore);
  }
});

test('optional fields default: trajectory "stable", lists empty, text fields null', async () => {
  const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }));
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply({ bluf: 'B', keyDevelopments: 'not a list' })) }, {}, () => {});
  const r = row(ddb, 'Japan');
  assert.equal(r.trajectory, 'stable');
  assert.deepEqual([r.keyDevelopments, r.backgroundTimeline, r.riskSignals, r.keyActors], [[], [], [], []]);
  assert.deepEqual([r.headline, r.whyItMatters, r.crossThreadInsight, r.trajectoryDetail], [null, null, null, null]);
});

// ─── the record note ─────────────────────────────────────────────────────────────

test('each stored briefing is also written as a country note under NOTES_PREFIX with its ISO3; a failed write never fails the run', async () => {
  const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }));
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ s3 }) => {
    const [file] = s3.keys('record/shadow/notes/country/').filter((k) => k.endsWith('.jsonl'));
    assert.ok(file, s3.keys().join());
    const [note] = s3.lines(file);
    assert.equal(note.subtype, 'country');
    assert.deepEqual(note.iso3, ['JPN']);
    assert.equal(note.payload.headline, GOOD.headline);
    assert.equal(note.producer.lambda, 'newsCountryIntelligence');
  });

  const ddb2 = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }));
  await run({ ddb: ddb2, s3: fakeS3({}, { fail: () => new Error('S3 down') }), llm: fakeLlm(reply(GOOD)) }, {}, ({ logs }, out) => {
    assert.match(out.body, /1 generated/);
    assert.ok(logs.error.some((l) => l.startsWith('[notes] country note not written: S3 down')), logs.error.join('\n'));
  });
  assert.ok(row(ddb2, 'Japan'));
});

// ─── who is briefed ──────────────────────────────────────────────────────────────

test('a country briefed today, or whose article count is unchanged, is skipped without a model call; an older changed one is not', async () => {
  const existing = (country, over) => ({ PK: `COUNTRY#${country}`, SK: 'COUNTRY_INTELLIGENCE', countryName: country, ...over });
  const ddb = fakeDdb([
    ...ARCHIVE(), THREAD_J,
    existing('Japan', { generatedAt: new Date().toISOString(), totalArticles: 1 }),   // already today
    existing('France', { generatedAt: hoursAgo(30), totalArticles: 2 }),               // same count
  ]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }, out) => {
    assert.equal(llm.calls.length, 0);
    assert.match(out.body, /0 generated \(none\), 2 skipped, 0 failed/);
  });
  assert.equal(ddb.puts.length, 0);

  const ddb2 = fakeDdb([...ARCHIVE(), THREAD_J, existing('Japan', { generatedAt: hoursAgo(24 * 8), totalArticles: 1 })]); // a week old, grew
  await run({ ddb: ddb2, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, (_, out) => {
    assert.match(out.body, /2 generated \(.*\), 0 skipped, 0 failed/);
    assert.match(out.body, /weekly-baseline 1/);
    assert.match(out.body, /new 1/);
  });
});

test('a failed read of the previous briefing counts as "none yet": the country is briefed as new', async () => {
  const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }), {
    fail: (name, input) => (input.Key && input.Key.SK === 'COUNTRY_INTELLIGENCE' ? new Error('throttled') : null),
  });
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, (_, out) => assert.match(out.body, /1 generated \(new 1\)/));
  assert.ok(row(ddb, 'Japan'));
});

test('COUNTRY_TOP_N limits the briefings; a country beyond it is briefed only when a HIGH situation names it', async () => {
  const twoSits = (names) => world(names.map((n, i) => ({ id: `s${i}`, state: 'escalating', tier: 'high', affected_names: [n], opened_at: hoursAgo(1) })));
  const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan']), entry('j-3', ['Japan']), entry('f-2', ['France'])], 2: [entry('j-1', ['Japan']), entry('f-1', ['France'])] }));
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { COUNTRY_TOP_N: '1' } }, {}, ({ llm }, out) => {
    assert.equal(llm.calls.length, 1);
    assert.match(llm.calls[0].user, /Country: Japan/);
    assert.match(out.body, /1 generated/);
  });
  assert.equal(row(ddb, 'France'), undefined);

  const ddb2 = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan']), entry('j-3', ['Japan']), entry('f-2', ['France'])], 2: [entry('j-1', ['Japan']), entry('f-1', ['France'])] }));
  await run({ ddb: ddb2, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), env: { COUNTRY_TOP_N: '1' }, fetch: twoSits(['France']) }, {}, ({ llm }, out) => {
    assert.equal(llm.calls.length, 2);
    assert.match(out.body, /2 generated/);
  });
  assert.ok(row(ddb2, 'France'));
});

test('an unreachable or broken world file only means no alerts: the weekly briefings still run', async () => {
  for (const fetch of [async () => { throw new Error('network down'); }, async () => ({ ok: false, status: 503, json: async () => ({}) })]) {
    const ddb = fakeDdb(archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }));
    await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)), fetch }, {}, ({ logs, fetchCalls }, out) => {
      assert.match(out.body, /1 generated/);
      assert.deepEqual(fetchCalls, ['https://world.test/latest.json']);
      assert.ok(logs.log.some((l) => /\[world\] .* FAILED/.test(l)), logs.log.join('\n'));
    });
  }
});

test('dry run: no model call, no writes; reports the plan, the world read and the excluded keys', async () => {
  const ddb = fakeDdb([...ARCHIVE(), THREAD_J]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, { dryRun: true }, ({ llm, s3 }, out) => {
    assert.equal(out.dryRun, true);
    assert.equal(llm.calls.length, 0);
    assert.equal(s3.objs.size, 0);
    assert.deepEqual(out.world, { url: 'https://world.test/latest.json', ok: true, status: 200, situations: 0 });
    assert.deepEqual(out.excludedKeys, [{ key: 'Europe', articles: 2 }]);
    assert.deepEqual(out.plan.map((p) => [p.country, p.refresh, p.reason]).sort(), [['France', true, 'new'], ['Japan', true, 'new']]);
    assert.deepEqual(out.counts, { 'refresh:new': 2 });
  });
  assert.equal(ddb.puts.length, 0);
});

test('missing table config or API key answers 500 and reads nothing', async () => {
  for (const [env, body] of [[{ TOPICS_DDB_TABLE: undefined }, 'Missing table config'], [{ SUMMARIZE_PREDICT_TABLE: undefined }, 'Missing table config'], [{ XAI_API_KEY: '' }, 'Missing API key']]) {
    const ddb = fakeDdb(ARCHIVE());
    await run({ ddb, llm: fakeLlm(reply(GOOD)), env }, {}, ({ llm }, out) => {
      assert.deepEqual(out, { statusCode: 500, body });
      assert.equal(llm.calls.length, 0);
    });
    assert.equal(ddb.sent.length, 0);
  }
});

// ─── mapWithConcurrency, seen through the handler ────────────────────────────────

const FOUR = () => archiveRows({
  1: ['Japan', 'France', 'Germany', 'Italy'].map((c) => entry(`${c}-2`, [c])),
  2: ['Japan', 'France', 'Germany', 'Italy'].map((c) => entry(`${c}-1`, [c])),
});
function trackedLlm(delayMs = 5) {
  const state = { inFlight: 0, max: 0 };
  const l = fakeLlm(async () => {
    state.inFlight += 1; state.max = Math.max(state.max, state.inFlight);
    await new Promise((r) => setTimeout(r, delayMs));
    state.inFlight -= 1;
    return reply(GOOD);
  });
  return Object.assign(l, { state });
}

test('LLM_CONCURRENCY bounds the model calls in flight, and every country is still briefed exactly once', async () => {
  for (const [limit, wantMax] of [['2', 2], ['1', 1], ['10', 4]]) {
    const ddb = fakeDdb(FOUR());
    const llm = trackedLlm();
    await run({ ddb, s3: fakeS3(), llm, env: { LLM_CONCURRENCY: limit } }, {}, (_, out) => assert.match(out.body, /4 generated/));
    assert.equal(llm.state.max, wantMax, `limit ${limit}`);
    assert.equal(llm.calls.length, 4);
    for (const c of ['Japan', 'France', 'Germany', 'Italy']) assert.ok(row(ddb, c), c);
  }
});

test('a failure in one worker does not stop the others (3 generated, 1 failed)', async () => {
  const ddb = fakeDdb(FOUR());
  const llm = fakeLlm(byCountry({ Japan: reply(GOOD), France: new Error('timeout'), Germany: reply(GOOD), Italy: reply(GOOD) }));
  await run({ ddb, s3: fakeS3(), llm, env: { LLM_CONCURRENCY: '2' } }, {}, ({ logs }, out) => {
    assert.match(out.body, /3 generated \(new 3\), 0 skipped, 1 failed/);
    assert.ok(logs.error.some((l) => /Failed to analyze France: timeout/.test(l)));
  });
  assert.equal(row(ddb, 'France'), undefined);
  assert.ok(row(ddb, 'Italy'));
});

// ─── buildDriftBlock and loadAndMergeDDBFacts (the model's context) ──────────────

const drift = (asOf, why, extra = {}) => ({ PK: 'COUNTRY#Japan', SK: `DRIFT#${asOf}`, countryName: 'Japan', asOf, whyChanged: why, ...extra });

test('buildDriftBlock: the two most recent grounded corrections, newest first, with level, score and trigger event', async () => {
  const ddb = fakeDdb([
    drift('2026-10-22', 'oldest, not used'),
    drift('2026-10-23', 'Rates rose.', { changeLevel: { from: 'moderate', to: 'elevated' }, changeScore: { from: 40, to: 55 }, triggerEvent: { title: 'BOJ hikes' } }),
    drift('2026-10-24', 'Yen slid.', { changeScore: { from: 55, to: 61 } }),
    { ...drift('2026-10-24', 'log copy'), SK: 'DRIFTLOG#2026-10-24' },
  ]);
  await withLambda(INDEX, { env: ENV, ddb, s3: fakeS3() }, async ({ mod }) => {
    const block = await mod.reads.buildDriftBlock('Japan');
    assert.match(block, /RECENT CORRECTIONS TO OUR READ \(Japan\)/);
    const lines = block.split('\n').filter((l) => l.startsWith('- '));
    assert.deepEqual(lines, [
      '- As of 2026-10-24: risk moved 55→61. Yen slid.',
      '- As of 2026-10-23: risk moved moderate→elevated / 40→55 — because: BOJ hikes. Rates rose.',
    ]);
    const q = ddb.sent.find((s) => s.name === 'QueryCommand').input;
    assert.equal(q.Limit, 2);
    assert.equal(q.ScanIndexForward, false);
  });
});

test('buildDriftBlock: no notes, notes without a reason, or a failing query all give an empty block (the prompt just has no corrections)', async () => {
  for (const [ddb, label] of [
    [fakeDdb([]), 'none'],
    [fakeDdb([drift('2026-10-24', '')]), 'no whyChanged'],
    [fakeDdb([drift('2026-10-24', 'x')], { fail: () => new Error('throttled') }), 'query fails'],
  ]) {
    await withLambda(INDEX, { env: ENV, ddb, s3: fakeS3() }, async ({ mod }) => assert.equal(await mod.reads.buildDriftBlock('Japan'), '', label));
  }
});

test('the corrections reach the model prompt', async () => {
  const ddb = fakeDdb([...archiveRows({ 1: [entry('j-2', ['Japan'])], 2: [entry('j-1', ['Japan'])] }), drift('2026-10-24', 'Yen slid.', { changeScore: { from: 55, to: 61 } })]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }) => {
    assert.match(llm.calls[0].user, /As of 2026-10-24: risk moved 55→61\. Yen slid\./);
  });
});

const factsRow = (country, over) => ({ PK: `FACTS#${country}`, SK: 'COUNTRY_FACTS', countryName: country, leadershipString: 'Auto Leader (Head of Government, since 2025-10-21)', lastUpdatedAt: '2026-10-26T20:00:01.500Z', ...over });

test('loadAndMergeDDBFacts: automated leadership fills a country with no operator entry; ACLED activity is added as a summary line', async () => {
  const ddb = fakeDdb([factsRow('Japan', { acledData: { eventCount30d: 12, retrievedAt: '2026-10-26T01:00:00.000Z', latestEventSummary: 'Clashes in the north' } })]);
  await withLambda(INDEX, { env: ENV, ddb, s3: fakeS3() }, async ({ mod }) => {
    await mod.reads.loadAndMergeDDBFacts('Japan');
    const f = mod.reads.editorialFacts().Japan;
    assert.equal(f.currentLeadership, 'Auto Leader (Head of Government, since 2025-10-21)');
    assert.equal(f._autoSource, 'wikidata');
    assert.equal(f._autoUpdatedAt, '2026-10-26T20:00:01.500Z');
    assert.equal(f._acledSummary, '12 conflict events in past 30 days (ACLED, as of 2026-10-26). Latest: Clashes in the north');
  });
});

test('loadAndMergeDDBFacts: the operator JSON wins over the automated facts, and an operator conflict list suppresses the ACLED line', async () => {
  const ddb = fakeDdb([factsRow('Iran', { leadershipString: 'Auto Iran Leader', acledData: { eventCount30d: 3, latestEventSummary: 'x' } })]);
  await withLambda(INDEX, { env: ENV, ddb, s3: fakeS3() }, async ({ mod }) => {
    const operator = mod.reads.editorialFacts().Iran.currentLeadership;
    assert.match(operator, /Mojtaba Khamenei/);
    await mod.reads.loadAndMergeDDBFacts('Iran');
    const f = mod.reads.editorialFacts().Iran;
    assert.equal(f.currentLeadership, operator);
    assert.equal(f._autoSource, 'wikidata');
    assert.equal('_acledSummary' in f, false);
  });
});

test('loadAndMergeDDBFacts: no stored facts leaves the table untouched; a DynamoDB error is logged and swallowed', async () => {
  await withLambda(INDEX, { env: ENV, ddb: fakeDdb([]), s3: fakeS3() }, async ({ mod }) => {
    await mod.reads.loadAndMergeDDBFacts('Japan');
    assert.equal('Japan' in mod.reads.editorialFacts(), false);
  });
  await withLambda(INDEX, { env: ENV, ddb: fakeDdb([], { fail: () => new Error('boom') }), s3: fakeS3() }, async ({ mod, logs }) => {
    await mod.reads.loadAndMergeDDBFacts('Japan');
    assert.ok(logs.warn.some((l) => /DDB facts load failed for Japan: boom/.test(l)), logs.warn.join('\n'));
  });
});

test('the editorial block reaches the model prompt: operator facts for Iran, automated leadership for Japan', async () => {
  const ddb = fakeDdb([
    ...archiveRows({ 1: [entry('j-2', ['Japan']), entry('i-2', ['Iran'])], 2: [entry('j-1', ['Japan']), entry('i-1', ['Iran'])] }),
    factsRow('Japan', { leadershipString: 'Sanae Example (Head of Government, since 2025-10-21)' }),
  ]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(reply(GOOD)) }, {}, ({ llm }) => {
    const prompts = llm.calls.map((c) => c.user);
    const japan = prompts.find((u) => /Country: Japan/.test(u));
    const iran = prompts.find((u) => /Country: Iran/.test(u));
    assert.match(japan, /EDITORIAL CONTEXT for Japan/);
    assert.match(japan, /▸ Current leadership: Sanae Example/);
    assert.match(iran, /EDITORIAL CONTEXT for Iran .*\(last reviewed 2026-04-18 by operator\)/);
    assert.match(iran, /Iran-Israel War \(started 2026-02-28\)/);
  });
});
