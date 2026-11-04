import { describe, it, expect } from 'vitest';
import { applyListView } from '@/features/countries/lib/countryListView.js';
import { isArc } from '@/features/countries/lib/countryArcs.js';
import { briefingAge } from '@/features/countries/lib/briefingAge.js';

const list = [
  { name: 'Japan', articles: 5, region: 'Asia' },
  { name: 'Chad', articles: 9, region: 'Africa' },
  { name: 'Brazil', articles: 2, region: 'Americas' },
];
const names = (v, intelOf) => applyListView(list, v, intelOf).map((c) => c.name);

describe('applyListView', () => {
  it('filters by region, searches by name or headline, sorts', () => {
    expect(names({ region: 'Africa', query: '', sortBy: 'risk' })).toEqual(['Chad']);
    expect(names({ region: null, query: 'bra', sortBy: 'risk' })).toEqual(['Brazil']);
    expect(names({ region: null, query: 'quake', sortBy: 'risk' }, (n) => (n === 'Japan' ? { headline: 'Quake' } : undefined))).toEqual(['Japan']);
    expect(names({ region: null, query: '', sortBy: 'alpha' })).toEqual(['Brazil', 'Chad', 'Japan']);
    expect(names({ region: null, query: '', sortBy: 'articles' })).toEqual(['Chad', 'Japan', 'Brazil']);
  });
});

describe('arc and briefing age rules', () => {
  it('an arc needs two entries', () => { expect(isArc(1)).toBe(false); expect(isArc(2)).toBe(true); });
  it('briefings older than 30 days are hidden, 14-30 older', () => {
    const at = (d) => ({ generatedAt: new Date(Date.now() - d * 86400000).toISOString() });
    expect(briefingAge(at(2))).toBe('plain');
    expect(briefingAge(at(20))).toBe('older');
    expect(briefingAge(at(60))).toBe('hidden');
  });
});
