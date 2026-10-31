import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { planForecastGaps } from './backfill-forecasts.mjs';

const require = createRequire(import.meta.url);
const world = require('../../shared/src/world');
const { fakeClient } = require('../../shared/test/world.fake');

const row = (topicId, date, extra = {}) => ({
  PK: `PRED#${topicId}`, SK: date, topicId, generatedAt: `${date}T04:00:00.000Z`,
  scenarios: [{ label: 'L', probability: 0.5, triggers: [{ id: '0-0', text: 'X', deadline: '2026-12-01', p: 40, question: true, qid: `q-${topicId}` }, { id: '0-1', text: 'Y', deadline: '2026-12-01' }] }], ...extra,
});
const entryFact = (topicId, threadId, at) => ({ kind: 'entry', eventId: `e-${topicId}-${at}`, threadId, at, payload: { topicId } });

async function snapshots(rows) {
  const c = fakeClient();
  for (const r of rows) c.put('GlobalPerspectivePredictionLog', r);
  return world.scenarios(c, { from: '2026-01-01', to: '2026-10-31' }, {});
}

test('planForecastGaps: a row without a fact becomes one (own threadId, else latest entry fact of the topic); known, unresolved and pre-record rows are not written', async () => {
  const snaps = await snapshots([
    row('Known-1', '2026-10-10', { threadId: 't-known' }),
    row('Own-2', '2026-10-10', { threadId: 't-own' }),
    row('Entry-3', '2026-10-11'),
    row('Nowhere-4', '2026-10-11'),
    row('Old-5', '2026-08-01', { threadId: 't-old' }),
  ]);
  const known = [{ kind: 'forecast_drawn', sourceKey: snaps.find((s) => s.topicId === 'Known-1').sourceKey }];
  const facts = [...known, entryFact('Entry-3', 't-first', '2026-10-01T00:00:00Z'), entryFact('Entry-3', 't-latest', '2026-10-09T00:00:00Z')];
  const plan = planForecastGaps({ snapshots: snaps, facts, firstDay: '2026-09-05', runId: 'r' });
  assert.deepEqual(plan.facts.map((f) => [f.payload.topicId, f.threadId, f.kind]), [['Own-2', 't-own', 'forecast_drawn'], ['Entry-3', 't-latest', 'forecast_drawn']]);
  assert.deepEqual(plan.unresolved.map((u) => u.pk), ['PRED#Nowhere-4']);
  assert.deepEqual([plan.counts.facts, plan.counts.questionBranches, plan.counts.otherBranches], [2, 2, 2]);
  assert.deepEqual(Object.keys(plan.byDay), ['2026-10-10', '2026-10-11']);
  // the 2026-08-01 row is dated before the record's first day: counted, not written
  const all = planForecastGaps({ snapshots: snaps, facts, firstDay: '2026-09-05', runId: 'r' });
  assert.deepEqual([all.counts.beforeRecord, all.facts.length], [1, 2]);
});

test('planForecastGaps: a re-plan after the facts are stored finds nothing, and the eventId equals the facts run\'s', async () => {
  const snaps = await snapshots([row('Own-2', '2026-10-10', { threadId: 't-own' })]);
  const first = planForecastGaps({ snapshots: snaps, facts: [], firstDay: '2026-09-05', runId: 'r1' });
  const again = planForecastGaps({ snapshots: snaps, facts: first.facts, firstDay: '2026-09-05', runId: 'r2' });
  assert.equal(first.facts.length, 1);
  assert.equal(again.facts.length, 0);
  const { forecastFact } = require('../newsStoryRecord/src/facts.js');
  assert.equal(first.facts[0].eventId, forecastFact(snaps[0], 't-own', [], 'other').eventId);
});
