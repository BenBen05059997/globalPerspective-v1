'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const w = require('../src/world');
const { fakeClient, seed } = require('./world.fake');

const range = async () => w.archiveRange(seed(fakeClient()), '2026-10-14', '2026-10-17');

test('tierFromScore: band edges, null for non-numbers, numeric strings coerced', () => {
  const cases = [[0, 'low'], [24, 'low'], [24.9, 'low'], [25, 'moderate'], [49, 'moderate'], [50, 'elevated'], [74, 'elevated'], [75, 'high'], [100, 'high'],
    [null, null], [undefined, null], ['', null], ['abc', null], [NaN, null], ['80', 'high'], ['24', 'low']];
  for (const [score, tier] of cases) assert.strictEqual(w.tierFromScore(score), tier, String(score));
  assert.deepStrictEqual(w.TIER_BANDS.map((b) => b.min), [75, 50, 25, 0]);
});

test('tierFromScore agrees with the frontend riskTiers.js at every integer score', async () => {
  let front;
  try { front = await import(pathToFileURL(path.join(__dirname, '../../../global-perspectives-starter/frontend/src/shared/lib/riskTiers.js')).href); } catch { return; } // frontend not present in this checkout
  for (let s = 0; s <= 100; s += 1) assert.strictEqual(w.tierFromScore(s), front.tierFromScore(s), String(s));
});

test('outletsOf: sorted distinct hosts, lower-cased, www stripped, empty names ignored; works on entries and topics', async () => {
  const r = await range();
  assert.deepStrictEqual(w.outletsOf(r.days.flatMap((d) => d.entries)), ['bbc.com', 'ft.com', 'reuters.com']);
  assert.deepStrictEqual(w.outletsOf([{ sources: [{ source: ' WWW.BBC.com ' }, { source: '' }, {}, null] }, { sources: undefined }, null]), ['bbc.com']);
  assert.deepStrictEqual(w.outletsOf(undefined), []);
});

test('birthByThread: earliest day, bornAt from archivedAt of that day, windowLimited on the first window day', async () => {
  const r = await range();
  const b = w.birthByThread(r);
  assert.deepStrictEqual(Object.keys(b).sort(), ['thread-a', 'thread-b']);
  assert.strictEqual(b['thread-a'].born, '2026-10-14');
  assert.strictEqual(b['thread-a'].bornAt, '2026-10-14T01:00:00.000Z'); // earliest of the two entries that day
  assert.strictEqual(b['thread-a'].bornAtApprox, false);
  assert.strictEqual(b['thread-a'].windowLimited, true); // first day of the window
  assert.strictEqual(b['thread-a'].firstTopicId, 't-a1'); // first by date, then topicId
  assert.strictEqual(b['thread-b'].born, '2026-10-16');
  assert.strictEqual(b['thread-b'].windowLimited, false); // 10-14 is a present day without it
  assert.deepStrictEqual(b['thread-b'].missingBefore, ['2026-10-15']); // but 10-15 is missing, so the date may be late
});

test('birthByThread: no present day before born inside the window means windowLimited; entry without archivedAt falls back to midnight', async () => {
  const c = seed(fakeClient());
  const r = await w.archiveRange(c, '2026-10-15', '2026-10-17'); // 10-15 missing, window starts there
  const b = w.birthByThread(r);
  assert.strictEqual(b['thread-a'].born, '2026-10-16');
  assert.strictEqual(b['thread-a'].windowLimited, true); // only a missing day precedes it
  assert.deepStrictEqual(b['thread-a'].missingBefore, ['2026-10-15']);
  const onlyB = w.birthByThread([r.days[1]], { from: '2026-10-17', missingDays: [] });
  assert.strictEqual(onlyB['thread-b'].bornAt, '2026-10-17T00:00:00Z');
  assert.strictEqual(onlyB['thread-b'].bornAtApprox, true);
  assert.deepStrictEqual(w.birthByThread([]), {});
});

test('entriesByThread: grouped, ascending, entries without a thread skipped', async () => {
  const g = w.entriesByThread(await range());
  assert.deepStrictEqual(g['thread-a'].map((e) => e.topicId), ['t-a1', 't-a1b', 't-a2']);
  assert.strictEqual(Object.keys(g).length, 2);
});

