'use strict';
const test = require('node:test');
const assert = require('node:assert');
const w = require('../src/world');
const { fakeClient, seed } = require('./world.fake');

const fresh = () => seed(fakeClient());

test('archiveDay: normalised entries, missing day is null, ai only on request', async () => {
  const c = fresh();
  const d = await w.archiveDay(c, '2026-10-14');
  assert.strictEqual(d.date, '2026-10-14');
  assert.strictEqual(d.source, 'archive');
  assert.strictEqual(d.entries.length, 2);
  const e = d.entries[0];
  assert.deepStrictEqual([e.date, e.archive, e.topicId, e.threadId, e.eventType, e.iso3, e.actors], ['2026-10-14', 'archive#2026-10-14', 't-a1', 'thread-a', 'unrest', ['FRA'], ['Emmanuel Macron']]);
  assert.strictEqual(e.sources[0].source, 'bbc.com');
  assert.ok(!('ai' in e));
  assert.deepStrictEqual((await w.archiveDay(c, '2026-10-14', { withAi: true })).entries[0].ai, { summary: '- text' });
  assert.strictEqual(await w.archiveDay(c, '2026-10-15'), null);
  await assert.rejects(() => w.archiveDay(c, '2026-13-40'));
});

test('archiveDay: an entry with only `id` and no sources still normalises', async () => {
  const d = await w.archiveDay(fresh(), '2026-10-16');
  const legacy = d.entries.find((x) => x.title === 'no thread');
  assert.strictEqual(legacy.topicId, 'legacy-id-only');
  assert.strictEqual(legacy.threadId, null);
  assert.deepStrictEqual(legacy.sources, []);
});

test('archiveDay: today-archive adds only entries archived today and only for the current UTC day', async () => {
  const c = fresh();
  const nowMs = Date.parse('2026-10-18T12:00:00Z');
  c.put('NewsCache', { id: 'today-archive', updatedAt: 'x', entries: [
    { topicId: 'fresh-1', threadId: 'thread-n', title: 'n', archivedAt: '2026-10-18T09:00:00.000Z', sources: [] },
    { topicId: 'stale', threadId: 'thread-s', archivedAt: '2026-10-17T09:00:00.000Z', sources: [] },
  ] });
  const d = await w.archiveDay(c, '2026-10-18', { nowMs });
  assert.strictEqual(d.source, 'today-archive'); // no archive#2026-10-18 row
  assert.deepStrictEqual(d.entries.map((e) => e.topicId), ['fresh-1']);
  assert.ok(!(await w.archiveDay(c, '2026-10-17', { nowMs })).entries.some((e) => e.topicId === 'fresh-1'));
  const same = await w.archiveDay(c, '2026-10-18'); // no nowMs: today-archive is not consulted
  assert.strictEqual(same, null);
  // a day row that exists keeps its own entry and gains the missing one
  c.put('NewsCache', { id: 'archive#2026-10-18', entries: [{ topicId: 'fresh-1', threadId: 'thread-n', sources: [{ source: 'a.com' }] }] });
  const merged = await w.archiveDay(c, '2026-10-18', { nowMs });
  assert.strictEqual(merged.source, 'archive');
  assert.strictEqual(merged.entries.length, 1);
  assert.strictEqual(merged.entries[0].sources[0].source, 'a.com');
});

test('archiveRange: present days ascending, missing days listed, range validated', async () => {
  const r = await w.archiveRange(fresh(), '2026-10-14', '2026-10-17');
  assert.deepStrictEqual(r.days.map((d) => d.date), ['2026-10-14', '2026-10-16', '2026-10-17']);
  assert.deepStrictEqual(r.missingDays, ['2026-10-15']);
  assert.deepStrictEqual([r.from, r.to], ['2026-10-14', '2026-10-17']);
  const none = await w.archiveRange(fresh(), '2026-01-01', '2026-01-02');
  assert.deepStrictEqual([none.days, none.missingDays], [[], ['2026-01-01', '2026-01-02']]);
  await assert.rejects(() => w.archiveRange(fresh(), '2026-10-17', '2026-10-14'));
});

