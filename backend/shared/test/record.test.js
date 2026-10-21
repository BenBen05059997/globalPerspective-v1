'use strict';
const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/record');

test('pairKey orders lexically and throws on equal ids', () => {
  assert.strictEqual(R.pairKey('b', 'a'), 'a__b');
  assert.strictEqual(R.pairKey('a', 'b'), 'a__b');
  assert.throws(() => R.pairKey('x', 'x'));
});

test('normalizeActor trims, collapses whitespace, lowercases', () => {
  assert.strictEqual(R.normalizeActor('  Vladimir \t Putin '), 'vladimir putin');
  assert.strictEqual(R.normalizeActor(undefined), '');
});

test('stringTexture covers every branch', () => {
  assert.strictEqual(R.stringTexture({ owner: 'ours', strength: 'inferred' }), 'dashed');
  assert.strictEqual(R.stringTexture({ owner: 'ours' }), 'dashed');
  for (const s of ['weak', 'medium', 'strong']) assert.strictEqual(R.stringTexture({ owner: 'ours', strength: s }), 'solid');
  assert.strictEqual(R.stringTexture({ owner: 'yours', line: 'x' }), 'dashed-alt');
  assert.strictEqual(R.stringTexture({ owner: 'yours', cutAt: '2026-10-20T00:00:00Z' }), 'cut');
  assert.strictEqual(R.stringTexture({ owner: 'ours', strength: 'strong', cutAt: '2026-10-20T00:00:00Z' }), 'cut');
});

test('pin budget is 12', () => {
  assert.strictEqual(R.PIN_BUDGET, 12);
  const pins = (n) => Array.from({ length: n }, (_, i) => ({ pinId: `p${i}` }));
  assert.strictEqual(R.pinBudgetOk({ pins: pins(12) }), true);
  assert.strictEqual(R.pinBudgetOk({ pins: pins(13) }), false);
  assert.strictEqual(R.pinBudgetOk({}), false);
});

test('normalizeBoard orders strings, collapses duplicate pairs, dedupes pins, does not mutate', () => {
  const board = {
    boardId: 'b1',
    pins: [
      { pinId: 'p1', kind: 'thread', refId: 't1' },
      { pinId: 'p2', kind: 'thread', refId: 't1' },
      { pinId: 'p3', kind: 'country', refId: 'IRN' },
    ],
    strings: [
      { a: 'p3', b: 'p1', owner: 'ours', strength: 'inferred', keptAt: '2026-10-01T00:00:00Z' },
      { a: 'p1', b: 'p3', owner: 'yours', line: 'newer', keptAt: '2026-10-02T00:00:00Z' },
      { a: 'p1', b: 'p9', owner: 'ours' },
    ],
  };
  const frozen = JSON.stringify(board);
  const out = R.normalizeBoard(board);
  assert.strictEqual(JSON.stringify(board), frozen);
  assert.deepStrictEqual(out.pins.map((p) => p.pinId), ['p1', 'p3']);
  assert.strictEqual(out.strings.length, 2);
  const k = out.strings.find((s) => s.b === 'p3');
  assert.strictEqual(k.a, 'p1');
  assert.strictEqual(k.line, 'newer');
  assert.ok(out.strings.every((s) => s.a < s.b));
  assert.notStrictEqual(out.pins[0], board.pins[0]);
});

// Daily series with moves (>= 8 points) on the given day offsets from 2026-10-01.
function series(moveDays, len = 20) {
  let score = 40;
  return Array.from({ length: len }, (_, i) => {
    if (moveDays.includes(i)) score += 10;
    return { date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), score };
  });
}
const A = { kind: 'thread', refId: 'a' };
const B = { kind: 'thread', refId: 'b' };
const ctxOf = (o) => ({
  actorsOf: (p) => (o.actors || {})[p.refId] || [],
  placesOf: (p) => (o.places || {})[p.refId] || [],
  outletsOf: (p) => (o.outlets || {})[p.refId] || [],
  scoresOf: (p) => (o.scores || {})[p.refId] || [],
});

test('cheapGrounds: nothing shared is an honest none', () => {
  const r = R.cheapGrounds(A, B, ctxOf({ actors: { a: ['X'], b: ['Y'] } }));
  assert.strictEqual(r.strength, 'none');
  assert.deepStrictEqual(r.grounds, []);
  assert.strictEqual(r.note, 'No link found. Shared: nothing but the week.');
});

test('cheapGrounds: a shared actor (normalized) is weak; actor + place is medium', () => {
  const weak = R.cheapGrounds(A, B, ctxOf({ actors: { a: ['Vladimir  Putin'], b: ['vladimir putin '] } }));
  assert.strictEqual(weak.strength, 'weak');
  assert.strictEqual(weak.grounds[0].kind, 'actor');
  const med = R.cheapGrounds(A, B, ctxOf({
    actors: { a: ['Putin'], b: ['putin'] }, places: { a: ['UKR', 'RUS'], b: ['UKR'] },
  }));
  assert.strictEqual(med.strength, 'medium');
  assert.deepStrictEqual(med.grounds.map((g) => g.kind), ['actor', 'place']);
});

