'use strict';
// Batch 4 / E: the prompt shows dated entries; only shown entries can be cited; cites carry date + title.
const test = require('node:test');
const assert = require('node:assert');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T'; process.env.XAI_API_KEY = 'x';
const Module = require('node:module');
const orig = Module._load;
Module._load = function (req, ...r) {
  if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => (k === 'DynamoDBDocumentClient' ? { from: () => ({ send: async () => ({}) }) } : class { constructor(i) { this.input = i; } }) });
  return orig.call(this, req, ...r);
};
const { groupByCountry, buildSystemsPrompt, validateGraph } = require('../src/index.js');
Module._load = orig;

const entries = [];
// story A: 25 entries over 25 days in Japan; story B: 6 entries; story C: 4 entries (need >= 2 threads and >= 4 entries)
for (let i = 0; i < 25; i++) entries.push({ topicId: `a${i}`, threadId: 'thA', title: `A headline ${i}`, date: `2026-09-${String(i + 1).padStart(2, '0')}`, regions: ['Japan'], category: 'politics' });
for (let i = 0; i < 6; i++) entries.push({ topicId: `b${i}`, threadId: 'thB', title: `B headline ${i}`, date: `2026-09-${String(10 + i).padStart(2, '0')}`, regions: ['Japan'], category: 'economy' });
const country = groupByCountry(entries, {})[0];

test('the thread list carries dated entries with short codes (10 of 25, oldest to newest), not opaque ids', () => {
  const p = buildSystemsPrompt(country);
  assert.match(p, /dated entries \(10 of 25, spread over the story, oldest to newest; cite ONLY these codes\)/);
  assert.match(p, /E1 \| 2026-09-01 \| A headline 0/);
  assert.match(p, /\| 2026-09-25 \| A headline 24/);
  assert.ok(!/topicIds: \[/.test(p));
  assert.ok(!/ a0 \|/.test(p)); // the long topic ids are not in the prompt at all
  assert.match(p, /entry codes \(like "E12"/);
});

test('the shown set is small; the story keeps its full count; codes map back to real topic ids', () => {
  const a = country.threads.find((t) => t.threadId === 'thA');
  assert.strictEqual(a.entryCount, 25);
  assert.strictEqual(a.shown.length, 10);
  assert.strictEqual(country.aliasToId[a.shown[0].code], a.shown[0].topicId);
  assert.ok(Object.keys(country.aliasToId).length <= 16);
});

const nodes2 = [{ threadId: 'thA', category: 'politics', peakDate: '2026-09-25', actors: [], summary: 's' }, { threadId: 'thB', category: 'economy', peakDate: '2026-09-15', actors: [], summary: 't' }];

test('the model cites codes: they map to topic ids and carry date + title; unknown codes are dropped', () => {
  const a = country.threads.find((t) => t.threadId === 'thA').shown;
  const codes = [a[0].code, 'E999', a[a.length - 1].code];
  const g = validateGraph({ nodes: nodes2, edges: [{ from: 'thA', to: 'thB', lagDays: 3, mechanism: 'm', confidence: 'strong', citedEntries: codes }] }, country);
  assert.strictEqual(g.edges.length, 1);
  assert.deepStrictEqual(g.edges[0].citedEntries, [a[0].topicId, a[a.length - 1].topicId]);
  assert.ok(g.edges[0].cited.every((c) => c.date && c.title && c.topicId));
  assert.strictEqual(g.edges[0].confidence, 'medium'); // strong needs 3 valid cites; only 2 survived
});

test('the first live run failure: a whole "E3 | date | title" line is read as the code E3; a bare shown topic id still works; a topic id that was NOT shown does not', () => {
  const a = country.threads.find((t) => t.threadId === 'thA').shown;
  const shownIds = new Set(a.map((e) => e.topicId));
  const notShown = ['a1', 'a2', 'a3', 'a5'].find((id) => !shownIds.has(id));
  const line = `${a[1].code} | ${a[1].date} | ${a[1].title}`;
  const g = validateGraph({ nodes: nodes2, edges: [{ from: 'thA', to: 'thB', lagDays: 1, mechanism: 'm', confidence: 'weak', citedEntries: [line, a[2].topicId, notShown] }] }, country);
  assert.deepStrictEqual(g.edges[0].citedEntries, [a[1].topicId, a[2].topicId]);
});

test('an edge whose every cite was not shown is deleted', () => {
  const g = validateGraph({ nodes: nodes2, edges: [{ from: 'thA', to: 'thB', lagDays: 1, mechanism: 'm', confidence: 'weak', citedEntries: ['zzz', 'E9999'] }] }, country);
  assert.strictEqual(g.edges.length, 0);
});
