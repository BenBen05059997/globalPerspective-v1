'use strict';
// A day with stories written after their slot is shown as `late` on the agent row, never as plain ok (decision 0061); the coverage part of the
// quality check follows the resolver's rule.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHealth, agentRow } = require('../src/health');
const Q = require('../src/quality');

const NOW = Date.parse('2026-11-18T12:00:00Z');
const MARK = { writtenAt: '2026-11-17T01:30:00.000Z', slot: '2026-11-15T12:15:00.000Z' };
const line = (late) => JSON.stringify(late ? { topicId: 't', writtenLate: MARK } : { topicId: 't' });
const file = (live, late) => [...Array.from({ length: live }, () => line(false)), ...Array.from({ length: late }, () => line(true))].join('\n') + '\n';
const ports = (files) => ({
  readText: async (key) => (files[key] == null ? null : { text: files[key], at: '2026-11-17T01:31:00.000Z' }),
  resolverStatus: async () => ({ sampled: 1, due: 0, drafted: 0, verdicts: 0, commits: [] }),
  lambdaErrors: async () => ({}),
  compareCounts: async () => ({}),
});
const cell = (health, day, stage) => health.days.find((d) => d.date === day).rows.find((r) => r.stage === stage);

test('the agent row is late when a day holds late stories and enough entries; the count is a fact; the live day beside it stays ok', async () => {
  const { health } = await buildHealth(ports({
    'record/inbox/entries/2026-11-14.jsonl': file(25, 13),
    'record/inbox/entries/2026-11-15.jsonl': file(0, 39),
    'record/inbox/entries/2026-11-13.jsonl': file(47, 0),
  }), NOW);
  for (const [day, late, n] of [['2026-11-14', 13, 38], ['2026-11-15', 39, 39]]) {
    const c = cell(health, day, 'agent');
    assert.equal(c.status, 'late', day);
    assert.deepEqual([c.facts.entries, c.facts.lateEntries], [n, late], day);
    assert.match(c.note, /written after their slot/);
  }
  assert.equal(cell(health, '2026-11-13', 'agent').status, 'ok');
  assert.equal('lateEntries' in cell(health, '2026-11-13', 'agent').facts, false);
});

test('a day with late lines but too few entries is still thin, with the late count in its facts', () => {
  const r = agentRow('2026-11-15', true, { lines: 6, late: 6, at: null });
  assert.equal(r.status, 'thin');
  assert.equal(r.facts.lateEntries, 6);
});

test('an unmarked day: ok at 20 entries or more, exactly as before', () => {
  const r = agentRow('2026-11-13', true, { lines: 47, late: 0, at: null });
  assert.equal(r.status, 'ok');
  assert.equal('lateEntries' in r.facts, false);
});

test('the quality check counts a Run with lateWritten as a coverage gap, as the resolver does', async () => {
  const run = (inputs) => JSON.stringify({ date: 'd', status: 'ok', inputs: { archiveDay: 'present', ...inputs }, failures: [] });
  const files = Object.fromEntries(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'].map((d) => [`record/runs/${d}.json`, run({})]));
  files['record/runs/2026-11-14.json'] = run({ lateWritten: { entries: 13, slots: [MARK.slot] } });
  const r = await Q.coveragePart({ readText: async (k) => (files[k] == null ? null : { text: files[k] }) }, '2026-11-17', NOW);
  assert.ok(r.gaps.some((g) => g.day === '2026-11-14' && g.why === 'stories written late'), JSON.stringify(r.gaps));
  assert.equal(r.gaps.some((g) => g.day === '2026-11-13'), false);
});
