'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, readdirSync} = require('node:fs');
const {resolve} = require('node:path');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const {fakeClient} = require('../../../shared/test/world.fake');

const P = 'record/shadow/';
const row = (date, index) => ({store: 'NewsCache', key: {id: `archive#${date}`}, index});
const entry = (date, n, extra = {}) => ({
  date, archive: `archive#${date}`, topicId: `Topic ${n}-${n}`, threadId: `thread-${n % 3}`, title: `Title ${n}`, category: 'conflict',
  regions: [], iso3: ['FRA'], actors: ['Emmanuel Macron'], eventType: 'unrest', archivedAt: `${date}T04:00:00.000Z`, generationId: 'gen-1', continuesTopic: null,
  sources: [{source: 'www.bbc.co.uk', title: 't', url: `https://www.bbc.co.uk/news/a${n}?utm_source=x`, tier: null, outletCountry: null, outletType: null, snippet: null}],
  sourceKey: `archive#${date}|gen-1|Topic ${n}-${n}`, sourceRow: row(date, n), ...extra,
});
const births = (entries) => {
  const out = {};
  for (const e of entries) if (e.threadId && !out[e.threadId]) out[e.threadId] = {threadId: e.threadId, born: e.date, bornAt: e.archivedAt, bornAtApprox: false, windowLimited: false, missingBefore: []};
  return out;
};
// A scripted store: days = {date: [entries]}; a date not in the map is a missing day.
function scripted(days, {snapshots = {}, fail = {}} = {}) {
  return {
    async load(date) {
      if (fail[date]) throw new Error(fail[date]);
      const entries = days[date];
      return {date, dayRow: entries ? {date, source: 'archive', entries} : null, entries: entries || [], births: births(entries || []), snapshots: snapshots[date] || []};
    },
  };
}
const make = (store, f = fakeS3(), now = () => '2026-10-21T05:45:00.000Z') => ({f, handler: makeHandler({store, s3json: f.s3json, manifest: f.manifest, now})});
const twenty = (date) => Array.from({length: 20}, (_, n) => entry(date, n));

test('a day writes entry and story_born facts, the Run, a run fact and the manifest; the Run is ok', async () => {
  const {f, handler} = make(scripted({'2026-10-20': twenty('2026-10-20')}));
  const r = await handler({date: '2026-10-20'});
  assert.equal(r.status, 'ok');
  const facts = f.lines(`${P}facts/2026-10-20.jsonl`);
  assert.equal(facts.filter((x) => x.kind === 'entry').length, 20);
  assert.equal(facts.filter((x) => x.kind === 'story_born').length, 3);
  assert.ok(facts.every((x) => x.schemaVersion === 1 && x.producer.runId === '2026-10-20-1'));
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.runId, run.inputs, run.counts.entry, run.counts.run], ['ok', '2026-10-20-1', {archiveDay: 'present', todayArchive: 'missing', rawDay: 'missing'}, 20, 1]);
  assert.ok(run.finishedAt && run.schemaVersion === 1);
  assert.equal(f.lines(`${P}facts/2026-10-21.jsonl`)[0].kind, 'run');
  assert.deepEqual(f.json(`${P}facts/manifest.json`), {schemaVersion: 1, days: ['2026-10-20', '2026-10-21']});
});

test('the Run is written first as started, then overwritten', async () => {
  const f = fakeS3();
  const seen = [];
  const store = scripted({'2026-10-20': twenty('2026-10-20')});
  const load = store.load;
  store.load = async (d) => { seen.push(f.json(`${P}runs/${d}.json`).status); return load(d); };
  await make(store, f).handler({date: '2026-10-20'});
  assert.deepEqual(seen, ['started']);
  assert.equal(f.json(`${P}runs/2026-10-20.json`).status, 'ok');
});

test('a re-run appends nothing new: facts dedupe by eventId, the second Run is attempt 2', async () => {
  const {f, handler} = make(scripted({'2026-10-20': twenty('2026-10-20')}));
  await handler({date: '2026-10-20'});
  const before = f.objs.get(`${P}facts/2026-10-20.jsonl`).body;
  const r = await handler({date: '2026-10-20'});
  assert.equal(f.objs.get(`${P}facts/2026-10-20.jsonl`).body, before);
  assert.equal(r.runId, '2026-10-20-2');
  assert.equal(r.counts.entry, 0);
  assert.equal(r.status, 'ok');
});

test('the same article re-listed under a new topicId and generation is the same fact', async () => {
  const again = twenty('2026-10-20').map((e, n) => ({...e, topicId: `Other ${n}-9`, sourceKey: `archive#2026-10-20|gen-2|Other ${n}-9`}));
  const {f, handler} = make(scripted({'2026-10-20': twenty('2026-10-20'), '2026-10-21': again.map((e) => ({...e, date: '2026-10-21', archivedAt: '2026-10-21T04:00:00.000Z'}))}));
  await handler({date: '2026-10-20'});
  const r = await handler({date: '2026-10-21'});
  assert.equal(r.counts.entry, 0);
  assert.equal(f.lines(`${P}facts/2026-10-21.jsonl`).filter((x) => x.kind === 'entry').length, 0);
});

test('a late fact lands in the file of its own day (the UTC date of at)', async () => {
  const e = entry('2026-10-20', 1, {archivedAt: '2026-10-19T23:30:00.000Z'});
  const {f, handler} = make(scripted({'2026-10-20': [e, ...twenty('2026-10-20').slice(1)]}));
  await handler({date: '2026-10-20'});
  assert.equal(f.lines(`${P}facts/2026-10-19.jsonl`)[0].kind, 'entry');
  assert.ok(f.json(`${P}facts/manifest.json`).days.includes('2026-10-19'));
});

test('a thrown error still writes a failed Run and a run fact, then the handler throws', async () => {
  const {f, handler} = make(scripted({}, {fail: {'2026-10-20': 'dynamodb exploded'}}));
  await assert.rejects(() => handler({date: '2026-10-20'}), /dynamodb exploded/);
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.failures[0].stage, run.failures[0].message], ['failed', 'fatal', 'dynamodb exploded']);
  assert.ok(run.finishedAt);
  const fact = f.lines(`${P}facts/2026-10-21.jsonl`)[0];
  assert.deepEqual([fact.kind, fact.threadId, fact.payload.status], ['run', null, 'failed']);
});

