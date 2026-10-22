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
function scripted(days, {snapshots = {}, verdicts = {}, fail = {}} = {}) {
  return {
    async load(date) {
      if (fail[date]) throw new Error(fail[date]);
      const entries = days[date];
      return {date, dayRow: entries ? {date, source: 'archive', entries} : null, entries: entries || [], births: births(entries || []), snapshots: snapshots[date] || []};
    },
    async verdicts() { return verdicts; },
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
  assert.deepEqual([run.status, run.runId, run.inputs, run.counts.entry, run.counts.run], ['ok', '2026-10-20-1', {archiveDay: 'present', todayArchive: 'missing'}, 20, 1]);
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
  const v = {qid: 'q1', n: 1, sk: 'VERDICT', verdict: 'yes', decidedAt: '2026-10-23T00:00:00.000Z', decidedBy: 'agent', reason: null, voidReason: null, evidence: {url: 'https://x.test', quote: 'q'},
    sourceKey: 'Q#q1|VERDICT', sourceRow: {store: 'GlobalPerspectivePredictionLog', key: {PK: 'Q#q1', SK: 'VERDICT'}}};
  const {f, handler} = make(scripted({'2026-10-20': e, '2026-10-24': e.map((x) => ({...x, date: '2026-10-24'}))}, {snapshots: {'2026-10-20': [snap]}, verdicts: {}}));
  await handler({date: '2026-10-20'});
  const fc = f.lines(`${P}facts/2026-10-20.jsonl`).find((x) => x.kind === 'forecast_drawn');
  assert.deepEqual([fc.threadId, fc.precision, fc.payload.branches[0].branchId, fc.payload.branches[0].p], ['thread-1', 'exact', 'PRED#Topic 1-1/2026-10-20/0-0', 40]);
  assert.deepEqual(fc.iso3, ['FRA']);
  // The question is remembered from the facts, not re-read from the table.
  const later = make(scripted({'2026-10-24': e.map((x) => ({...x, date: '2026-10-24'}))}, {verdicts: {q1: {...v, all: [v]}}}), f, () => '2026-10-25T05:45:00.000Z');
  await later.handler({date: '2026-10-24'});
  const verdict = f.lines(`${P}facts/2026-10-23.jsonl`).find((x) => x.kind === 'verdict');
  assert.deepEqual([verdict.threadId, verdict.payload.result, verdict.payload.branchId, verdict.at], ['thread-1', 'yes', 'PRED#Topic 1-1/2026-10-20/0-0', '2026-10-23T00:00:00.000Z']);
});

test('a verdict with an unknown result is recorded as a failure, the rest of the day is kept (partial)', async () => {
  const e = twenty('2026-10-20');
  const snap = {pk: 'PRED#Topic 1-1', topicId: 'Topic 1-1', date: '2026-10-20', threadId: 'thread-1', generatedAt: null, title: 't',
    sourceRow: {store: 'G', key: {PK: 'a', SK: 'b'}}, sourceKey: 'k1', scenarios: [{index: 0, label: 'L', probability: 1, triggers: [{id: '0-0', trigger: 't', due: null, p: null, resolutionSource: '', question: true, qid: 'q9', status: ''}]}]};
  const bad = {qid: 'q9', n: 1, sk: 'VERDICT', verdict: 'maybe', decidedAt: '2026-10-20T08:00:00.000Z', sourceKey: 'Q#q9|VERDICT', sourceRow: {store: 'G', key: {PK: 'Q#q9', SK: 'VERDICT'}}};
  const {f, handler} = make(scripted({'2026-10-20': e}, {snapshots: {'2026-10-20': [snap]}, verdicts: {q9: {...bad, all: [bad]}}}));
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

test('O1: a forecast drawn 80 days ago still gets its verdict (lookback covers due + grace); the verdict is not appended twice', async () => {
  const day = '2026-10-20';
  const f = fakeS3();
  const drawn = {schemaVersion: 1, eventId: 'old-fc', kind: 'forecast_drawn', at: '2026-08-01T05:00:00.000Z', date: '2026-08-01', precision: 'exact', threadId: 'thread-1', iso3: [], actorIds: [], sourceIds: [],
    payload: {forkId: 'F', topicId: 't', branches: [{branchId: 'B1', text: 'x', p: 40, trigger: 'x', resolutionSource: 'Reuters', due: '2026-10-15', question: true, qid: 'q-old', scenarioP: 50}]},
    producer: {lambda: 'x', runId: 'r'}, sourceKey: 'k', sourceRow: {store: 's', key: 'k'}};
  f.put(`${P}facts/2026-08-01.jsonl`, drawn);
  const v = {qid: 'q-old', n: 1, sk: 'VERDICT', verdict: 'void', decidedAt: '2026-10-19T00:00:00.000Z', decidedBy: 'resolver', reason: null, voidReason: 'event_moot', evidence: null,
    sourceKey: 'Q#q-old|VERDICT', sourceRow: {store: 'G', key: {PK: 'Q#q-old', SK: 'VERDICT'}}};
  const store = scripted({[day]: twenty(day)}, {verdicts: {'q-old': {...v, all: [v]}}});
  const {handler} = make(store, f, () => '2026-10-21T05:45:00.000Z');
  const r = await handler({date: day});
  assert.equal(r.counts.verdict, 1);
  const fact = f.lines(`${P}facts/2026-10-19.jsonl`).find((x) => x.kind === 'verdict');
  assert.deepEqual([fact.threadId, fact.payload.result, fact.payload.voidReason, fact.payload.branchId], ['thread-1', 'void', 'event_moot', 'B1']);
  assert.equal((await handler({date: day})).counts.verdict, 0);
});

test('O1: the store asks for verdicts of any question, sampled or not', async () => {
  const c = fakeClient();
  c.put('GlobalPerspectivePredictionLog', {PK: 'Q#q-unsampled', SK: 'VERDICT', qid: 'q-unsampled', verdict: 'yes', decidedAt: '2026-10-19T00:00:00.000Z', decidedBy: 'resolver', evidence: {url: 'https://x.test', quote: 'twelve chars or more'}});
  const got = await makeStore(c).verdicts(['q-unsampled', 'q-none'], '2026-10-20');
  assert.deepEqual(Object.keys(got), ['q-unsampled']);
  assert.equal(got['q-unsampled'].verdict, 'yes');
  assert.ok(!c.calls.some((x) => x[0] === 'batchGet'));
});