test('branchesFromScenarios: one fork per snapshot, one branch per trigger, trigger p kept apart from scenario p', async () => {
  const snaps = await w.scenarios(seed(fakeClient()), { topicIds: ['t-a1', 't-a2'] });
  const forks = w.branchesFromScenarios(snaps);
  assert.deepStrictEqual(forks.map((f) => [f.forkId, f.drawnAt, f.atEvent, f.threadId, f.branches.length]), [
    ['PRED#t-a1/2026-10-14', '2026-10-14', 't-a1', null, 1], ['PRED#t-a2/2026-10-16', '2026-10-16', 't-a2', 'thread-a', 3]]);
  const b = forks[1].branches;
  assert.deepStrictEqual(b[0], { branchId: 'PRED#t-a2/2026-10-16/0-0', scenarioId: '0', text: 'Most Likely', p: 65, scenarioP: 60, trigger: 'Charges filed', resolutionSource: 'AG announcement', due: '2027-01-05', question: true, qid: 'q1' });
  assert.strictEqual(b[1].p, null); // a narrative trigger has no p of its own
  assert.strictEqual(b[1].resolutionSource, '');
  assert.strictEqual(b[2].branchId, 'PRED#t-a2/2026-10-16/1-0');
  assert.strictEqual(forks[0].branches[0].p, null);
  assert.deepStrictEqual(w.branchesFromScenarios([]), []);
  assert.deepStrictEqual(w.branchesFromScenarios([{ pk: 'PRED#e', date: '2026-10-01', topicId: 'e', threadId: null, scenarios: [] }])[0].branches, []);
});

test('coverage: scoped counts, missing days in scope and in the window, analysedNew over stories born since', async () => {
  const r = await range();
  const births = w.birthByThread(r);
  const cov = w.coverage(r, { since: '2026-10-16', births, analyses: { 'thread-b': { riskScore: 40 } } });
  assert.deepStrictEqual(cov, {
    from: '2026-10-14', to: '2026-10-17', since: '2026-10-16', expectedDays: 2, daysWithData: 2,
    missingDays: [], windowMissingDays: ['2026-10-15'], entries: 4, stories: 2, outlets: 3, analysedNew: { analysed: 1, total: 1 },
  });
  const all = w.coverage(r);
  assert.deepStrictEqual([all.expectedDays, all.daysWithData, all.missingDays, all.entries, all.analysedNew], [4, 3, ['2026-10-15'], 6, null]);
  const none = w.coverage({ from: '2026-01-01', to: '2026-01-02', days: [], missingDays: ['2026-01-01', '2026-01-02'] }, { births: {} });
  assert.deepStrictEqual([none.entries, none.stories, none.outlets, none.daysWithData, none.analysedNew], [0, 0, 0, 0, { analysed: 0, total: 0 }]);
});

test('analysisAsOf: analysis when generated by the day, else last history point, else null; no leak backward', () => {
  const a = { asOfDay: '2026-10-19', riskScore: 78, tier: 'high', title: 'T', trajectory: 'now' };
  const h = [{ date: '2026-10-14', score: 50, tier: 'elevated', title: 'old', trajectory: 'h0' }, { date: '2026-10-16', score: 49, tier: 'moderate', title: null, trajectory: 'h1' }];
  assert.deepStrictEqual(w.analysisAsOf(a, h, '2026-10-20'), { source: 'analysis', date: '2026-10-19', riskScore: 78, tier: 'high', title: 'T', trajectory: 'now' });
  assert.strictEqual(w.analysisAsOf(a, h).source, 'analysis');
  assert.deepStrictEqual(w.analysisAsOf(a, h, '2026-10-17'), { source: 'history', date: '2026-10-16', riskScore: 49, tier: 'moderate', title: null, trajectory: 'h1' });
  assert.strictEqual(w.analysisAsOf(a, h, '2026-10-01'), null);
  assert.strictEqual(w.analysisAsOf({ ...a, asOfDay: null }, h, '2026-10-20').source, 'history'); // undated analysis cannot be placed in time
  assert.strictEqual(w.analysisAsOf(null, [], '2026-10-20'), null);
});

test('dates: eachDay is inclusive, isDay rejects impossible days', () => {
  assert.deepStrictEqual(w.eachDay('2026-02-27', '2026-03-02'), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  assert.strictEqual(w.isDay('2026-02-30'), false);
  assert.strictEqual(w.isDay('2026-2-3'), false);
  assert.strictEqual(w.addDays('2026-12-31', 1), '2027-01-01');
  assert.throws(() => w.eachDay('x', '2026-01-01'));
});