test('threadAnalysis: normalised, missing threads absent, TTL-expired rows dropped when nowMs given', async () => {
  const c = fresh();
  const out = await w.threadAnalysis(c, ['thread-a', 'thread-missing', 'thread-old', 'thread-a']);
  assert.deepStrictEqual(Object.keys(out).sort(), ['thread-a', 'thread-old']);
  const a = out['thread-a'];
  assert.deepStrictEqual([a.title, a.riskScore, a.tier, a.lead, a.iso3, a.asOfDay, a.entryCount], ['Story A', 78, 'high', 'political', ['FRA'], '2026-10-19', 31]);
  assert.deepStrictEqual(a.keyActors, [{ name: 'Emmanuel Macron', role: 'France · President', mentionCount: 8 }, { name: 'Marine Le Pen', role: null, mentionCount: null }]);
  assert.deepStrictEqual(out['thread-old'].iso3, []); // older rows have no iso3
  const live = await w.threadAnalysis(c, ['thread-a', 'thread-old'], { nowMs: Date.parse('2026-10-20T00:00:00Z') });
  assert.deepStrictEqual(Object.keys(live), ['thread-a']);
  assert.deepStrictEqual(await w.threadAnalysis(c, []), {});
  assert.strictEqual(c.calls.filter((x) => x[0] === 'batchGet').length, 2); // [] makes no call
});

test('threadHistory / countryHistory: ascending, from..to, rows without a score or date dropped, tier from score', async () => {
  const c = fresh();
  const h = await w.threadHistory(c, 'thread-a');
  assert.deepStrictEqual(h.map((p) => [p.date, p.score, p.tier]), [['2026-10-14', 50, 'elevated'], ['2026-10-16', 49, 'moderate'], ['2026-10-18', 75, 'high']]);
  assert.strictEqual(h[1].title, 'Story A');
  assert.deepStrictEqual((await w.threadHistory(c, 'thread-a', '2026-10-15', '2026-10-17')).map((p) => p.date), ['2026-10-16']);
  assert.deepStrictEqual(await w.threadHistory(c, 'thread-none'), []);
  const ch = await w.countryHistory(c, 'France');
  assert.deepStrictEqual(ch.map((p) => [p.date, p.score, p.tier, p.level]), [['2026-10-14', 65, 'elevated', 'elevated'], ['2026-10-15', 24, 'low', null]]);
  assert.strictEqual(ch[0].headline, 'France faces');
  assert.deepStrictEqual(await w.countryHistory(c, 'Atlantis'), []);
});

test('driftNotes: DRIFTLOG preferred over DRIFT for the same date, DRIFT alone still returned, range and country', async () => {
  const c = fresh();
  const notes = await w.driftNotes(c, { threadId: 'thread-a' });
  assert.deepStrictEqual(notes.map((n) => [n.date, n.source]), [['2026-10-16', 'DRIFTLOG'], ['2026-10-18', 'DRIFT']]);
  assert.strictEqual(notes[0].whyChanged, 'because (log)');
  assert.deepStrictEqual(notes[0].triggerEvent, { date: '2026-10-16', topicId: 't-a2', title: 'T' });
  assert.deepStrictEqual(notes[0].changeScore, { from: 50, to: 49, delta: -1 });
  assert.deepStrictEqual([notes[0].prior, notes[0].current, notes[0].subject], ['P', 'C', { kind: 'thread', id: 'thread-a' }]);
  assert.strictEqual(notes[1].triggerEvent, null);
  assert.strictEqual(notes[1].noSingleDriver, true);
  assert.deepStrictEqual(notes[1].directionFlag, { kinds: ['x'] });
  assert.deepStrictEqual((await w.driftNotes(c, { threadId: 'thread-a' }, '2026-10-17', '2026-10-20')).map((n) => n.date), ['2026-10-18']);
  const country = await w.driftNotes(c, { country: 'France' });
  assert.deepStrictEqual([country.length, country[0].prior, country[0].current, country[0].changeLevel, country[0].subject], [1, 'ph', 'ch', { from: 'moderate', to: 'elevated' }, { kind: 'country', id: 'France' }]);
  assert.deepStrictEqual(await w.driftNotes(c, { threadId: 'thread-none' }), []);
  await assert.rejects(() => w.driftNotes(c, {}));
});

