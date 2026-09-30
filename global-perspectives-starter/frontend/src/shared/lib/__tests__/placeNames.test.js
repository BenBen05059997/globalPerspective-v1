import { describe, it, expect } from 'vitest';
import { isRealCountryName } from '@/shared/lib/placeNames.js';

describe('isRealCountryName (Batch 3 / F)', () => {
  it('aggregates and regions are not countries', () => {
    for (const n of ['Europe', 'Asia', 'Middle East', 'Americas', 'Africa', 'Global', 'European Union', 'NATO', '']) expect(isRealCountryName(n)).toBe(false);
  });
  it('countries, territories and archive variants are', () => {
    for (const n of ['Iran', 'Taiwan', 'Palestine', 'Kosovo', 'Hong Kong', 'USA', 'United States', 'UK', 'DR Congo', 'Democratic Republic of the Congo']) expect(isRealCountryName(n)).toBe(true);
  });
});