test('a missing archive day: Run failed with archiveDay missing, no facts but the run fact, and a daily run throws', async () => {
  const {f, handler} = make(scripted({}));
  await assert.rejects(() => handler({date: '2026-10-20'}), /no archive#2026-10-20/);
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.inputs.archiveDay, run.inputs.todayArchive], ['failed', 'missing', 'missing']);
  assert.equal(f.objs.has(`${P}facts/2026-10-20.jsonl`), false);
  assert.deepEqual(f.lines(`${P}facts/2026-10-21.jsonl`).map((x) => x.kind), ['run']);
});

test('backfill replays oldest first; a day without a row gets a missing Run and no facts and does not throw', async () => {
  const order = [];
  const store = scripted({'2026-10-18': twenty('2026-10-18'), '2026-10-20': twenty('2026-10-20')});
  const load = store.load;
  store.load = async (d) => { order.push(d); return load(d); };
  const {f, handler} = make(store);
  const r = await handler({backfill: {from: '2026-10-18', to: '2026-10-20'}, strict: false});
  assert.deepEqual(order, ['2026-10-18', '2026-10-19', '2026-10-20']);
  assert.deepEqual(r.days.map((d) => d.status), ['ok', 'failed', 'ok']);
  assert.equal(f.json(`${P}runs/2026-10-19.json`).inputs.archiveDay, 'missing');
  assert.equal(f.json(`${P}runs/2026-10-19.json`).notes, 'backfill');
  assert.equal(f.lines(`${P}facts/2026-10-19.jsonl`).filter((x) => x.kind === 'entry').length, 0);
});

test('a thin day (under 20 entries) is recorded as thin, facts are still written', async () => {
  const {f, handler} = make(scripted({'2026-10-20': twenty('2026-10-20').slice(0, 13)}));
  const r = await handler({date: '2026-10-20'});
  assert.deepEqual(r.inputs.archiveDay, {thin: 13});
  assert.equal(r.counts.entry, 13);
  assert.equal(f.json(`${P}runs/2026-10-20.json`).status, 'ok');
});

test('forecast_drawn and verdict facts: threads from the topic, verdict from a question awaiting its verdict', async () => {
  const e = twenty('2026-10-20');
  const snap = {pk: 'PRED#Topic 1-1', topicId: 'Topic 1-1', date: '2026-10-20', threadId: null, generatedAt: '2026-10-20T05:00:00.000Z', title: 't',
    sourceRow: {store: 'GlobalPerspectivePredictionLog', key: {PK: 'PRED#Topic 1-1', SK: '2026-10-20'}}, sourceKey: 'PRED#Topic 1-1|2026-10-20',
    scenarios: [{index: 0, label: 'Most likely', probability: 60, triggers: [{id: '0-0', trigger: 'X happens', due: '2026-10-22', p: 40, resolutionSource: 'Reuters', question: true, qid: 'q1', status: ''}]}]};
  const v = {schemaVersion: 1, qid: 'q1', threadId: null, branchId: null, result: 'yes', voidReason: null, decidedAt: '2026-10-23T00:00:00.000Z', decidedBy: 'agent', evidence: {quote: 'q', url: 'https://x.test', title: 't', date: '2026-10-23'}, reason: null, revision: 1, sourceKey: 'inbox:verdicts/2026-10-23#0'};
  const {f, handler} = make(scripted({'2026-10-20': e, '2026-10-24': e.map((x) => ({...x, date: '2026-10-24'}))}, {snapshots: {'2026-10-20': [snap]}}));
  await handler({date: '2026-10-20'});
  const fc = f.lines(`${P}facts/2026-10-20.jsonl`).find((x) => x.kind === 'forecast_drawn');
  assert.deepEqual([fc.threadId, fc.precision, fc.payload.branches[0].branchId, fc.payload.branches[0].p], ['thread-1', 'exact', 'PRED#Topic 1-1/2026-10-20/0-0', 40]);
  assert.deepEqual(fc.iso3, ['FRA']);
  // The thread and branch are taken from the forecast_drawn fact when the inbox line lacks them.
  f.objs.set(`${P}inbox/verdicts/2026-10-23.jsonl`, {body: `${JSON.stringify(v)}\n`, etag: '"i"'});
  const later = make(scripted({'2026-10-24': e.map((x) => ({...x, date: '2026-10-24'}))}), f, () => '2026-10-25T05:45:00.000Z');
  await later.handler({date: '2026-10-24'});
  const verdict = f.lines(`${P}facts/2026-10-23.jsonl`).find((x) => x.kind === 'verdict');
  assert.deepEqual([verdict.threadId, verdict.payload.result, verdict.payload.branchId, verdict.at], ['thread-1', 'yes', 'PRED#Topic 1-1/2026-10-20/0-0', '2026-10-23T00:00:00.000Z']);
});

test('a verdict with an unknown result is recorded as a failure, the rest of the day is kept (partial)', async () => {
  const e = twenty('2026-10-20');
  const snap = {pk: 'PRED#Topic 1-1', topicId: 'Topic 1-1', date: '2026-10-20', threadId: 'thread-1', generatedAt: null, title: 't',
    sourceRow: {store: 'G', key: {PK: 'a', SK: 'b'}}, sourceKey: 'k1', scenarios: [{index: 0, label: 'L', probability: 1, triggers: [{id: '0-0', trigger: 't', due: null, p: null, resolutionSource: '', question: true, qid: 'q9', status: ''}]}]};
  const bad = {schemaVersion: 1, qid: 'q9', result: 'maybe', decidedAt: '2026-10-20T08:00:00.000Z', revision: 1};
  const f0 = fakeS3();
  f0.objs.set(`${P}inbox/verdicts/2026-10-20.jsonl`, {body: `${JSON.stringify(bad)}\n`, etag: '"i"'});
  const {f, handler} = make(scripted({'2026-10-20': e}, {snapshots: {'2026-10-20': [snap]}}), f0);
  await assert.rejects(() => handler({date: '2026-10-20'}), /partial/);
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.failures[0].stage, run.counts.entry, run.counts.verdict], ['partial', 'verdict', 20, 0]);
});

test('the manifest survives a racing writer: 412 re-reads and merges, no day is lost', async () => {
  const f = fakeS3();
  f.put(`${P}facts/manifest.json`, {schemaVersion: 1, days: ['2026-10-01']});
  let raced = false;
  const original = f.client.send;
  f.client.send = async (c) => {
    if (!raced && c.input.Key === `${P}facts/manifest.json` && c.input.Body) { raced = true; f.put(c.input.Key, {schemaVersion: 1, days: ['2026-10-01', '2026-10-05']}); }
    return original(c);
  };
  await make(scripted({'2026-10-20': twenty('2026-10-20')}), f).handler({date: '2026-10-20'});
  assert.equal(raced, true);
  assert.deepEqual(f.json(`${P}facts/manifest.json`).days, ['2026-10-01', '2026-10-05', '2026-10-20', '2026-10-21']);
});