test('scenarios by topicIds: percent units, older rows without p, sorted, range narrows', async () => {
  const c = fresh();
  const snaps = await w.scenarios(c, { topicIds: ['t-a2', 't-a1'] });
  assert.deepStrictEqual(snaps.map((s) => [s.pk, s.date]), [['PRED#t-a1', '2026-10-14'], ['PRED#t-a2', '2026-10-16']]);
  const old = snaps[0];
  assert.strictEqual(old.questionSchema, false);
  assert.strictEqual(old.threadId, null);
  assert.deepStrictEqual(old.scenarios[0].triggers[0], { id: '0-0', trigger: 'Old trigger', due: '2026-12-31', p: null, resolutionSource: null, question: null, qid: null, status: 'pending' });
  const s = snaps[1];
  assert.strictEqual(s.questionSchema, true);
  assert.deepStrictEqual([s.scenarios[0].probability, s.scenarios[1].probability, s.scenarios[0].probabilityRange], [60, 15, '55-65%']);
  assert.deepStrictEqual(s.scenarios[0].triggers[0], { id: '0-0', trigger: 'Charges filed', due: '2027-01-05', p: 65, resolutionSource: 'AG announcement', question: true, qid: 'q1', status: 'pending' });
  assert.strictEqual(s.scenarios[1].triggers[0].id, '1-0'); // no id on the row: scenario-trigger index
  assert.deepStrictEqual((await w.scenarios(c, { topicIds: ['t-a2', 't-a1'], from: '2026-10-15', to: '2026-10-31' })).map((x) => x.pk), ['PRED#t-a2']);
  assert.deepStrictEqual(await w.scenarios(c, { topicIds: ['t-nothing'] }), []);
});

test('scenarios by threadId: TOPICS pointer, extra topicIds, a row naming another thread is dropped', async () => {
  const c = fresh();
  assert.deepStrictEqual((await w.scenarios(c, { threadId: 'thread-a' })).map((s) => s.pk), ['PRED#t-a1', 'PRED#t-a2']);
  const more = await w.scenarios(c, { threadId: 'thread-a', topicIds: ['t-other', 't-x'] });
  assert.deepStrictEqual(more.map((s) => s.pk), ['PRED#t-a1', 'PRED#t-a2', 'PRED#t-x']); // t-other belongs to thread-zzz
  assert.deepStrictEqual(await w.scenarios(c, { threadId: 'thread-no-pointer' }), []);
});

test('scenarios by date range: one bounded scan, and a clear error with no selector', async () => {
  const c = fresh();
  const snaps = await w.scenarios(c, { from: '2026-10-15', to: '2026-10-19' });
  assert.deepStrictEqual(snaps.map((s) => s.pk), ['PRED#t-a2', 'PRED#t-other']);
  assert.strictEqual(c.calls.filter((x) => x[0] === 'scan').length, 1);
  await assert.rejects(() => w.scenarios(c, {}), /needs/);
});

