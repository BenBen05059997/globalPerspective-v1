'use strict';
// The newsSystemsAnalysis handler, offline: fake DynamoDB (archive, thread analyses, stored webs), a scripted model, fake S3 (web history and record notes).
// The SYSTEMS# rows, WEB#INDEX and THREAD#/WEB records are what the home page, country pages and story pages read as "how stories connect".
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { withLambda, fakeDdb, fakeS3, fakeLlm, dayAgo, archiveRows } = require('../../../shared/test/pipelineHarness');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = {
  TOPICS_DDB_TABLE: 'topics', SUMMARIZE_PREDICT_TABLE: 'summary', XAI_API_KEY: 'k', WORLD_BUCKET: 'bkt', SYSTEMS_TOP_N: undefined, SYSTEMS_TEST_COUNTRIES: undefined,
  NOTES_PREFIX: undefined, NOTES_READS: undefined, GROK_MODEL: undefined, MAX_TOKENS: undefined,
};
const D = (n) => dayAgo(n).date;
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

const e = (id, thread, regions = ['Japan'], extra = {}) => ({ topicId: id, threadId: thread, title: `Headline ${id}`, regions, category: 'Economy', sources: [{ url: `https://example.com/${id}`, title: 'x' }], ...extra });
const threadEntries = (country, ids) => ids.flatMap((id, i) => [[1 + i % 2, e(`${id}-b`, id, [country])], [3 + i % 2, e(`${id}-a`, id, [country])]]);
const rowsFor = (specs) => { // [[daysAgo, entry], ...] -> archive rows
  const by = {};
  for (const [n, entry] of specs) (by[n] ||= []).push(entry);
  return archiveRows(by);
};
// Japan: four stories of two entries each (8 entries); thread analyses are not needed
// (archive rows are one per day, so countries are combined as specs and turned into rows once)
const JAPAN_SPECS = threadEntries('Japan', ['thr-j1', 'thr-j2', 'thr-j3', 'thr-j4']);
const FRANCE_SPECS = threadEntries('France', ['thr-f1', 'thr-f2']);
const JAPAN = () => rowsFor(JAPAN_SPECS);
const FRANCE = () => rowsFor(FRANCE_SPECS);
const BOTH_SPECS = [...JAPAN_SPECS, ...FRANCE_SPECS];

// A model reply that cites entries by the code printed in the prompt ("E3 | 2026-10-29 | Headline j1-a"): edges give the entry ids they cite
const codesOf = (prompt) => Object.fromEntries([...prompt.matchAll(/^\s+(E\d+) \| [\d-]+ \| (.*)$/gm)].map((m) => [m[2], m[1]]));
const graph = (nodes, edges = []) => (o) => {
  const codes = codesOf(o.user);
  return JSON.stringify({ nodes, edges: edges.map(({ cites = [], ...rest }) => ({ ...rest, citedEntries: cites.map((id) => codes[`Headline ${id}`] || id) })) });
};
const node = (threadId, actors, summary = `About ${threadId}`) => ({ threadId, category: 'economy', peakDate: D(2), actors, summary });
const NODES = [node('thr-j1', ['Japan', 'Bank of Japan']), node('thr-j2', ['Bank of Japan', 'Nikkei']), node('thr-j3', ['Toyota']), node('thr-j4', ['Nikkei'])];

const pagedScan = (size = 1) => (input, store) => {
  const all = [...store.values()].filter((it) => typeof it.PK === 'string' && it.PK.startsWith('SYSTEMS#') && it.SK === 'SYSTEMS_ANALYSIS');
  const start = input.ExclusiveStartKey ? input.ExclusiveStartKey.i : 0;
  return { Items: all.slice(start, start + size), ...(start + size < all.length ? { LastEvaluatedKey: { i: start + size } } : {}) };
};
const mkDdb = (rows, opts = {}) => fakeDdb(rows, { scan: pagedScan(1), ...opts });

const run = (opts, event, body) => withLambda(INDEX, { env: { ...ENV, ...(opts.env || {}) }, ddb: opts.ddb, s3: opts.s3, llm: opts.llm }, async (ctx) => body(ctx, await ctx.mod.handler(event)));
const systems = (ddb, country) => ddb.store.get(`SYSTEMS#${country}|SYSTEMS_ANALYSIS`);