test('a manifest that keeps losing the race fails the run with a manifest failure; facts stay written', async () => {
  const f = fakeS3();
  f.put(`${P}facts/manifest.json`, {schemaVersion: 1, days: []});
  let k = 0;
  const original = f.client.send;
  f.client.send = async (c) => {
    if (c.input.Key === `${P}facts/manifest.json` && c.input.Body) { k += 1; f.put(c.input.Key, {schemaVersion: 1, days: [`2026-09-${String(k).padStart(2, '0')}`]}); }
    return original(c);
  };
  const handler = makeHandler({store: scripted({'2026-10-20': twenty('2026-10-20')}), s3json: f.s3json, manifest: f.manifest, now: () => '2026-10-21T05:45:00.000Z'});
  await assert.rejects(() => handler({date: '2026-10-20'}), /partial|manifest/);
  assert.equal(f.json(`${P}runs/2026-10-20.json`).failures[0].stage, 'manifest');
  assert.equal(f.lines(`${P}facts/2026-10-20.jsonl`).filter((x) => x.kind === 'entry').length, 20);
});

test('today-archive fallback: no archive row, entries archived that day in today-archive still yield facts', async () => {
  const c = fakeClient();
  const date = '2026-10-20';
  const fresh = (n) => ({topicId: `T ${n}-${n}`, threadId: 'thread-x', title: `Title ${n}`, category: 'conflict', iso3: ['FRA'], actors: ['A'], event_type: 'unrest',
    sources: [{source: 'bbc.com', title: 't', url: `https://bbc.com/${n}`}], archivedAt: `${date}T03:00:00.000Z`, generationId: 'gen-9'});
  c.put('NewsCache', {id: 'today-archive', entries: [fresh(1), fresh(2), {...fresh(3), archivedAt: '2026-10-18T03:00:00.000Z'}]});
  const f = fakeS3();
  const handler = makeHandler({store: makeStore(c), s3json: f.s3json, manifest: f.manifest, now: () => `${date}T05:45:00.000Z`});
  const r = await handler({date});
  assert.deepEqual([r.inputs.archiveDay, r.inputs.todayArchive, r.counts.entry, r.status], ['missing', 'present', 2, 'ok']);
  assert.equal(f.lines(`${P}facts/${date}.jsonl`)[0].sourceRow.key.id, 'today-archive');
});

test('a real archive row with today-archive extras reports both inputs', async () => {
  const c = fakeClient();
  const date = '2026-10-20';
  const e = (n, id) => ({topicId: `T ${n}-${n}`, threadId: 'thread-x', title: `Title ${n}`, sources: [{source: 'bbc.com', url: `https://bbc.com/${n}`}], archivedAt: `${date}T03:00:00.000Z`, generationId: 'g'});
  c.put('NewsCache', {id: `archive#${date}`, entries: Array.from({length: 20}, (_, n) => e(n))});
  c.put('NewsCache', {id: 'today-archive', entries: [e(50)]});
  const f = fakeS3();
  const r = await makeHandler({store: makeStore(c), s3json: f.s3json, manifest: f.manifest, now: () => `${date}T05:45:00.000Z`})({date});
  assert.deepEqual([r.inputs.archiveDay, r.inputs.todayArchive, r.counts.entry], ['present', 'present', 21]);
});

