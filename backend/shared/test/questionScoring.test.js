'use strict';
// questionScoring.js: the Brier score, skill against a constant base-rate guess, the cluster bootstrap interval and the reliability bins
// of the sampled questions. Pure; the bootstrap seed derives from n, so the published number does not jitter.
const test = require('node:test');
const assert = require('node:assert/strict');
const { brier, reliability, computeScoring } = require('../src/questionScoring');

// n items over `clusters` stories; p cycles through `ps`, y follows `yOf(i)`
const make = (n, { clusters = 30, ps = [20, 40, 60, 80], yOf = (i) => (i % 2 === 0 ? 1 : 0) } = {}) =>
  Array.from({ length: n }, (_, i) => ({ p: ps[i % ps.length], y: yOf(i), cluster: `story-${i % clusters}` }));

test('brier is the mean squared gap between p/100 and the outcome; no items gives null', () => {
  assert.equal(brier([]), null);
  assert.equal(brier([{ p: 100, y: 1 }]), 0);
  assert.equal(brier([{ p: 0, y: 1 }]), 1);
  assert.equal(brier([{ p: 50, y: 1 }, { p: 50, y: 0 }]), 0.25);
  assert.ok(Math.abs(brier([{ p: 80, y: 1 }, { p: 30, y: 0 }]) - (0.04 + 0.09) / 2) < 1e-12);
});

test('computeScoring returns null below the Stage 2 threshold (150 resolved) and a block at it', () => {
  assert.equal(computeScoring([]), null);
  assert.equal(computeScoring(make(149)), null);
  assert.equal(computeScoring(make(149), { voidCount: 40 }), null); // voids do not count towards n
  const s = computeScoring(make(150));
  assert.notEqual(s, null);
  assert.equal(s.n, 150);
});

test('computeScoring: brier, base rate, reference and skill on a known set', () => {
  // 150 items: 75 yes at p=60, 75 no at p=40 -> every miss is 0.4, brier 0.16; base rate .5, ref .25, skill 1 - .16/.25 = .36
  const items = Array.from({ length: 150 }, (_, i) => (i < 75 ? { p: 60, y: 1, cluster: `c${i % 15}` } : { p: 40, y: 0, cluster: `c${i % 15}` }));
  const s = computeScoring(items);
  assert.equal(s.brier, 0.16);
  assert.equal(s.baseRate, 0.5);
  assert.equal(s.brierRef, 0.25);
  assert.equal(s.skill, 0.36);
});

test('computeScoring: a forecast no better than the base rate scores skill 0, a worse one scores below 0, a perfect one 1', () => {
  // 40% yes, always said 40%: brier = .4*.36 + .6*.16 = .24 = ref
  const same = Array.from({ length: 150 }, (_, i) => ({ p: 40, y: i < 60 ? 1 : 0, cluster: `c${i % 10}` }));
  assert.equal(computeScoring(same).skill, 0);
  const worse = Array.from({ length: 150 }, (_, i) => ({ p: i < 60 ? 10 : 90, y: i < 60 ? 1 : 0, cluster: `c${i % 10}` }));
  assert.ok(computeScoring(worse).skill < 0);
  const perfect = Array.from({ length: 150 }, (_, i) => ({ p: i < 60 ? 100 : 0, y: i < 60 ? 1 : 0, cluster: `c${i % 10}` }));
  const s = computeScoring(perfect);
  assert.equal(s.brier, 0);
  assert.equal(s.skill, 1);
});

test('computeScoring: all-yes or all-no has no reference variance, so skill is null (not NaN or Infinity) and the interval is dropped', () => {
  for (const y of [1, 0]) {
    const s = computeScoring(make(150, { yOf: () => y }));
    assert.equal(s.baseRate, y);
    assert.equal(s.brierRef, 0);
    assert.equal(s.skill, null);
    assert.equal(s.ci, null); // fewer than half the resamples have a skill
    assert.ok(Number.isFinite(s.brier));
  }
});

test('computeScoring: voidRate is voids / (resolved + voids), rounded to 3 places; 0 with none', () => {
  const items = make(150);
  assert.equal(computeScoring(items).voidRate, 0);
  assert.equal(computeScoring(items, { voidCount: 50 }).voidRate, 0.25);
  assert.equal(computeScoring(items, { voidCount: 1 }).voidRate, 0.007); // 1/151 = .00662
});