const EDGES = [
  { from: 'thr-j1', to: 'thr-j2', lagDays: 200, mechanism: 'Rates moved the index.', confidence: 'strong', cites: ['thr-j1-a', 'thr-j1-b', 'thr-j2-a'] },
  { from: 'thr-j1', to: 'thr-j3', lagDays: 3, mechanism: 'Yen and exports.', confidence: 'strong', cites: ['thr-j1-a', 'thr-j3-a', 'not-a-shown-entry'] },
  { from: 'thr-j1', to: 'thr-j4', lagDays: 'soon', mechanism: 'Weak link.', confidence: 'weak', cites: ['thr-j1-a'] },
  { from: 'thr-j1', to: 'thr-j2', lagDays: 1, mechanism: 'A fourth edge from the same story.', confidence: 'weak', cites: ['thr-j1-b'] },
  { from: 'thr-j2', to: 'thr-j2', lagDays: 0, mechanism: 'self', confidence: 'weak', cites: ['thr-j2-a'] },
  { from: 'thr-j2', to: 'thr-zzz', lagDays: 0, mechanism: 'unknown story', confidence: 'weak', cites: ['thr-j2-a'] },
  { from: 'thr-j3', to: 'thr-j4', lagDays: 0, mechanism: 'no citation survives', confidence: 'strong', cites: ['made-up'] },
];

test('a valid reply is stored as SYSTEMS#<country> (14 day TTL), with the story index WEB#INDEX and a THREAD#<id>/WEB record per story, and a dated copy in S3', async () => {
  const ddb = mkDdb(JAPAN());
  const llm = fakeLlm(graph(NODES, [EDGES[0]]));
  const s3 = fakeS3();
  await run({ ddb, s3, llm }, {}, ({}, out) => {
    assert.equal(out.statusCode, 200);
    assert.equal(out.body, 'Systems analysis complete: 1 generated, 0 failed');
    assert.equal(out.coverage.threadsInScope, 4);

    assert.equal(llm.calls.length, 1);
    assert.equal(llm.calls[0].step, 'systems_web');
    assert.equal(llm.calls[0].json, true);
    assert.match(llm.calls[0].system, /causal analysis engine/);
    assert.match(llm.calls[0].user, /STORY THREADS IN JAPAN/);
  });
  const row = systems(ddb, 'Japan');
  assert.equal(row.PK, 'SYSTEMS#Japan');
  assert.equal(row.countryName, 'Japan');
  assert.equal(row.totalArticles, 8);
  assert.equal(row.threadCount, 4);
  assert.equal(row.model, 'deepseek-v4-pro');
  assert.ok(Math.abs(row.ttl - (Date.now() / 1000 + 14 * 86400)) < 60);
  assert.equal(row.nodes.length, 4);
  assert.equal(row.edges.length, 1);
  assert.deepEqual([row.edges[0].from, row.edges[0].to, row.edges[0].confidence, row.edges[0].class, row.edges[0].relation], ['thr-j1', 'thr-j2', 'strong', 'causal', 'inferred_influence']);

  const index = ddb.store.get('WEB#INDEX|LATEST');
  assert.deepEqual(index.targets, { count: 1, countries: ['Japan'] });
  assert.deepEqual(index.websUsed.map((w) => [w.country, w.nodes]), [['Japan', 4]]);
  assert.equal(index.links.length, 1);
  assert.equal(index.ttl, undefined, 'the web index has no TTL attribute');
  const rec = ddb.store.get('THREAD#thr-j2|WEB');
  assert.equal(rec.state, 'linked');
  assert.deepEqual(rec.from.map((l) => [l.other, l.confidence, l.country]), [['thr-j1', 'strong', 'Japan']]);
  assert.equal(ddb.store.get('THREAD#thr-j3|WEB').state, 'analysed_no_links');
  assert.equal(ddb.puts.filter((p) => p.item.SK === 'WEB').length, 4);

  // dated immutable copy + latest pointer, same body, in the world bucket
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const hist = s3.puts.filter((p) => p.Key.startsWith('web/'));
  assert.deepEqual(hist.map((p) => p.Key), [`web/${day}.json`, 'web/latest.json']);
  assert.ok(hist.every((p) => p.Bucket === 'bkt' && p.ContentType === 'application/json'));
  assert.equal(hist[0].Body, hist[1].Body);
  const body = JSON.parse(hist[0].Body);
  assert.deepEqual(Object.keys(body).sort(), ['generatedAt', 'index', 'records', 'runId', 'webs']);
  assert.equal(body.webs[0].countryName, 'Japan');
  assert.equal(body.records.length, 4);
});