test('no model is wired in: no source file mentions a model or llm, and loading the writer pulls in no llm module', () => {
  const src = resolve(__dirname, '../src');
  for (const file of readdirSync(src).filter((n) => n.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(resolve(src, file), 'utf8'), /RECORD_LLM_MODEL|\bllm\b|chat\(|prompts/i, file);
  }
  require('../src/runtime');
  assert.deepEqual(Object.keys(require.cache).filter((k) => /llm|deepseek|openai|anthropic/i.test(k)), []);
});

test('a scheduled range with yesterday missing throws after writing its Runs; today missing alone is tolerated', async () => {
  const {f, handler} = make(scripted({'2026-10-21': twenty('2026-10-21')}));
  await assert.rejects(() => handler({backfill: {from: '2026-10-20', to: '2026-10-21'}}), /2026-10-20/);
  assert.equal(f.json(`${P}runs/2026-10-20.json`).inputs.archiveDay, 'missing');
  assert.equal(f.json(`${P}runs/2026-10-21.json`).status, 'ok');
  const today = make(scripted({'2026-10-20': twenty('2026-10-20')}));
  const r = await today.handler({backfill: {from: '2026-10-20', to: '2026-10-21'}});
  assert.deepEqual(r.days.map((d) => d.inputs.archiveDay), ['present', 'missing']);
});

test('a backfill keeps its run fact in the replayed day, not in today\'s file', async () => {
  const {f, handler} = make(scripted({'2026-10-18': twenty('2026-10-18')}));
  await handler({backfill: {from: '2026-10-18', to: '2026-10-18'}, strict: false});
  assert.equal(f.lines(`${P}facts/2026-10-18.jsonl`).filter((x) => x.kind === 'run').length, 1);
  assert.equal(f.objs.has(`${P}facts/2026-10-21.jsonl`), false);
  assert.equal(f.json(`${P}runs/2026-10-18.json`).daysWritten.includes('2026-10-21'), false);
});

// Views (0037): rebuilt from every facts day in the manifest, after the facts append, in one write order.
const viewKeys = (f) => f.puts.map((p) => p.Key).filter((k) => k.startsWith(`${P}views/`)).map((k) => k.slice(`${P}views/`.length));
// Distinct articles per day: the same url listed on a later day is not a second fact.
const fresh = (date, from) => Array.from({length: 20}, (_, n) => entry(date, n + from));
const dayStore = () => scripted({'2026-10-19': fresh('2026-10-19', 0), '2026-10-20': fresh('2026-10-20', 100)});

test('views are written after the facts, in order: stories, links, counts, then active, all, and the manifest last', async () => {
  const {f, handler} = make(dayStore());
  await handler({date: '2026-10-20'});
  const keys = viewKeys(f);
  const at = (k) => keys.indexOf(k);
  assert.deepEqual(keys.slice(-3), ['index/active.json', 'index/all.json', 'manifest.json']);
  const groups = keys.slice(0, -3).map((k) => k.split('/')[0]);
  assert.deepEqual([...new Set(groups)], ['stories', 'links', 'counts']);
  assert.ok(groups.lastIndexOf('stories') < groups.indexOf('links') && groups.lastIndexOf('links') < groups.indexOf('counts'));
  assert.ok(f.puts.findIndex((p) => p.Key === `${P}facts/2026-10-20.jsonl`) < f.puts.findIndex((p) => p.Key === `${P}views/${keys[0]}`));
  assert.ok(at('manifest.json') === keys.length - 1);
  const m = f.json(`${P}views/manifest.json`);
  assert.deepEqual([m.runId, m.factsThrough, m.readingsThrough, m.builtAt], ['2026-10-20-1', '2026-10-20', null, '2026-10-21T05:45:00.000Z']);
  assert.equal(f.json(`${P}views/index/active.json`).stories.length, 3);
  assert.equal(f.json(`${P}views/stories/thread-1.json`).entries.length, 7);
  assert.ok(f.objs.has(`${P}views/counts/2026-10-20.json`) && f.objs.has(`${P}views/counts/2026-10-15.json`)); // current and previous ISO week
});

test('views read every facts day in the manifest, not only the day just written', async () => {
  const {f, handler} = make(dayStore());
  await handler({date: '2026-10-19'});
  await handler({date: '2026-10-20'});
  const story = f.json(`${P}views/stories/thread-1.json`);
  assert.deepEqual([...new Set(story.entries.map((e) => e.date))], ['2026-10-19', '2026-10-20']);
});

test('shadow:false writes the views under record/views/', async () => {
  const {f, handler} = make(dayStore());
  await handler({date: '2026-10-20', shadow: false});
  assert.ok(f.objs.has('record/views/manifest.json'));
  assert.equal(f.objs.has(`${P}views/manifest.json`), false);
});

test('a re-run rewrites the same view bytes; only the manifest builtAt and runId change', async () => {
  const f = fakeS3();
  await make(dayStore(), f).handler({date: '2026-10-20'});
  const first = new Map([...f.objs].filter(([k]) => k.includes('/views/')).map(([k, v]) => [k, v.body]));
  await make(dayStore(), f, () => '2026-10-21T09:00:00.000Z').handler({date: '2026-10-20'});
  for (const [k, body] of first) {
    if (k.endsWith('/manifest.json')) continue;
    assert.equal(f.objs.get(k).body, body, k);
  }
  assert.deepEqual(f.json(`${P}views/manifest.json`), {...JSON.parse(first.get(`${P}views/manifest.json`)), builtAt: '2026-10-21T09:00:00.000Z', runId: '2026-10-20-2', factsManifestDays: 2});
});

test('a view failure marks the Run partial with stage views; facts stay and the old manifest stays', async () => {
  const f = fakeS3();
  await make(dayStore(), f).handler({date: '2026-10-19'});
  const oldManifest = f.objs.get(`${P}views/manifest.json`).body;
  f.failPut = (i) => i.Key === `${P}views/index/all.json`;
  await assert.rejects(() => make(dayStore(), f).handler({date: '2026-10-20'}), /partial/);
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.failures.map((x) => x.stage)], ['partial', ['views']]);
  assert.equal(f.lines(`${P}facts/2026-10-20.jsonl`).filter((x) => x.kind === 'entry').length, 20);
  assert.equal(f.objs.get(`${P}views/manifest.json`).body, oldManifest);
  assert.equal(f.lines(`${P}facts/2026-10-21.jsonl`).filter((x) => x.kind === 'run').at(-1).payload.status, 'partial');
});

test('a view failure on a re-run that writes no new facts is still partial, not failed', async () => {
  const f = fakeS3();
  await make(dayStore(), f).handler({date: '2026-10-20'});
  f.failPut = (i) => i.Key === `${P}views/index/active.json`;
  await assert.rejects(() => make(dayStore(), f).handler({date: '2026-10-20'}), /partial/);
  assert.equal(f.json(`${P}runs/2026-10-20.json`).status, 'partial');
});

test('a backfill builds the views once, after its last day', async () => {
  const {f, handler} = make(scripted({'2026-10-18': fresh('2026-10-18', 0), '2026-10-19': fresh('2026-10-19', 100), '2026-10-20': fresh('2026-10-20', 200)}));
  await handler({backfill: {from: '2026-10-18', to: '2026-10-20'}, strict: false});
  assert.equal(viewKeys(f).filter((k) => k === 'index/active.json').length, 1);
  assert.equal(viewKeys(f).filter((k) => k === 'manifest.json').length, 1);
  assert.deepEqual([...new Set(f.json(`${P}views/stories/thread-1.json`).entries.map((e) => e.date))], ['2026-10-18', '2026-10-19', '2026-10-20']);
  assert.ok(f.objs.has(`${P}views/counts/2026-10-18.json`));
});

// O5 (revised): verdicts come from the resolver's inbox, never from a table.
const inboxLine = (qid, o = {}) => ({schemaVersion: 1, qid, threadId: 'thread-1', branchId: `B-${qid}`, forkId: 'F', result: 'yes', voidReason: null, decidedAt: '2026-10-20T08:00:00.000Z', decidedBy: 'resolver',
  evidence: {quote: 'twelve chars or more', url: 'https://x.test', title: 't', date: '2026-10-20'}, reason: null, revision: 1, sourceKey: `inbox:verdicts/2026-10-20#${qid}`, ...o});
const putInbox = (f, prefix, day, lines) => f.objs.set(`${prefix}inbox/verdicts/${day}.jsonl`, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: `"i${day}"`});
const verdictsOf = (f, prefix = P) => [...f.objs.keys()].filter((k) => k.startsWith(`${prefix}facts/2`)).flatMap((k) => f.lines(k)).filter((x) => x.kind === 'verdict');

