import { describe, it, expect } from 'vitest';
import { factRows, compactPopulation, FACTS_MAX_AGE_DAYS } from '@/features/countries/lib/countryFacts.js';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const chk = '2026-09-28T20:03:23.148Z';
const full = {
  leadership: { headOfState: { name: 'Xi Jinping', since: '2013-03-14' }, headOfGovernment: { name: 'Li Qiang', since: '2023-03-11' }, source: 'wikidata', checkedAt: chk },
  capital: { names: ['Beijing'], source: 'wikidata', checkedAt: chk },
  population: { value: 1404890000, year: 2025, source: 'wikidata', checkedAt: chk },
};

describe('factRows (Batch 3 / D)', () => {
  it('shows leader(s), capital and population, each with source + checked date', () => {
    const rows = factRows(full, NOW);
    expect(rows.map((r) => r.key)).toEqual(['hos', 'hog', 'capital', 'population']);
    for (const r of rows) { expect(r.source).toBe('Wikidata'); expect(r.checkedAt).toBe(chk); }
    expect(rows[0]).toMatchObject({ label: 'Head of state', value: 'Xi Jinping', since: '2013-03-14' });
    expect(rows[3]).toMatchObject({ value: '1.40B', dataYear: 2025 });
  });
  it('one row when head of state and government are the same person', () => {
    const rows = factRows({ leadership: { headOfState: { name: 'Donald Trump', since: '2025-01-20' }, headOfGovernment: { name: 'Donald Trump', since: '2025-01-20' }, source: 'wikidata', checkedAt: chk } }, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Head of state & government');
  });
  it('hides anything not checked within the freshness window (the weekly job is not running)', () => {
    const old = new Date(NOW - (FACTS_MAX_AGE_DAYS + 1) * 86400000).toISOString();
    expect(factRows({ ...full, leadership: { ...full.leadership, checkedAt: old }, capital: { ...full.capital, checkedAt: old }, population: { ...full.population, checkedAt: old } }, NOW)).toEqual([]);
  });
  it('never shows an undated or unsourced value', () => {
    expect(factRows({ capital: { names: ['X'], source: 'wikidata' } }, NOW)).toEqual([]);
    expect(factRows({ capital: { names: ['X'], checkedAt: chk } }, NOW)).toEqual([]);
    expect(factRows({ population: { value: 5e6, source: 'wikidata', checkedAt: chk } }, NOW)).toEqual([]); // no data year
    expect(factRows({ leadership: { headOfState: { name: 'A' }, checkedAt: chk } }, NOW)).toEqual([]);   // no source
  });
  it('hides a population whose data year is too old', () => {
    expect(factRows({ population: { value: 28250420, year: 2017, source: 'wikidata', checkedAt: chk } }, NOW)).toEqual([]);
    expect(factRows({ population: { value: 33000000, year: 2018, source: 'wikidata', checkedAt: chk } }, NOW)).toHaveLength(1);
  });
  it('a future checkedAt (clock skew / bad data) is not trusted; junk input is empty', () => {
    expect(factRows({ capital: { names: ['X'], source: 'wikidata', checkedAt: '2030-01-01T00:00:00Z' } }, NOW)).toEqual([]);
    expect(factRows(null, NOW)).toEqual([]);
    expect(factRows({}, NOW)).toEqual([]);
  });
  it('compactPopulation', () => {
    expect(compactPopulation(84900000)).toBe('84.9M');
    expect(compactPopulation(1404890000)).toBe('1.40B');
    expect(compactPopulation(5261372)).toBe('5.3M');
    expect(compactPopulation(0)).toBeNull();
    expect(compactPopulation('x')).toBeNull();
  });
});
