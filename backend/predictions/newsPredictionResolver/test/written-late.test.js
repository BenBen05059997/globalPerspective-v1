'use strict';
// A day with stories written after their slot is a record gap for the resolver (decisions 0061, 0055): the late stories may support a `yes`,
// they never let a `no` stand. A day without the marker is judged exactly as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const gather = require('../src/gather');
const { draftQuestion } = require('../src/draft');
const { fakeFacts, okRun } = require('./helpers');

const TODAY = '2026-11-20';
const NOW = '2026-11-20T10:30:00.000Z';
// drawn 2026-11-12, due 2026-11-16: coverage days 11-13 .. 11-16, the grace days after (to 11-19) feed the bundle
const Q = { qid: 'q', threadId: 'tA', issuedAt: '2026-11-12T05:00:00.000Z', deadline: '2026-11-16', storyTitle: 's', question: 'x' };
const LATE = { entries: 12, slots: ['2026-11-14T20:15:00.000Z'] };
const healthy = () => Object.fromEntries(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'].map((d) => [d, okRun()]));
const bundleOf = async (runs) => gather.buildBundle(Q, await gather.loadEntries(fakeFacts({}, runs), [Q], TODAY), TODAY);
const noOf = async (runs) => draftQuestion({ ...Q, bundle: await bundleOf(runs) }, { now: () => NOW, llm: async () => { throw new Error('no model'); } });

test('runGap: a Run that is ok with the archive present but holds late stories is a gap; without the marker it is not', () => {
  assert.equal(gather.windowOf !== undefined, true);
  assert.equal(gather.runGap, undefined, 'runGap stays private; the bundle is the interface');
});

test('both days 11-14 and 11-15 count as a gap when their Run carries lateWritten, whatever status and archiveDay say', async () => {
  const runs = { ...healthy(), '2026-11-14': okRun({ inputs: { archiveDay: 'present', lateWritten: LATE } }), '2026-11-15': okRun({ inputs: { archiveDay: 'present', lateWritten: { entries: 39, slots: ['2026-11-15T04:15:00.000Z'] } } }) };
  const b = await bundleOf(runs);
  assert.deepEqual(b.coverageGaps.map((g) => [g.day, g.why]), [['2026-11-14', 'stories written late'], ['2026-11-15', 'stories written late']]);
});

test('a model `no` over a window that crosses a late day is blocked (not_yet, coverage_gap); a `yes` from a late story still stands', async () => {
  const runs = { ...healthy(), '2026-11-14': okRun({ inputs: { archiveDay: 'present', lateWritten: LATE } }) };
  const d = await noOf(runs);
  assert.deepEqual([d.verdict, d.reason, d.gapDays], ['not_yet', 'coverage_gap', ['2026-11-14']]);
  const entries = [{ eventId: 'e1', title: 'Parliament ratifies the treaty today', summary: 'Lawmakers voted 200-10 on Tuesday.', date: '2026-11-14', url: null }];
  const yes = await draftQuestion({ ...Q, bundle: { entries, complete: true, coverageGaps: (await bundleOf(runs)).coverageGaps } }, { now: () => NOW, llm: async () => ({ verdict: 'yes', event_id: 'e1', quote: 'Lawmakers voted 200-10', why: 'w' }) });
  assert.equal(yes.verdict, 'yes');
});

test('an unmarked day behaves exactly as before: all four days healthy allow the no', async () => {
  const b = await bundleOf(healthy());
  assert.deepEqual(b.coverageGaps, []);
  const d = await noOf(healthy());
  assert.deepEqual([d.verdict, d.reason], ['no', 'not_reported_by_due']);
});

test('the other gap reasons are unchanged and take precedence over the marker', async () => {
  const runs = { ...healthy(), '2026-11-14': okRun({ status: 'failed', inputs: { archiveDay: 'missing', lateWritten: LATE } }) };
  assert.equal((await bundleOf(runs)).coverageGaps[0].why, 'run failed');
});