test('O5: the run reads the inbox for the run day and the 6 days before (7 reads), missing days are empty, and no table is asked', async () => {
  const f = fakeS3();
  putInbox(f, P, '2026-10-14', [inboxLine('q-edge', {decidedAt: '2026-10-14T08:00:00.000Z'})]);
  putInbox(f, P, '2026-10-13', [inboxLine('q-too-old', {decidedAt: '2026-10-13T08:00:00.000Z'})]); // 8 days back: not read
  putInbox(f, P, '2026-10-20', [inboxLine('q-today')]);
  const gets = [];
  const original = f.client.send;
  f.client.send = async (c) => { if (c.input.Key.includes('inbox/verdicts/') && !c.input.Body) gets.push(c.input.Key.slice(-16, -6)); return original(c); };
  const store = scripted({'2026-10-20': twenty('2026-10-20')});
  assert.equal(store.verdicts, undefined);
  const r = await make(store, f).handler({date: '2026-10-20'});
  assert.deepEqual(gets.sort(), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
  assert.deepEqual(verdictsOf(f).map((v) => v.payload.qid).sort(), ['q-edge', 'q-today']);
  assert.equal(r.counts.verdict, 2);
  const v = verdictsOf(f).find((x) => x.payload.qid === 'q-today');
  assert.deepEqual([v.threadId, v.payload.branchId, v.payload.result, v.payload.revision, v.at, v.eventId], ['thread-1', 'B-q-today', 'yes', 1, '2026-10-20T08:00:00.000Z', require('../src/_shared/record').sha1('verdictq-today1')]);
  assert.deepEqual(v.sourceRow, {store: 'record', key: 'inbox:verdicts/2026-10-20#q-today'});
});

test('O5: a line is one fact however often it is read; a correction line (revision 2) is a second verdict fact and wins in the view', async () => {
  const f = fakeS3();
  putInbox(f, P, '2026-10-20', [inboxLine('q1')]);
  const store = scripted({'2026-10-20': twenty('2026-10-20'), '2026-10-21': twenty('2026-10-21')});
  const nightly = (d, at) => make(store, f, () => at).handler({date: d});
  await nightly('2026-10-20', '2026-10-21T05:45:00.000Z');
  assert.equal((await nightly('2026-10-20', '2026-10-21T05:45:00.000Z')).counts.verdict, 0);
  putInbox(f, P, '2026-10-21', [inboxLine('q1', {result: 'void', voidReason: 'event_moot', evidence: null, revision: 2, decidedAt: '2026-10-21T08:00:00.000Z'})]);
  assert.equal((await nightly('2026-10-21', '2026-10-22T05:45:00.000Z')).counts.verdict, 1);
  assert.deepEqual(verdictsOf(f).map((v) => [v.payload.revision, v.payload.result, v.payload.voidReason]).sort(), [[1, 'yes', null], [2, 'void', 'event_moot']]);
});

test('O5: a line without thread or branch takes them from the forecast_drawn fact; with neither it is a verdict failure and the day is kept', async () => {
  const f = fakeS3();
  const fc = {schemaVersion: 1, eventId: 'fc', kind: 'forecast_drawn', at: '2026-10-01T05:00:00.000Z', date: '2026-10-01', precision: 'exact', threadId: 'thread-9', iso3: [], actorIds: [], sourceIds: [],
    payload: {forkId: 'F', topicId: 't', branches: [{branchId: 'B9', text: 'x', p: 40, trigger: 'x', resolutionSource: 'R', due: '2026-10-10', question: true, qid: 'q9', scenarioP: 50}]}, producer: {lambda: 'x', runId: 'r'}, sourceKey: 'k', sourceRow: {store: 's', key: 'k'}};
  f.put(`${P}facts/2026-10-01.jsonl`, fc);
  putInbox(f, P, '2026-10-20', [inboxLine('q9', {threadId: null, branchId: null}), inboxLine('q-nowhere', {threadId: null, branchId: null})]);
  await assert.rejects(() => make(scripted({'2026-10-20': twenty('2026-10-20')}), f).handler({date: '2026-10-20'}), /partial/);
  const v = verdictsOf(f);
  assert.deepEqual(v.map((x) => [x.payload.qid, x.threadId, x.payload.branchId]), [['q9', 'thread-9', 'B9']]);
  assert.equal(f.json(`${P}runs/2026-10-20.json`).failures[0].stage, 'verdict');
});

test('O5: {inboxFrom} reads the inbox from that day to the run day; the shadow prefix reads its own inbox', async () => {
  const f = fakeS3();
  putInbox(f, P, '2026-10-05', [inboxLine('q-early', {decidedAt: '2026-10-05T08:00:00.000Z'})]);
  putInbox(f, 'record/', '2026-10-06', [inboxLine('q-live', {decidedAt: '2026-10-06T08:00:00.000Z'})]);
  const store = scripted({'2026-10-20': twenty('2026-10-20')});
  const plain = await make(store, f).handler({date: '2026-10-20'});
  assert.equal(plain.counts.verdict, 0);
  const r = await make(store, f).handler({date: '2026-10-20', inboxFrom: '2026-10-01'});
  assert.equal(r.counts.verdict, 1);
  assert.deepEqual(verdictsOf(f).map((v) => v.payload.qid), ['q-early']);
  await assert.rejects(() => make(store, f).handler({date: '2026-10-20', inboxFrom: 'last week'}), /inboxFrom/);
  const live = await make(store, f).handler({date: '2026-10-20', inboxFrom: '2026-10-01', shadow: false});
  assert.equal(live.counts.verdict, 1);
  assert.deepEqual(verdictsOf(f, 'record/').map((v) => v.payload.qid), ['q-live']);
});

// O3: the legacy void job. Facts are seeded straight into a fake bucket so the job reads them as the nightly run would.
const seedForecast = (f, prefix, date, threadId, branches) => {
  const fact = {schemaVersion: 1, eventId: `fc-${threadId}-${date}`, kind: 'forecast_drawn', at: `${date}T05:00:00.000Z`, date, precision: 'exact', threadId, iso3: [], actorIds: [], sourceIds: [],
    payload: {forkId: `F-${threadId}`, topicId: 't', branches}, producer: {lambda: 'x', runId: 'r'}, sourceKey: `k-${threadId}`, sourceRow: {store: 's', key: 'k'}};
  f.put(`${prefix}facts/${date}.jsonl`, fact);
  f.put(`${prefix}facts/manifest.json`, {schemaVersion: 1, days: [date]});
};
const br = (id, extra = {}) => ({branchId: id, text: id, p: 40, trigger: id, resolutionSource: 'Reuters', due: '2026-10-27', question: true, qid: `q-${id}`, scenarioP: 50, ...extra});
const legacyScript = () => {
  const f = fakeS3();
  seedForecast(f, P, '2026-09-01', 'thread-1', [br('ok'), br('old1', {question: false, qid: null}), br('old2', {qid: null})]);
  return f;
};

test('O3: the legacy void job writes one void verdict per branch without a question id, and a re-run appends nothing', async () => {
  const f = legacyScript();
  const {handler} = make(scripted({}), f, () => '2026-10-27T06:00:00.000Z');
  const r = await handler({legacyVoid: true});
  assert.deepEqual([r.prefix, r.legacyBranches, r.written, r.alreadyVoid], [P, 2, 2, 0]);
  const verdicts = f.lines(`${P}facts/2026-10-27.jsonl`).filter((x) => x.kind === 'verdict');
  assert.deepEqual(verdicts.map((v) => v.payload.branchId).sort(), ['old1', 'old2']);
  for (const v of verdicts) {
    assert.deepEqual([v.threadId, v.payload.qid, v.payload.result, v.payload.voidReason, v.payload.decidedBy, v.at], ['thread-1', null, 'void', 'issued_before_method', 'operator-job', '2026-10-27T06:00:00.000Z']);
  }
  assert.ok(f.json(`${P}facts/manifest.json`).days.includes('2026-10-27'));
  const before = f.objs.get(`${P}facts/2026-10-27.jsonl`).body;
  // a later re-run, a different day: same eventIds, nothing appended, no new day file
  const again = await make(scripted({}), f, () => '2026-10-29T06:00:00.000Z').handler({legacyVoid: true});
  assert.deepEqual([again.written, again.alreadyVoid, again.days], [0, 2, []]);
  assert.equal(f.objs.get(`${P}facts/2026-10-27.jsonl`).body, before);
  assert.equal(f.objs.has(`${P}facts/2026-10-29.jsonl`), false);
});

test('O3: shadow is the default; shadow:false writes the live prefix and never touches the shadow one', async () => {
  const f = fakeS3();
  seedForecast(f, 'record/', '2026-09-01', 'thread-1', [br('old1', {qid: null})]);
  seedForecast(f, P, '2026-09-01', 'thread-1', [br('old1', {qid: null})]);
  const shadowBody = f.objs.get(`${P}facts/2026-09-01.jsonl`).body;
  const live = await make(scripted({}), f, () => '2026-10-27T06:00:00.000Z').handler({legacyVoid: true, shadow: false});
  assert.deepEqual([live.prefix, live.written], ['record/', 1]);
  assert.equal(f.objs.has(`${P}facts/2026-10-27.jsonl`), false);
  assert.equal(f.objs.has('record/facts/2026-10-27.jsonl'), true);
  assert.equal(f.objs.get(`${P}facts/2026-09-01.jsonl`).body, shadowBody);
  const sh = await make(scripted({}), f, () => '2026-10-27T06:00:00.000Z').handler({legacyVoid: true});
  assert.deepEqual([sh.prefix, sh.written], [P, 1]);
  assert.equal(f.objs.has('record/shadow/views/manifest.json'), true);
});

test('O3: after the job the views show the legacy branches as void and legacy, counts see the verdicts, branchesDue stays resolvable only', async () => {
  const f = legacyScript();
  await make(scripted({}), f, () => '2026-10-27T06:00:00.000Z').handler({legacyVoid: true});
  const story = f.json(`${P}views/stories/thread-1.json`);
  const branches = story.forks[0].branches;
  assert.deepEqual(branches.map((b) => [b.branchId, b.legacy, b.verdict && b.verdict.result]), [['ok', undefined, null], ['old1', true, 'void'], ['old2', true, 'void']]);
  assert.deepEqual(story.forks[0].branches[1].verdict.decidedBy, 'operator-job');
  assert.deepEqual(f.json(`${P}views/counts/2026-10-27.json`).total, {newEntries: 0, branchesDue: 1, verdicts: 2});
  const row = f.json(`${P}views/index/all.json`).stories.find((r) => r.threadId === 'thread-1');
  assert.deepEqual([row.branchCount, row.liveBranchCount], [3, 1]);
});

test('O3: the job is only reachable by the explicit event; a nightly event never voids anything', async () => {
  const f = legacyScript();
  await make(scripted({'2026-10-20': twenty('2026-10-20')}), f).handler({date: '2026-10-20'});
  assert.equal(f.lines(`${P}facts/2026-10-20.jsonl`).concat(f.lines(`${P}facts/2026-10-21.jsonl`)).some((x) => x.kind === 'verdict'), false);
  await assert.doesNotReject(() => make(scripted({}), f).handler({legacyVoid: false, date: '2026-10-20'}).catch((e) => { if (!/partial|failed/.test(e.message)) throw e; }));
});

// Step 3 (T1): the build reads record/readings/YYYY-Www.jsonl for every ISO week from the first facts day to today; a missing week is empty.
const putLines = (f, key, lines) => f.objs.set(key, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: `"l${key}"`});
const reading = (week, threadId, subtype, payload, o = {}) => ({schemaVersion: 1, readingId: `r-${week}-${threadId}-${subtype}`, week, threadId, subtype, payload, cites: ['a'.repeat(40)], covers: {from: '2026-10-12', to: '2026-10-18'}, supersedes: null, run: `review-${week}`, model: 'stub', promptVersion: 'v1', confidence: 'high', ...o});