test('the model graph is validated: unknown stories and uncited edges dropped, cites mapped to topic ids, confidence downgraded, lag clamped, 3 edges per story, actors cleaned, shared-actor backbone added', async () => {
  const ddb = mkDdb(JAPAN());
  const nodes = [{ ...NODES[0], actors: ['Japan', 'Bank of Japan', '  bank   of japan ', 'Yen', 42, ''] }, ...NODES.slice(1), node('thr-zzz', ['Nobody'])];
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(graph(nodes, EDGES)) }, {}, ({ logs }) => {
    assert.ok(logs.warn.some((l) => /unknown threadId: thr-zzz/.test(l)), logs.warn.join('\n'));
    assert.ok(logs.warn.some((l) => /exceeded max edges/.test(l)));
    assert.ok(logs.warn.some((l) => /self-loop/.test(l)));
  });
  const row = systems(ddb, 'Japan');
  assert.deepEqual(row.nodes.map((n) => n.threadId), ['thr-j1', 'thr-j2', 'thr-j3', 'thr-j4']);
  assert.deepEqual(row.nodes[0].actors, ['Japan', 'Bank of Japan', 'Yen']);
  assert.deepEqual(row.edges.map((x) => [x.from, x.to, x.confidence, x.lagDays]), [
    ['thr-j1', 'thr-j2', 'strong', 90],   // 3 cited entries keep "strong"; 200 days clamps to 90
    ['thr-j1', 'thr-j3', 'medium', 3],    // only 2 of 3 cites were shown to the model: strong -> medium
    ['thr-j1', 'thr-j4', 'weak', 0],      // a non-numeric lag is 0
  ]);
  const first = row.edges[0];
  assert.deepEqual(first.citedEntries, ['thr-j1-a', 'thr-j1-b', 'thr-j2-a']);
  assert.deepEqual(first.cited.map((c) => c.title), ['Headline thr-j1-a', 'Headline thr-j1-b', 'Headline thr-j2-a']);
  assert.ok(first.cited.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date)));
  assert.deepEqual(row.edges[1].citedEntries, ['thr-j1-a', 'thr-j3-a']);

  // two stories link on a specific shared actor; the country itself is never a link
  assert.deepEqual(row.backbone.map((b) => [b.class, b.relation, b.sharedActors, b.weight]).sort(), [
    ['backbone', 'shared_actor', ['Bank of Japan'], 1],
    ['backbone', 'shared_actor', ['Nikkei'], 1],
  ]);
});

test('a fenced reply is parsed; a malformed one fails that country (no SYSTEMS# row) but the story index is still rebuilt from the webs that exist', async () => {
  const ddb = mkDdb(JAPAN());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm((o) => '```json\n' + graph(NODES)(o) + '\n```') }, {}, (_, out) => assert.match(out.body, /1 generated, 0 failed/));
  assert.ok(systems(ddb, 'Japan'));

  const old = { PK: 'SYSTEMS#France', SK: 'SYSTEMS_ANALYSIS', countryName: 'France', nodes: [{ threadId: 'thr-f1', summary: 's' }, { threadId: 'thr-f2', summary: 's' }], edges: [], backbone: [], generatedAt: hoursAgo(48) };
  const bad = mkDdb([...rowsFor(BOTH_SPECS), old]);
  await run({ ddb: bad, s3: fakeS3(), llm: fakeLlm('not json'), env: { SYSTEMS_TEST_COUNTRIES: 'Japan' } }, {}, ({ logs }, out) => {
    assert.equal(out.body, 'Systems analysis complete: 0 generated, 1 failed');
    assert.ok(logs.error.some((l) => /Failed for Japan: Failed to parse/.test(l)), logs.error.join('\n'));
  });
  assert.equal(systems(bad, 'Japan'), undefined);
  assert.deepEqual(bad.store.get('WEB#INDEX|LATEST').websUsed.map((w) => w.country), ['France']);
});

