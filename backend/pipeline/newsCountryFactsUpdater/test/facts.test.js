'use strict';
const test = require('node:test');
const assert = require('node:assert');
const f = require('../src/facts');

const b = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
const WD = 'http://www.wikidata.org/entity/';

test('parseCapitals: current capitals only, de-duplicated, unlabeled QIDs dropped', () => {
  const m = f.parseCapitals([
    b({ c: WD + 'Q258', capLabel: 'Pretoria' }), b({ c: WD + 'Q258', capLabel: 'Cape Town' }), b({ c: WD + 'Q258', capLabel: 'Pretoria' }),
    b({ c: WD + 'Q258', capLabel: 'Old Capital', end: '1994-01-01T00:00:00Z' }),
    b({ c: WD + 'Q17', capLabel: 'Q1490' }), b({ c: WD + 'Q17', capLabel: 'Tokyo' }),
  ]);
  assert.deepStrictEqual(m.get('Q258').names, ['Pretoria', 'Cape Town']);
  assert.deepStrictEqual(m.get('Q17').names, ['Tokyo']);
});

test('parsePopulations: latest DATED value wins; undated and junk are ignored', () => {
  const m = f.parsePopulations([
    b({ c: WD + 'Q183', pop: '83000000', time: '2019-12-31T00:00:00Z' }),
    b({ c: WD + 'Q183', pop: '84500000', time: '2023-12-31T00:00:00Z' }),
    b({ c: WD + 'Q183', pop: '99999999' }),                       // undated: never used
    b({ c: WD + 'Q17', pop: 'NaN', time: '2023-01-01T00:00:00Z' }),
    b({ c: WD + 'Q17', pop: '-5', time: '2023-01-01T00:00:00Z' }),
  ]);
  assert.strictEqual(m.get('Q183').value, 84500000);
  assert.strictEqual(m.get('Q183').year, 2023);
  assert.strictEqual(m.has('Q17'), false);
});

test('buildCapPop: fresh values carry source + checkedAt; a failed sub-query keeps the previous value and its OLD date', () => {
  const capitals = new Map([['Q183', { names: ['Berlin'] }]]);
  const populations = new Map();
  const existing = { population: { value: 80000000, year: 2020, time: '2020-12-31', source: 'wikidata', checkedAt: '2026-09-21T20:00:00Z' } };
  const out = f.buildCapPop({ qid: 'Q183', capitals, populations, existing, nowIso: '2026-09-28T20:00:00Z' });
  assert.deepStrictEqual(out.capital, { names: ['Berlin'], source: 'wikidata', checkedAt: '2026-09-28T20:00:00Z' });
  assert.strictEqual(out.population.checkedAt, '2026-09-21T20:00:00Z');
  assert.deepStrictEqual(f.buildCapPop({ qid: 'Q1', capitals, populations, existing: null, nowIso: 'x' }), {});
});

test('QID lookup + queries are batched (one query for many countries)', () => {
  const m = f.parseQidByIso3([b({ c: WD + 'Q183', iso: 'DEU' }), b({ c: WD + 'Q17', iso: 'JPN' }), b({ c: 'x', iso: 'bad' })]);
  assert.strictEqual(m.get('DEU'), 'Q183'); assert.strictEqual(m.size, 2);
  assert.match(f.CAPITALS_QUERY(['Q1', 'Q2']), /wd:Q1 wd:Q2/);
  assert.match(f.POPULATIONS_QUERY(['Q1']), /pq:P585/);
  assert.match(f.QID_BY_ISO3_QUERY(['DEU', 'JPN']), /"DEU" "JPN"/);
});
