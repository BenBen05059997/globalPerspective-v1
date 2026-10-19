// node --test backend/pipeline/cli/threads.test.mjs — planning half of the thread merge/split CLI (no AWS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { listJoins, planMerge, planSplit } from './threads.mjs';

const { generateThreadId } = createRequire(import.meta.url)('../NewsProjectInvokeAgentLambda/src/threading.js');

const plagueUs = { topicId: 'US Plague-2', title: 'US Monitoring Plague Researcher Death in Russia, Russia Says Situation Under Control', category: 'health', regions: ['United States', 'Russia'], search_keywords: ['plague', 'Russia', 'lab technician', 'death', 'quarantine'], threadId: 'thread-plague', generationId: 'gen-1', archivedAt: '2026-10-10T04:00:00Z' };
const plagueRu = { topicId: 'Russia plague-0', title: 'Russia plague quarantine following lab death raises concerns', category: 'health', regions: ['Russia'], search_keywords: ['Russia', 'plague', 'quarantine', 'lab death'], threadId: 'thread-plague', generationId: 'gen-2', archivedAt: '2026-10-11T04:00:00Z' };
const flyingCar = { topicId: 'Tesla car-4', title: "Elon Musk Unveils Tesla's 'Flying' Car", category: 'technology', regions: ['United States'], search_keywords: ['Elon Musk', 'Tesla', 'flying car'], threadId: 'thread-agent', generationId: 'gen-2', archivedAt: '2026-10-11T04:00:00Z' };
const rogueAgent = { topicId: 'Rogue agent-1', title: 'Rogue Anthropic AI Agent Gave Police Fake Tip in Unsolved Murder Case', category: 'technology', regions: ['United States'], search_keywords: ['Anthropic', 'AI agent', 'fake tip'], threadId: 'thread-agent', generationId: 'gen-1', archivedAt: '2026-10-10T04:00:00Z' };

const days = { '2026-10-10': [plagueUs, rogueAgent], '2026-10-11': [plagueRu, flyingCar] };

test('list-joins shows score, kwScore, both titles and flags joins the current rule would not make', () => {
  const rows = listJoins(days, '2026-10-11');
  assert.equal(rows.length, 2);
  const plague = rows.find((r) => r.topicId === 'Russia plague-0');
  assert.equal(plague.joinedTitle, plagueUs.title);
  assert.ok(plague.score >= 0.4 && plague.kwScore >= 0.15);
  assert.equal(plague.ruleNow, 'score');
  assert.equal(plague.ruleAgrees, true);
  const car = rows.find((r) => r.topicId === 'Tesla car-4');
  assert.equal(car.joinedTitle, rogueAgent.title);
  assert.equal(car.kwScore, 0);
  assert.equal(car.ruleNow, 'new');
  assert.equal(car.ruleAgrees, false);
});

test('list-joins skips founding rows unless --all', () => {
  assert.equal(listJoins(days, '2026-10-10').length, 2);
  assert.equal(listJoins(days, '2026-10-10', { all: true }).length, 4);
});

const snapshot = () => ({
  cache: [
    { id: 'archive#2026-10-10', list: 'entries', items: [plagueUs, rogueAgent] },
    { id: 'archive#2026-10-11', list: 'entries', items: [plagueRu, flyingCar] },
    { id: 'latest', list: 'topics', items: [{ id: 'Tesla car-4', title: flyingCar.title, threadId: 'thread-agent' }] },
  ],
  topicRows: [{ PK: 'TOPIC#Tesla car-4', SK: 'SUMMARY', threadId: 'thread-agent' }, { PK: 'TOPIC#Russia plague-0', SK: 'SUMMARY', threadId: 'thread-plague' }],
  predRows: [{ PK: 'PRED#Tesla car-4', SK: '2026-10-11', threadId: 'thread-agent' }],
  pointers: { 'thread-agent': { topicIds: ['Rogue agent-1', 'Tesla car-4'] } },
  storyMap: { pairs: { 'tech#USA#tesla': { threadId: 'thread-agent', topic_id: 'Tesla car-4' }, 'health#RUS#plague': { threadId: 'thread-plague', topic_id: 'Russia plague-0' } } },
  situations: [{ key: 'news_tech_USA_tesla.json', state: { situationId: 'news#tech#USA#tesla', threadId: 'thread-agent' } }],
});