test('T1: readings written by the review reach the story view and the index; the views name the prefix they read', async () => {
  const f = fakeS3();
  putLines(f, `${P}readings/2026-W43.jsonl`, [reading('2026-W43', 'thread-1', 'line', {text: 'Thread one holds'})]);
  putLines(f, 'record/readings/2026-W43.jsonl', [reading('2026-W43', 'thread-1', 'line', {text: 'live, not shadow'})]);
  const gets = [];
  const original = f.client.send;
  f.client.send = async (c) => { if (c.input.Key.includes('readings/') && !c.input.Body) gets.push(c.input.Key); return original(c); };
  await make(dayStore(), f).handler({date: '2026-10-20'});
  assert.equal(f.json(`${P}views/stories/thread-1.json`).line.text, 'Thread one holds');
  assert.equal(f.json(`${P}views/index/active.json`).stories.find((r) => r.threadId === 'thread-1').line, 'Thread one holds');
  assert.equal(f.json(`${P}views/manifest.json`).readingsThrough, '2026-W43');
  assert.deepEqual([...new Set(gets)], [`${P}readings/2026-W43.jsonl`]); // facts 10-19..10-20 and today 10-21 are all in W43
});

// T2: merges from the review's inbox become story_merged facts; the operator's splits become story_split facts.
const mergeLine = (o = {}) => ({from: 'thread-2', into: 'thread-1', at: '2026-10-20T12:00:00.000Z', reason: 'same event, two thread ids', cites: ['b'.repeat(40), 'c'.repeat(40)], readingId: 'rid-1', ...o});
const sha1 = (t) => require('node:crypto').createHash('sha1').update(t).digest('hex');