test('verdicts: highest VERDICT#n wins (10 beats 2 beats VERDICT), as-of ignores later decisions, no verdict is absent', async () => {
  const c = fresh();
  const v = await w.verdicts(c, ['q1', 'q2', 'q3', 'q1']);
  assert.deepStrictEqual(Object.keys(v), ['q1']);
  assert.deepStrictEqual([v.q1.n, v.q1.sk, v.q1.verdict, v.q1.decidedBy, v.q1.voidReason], [10, 'VERDICT#10', 'void', 'operator', 'v']);
  assert.deepStrictEqual(v.q1.all.map((x) => x.n), [1, 2, 10]);
  const asOf = await w.verdicts(c, ['q1'], { asOf: '2026-10-19' });
  assert.deepStrictEqual([asOf.q1.n, asOf.q1.verdict, asOf.q1.evidence], [1, 'no', { url: 'u', quote: 'q' }]);
  assert.deepStrictEqual(await w.verdicts(c, ['q1'], { asOf: '2026-10-01' }), {});
  assert.deepStrictEqual(await w.verdicts(c, []), {});
  assert.strictEqual(w.verdictOrder('VERDICT'), 1);
  assert.strictEqual(w.verdictOrder('VERDICT#7'), 7);
  assert.strictEqual(w.verdictOrder('SAMPLED'), 0);
});

test('webIndex / webLatest: normalised bundle; bad links dropped; no row is empty (DynamoDB) or null (S3)', async () => {
  const c = fresh();
  const idx = await w.webIndex(c);
  assert.strictEqual(idx.generatedAt, '2026-10-20T05:00:21.595Z');
  assert.deepStrictEqual(idx.links.map((l) => [l.from, l.to]), [['thread-a', 'thread-b'], ['thread-b', 'thread-c']]);
  assert.deepStrictEqual(idx.links[0], { sourceRow: { store: 'SummarizeAndPredict', key: { PK: 'WEB#INDEX', SK: 'LATEST' }, index: 0 }, sourceKey: 'web|thread-a|thread-b', from: 'thread-a', to: 'thread-b', confidence: 'strong', lagDays: 1, mechanism: 'm', cited: [{ date: '2026-10-14', topicId: 't-a1', title: 'T' }], country: 'France', generatedAt: '2026-10-19T05:00:00.000Z' });
  assert.deepStrictEqual([idx.links[1].confirmed, idx.links[1].confirmedBy, idx.links[1].strength], [true, 'rule', 'strong']);
  assert.deepStrictEqual(idx.links[1].sourceRow.index, 2); // the bad link at raw index 1 was filtered: index 2 stays 2
  assert.strictEqual(idx.links[1].sourceKey, 'web|thread-b|thread-c');
  assert.deepStrictEqual(idx.shared, [{ sourceRow: { store: 'SummarizeAndPredict', key: { PK: 'WEB#INDEX', SK: 'LATEST' }, index: 0 }, sourceKey: 'web-shared|thread-a|thread-b', a: 'thread-a', b: 'thread-b', actors: ['Iran'], weight: 2, country: 'France', generatedAt: null }]);
  assert.deepStrictEqual(Object.keys(idx.threads), ['thread-a']);
  assert.deepStrictEqual(idx.threads['thread-a'].places, [{ name: 'France', n: 3 }]);
  const s3 = await w.webLatest(c);
  assert.strictEqual(s3.runId, 'web-1');
  assert.deepStrictEqual(s3.index.links.map((l) => l.sourceRow), [{ store: 'S3', key: 'web/latest.json', index: 0 }, { store: 'S3', key: 'web/latest.json', index: 2 }]);
  assert.deepStrictEqual(s3.index.links.map((l) => l.sourceKey), idx.links.map((l) => l.sourceKey));
  assert.deepStrictEqual(s3.index.links.map(({ sourceRow, ...l }) => l), idx.links.map(({ sourceRow, ...l }) => l));
  assert.deepStrictEqual(s3.index.threads, idx.threads);
  const empty = fakeClient();
  assert.deepStrictEqual(await w.webIndex(empty), { generatedAt: null, links: [], shared: [], threads: {} });
  assert.strictEqual(await w.webLatest(empty), null);
  empty.putS3('web/latest.json', { links: [], shared: [], threads: {} }); // an unwrapped bundle is accepted
  assert.deepStrictEqual((await w.webLatest(empty)).index.links, []);
});