test('cheapGrounds: shared outlets alone stay weak and carry the artefact note; they never lift a link', () => {
  const r = R.cheapGrounds(A, B, ctxOf({ outlets: { a: ['Reuters'], b: ['Reuters'] } }));
  assert.strictEqual(r.strength, 'weak');
  assert.match(r.note, /coverage artefact possible/);
  assert.strictEqual(r.grounds[0].kind, 'outlet');
  const withActor = R.cheapGrounds(A, B, ctxOf({
    actors: { a: ['x'], b: ['x'] }, outlets: { a: ['Reuters'], b: ['Reuters'] },
  }));
  assert.strictEqual(withActor.strength, 'weak');
});

test('cheapGrounds: one score pairing is shown but does not raise strength', () => {
  const r = R.cheapGrounds(A, B, ctxOf({ scores: { a: series([10]), b: series([11]) } }));
  assert.strictEqual(r.strength, 'none');
  assert.strictEqual(r.grounds[0].kind, 'comovement');
  assert.strictEqual(r.grounds[0].detail.note, 'one pairing is not a pattern');
});

test('cheapGrounds: two pairings within the lag count as co-movement', () => {
  const r = R.cheapGrounds(A, B, ctxOf({ scores: { a: series([8, 15]), b: series([10, 15]) } }));
  assert.strictEqual(r.strength, 'weak');
  const g = r.grounds.find((x) => x.kind === 'comovement');
  assert.deepStrictEqual(g.detail, { lagDays: 2, pairs: 2 });
  const withPlace = R.cheapGrounds(A, B, ctxOf({
    scores: { a: series([8, 15]), b: series([10, 15]) }, places: { a: ['IRN'], b: ['IRN'] },
  }));
  assert.strictEqual(withPlace.strength, 'medium');
});

test('cheapGrounds: moves further apart than the lag do not pair', () => {
  const r = R.cheapGrounds(A, B, ctxOf({ scores: { a: series([3, 6]), b: series([10, 14]) } }));
  assert.strictEqual(r.strength, 'none');
  assert.deepStrictEqual(r.grounds, []);
});

// ---- content IDs for the facts (decision 0036 section 3) ----
test('canonicalUrl: utm/fbclid/gclid stripped, fragment dropped, trailing slash and www removed, query sorted, default port dropped', () => {
  const c = R.canonicalUrl;
  assert.strictEqual(c('https://www.Example.com/A/b/?utm_source=x&b=2&a=1&fbclid=z&gclid=q#frag'), 'https://example.com/A/b?a=1&b=2');
  assert.strictEqual(c('HTTP://EXAMPLE.com:80/path/'), 'http://example.com/path');
  assert.strictEqual(c('https://example.com:443/'), 'https://example.com/');
  assert.strictEqual(c('https://example.com:8443/x'), 'https://example.com:8443/x');
  assert.strictEqual(c('https://example.com'), 'https://example.com/');
  assert.strictEqual(c('https://example.com/?UTM_Medium=a'), 'https://example.com/');
  assert.strictEqual(c('  https://example.com/x?b=2&b=1&a  '), 'https://example.com/x?a&b=1&b=2');
  assert.strictEqual(c('https://m.bbc.co.uk/news/a1'), 'https://m.bbc.co.uk/news/a1', 'only www. is dropped from a url host');
  assert.strictEqual(c('not a url'), null);
  assert.strictEqual(c('ftp://x.com/a'), null);
  assert.strictEqual(c(undefined), null);
});

test('entryIdentity: the smallest canonical url decides, whatever the source order; no url falls back to date + title', () => {
  const a = { url: 'https://www.zeta.com/b/?utm_source=x' };
  const b = { url: 'https://alpha.com/a#top' };
  const one = R.entryIdentity({ sources: [a, b], date: '2026-10-20', title: 'T' });
  const two = R.entryIdentity({ sources: [b, a], date: '2026-10-21', title: 'Other' });
  assert.deepStrictEqual(one, two);
  assert.strictEqual(one.idBasis, 'url');
  assert.strictEqual(one.eventId, R.sha1('entryhttps://alpha.com/a'));
  const t1 = R.entryIdentity({ sources: [{ url: 'junk' }, {}], date: '2026-10-20', title: '  Big   NEWS ' });
  assert.strictEqual(t1.idBasis, 'title');
  assert.strictEqual(t1.eventId, R.sha1('entry2026-10-20big news'));
  assert.notStrictEqual(t1.eventId, R.entryIdentity({ sources: [], date: '2026-10-21', title: 'big news' }).eventId);
});

test('sourceIdOf: the registrable domain, www/m/amp dropped, two-level suffixes keep three labels; actorIdOf; factId', () => {
  const same = ['https://www.bbc.co.uk/x', 'https://m.bbc.co.uk/y', 'amp.bbc.co.uk', 'BBC.CO.UK', 'news.bbc.co.uk'].map(R.sourceIdOf);
  assert.strictEqual(new Set(same).size, 1);
  assert.strictEqual(same[0], R.sha1('bbc.co.uk'));
  assert.strictEqual(R.sourceIdOf('https://www.nytimes.com/a'), R.sha1('nytimes.com'));
  assert.strictEqual(R.sourceIdOf('asia.nikkei.com'), R.sha1('nikkei.com'));
  assert.notStrictEqual(R.sourceIdOf('bbc.co.uk'), R.sourceIdOf('itv.co.uk'));
  assert.strictEqual(R.sourceIdOf(''), null);
  assert.strictEqual(R.actorIdOf('  Vladimir \t PUTIN '), 'name:vladimir putin');
  assert.strictEqual(R.actorIdOf('  '), null);
  assert.strictEqual(R.factId('verdict', 'Q#1|VERDICT'), R.sha1('verdictQ#1|VERDICT'));
});