test('T2: a merge line in the inbox becomes one story_merged fact with eventId sha1(story_merged+from+into+at); a re-run adds nothing', async () => {
  const f = fakeS3();
  putLines(f, `${P}inbox/merges/2026-10-20.jsonl`, [mergeLine()]);
  const {handler} = make(dayStore(), f);
  const r = await handler({date: '2026-10-20'});
  assert.equal(r.counts.story_merged, 1);
  const m = f.lines(`${P}facts/2026-10-20.jsonl`).find((x) => x.kind === 'story_merged');
  assert.deepEqual([m.eventId, m.threadId, m.at, m.precision], [sha1('story_merged' + 'thread-2' + 'thread-1' + '2026-10-20T12:00:00.000Z'), 'thread-1', '2026-10-20T12:00:00.000Z', 'exact']);
  assert.deepEqual(m.payload, {from: 'thread-2', into: 'thread-1', reason: 'same event, two thread ids', evidence: [{eventId: 'b'.repeat(40)}, {eventId: 'c'.repeat(40)}], readingId: 'rid-1'});
  assert.deepEqual(f.json(`${P}views/stories/thread-2.json`).aliasOf, 'thread-1');
  const body = f.objs.get(`${P}facts/2026-10-20.jsonl`).body;
  const again = await make(dayStore(), f).handler({date: '2026-10-20'});
  assert.equal(again.counts.story_merged, 0);
  assert.equal(f.objs.get(`${P}facts/2026-10-20.jsonl`).body, body);
});

test('T2: a malformed merge line is a merge failure on the Run (partial) and the good line is kept; self merge is malformed', async () => {
  const f = fakeS3();
  putLines(f, `${P}inbox/merges/2026-10-19.jsonl`, [{from: 'thread-2'}, mergeLine({from: 'thread-1'}), mergeLine({reason: ''}), mergeLine({at: '2026-10-19T12:00:00.000Z'})]);
  await assert.rejects(() => make(dayStore(), f).handler({date: '2026-10-20'}), /merge/);
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.failures.map((x) => x.stage), run.counts.story_merged], ['partial', ['merge', 'merge', 'merge'], 1]);
});

test('T2: the merge inbox is read for the run day and 6 days back, {inboxFrom} reaches further, and the live prefix has its own', async () => {
  const f = fakeS3();
  putLines(f, `${P}inbox/merges/2026-10-14.jsonl`, [mergeLine({at: '2026-10-14T12:00:00.000Z'})]);
  putLines(f, `${P}inbox/merges/2026-10-13.jsonl`, [mergeLine({at: '2026-10-13T12:00:00.000Z', from: 'thread-0'})]); // 8 days back
  const r = await make(dayStore(), f).handler({date: '2026-10-20'});
  assert.equal(r.counts.story_merged, 1);
  const wide = await make(dayStore(), f).handler({date: '2026-10-20', inboxFrom: '2026-10-01'});
  assert.equal(wide.counts.story_merged, 1);
});

test('T2: a split line becomes a story_split fact, the views cancel the matching merge, and a later merge of the same pair holds again', async () => {
  const f = fakeS3();
  putLines(f, `${P}inbox/merges/2026-10-20.jsonl`, [mergeLine()]);
  await make(dayStore(), f).handler({date: '2026-10-20'});
  assert.equal(f.json(`${P}views/stories/thread-2.json`).aliasOf, 'thread-1');
  putLines(f, `${P}inbox/splits/2026-10-20.jsonl`, [{from: 'thread-2', into: 'thread-1', at: '2026-10-20T15:00:00.000Z', reason: 'two separate events'}]);
  const r = await make(dayStore(), f, () => '2026-10-21T05:45:00.000Z').handler({date: '2026-10-20'});
  assert.deepEqual([r.counts.story_split, r.counts.story_merged], [1, 0]);
  const s = f.lines(`${P}facts/2026-10-20.jsonl`).find((x) => x.kind === 'story_split');
  assert.deepEqual([s.eventId, s.threadId, s.payload], [sha1('story_split' + 'thread-2' + 'thread-1' + '2026-10-20T15:00:00.000Z'), 'thread-1', {from: 'thread-2', into: 'thread-1', reason: 'two separate events'}]);
  assert.equal(f.json(`${P}views/stories/thread-2.json`).aliasOf, null);
  assert.equal(f.json(`${P}views/stories/thread-1.json`).merges.length, 0);
  assert.deepEqual(f.json(`${P}views/index/all.json`).stories.find((x) => x.threadId === 'thread-2').aliasOf, null);
  // the pair merged again after the split
  putLines(f, `${P}inbox/merges/2026-10-20.jsonl`, [mergeLine(), mergeLine({at: '2026-10-21T08:00:00.000Z'})]);
  await make(dayStore(), f, () => '2026-10-21T06:45:00.000Z').handler({date: '2026-10-20'});
  assert.equal(f.json(`${P}views/stories/thread-2.json`).aliasOf, 'thread-1');
});

test('T3: record/operator/aliases.json is read under the prefix of the run (missing = none) and maps the actors of the views', async () => {
  const f = fakeS3();
  f.put(`${P}operator/aliases.json`, {schemaVersion: 1, aliases: [{canonical: 'name:macron', variants: ['name:emmanuel macron'], wikidataId: 'Q3052772'}]});
  f.put('record/operator/aliases.json', {schemaVersion: 1, aliases: [{canonical: 'name:wrong', variants: ['name:emmanuel macron'], wikidataId: null}]});
  await make(dayStore(), f).handler({date: '2026-10-20'});
  assert.deepEqual(f.json(`${P}views/stories/thread-1.json`).actorIds, ['wd:Q3052772']);
  const g = fakeS3();
  await make(dayStore(), g).handler({date: '2026-10-20'});
  assert.deepEqual(g.json(`${P}views/stories/thread-1.json`).actorIds, ['name:emmanuel macron']);
});

// X2: the article inbox
const rawLine = (n, o = {}) => ({schemaVersion: 1, rawId: `r${n}`, url: `https://www.bbc.co.uk/news/raw${n}?utm_source=rss`, canonicalUrl: `https://bbc.co.uk/news/raw${n}`, title: `Raw ${n}`, outlet: 'BBC', feed: 'bbc-world',
  publishedAt: '2026-10-20T03:00:00.000Z', fetchedAt: '2026-10-20T04:00:00.000Z', snippet: null, lang: 'en', ...o});
const putArticles = (f, day, lines) => f.objs.set(`${P}inbox/articles/${day}.jsonl`, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: `"a${day}"`});
const day20 = () => scripted({'2026-10-20': twenty('2026-10-20')});

