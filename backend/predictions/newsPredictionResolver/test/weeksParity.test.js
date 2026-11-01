'use strict';
// The settle Lambda WRITES weeks; newsPredictionsSnapshot READ them with its own copy of the ISO-week
// helpers (the proxy's copy went with prediction_snapshot, 2026-11-01). Any drift would silently mislabel a week, so compare 800 days.
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/lib');
const snap = require('../../newsPredictionsSnapshot/src/weeks');

test('weekOf / weekStart / weekEnd / addWeeks agree across the settle Lambda and the aggregator', () => {
  let d = '2025-12-01';
  for (let i = 0; i < 800; i++) {
    const w = lib.weekOf(d);
    assert.equal(snap.weekOf(d), w, d);
    assert.equal(snap.weekStart(w), lib.weekStart(w));
    assert.equal(snap.weekEnd(w), lib.weekEnd(w));
    assert.equal(snap.addWeeks(w, 3), lib.addWeeks(w, 3));
    d = lib.addDays(d, 1);
  }
});
