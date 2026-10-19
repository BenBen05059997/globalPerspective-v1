'use strict';
// explainMove: validator + one retry + flag, with the LLM injected (no network) and the AWS SDK stubbed.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
const { buildDriftPrompt, parseDriftResponse } = require('../src/lib');

const orig = Module._load;
Module._load = function (req, ...r) { if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => (k === 'DynamoDBDocumentClient' ? { from: () => ({}) } : class {}) }); return orig.call(this, req, ...r); };
process.env.SUMMARIZE_PREDICT_TABLE = 'T'; process.env.TOPICS_DDB_TABLE = 'T';
const { explainMove } = require('../src/index.js');
Module._load = orig;

const snap = (dateKey, riskScore, dimensions) => ({ dateKey, riskScore, dimensions, riskLevel: 'high', headline: 'h' });
const prior = snap('2026-08-18', 80, { conflict: 80, humanitarian: 90 });
const cur = snap('2026-08-19', 80, { conflict: 80, humanitarian: 70 });      // humanitarian FELL 20
const drift = { prior, current: cur, moved: { axisMoves: [{ axis: 'humanitarian', from: 90, to: 70, delta: -20 }] } };
const events = [{ topicId: 't1', title: 'UAE announces indefinite trade embargo on Iran', date: '2026-08-19' }];

const bad = JSON.stringify({ triggerEventNumber: 1, whyChanged: 'The embargo shifts the humanitarian score down as trade disruption worsens civilian conditions.', noSingleDriver: false, axisEffects: { humanitarian: 'worsens' } });
const good = JSON.stringify({ triggerEventNumber: 0, whyChanged: 'No listed event explains the fall in humanitarian risk.', noSingleDriver: true, axisEffects: { humanitarian: 'unclear' } });

test('a consistent first answer is stored as is (one LLM call)', async () => {
  let calls = 0;
  const note = await explainMove('Iran', drift, events, async () => { calls++; return good; });
  assert.equal(calls, 1); assert.equal(note.directionFlag, undefined); assert.match(note.whyChanged, /No listed event/);
});
test('contradictory first answer -> retried once with the concrete mismatch; a good retry is stored, no flag', async () => {
  const prompts = [];
  const note = await explainMove('Iran', drift, events, async (p) => { prompts.push(p); return prompts.length === 1 ? bad : good; });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /YOUR PREVIOUS ANSWER WAS REJECTED because you said the cited event worsens the humanitarian axis, but its score fell/);
  assert.equal(note.directionFlag, undefined); assert.equal(note.noSingleDriver, true);
});
test('still contradictory after the retry -> numbers-only text + directionFlag, the model prose is never stored', async () => {
  let calls = 0;
  const note = await explainMove('Iran', drift, events, async () => { calls++; return bad; });
  assert.equal(calls, 2);
  assert.equal(note.noSingleDriver, true); assert.equal(note.triggerEvent, null);
  assert.equal(note.whyChanged, 'Humanitarian risk fell 20 points (90 to 70). No listed event explains a move in this direction.');
  assert.doesNotMatch(note.whyChanged, /worsens/);
  assert.deepEqual(note.directionFlag.axes, ['humanitarian']); assert.equal(note.directionFlag.attempts, 2);
});
test('unparseable first answer -> null (nothing stored, as before)', async () => {
  assert.equal(await explainMove('Iran', drift, events, async () => 'not json'), null);
});

test('the prompt states each moved axis direction in words and asks for axisEffects; a correction is appended on retry', () => {
  const p = buildDriftPrompt('Iran', prior, cur, events);
  assert.match(p, /humanitarian: risk FELL 90→70 \(conditions on this axis got BETTER\)/);
  assert.match(p, /axisEffects/);
  assert.match(p, /"axisEffects":\{"humanitarian":"worsens\|improves\|unclear"\}/);
  assert.doesNotMatch(p, /PREVIOUS ANSWER/);
  assert.match(buildDriftPrompt('Iran', prior, cur, events, 'X'), /PREVIOUS ANSWER WAS REJECTED because X/);
});
test('parseDriftResponse keeps only the three allowed axisEffects words for the four axes', () => {
  const r = parseDriftResponse('{"triggerEventNumber":1,"whyChanged":"w","noSingleDriver":false,"axisEffects":{"conflict":"Worsens","humanitarian":"maybe","bogus":"improves"}}', events);
  assert.deepEqual(r.axisEffects, { conflict: 'worsens' });
});
