// Run: node --test backend/weekly/test/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SECTIONS, LABELS, CONFIDENCE, orderedSections } = require('../sections.js');

test('six sections in print order with the printed titles', () => {
  assert.deepEqual(SECTIONS.map((s) => s.key), ['lead', 'moved', 'trace', 'dates', 'new', 'coverage']);
  assert.deepEqual(SECTIONS.map((s) => s.title),
    ['This week', 'Where our view moved', 'The trace', "Next week's dates", 'New this week', 'What we did not see']);
});

test('lead, moved and coverage are required; every section has an empty text and a word cap', () => {
  assert.deepEqual(SECTIONS.filter((s) => s.required).map((s) => s.key), ['lead', 'moved', 'coverage']);
  for (const s of SECTIONS) {
    assert.ok(s.emptyText.length > 0, s.key);
    assert.ok(Number.isInteger(s.emailWordCap) && s.emailWordCap > 0, s.key);
    assert.ok(s.max === null || (Number.isInteger(s.max) && s.max > 0), s.key);
  }
  assert.equal(SECTIONS.find((s) => s.key === 'moved').emptyText, 'Our view did not move this week.');
});

test('the model is frozen', () => {
  assert.ok(Object.isFrozen(SECTIONS) && Object.isFrozen(SECTIONS[0]) && Object.isFrozen(LABELS) && Object.isFrozen(CONFIDENCE));
  assert.deepEqual([...CONFIDENCE], ['low', 'medium', 'high']);
  assert.deepEqual({ ...LABELS }, { fact: 'FACT', judgment: 'JUDGMENT' });
});

test('orderedSections: full weekly keeps all six, lead and coverage as one-item lists', () => {
  const w = { lead: { headline: 'h' }, moved: [{ a: 1 }], trace: [{ a: 1 }], dates: [{ a: 1 }], new: [{ a: 1 }], coverage: { stories: 1 } };
  const out = orderedSections(w);
  assert.deepEqual(out.map((o) => o.section.key), ['lead', 'moved', 'trace', 'dates', 'new', 'coverage']);
  assert.deepEqual(out[0].items, [w.lead]);
  assert.deepEqual(out[5].items, [w.coverage]);
});

test('orderedSections: empty optional sections are skipped, empty required ones stay with no items', () => {
  const out = orderedSections({ lead: { headline: 'h' }, moved: [], trace: [], dates: [], new: [], coverage: { stories: 1 } });
  assert.deepEqual(out.map((o) => o.section.key), ['lead', 'moved', 'coverage']);
  assert.deepEqual(out[1].items, []);
  assert.deepEqual(orderedSections(null).map((o) => o.section.key), ['lead', 'moved', 'coverage']);
});