test('X2: articles are appended under their own date, once; a re-run and an overlapping inbox day add nothing; counts.article', async () => {
  const f0 = fakeS3();
  putArticles(f0, '2026-10-20', [rawLine(1), rawLine(2, {publishedAt: null}), rawLine(1, {rawId: 'dup'})]);
  putArticles(f0, '2026-10-19', [rawLine(3, {publishedAt: '2026-10-19T22:00:00.000Z', fetchedAt: '2026-10-19T23:00:00.000Z'})]);
  const {f, handler} = make(day20(), f0);
  const r = await handler({date: '2026-10-20'});
  assert.deepEqual([r.status, r.counts.article], ['ok', 3]);
  assert.deepEqual(f.lines(`${P}facts/2026-10-20.jsonl`).filter((x) => x.kind === 'article').map((x) => [x.payload.title, x.precision]).sort(), [['Raw 1', 'exact'], ['Raw 2', 'day']]);
  assert.deepEqual(f.lines(`${P}facts/2026-10-19.jsonl`).map((x) => x.kind), ['article']);
  const again = await handler({date: '2026-10-20'});
  assert.equal(again.counts.article, 0);
});

test('X2: the article inbox window is the run day and 6 days back; {inboxFrom} widens it', async () => {
  const f0 = fakeS3();
  putArticles(f0, '2026-10-14', [rawLine(1, {publishedAt: null, fetchedAt: '2026-10-14T05:00:00.000Z'})]);
  putArticles(f0, '2026-10-13', [rawLine(2, {publishedAt: null, fetchedAt: '2026-10-13T05:00:00.000Z'})]);
  const a = make(day20(), f0);
  await a.handler({date: '2026-10-20'});
  assert.deepEqual(a.f.lines(`${P}facts/2026-10-14.jsonl`).map((x) => x.kind), ['article']);
  assert.equal(a.f.lines(`${P}facts/2026-10-13.jsonl`).length, 0);
  const b = make(day20(), f0);
  await b.handler({date: '2026-10-20', inboxFrom: '2026-10-13'});
  assert.deepEqual(b.f.lines(`${P}facts/2026-10-13.jsonl`).map((x) => x.kind), ['article']);
});

test('X2: a malformed article line is an article failure (partial), the other lines are kept', async () => {
  const f0 = fakeS3();
  putArticles(f0, '2026-10-20', [rawLine(1), {schemaVersion: 1, url: 'https://x.test/a', title: ''}, rawLine(2, {fetchedAt: 'nope'})]);
  const {f, handler} = make(day20(), f0);
  await assert.rejects(() => handler({date: '2026-10-20'}), /partial/);
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.counts.article, run.failures.map((x) => [x.stage, x.ref])], ['partial', 1, [['article', '2026-10-20#1'], ['article', '2026-10-20#2']]]);
});

test('X2: an unparseable article file is an article failure for that day only', async () => {
  const f0 = fakeS3();
  putArticles(f0, '2026-10-20', [rawLine(1)]);
  f0.objs.set(`${P}inbox/articles/2026-10-19.jsonl`, {body: 'not json\n', etag: '"x"'});
  const {f, handler} = make(day20(), f0);
  await assert.rejects(() => handler({date: '2026-10-20'}), /partial/);
  const run = f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.counts.article, run.failures.map((x) => [x.stage, x.ref])], [1, [['article', '2026-10-19']]]);
});

test('X2: inputs.rawDay is missing, {thin:n} under 50 and present from 50; null when the file cannot be read', async () => {
  const run = async (lines, raw) => {
    const f0 = fakeS3();
    if (lines) putArticles(f0, '2026-10-20', lines);
    if (raw) f0.objs.set(`${P}inbox/articles/2026-10-20.jsonl`, {body: raw, etag: '"x"'});
    const {f, handler} = make(day20(), f0);
    await handler({date: '2026-10-20'}).catch(() => {});
    return f.json(`${P}runs/2026-10-20.json`).inputs.rawDay;
  };
  const n = (k) => Array.from({length: k}, (_, i) => rawLine(i));
  assert.deepEqual([await run(null), await run(n(7)), await run(n(49)), await run(n(50)), await run(null, 'bad\n')], ['missing', {thin: 7}, {thin: 49}, 'present', null]);
});

test('X2: a missing archive day (model outage) still lands the article facts: Run failed for inputs, counts and views carry them, a re-run appends nothing', async () => {
  const f0 = fakeS3();
  putArticles(f0, '2026-10-20', [rawLine(1), rawLine(2)]);
  const a = make(scripted({}), f0);
  const r = await a.handler({date: '2026-10-20', strict: false});
  const arts = () => a.f.lines(`${P}facts/2026-10-20.jsonl`).filter((x) => x.kind === 'article').length;
  const run = a.f.json(`${P}runs/2026-10-20.json`);
  assert.deepEqual([run.status, run.inputs.archiveDay, run.inputs.rawDay, run.failures.map((x) => x.stage), r.counts.article, arts()], ['failed', 'missing', {thin: 2}, ['inputs'], 2, 2]);
  assert.ok(run.daysWritten.includes('2026-10-20'));
  assert.equal(a.f.json(`${P}views/counts/2026-10-20.json`).articles, 2);
  await a.handler({date: '2026-10-20', strict: false});
  assert.equal(arts(), 2);
});

test('X2: a day whose Run notes recovery refuses forecast_drawn (hook); a normal day keeps them', async () => {
  const snap = {pk: 'PRED#Topic 1-1', topicId: 'Topic 1-1', date: '2026-10-20', threadId: 'thread-1', generatedAt: null, title: 't',
    sourceRow: {store: 'G', key: {PK: 'a', SK: 'b'}}, sourceKey: 'k1', scenarios: [{index: 0, label: 'L', probability: 1, triggers: [{id: '0-0', trigger: 't', due: null, p: null, resolutionSource: '', question: true, qid: 'q1', status: ''}]}]};
  const mk = () => make(scripted({'2026-10-20': twenty('2026-10-20')}, {snapshots: {'2026-10-20': [snap]}}));
  const normal = mk();
  assert.equal((await normal.handler({date: '2026-10-20'})).counts.forecast_drawn, 1);
  const rec = mk();
  const r = await rec.handler({date: '2026-10-20', recovery: true});
  assert.deepEqual([r.status, r.counts.forecast_drawn, r.counts.entry], ['ok', 0, 20]);
  const run = rec.f.json(`${P}runs/2026-10-20.json`);
  assert.match(run.notes, /^recovery refused forecast_drawn: 1$/);
  assert.equal(rec.f.lines(`${P}facts/2026-10-20.jsonl`).filter((x) => x.kind === 'forecast_drawn').length, 0);
});
