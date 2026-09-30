'use strict';

// M2 (Batch 4 phase A): per-question gates G7-G12, qid, and the regression that the OLD model
// output shape (no p / no source) is still logged exactly as before, only marked question:false.

const test = require('node:test');
const assert = require('node:assert/strict');
const q = require('../src/questions');
const { buildGatedScenarios } = require('../src/lib');
const pre = require('./fixtures/pre-m2-output.json');
const m2 = require('./fixtures/m2-output.json');

const CTX = { generatedAtDay: '2026-10-01', snippets: [], priorTexts: [] };
const base = { text: 'Ministry X announces a new rule', deadline: '2026-11-15', p: 40, resolutionSource: 'Official Gazette of Japan' };

test('parseP: integers, percent strings, rounding, garbage', () => {
  assert.equal(q.parseP(64), 64);
  assert.equal(q.parseP('64%'), 64);
  assert.equal(q.parseP(64.4), 64);
  assert.equal(q.parseP('abc'), null);
  assert.equal(q.parseP(null), null);
  assert.equal(q.parseP(true), null);
});

test('G7 own probability: missing, 1, 99 are demoted; 2 and 98 are kept', () => {
  for (const p of [undefined, 1, 99, 'x', 0]) {
    const g = q.questionGate({ ...base, p }, CTX);
    assert.equal(g.action, 'demote'); assert.equal(g.gate, 'G7');
  }
  assert.equal(q.questionGate({ ...base, p: 2 }, CTX).action, 'keep');
  assert.equal(q.questionGate({ ...base, p: 98 }, CTX).action, 'keep');
});

test('G8 named source: generic or short is demoted', () => {
  for (const s of ['news', 'Media', 'reports', 'sources', 'the internet', 'AP', '', undefined]) {
    const g = q.questionGate({ ...base, resolutionSource: s }, CTX);
    assert.equal(g.gate, 'G8', String(s));
  }
  assert.equal(q.questionGate(base, CTX).action, 'keep');
});

test('G9 lead time: 6 days dropped, 7 days kept', () => {
  assert.equal(q.questionGate({ ...base, deadline: '2026-10-07' }, CTX).gate, 'G9');
  assert.equal(q.questionGate({ ...base, deadline: '2026-10-07' }, CTX).action, 'drop');
  assert.equal(q.questionGate({ ...base, deadline: '2026-10-08' }, CTX).action, 'keep');
});

test('G10 restating a reported snippet is dropped', () => {
  const g = q.questionGate({ ...base, text: 'Police deploy extra patrols in the capital' }, { ...CTX, snippets: ['Police deploy extra patrols in the capital'] });
  assert.equal(g.action, 'drop'); assert.equal(g.gate, 'G10');
});

test('G11 certain formality only when p >= 95 and scheduled wording', () => {
  assert.equal(q.questionGate({ ...base, p: 97, text: 'The council is scheduled to meet on 3 Nov' }, CTX).gate, 'G11');
  assert.equal(q.questionGate({ ...base, p: 60, text: 'The council is scheduled to meet on 3 Nov' }, CTX).action, 'keep');
  assert.equal(q.questionGate({ ...base, p: 97, text: 'Firm X wins the tender' }, CTX).action, 'keep');
});

test('G12 near-duplicate of a recent question is demoted', () => {
  const g = q.questionGate(base, { ...CTX, priorTexts: ['Ministry X announces a new rule now'] });
  assert.equal(g.gate, 'G12');
});

test('qidFor is deterministic, 20 hex, and depends on every part', () => {
  const a = q.qidFor('PRED#t', '2026-10-01', '0-1');
  assert.equal(a, q.qidFor('PRED#t', '2026-10-01', '0-1'));
  assert.match(a, /^[0-9a-f]{20}$/);
  assert.notEqual(a, q.qidFor('PRED#t', '2026-10-02', '0-1'));
  assert.notEqual(a, q.qidFor('PRED#t', '2026-10-01', '0-2'));
});

test('M2 fixture: real-shaped output is gated as designed', () => {
  const { scenarios, capture } = buildGatedScenarios(m2.raw.scenarios, {
    generatedAtDay: m2.generatedAtDay, fallbackYear: 2026, pk: m2.pk, sk: m2.sk, snippets: m2.snippets, priorTexts: [],
  });
  const all = scenarios.flatMap(s => s.triggers);
  const qs = all.filter(t => t.question === true);
  assert.deepEqual(qs.map(t => t.p), [62, 35, 60]);
  assert.ok(qs.every(t => /^[0-9a-f]{20}$/.test(t.qid) && t.resolutionSource && t.resolver === 'human'));
  const reasons = capture.questions.demoted.map(d => d.reason).sort();
  assert.deepEqual(reasons, ['generic_source', 'near_duplicate', 'no_p', 'no_p']);
  assert.deepEqual(capture.dropped.map(d => d.gate).sort(), ['G10', 'G9']);
  assert.equal(capture.questions.kept, 3);
  assert.equal(new Set(qs.map(t => t.qid)).size, qs.length);
});

test('pre-M2 output shape: every trigger kept as narrative (question:false / no_p), nothing extra dropped', () => {
  for (const row of pre) {
    const legacy = buildGatedScenarios(row.raw.scenarios, { generatedAtDay: row.sk, fallbackYear: 2026 });
    const m = buildGatedScenarios(row.raw.scenarios, { generatedAtDay: row.sk, fallbackYear: 2026, pk: row.pk, sk: row.sk, snippets: ['zzz'], priorTexts: [] });
    assert.equal(m.capture.kept, legacy.capture.kept);
    assert.equal(m.capture.dropped.length, legacy.capture.dropped.length);
    const trigs = m.scenarios.flatMap(s => s.triggers);
    assert.ok(trigs.every(t => t.question === false && t.qid === undefined && t.p === undefined));
    assert.equal(m.capture.questions.kept, 0);
    assert.ok(m.capture.questions.demoted.every(d => d.reason === 'no_p'));
  }
});

test('legacy callers (no pk/sk) get the exact old shape: no question fields at all', () => {
  const { scenarios, capture } = buildGatedScenarios(m2.raw.scenarios, { generatedAtDay: m2.generatedAtDay, fallbackYear: 2026 });
  assert.ok(scenarios.flatMap(s => s.triggers).every(t => !('question' in t) && !('qid' in t)));
  assert.equal(capture.questions, undefined);
});