test('stored webs of other countries join the index (the scan is paged); a web older than 30 days does not', async () => {
  const web = (country, ids, h) => ({ PK: `SYSTEMS#${country}`, SK: 'SYSTEMS_ANALYSIS', countryName: country, nodes: ids.map((id) => ({ threadId: id, summary: 's' })), edges: [], backbone: [], generatedAt: hoursAgo(h) });
  const ddb = mkDdb([...rowsFor(BOTH_SPECS), web('France', ['thr-f1', 'thr-f2'], 48), web('Italy', ['thr-i1', 'thr-i2'], 24 * 40), web('Spain', ['thr-s1', 'thr-s2'], 5)]);
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(graph(NODES)), env: { SYSTEMS_TEST_COUNTRIES: 'Japan' } }, {}, () => {});
  const used = ddb.store.get('WEB#INDEX|LATEST').websUsed.map((w) => w.country).sort();
  assert.deepEqual(used, ['France', 'Japan', 'Spain']);
  assert.equal(ddb.sent.filter((s) => s.name === 'ScanCommand').length, 4, 'one scan page per stored web (Japan included)');
});

test('record notes: one web note per written country and one link note per edge, under NOTES_PREFIX (default record/shadow/)', async () => {
  const ddb = mkDdb(JAPAN());
  const s3 = fakeS3();
  await run({ ddb, s3, llm: fakeLlm(graph(NODES, [EDGES[0], EDGES[1]])) }, {}, () => {});
  const keys = s3.keys('record/shadow/notes/');
  assert.deepEqual(keys.map((k) => k.replace(/\d{4}-\d{2}-\d{2}/, 'DAY')), [
    'record/shadow/notes/link/DAY.jsonl', 'record/shadow/notes/link/manifest.json', 'record/shadow/notes/web/DAY.jsonl', 'record/shadow/notes/web/manifest.json']);
  const links = s3.lines(keys.find((k) => /link\/\d/.test(k)));
  assert.equal(links.length, 2);
  assert.ok(links.every((n) => n.subtype === 'link' && n.producer.lambda === 'newsSystemsAnalysis'));
  const [web] = s3.lines(keys.find((k) => /web\/\d/.test(k)));
  assert.equal(web.subtype, 'web');
  assert.deepEqual(web.iso3, ['JPN']);
  assert.equal(web.payload.nodes.length, 4);
  assert.equal(web.payload.backbone.length, 2);
});

test('a failed S3 history write (or record note write) is logged and never fails the run or the DynamoDB rows', async () => {
  const ddb = mkDdb(JAPAN());
  const s3 = fakeS3({}, { fail: (name, input) => (name === 'PutObjectCommand' ? new Error('S3 down') : null) });
  await run({ ddb, s3, llm: fakeLlm(graph(NODES)) }, {}, ({ logs }, out) => {
    assert.match(out.body, /1 generated, 0 failed/);
    assert.ok(logs.error.some((l) => /Web history write failed: S3 down/.test(l)), logs.error.join('\n'));
    assert.ok(logs.error.some((l) => /\[notes\] link notes not written: S3 down/.test(l)));
  });
  assert.ok(systems(ddb, 'Japan'));
  assert.ok(ddb.store.get('WEB#INDEX|LATEST'));
});

test('if the story index cannot be built the country webs are still written, and the run says so', async () => {
  const ddb = mkDdb(JAPAN(), { fail: (name) => (name === 'ScanCommand' ? new Error('scan throttled') : null) });
  await run({ ddb, s3: fakeS3(), llm: fakeLlm(graph(NODES)) }, {}, ({ logs }, out) => {
    assert.match(out.body, /1 generated, 0 failed/);
    assert.equal(out.coverage, null);
    assert.ok(logs.error.some((l) => /Web index build failed \(the country webs themselves were written\): scan throttled/.test(l)));
  });
  assert.ok(systems(ddb, 'Japan'));
  assert.equal(ddb.store.get('WEB#INDEX|LATEST'), undefined);
});

// ─── who is analysed ──────────────────────────────────────────────────────────────

const EUROPE_SPECS = [[1, e('eu-1', 'thr-e1', ['Europe'])], [2, e('eu-2', 'thr-e1', ['Europe'])], [3, e('eu-3', 'thr-e2', ['Europe'])], [4, e('eu-4', 'thr-e2', ['Europe'])]];
const BOTH = () => rowsFor([...BOTH_SPECS, ...EUROPE_SPECS]);

