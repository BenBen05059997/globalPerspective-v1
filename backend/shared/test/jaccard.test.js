'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { jaccard } = require('../src/jaccard');

const S = (...x) => new Set(x);

test('intersection over union', () => {
  assert.equal(jaccard(S('a', 'b'), S('a', 'b')), 1);
  assert.equal(jaccard(S('a', 'b'), S('c', 'd')), 0);
  assert.equal(jaccard(S('a', 'b', 'c'), S('b', 'c', 'd')), 0.5);
  assert.equal(jaccard(S('a'), S('a', 'b', 'c', 'd')), 0.25);
});

test('0 when either set is empty, including both', () => {
  assert.equal(jaccard(S(), S('a')), 0);
  assert.equal(jaccard(S('a'), S()), 0);
  assert.equal(jaccard(S(), S()), 0);
});

test('same value as the inline copies (the guarded form it replaced and the `|| 1` form still in newsSelectionShadow) on random sets', () => {
  const guarded = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i); };
  const orOne = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n / (a.size + b.size - n || 1); };
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pool = ['iran', 'oil', 'talks', 'strike', 'port', 'ceasefire', 'vote', 'storm'];
  const pick = () => new Set(pool.filter(() => rnd() < 0.4));
  for (let k = 0; k < 2000; k++) {
    const a = pick(); const b = pick();
    assert.equal(jaccard(a, b), guarded(a, b));
    assert.equal(jaccard(a, b), orOne(a, b));
  }
});
