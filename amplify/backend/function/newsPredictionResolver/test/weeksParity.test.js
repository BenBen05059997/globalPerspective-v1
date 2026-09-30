'use strict';
// The settle Lambda WRITES weeks; newsPredictionsSnapshot and the proxy READ them with their own
// copies of the ISO-week helpers. Any drift would silently mislabel a week, so compare 800 days.
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/lib');
const snap = require('../../newsPredictionsSnapshot/src/weeks');
const proxy = require('../../newsSensitiveData/src/lib');

test('weekOf / weekStart / weekEnd / addWeeks agree across the settle Lambda, the aggregator and the proxy', () => {
  let d = '2025-12-01';
  for (let i = 0; i < 800; i++) {
    const w = lib.weekOf(d);
    assert.equal(snap.weekOf(d), w, d);
    assert.equal(proxy.isoWeekOfDay(d), w, d);
    assert.equal(snap.weekStart(w), lib.weekStart(w));
    assert.equal(snap.weekEnd(w), lib.weekEnd(w));
    assert.equal(snap.addWeeks(w, 3), lib.addWeeks(w, 3));
    d = lib.addDays(d, 1);
  }
});