test('merge retags every record of the from-thread, conditionally, and leaves an alias pointer', () => {
  const changes = planMerge(snapshot(), 'thread-agent', 'thread-x');
  const ddb = changes.filter((c) => c.op.kind === 'ddb-update');
  const cacheEdits = ddb.filter((c) => c.op.table === 'NewsCache');
  assert.deepEqual(cacheEdits.map((c) => c.op.update), ['SET entries[1].threadId = :to', 'SET entries[1].threadId = :to', 'SET topics[0].threadId = :to']);
  assert.ok(cacheEdits.every((c) => c.op.cond && c.op.values[':from'].S === 'thread-agent' && c.op.values[':to'].S === 'thread-x'));
  assert.equal(ddb.filter((c) => c.op.table === 'SummarizeAndPredict' && c.op.key.PK?.S.startsWith('TOPIC#')).length, 1);
  assert.equal(ddb.filter((c) => c.op.table === 'GlobalPerspectivePredictionLog').length, 1);
  const into = ddb.find((c) => c.op.key.PK?.S === 'THREAD#thread-x');
  assert.deepEqual(into.op.values[':ids'].SS, ['Rogue agent-1', 'Tesla car-4']);
  const alias = ddb.find((c) => c.op.key.PK?.S === 'THREAD#thread-agent');
  assert.equal(alias.op.values[':into'].S, 'thread-x');
  const s3 = changes.filter((c) => c.op.kind === 's3-put');
  const map = s3.find((c) => c.op.key === 'threads/story-map.json').op.body;
  assert.equal(map.pairs['tech#USA#tesla'].threadId, 'thread-x');
  assert.equal(map.pairs['health#RUS#plague'].threadId, 'thread-plague');
  assert.equal(s3.find((c) => c.op.key.startsWith('situations/state/')).op.body.threadId, 'thread-x');
  // nothing on the plague thread is touched
  assert.ok(!changes.some((c) => c.desc.includes('thread-plague ->')));
});

test('merge refuses the same id twice', () => {
  assert.throws(() => planMerge(snapshot(), 'thread-agent', 'thread-agent'));
});

test('split moves only the named topics to a new thread named from their founding title', () => {
  const { newId, changes } = planSplit(snapshot(), 'thread-agent', ['Tesla car-4']);
  assert.equal(newId, generateThreadId(flyingCar));
  const retagged = changes.filter((c) => c.op.values?.[':to']?.S === newId);
  assert.equal(retagged.filter((c) => c.op.table === 'NewsCache').length, 2); // archive + latest
  assert.equal(retagged.filter((c) => c.op.table === 'SummarizeAndPredict').length, 1);
  assert.equal(retagged.filter((c) => c.op.table === 'GlobalPerspectivePredictionLog').length, 1);
  assert.ok(!changes.some((c) => c.desc.includes('Rogue Anthropic')));
  const del = changes.find((c) => c.op.update === 'DELETE topicIds :ids');
  assert.equal(del.op.key.PK.S, 'THREAD#thread-agent');
  const ptr = changes.find((c) => c.op.key?.PK?.S === `THREAD#${newId}`);
  assert.equal(ptr.op.values[':t'].S, 'Tesla car-4');
  const map = changes.find((c) => c.op.kind === 's3-put').op.body;
  assert.equal(map.pairs['tech#USA#tesla'].threadId, newId);
});

test('split refuses to move the founding title out of its own thread, or topics not on it', () => {
  const snap = snapshot();
  snap.cache[0].items = [plagueUs, { ...rogueAgent, threadId: generateThreadId(rogueAgent) }];
  assert.throws(() => planSplit(snap, generateThreadId(rogueAgent), ['Rogue agent-1']), /founding title/);
  assert.throws(() => planSplit(snapshot(), 'thread-agent', ['nope']), /none of the topic ids/);
});