test('latestTopics: normalised pool; no row is an empty list', async () => {
  const t = await w.latestTopics(fresh());
  assert.strictEqual(t.length, 2);
  assert.deepStrictEqual([t[0].topicId, t[0].threadId, t[0].actors, t[0].iso3, t[0].sources.map((s) => s.source)], ['Topic X', 'thread-a', ['Iran'], ['IRN'], ['reuters.com', 'bbc.com']]);
  assert.deepStrictEqual([t[1].topicId, t[1].threadId, t[1].actors], ['Only id', null, []]);
  assert.deepStrictEqual(await w.latestTopics(fakeClient()), []);
});

test('table names: live defaults, env override, explicit tables override env', async () => {
  assert.deepStrictEqual(w.resolveTables(), w.DEFAULT_TABLES);
  assert.strictEqual(w.DEFAULT_TABLES.predictions, 'GlobalPerspectivePredictionLog');
  const env = { TOPICS_DDB_TABLE: 'n', SUMMARIZE_PREDICT_TABLE: 'w', PREDICTION_LOG_TABLE: 'p' };
  assert.deepStrictEqual(w.resolveTables({ env }), { cache: 'n', world: 'w', predictions: 'p' });
  assert.strictEqual(w.resolveTables({ env, tables: { world: 'x' } }).world, 'x');
  const c = fresh();
  await w.latestTopics(c, { env: { TOPICS_DDB_TABLE: 'custom' } });
  assert.deepStrictEqual(c.calls.at(-1), ['getItem', 'custom', { id: 'latest' }]);
});

test('a client missing a method gives a clear error instead of a TypeError', async () => {
  await assert.rejects(() => w.webLatest({ getItem: async () => null }), /no getS3Json/);
  await assert.rejects(() => w.archiveDay({}, '2026-10-14'), /no getItem/);
});

test('read errors propagate: a failure is never treated as absence', async () => {
  const c = fresh();
  c.getItem = async () => { throw new Error('throttled'); };
  await assert.rejects(() => w.archiveDay(c, '2026-10-14'), /throttled/);
  await assert.rejects(() => w.archiveRange(c, '2026-10-14', '2026-10-15'), /throttled/);
});

test('provenance: archive entries carry NewsCache key, raw index before filtering, and a generation-based sourceKey', async () => {
  const c = fresh();
  const d = await w.archiveDay(c, '2026-10-16');
  // raw array: [t-a2, t-b1, legacy]; all objects kept
  assert.deepStrictEqual(d.entries.map((e) => e.sourceRow), [0, 1, 2].map((index) => ({ store: 'NewsCache', key: { id: 'archive#2026-10-16' }, index })));
  assert.deepStrictEqual(d.entries.map((e) => e.sourceKey), ['archive#2026-10-16|gen-1|t-a2', 'archive#2026-10-16|gen-1|t-b1', 'archive#2026-10-16||legacy-id-only']);
  // no generationId: archivedAt
  c.put('NewsCache', { id: 'archive#2026-10-19', entries: [null, { topicId: 'x-1', threadId: 'thread-a', archivedAt: '2026-10-19T04:00:00.000Z', sources: [] }, { topicId: 'x-2', generationId: 'g9' }] });
  const f = await w.archiveDay(c, '2026-10-19');
  assert.deepStrictEqual(f.entries.map((e) => [e.sourceRow.index, e.sourceKey]), [[1, 'archive#2026-10-19|2026-10-19T04:00:00.000Z|x-1'], [2, 'archive#2026-10-19|g9|x-2']]); // the null entry did not shift the next index
});

test('provenance: today-archive entries merged into the day keep their own row and raw index', async () => {
  const c = fresh();
  const nowMs = Date.parse('2026-10-18T12:00:00Z');
  c.put('NewsCache', { id: 'today-archive', entries: [
    { topicId: 'stale', threadId: 's', archivedAt: '2026-10-17T09:00:00.000Z', sources: [] },
    { topicId: 'fresh-1', threadId: 'n', generationId: 'g1', archivedAt: '2026-10-18T09:00:00.000Z', sources: [] },
  ] });
  c.put('NewsCache', { id: 'archive#2026-10-18', entries: [{ topicId: 'own', threadId: 'o', generationId: 'g1', sources: [] }] });
  const d = await w.archiveDay(c, '2026-10-18', { nowMs });
  assert.deepStrictEqual(d.entries.map((e) => [e.topicId, e.sourceRow, e.sourceKey]), [
    ['own', { store: 'NewsCache', key: { id: 'archive#2026-10-18' }, index: 0 }, 'archive#2026-10-18|g1|own'],
    ['fresh-1', { store: 'NewsCache', key: { id: 'today-archive' }, index: 1 }, 'today-archive|g1|fresh-1'], // stale at raw index 0 was filtered; fresh-1 keeps 1
  ]);
});