test('computeScoring: the bootstrap interval is deterministic for the same input, brackets the point skill, and is described', () => {
  const items = make(200, { clusters: 40, ps: [15, 35, 65, 85], yOf: (i) => (((i * 7) % 10) < 5 ? 1 : 0) });
  const a = computeScoring(items);
  const b = computeScoring(items.map((r) => ({ ...r })));
  assert.deepEqual(a.ci, b.ci); // same n -> same seed -> same interval, however many times the cron runs
  assert.equal(a.ci.method, 'cluster bootstrap by story');
  assert.equal(a.ci.resamples, 2000);
  assert.equal(a.ci.seed, 'n*2654435761');
  assert.ok(a.ci.lo <= a.ci.hi);
  assert.ok(a.ci.lo <= a.skill + 0.05 && a.skill - 0.05 <= a.ci.hi, `skill ${a.skill} vs ${JSON.stringify(a.ci)}`);
});

test('computeScoring: the point numbers do not depend on item order; the interval (drawn by cluster order) stays a valid interval', () => {
  const items = make(180, { clusters: 36 });
  const fwd = computeScoring(items);
  const rev = computeScoring([...items].reverse());
  assert.equal(rev.skill, fwd.skill);
  assert.equal(rev.brier, fwd.brier);
  assert.ok(rev.ci.lo <= rev.ci.hi);
  assert.ok(Math.abs(rev.ci.lo - fwd.ci.lo) < 0.15 && Math.abs(rev.ci.hi - fwd.ci.hi) < 0.15); // same data, same seed: close, not necessarily identical
});

test('computeScoring: more independent stories give a narrower interval than few big stories for the same data', () => {
  const many = computeScoring(make(300, { clusters: 150 }));
  const few = computeScoring(make(300, { clusters: 6 }));
  assert.ok(many.ci.hi - many.ci.lo < few.ci.hi - few.ci.lo, `${JSON.stringify(many.ci)} vs ${JSON.stringify(few.ci)}`);
});

test('computeScoring: a single story gives a degenerate interval (every resample is the same draw)', () => {
  const s = computeScoring(make(150, { clusters: 1 }));
  assert.equal(s.ci.lo, s.ci.hi);
  assert.equal(s.ci.lo, s.skill);
});

test('computeScoring: numbers are rounded to 3 places', () => {
  const s = computeScoring(make(151, { ps: [13, 37, 71] }));
  for (const k of ['brier', 'baseRate', 'brierRef', 'skill', 'voidRate']) assert.equal(s[k], Math.round(s[k] * 1000) / 1000, k);
});

test('reliability bins p in 10-point steps, returns only bins with at least 20 items, and p=100 lands in the top bin', () => {
  const items = [
    ...Array.from({ length: 20 }, (_, i) => ({ p: 25, y: i < 5 ? 1 : 0 })), // 20-30%: n 20 -> shown
    ...Array.from({ length: 19 }, () => ({ p: 75, y: 1 })), // 70-80%: n 19 -> hidden
    ...Array.from({ length: 10 }, () => ({ p: 100, y: 1 })), ...Array.from({ length: 10 }, () => ({ p: 95, y: 1 })), // 90-100%: n 20
  ];
  const rows = reliability(items);
  assert.deepEqual(rows.map((r) => r.bin), ['20-30%', '90-100%']);
  assert.deepEqual(rows[0], { bin: '20-30%', n: 20, meanP: 0.25, rate: 0.25 });
  assert.deepEqual(rows[1], { bin: '90-100%', n: 20, meanP: 0.975, rate: 1 });
});

test('reliability: minN is a parameter, edges 10/20 belong to the upper bin, and an empty set gives no bins', () => {
  assert.deepEqual(reliability([]), []);
  const rows = reliability([{ p: 10, y: 0 }, { p: 19, y: 1 }, { p: 20, y: 1 }], 1);
  assert.deepEqual(rows.map((r) => [r.bin, r.n]), [['10-20%', 2], ['20-30%', 1]]);
  assert.deepEqual(reliability([{ p: 0, y: 0 }], 2), []);
});

test('computeScoring carries the reliability bins of its items', () => {
  const s = computeScoring(make(160, { ps: [25], yOf: (i) => (i % 4 === 0 ? 1 : 0) }));
  assert.deepEqual(s.reliability, [{ bin: '20-30%', n: 160, meanP: 0.25, rate: 0.25 }]);
  assert.deepEqual(computeScoring(make(200, { ps: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95] })).reliability.length, 10);
});
