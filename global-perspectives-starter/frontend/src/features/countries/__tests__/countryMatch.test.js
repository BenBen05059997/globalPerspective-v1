import { describe, it, expect } from 'vitest';
import { countryMatcher } from '@/features/countries/lib/countryMatch.js';

describe('countryMatcher', () => {
  it('matches every name of the country and places inside it', () => {
    const us = countryMatcher('United States');
    expect(us(['USA'])).toBe(true);
    expect(us(['US', 'Iran'])).toBe(true);
    expect(us(['Iran'])).toBe(false);
    expect(countryMatcher('Palestine')(['West Bank'])).toBe(true);
    expect(countryMatcher('UAE')(['United Arab Emirates'])).toBe(true);
  });

  it('a name that is not a country matches only its own text', () => {
    const hormuz = countryMatcher('Strait of Hormuz');
    expect(hormuz(['Strait of Hormuz'])).toBe(true);
    expect(hormuz(['Iran'])).toBe(false);
  });
});