test('provenance: analysis, history points, drift (both rows merged), scenarios, verdicts, latest topics', async () => {
  const c = fresh();
  const a = (await w.threadAnalysis(c, ['thread-a']))['thread-a'];
  assert.deepStrictEqual([a.sourceRow, a.sourceKey], [{ store: 'SummarizeAndPredict', key: { PK: 'THREAD#thread-a', SK: 'THREAD_ANALYSIS' } }, 'THREAD#thread-a|THREAD_ANALYSIS']);
  const h = await w.threadHistory(c, 'thread-a');
  assert.deepStrictEqual([h[1].sourceRow.key, h[1].sourceKey], [{ PK: 'THREAD#thread-a', SK: 'THREAD_HISTORY#2026-10-16' }, 'THREAD#thread-a|THREAD_HISTORY#2026-10-16']);
  const ch = await w.countryHistory(c, 'France');
  assert.strictEqual(ch[1].sourceKey, 'COUNTRY#France|HISTORY#2026-10-15');
  const notes = await w.driftNotes(c, { threadId: 'thread-a' });
  assert.deepStrictEqual(notes[0].sourceRow.key, { PK: 'THREAD#thread-a', SK: 'DRIFTLOG#2026-10-16' }); // the row the note was taken from
  assert.deepStrictEqual(notes[0].sourceRows, [{ PK: 'THREAD#thread-a', SK: 'DRIFT#2026-10-16' }, { PK: 'THREAD#thread-a', SK: 'DRIFTLOG#2026-10-16' }]);
  assert.strictEqual(notes[0].sourceKey, 'THREAD#thread-a|DRIFT#2026-10-16');
  assert.deepStrictEqual([notes[1].sourceRow.key.SK, notes[1].sourceRows.length, notes[1].sourceKey], ['DRIFT#2026-10-18', 1, 'THREAD#thread-a|DRIFT#2026-10-18']);
  const snap = (await w.scenarios(c, { topicIds: ['t-a2'] }))[0];
  assert.deepStrictEqual([snap.sourceRow, snap.sourceKey], [{ store: 'GlobalPerspectivePredictionLog', key: { PK: 'PRED#t-a2', SK: '2026-10-16' } }, 'PRED#t-a2|2026-10-16']);
  assert.deepStrictEqual(snap.scenarios.map((s) => [s.sourceRow.index, s.sourceKey]), [[0, 'PRED#t-a2|2026-10-16|0'], [1, 'PRED#t-a2|2026-10-16|1']]);
  assert.deepStrictEqual(snap.scenarios[1].sourceRow.key, { PK: 'PRED#t-a2', SK: '2026-10-16' });
  const v = (await w.verdicts(c, ['q1'])).q1;
  assert.deepStrictEqual([v.sourceRow, v.sourceKey], [{ store: 'GlobalPerspectivePredictionLog', key: { PK: 'Q#q1', SK: 'VERDICT#10' } }, 'Q#q1|VERDICT#10']);
  assert.deepStrictEqual(v.all.map((x) => x.sourceKey), ['Q#q1|VERDICT', 'Q#q1|VERDICT#2', 'Q#q1|VERDICT#10']);
  const lt = await w.latestTopics(c);
  assert.deepStrictEqual([lt[1].sourceRow, lt[1].sourceKey], [{ store: 'NewsCache', key: { id: 'latest' }, index: 1 }, 'latest|Only id']);
});