test('the top SYSTEMS_TOP_N countries by coverage are analysed; regions, countries with under 4 entries or under 2 stories are not eligible', async () => {
  const THIN_SPECS = [[1, e('b-1', 'thr-b1', ['Brazil'])], [2, e('b-2', 'thr-b1', ['Brazil'])], [3, e('b-3', 'thr-b1', ['Brazil'])], [4, e('b-4', 'thr-b1', ['Brazil'])]]; // 4 entries but one story
  const withThin = () => rowsFor([...BOTH_SPECS, ...EUROPE_SPECS, ...THIN_SPECS]);
  const ddb = mkDdb(withThin());
  const llm = fakeLlm(graph([]));
  await run({ ddb, s3: fakeS3(), llm, env: { SYSTEMS_TOP_N: '1' } }, {}, (_, out) => {
    assert.match(out.body, /1 generated/);
    assert.equal(llm.calls.length, 1);
    assert.match(llm.calls[0].user, /STORY THREADS IN JAPAN/); // 8 entries beats France's 4
  });
  assert.ok(systems(ddb, 'Japan'));
  for (const c of ['France', 'Europe', 'Brazil']) assert.equal(systems(ddb, c), undefined, c);

  const all = mkDdb(withThin());
  await run({ ddb: all, s3: fakeS3(), llm: fakeLlm(graph([])) }, {}, ({ logs }, out) => {
    assert.match(out.body, /2 generated/); // Japan, France: never Europe, never Brazil
    assert.ok(logs.log.some((l) => /Excluded \(not real countries\): Europe/.test(l)), logs.log.join('\n'));
  });
});

test('event.countries and SYSTEMS_TEST_COUNTRIES restrict the run to the named countries', async () => {
  for (const [env, event] of [[{}, { countries: ['France'] }], [{ SYSTEMS_TEST_COUNTRIES: 'France , Nowhere' }, {}]]) {
    const ddb = mkDdb(BOTH());
    const llm = fakeLlm(graph([]));
    await run({ ddb, s3: fakeS3(), llm, env }, event, () => {});
    assert.equal(llm.calls.length, 1);
    assert.match(llm.calls[0].user, /STORY THREADS IN FRANCE/);
    assert.equal(systems(ddb, 'Japan'), undefined);
  }
});

test('one country failing does not stop the next (error on the first call, success on the second)', async () => {
  const ddb = mkDdb(BOTH());
  await run({ ddb, s3: fakeS3(), llm: fakeLlm([new Error('DeepSeek 503'), graph([])]) }, {}, ({ logs }, out) => {
    assert.match(out.body, /1 generated, 1 failed/);
    assert.ok(logs.error.some((l) => /Failed for Japan: DeepSeek 503/.test(l)));
  });
  assert.equal(systems(ddb, 'Japan'), undefined);
  assert.ok(systems(ddb, 'France'));
});

test('dry run: what would run, prompt sizes and story coverage; no model call and nothing written', async () => {
  const ddb = mkDdb(BOTH());
  const s3 = fakeS3();
  await run({ ddb, s3, llm: fakeLlm(graph([])) }, { dryRun: true }, ({ llm }, out) => {
    assert.equal(out.dryRun, true);
    assert.equal(out.eligible, 2);
    assert.deepEqual(out.targets, ['Japan', 'France']);
    assert.deepEqual(out.excluded, ['Europe']);
    assert.deepEqual(out.prompts.map((p) => [p.country, p.threads, p.shownEntries]), [['Japan', 4, 8], ['France', 2, 4]]);
    assert.ok(out.prompts.every((p) => p.chars > 1000 && p.approxTokens === Math.round(p.chars / 4)));
    assert.match(out.webHistoryKey, /^web\/\d{4}\/\d{2}\/\d{2}\.json$/);
    assert.equal(out.coverage.threadsInScope, 8); // every story in the last 14 days, whatever place it names
    assert.equal(llm.calls.length, 0);
  });
  assert.equal(ddb.puts.length, 0);
  assert.equal(s3.objs.size, 0);
});

test('missing table config or API key answers 500 and reads nothing', async () => {
  for (const [env, body] of [[{ TOPICS_DDB_TABLE: undefined }, 'Missing table config'], [{ SUMMARIZE_PREDICT_TABLE: undefined }, 'Missing table config'], [{ XAI_API_KEY: '' }, 'Missing API key']]) {
    const ddb = mkDdb(JAPAN());
    await run({ ddb, llm: fakeLlm(graph([])), env }, {}, ({ llm }, out) => {
      assert.deepEqual(out, { statusCode: 500, body });
      assert.equal(llm.calls.length, 0);
    });
    assert.equal(ddb.sent.length, 0);
  }
});
