import { describe, it, expect } from 'vitest';
import { matchLandFeature, centroidForCountry } from '@/features/account/lib/deskMap.js';

describe('deskMap country matching', () => {
  it('finds the land feature for display names and aliases of the same country', () => {
    const us = matchLandFeature('United States');
    expect(us).not.toBeNull();
    expect(matchLandFeature('USA')).toBe(us);
    expect(matchLandFeature('DR Congo')).toBe(matchLandFeature('Democratic Republic of the Congo'));
    expect(matchLandFeature('Ivory Coast')).toBe(matchLandFeature("Cote d'Ivoire"));
    expect(matchLandFeature('Czech Republic')).toBe(matchLandFeature('Czechia'));
    expect(matchLandFeature('Bosnia and Herzegovina')).not.toBeNull();
    expect(matchLandFeature('Dominican Republic')).not.toBeNull();
  });
  it('returns null for text that is not a country', () => {
    expect(matchLandFeature('Strait of Hormuz')).toBeNull();
    expect(matchLandFeature('')).toBeNull();
    expect(centroidForCountry('Atlantis')).toBeNull();
  });
  it('gives finite centroids for countries in the bundle', () => {
    const c = centroidForCountry('France');
    expect(Number.isFinite(c?.[0]) && Number.isFinite(c?.[1])).toBe(true);
  });
  it('keeps the outlines the old name table had, including ones missing from ISO3_TO_NUM', () => {
    for (const n of ['Burundi', 'Estonia', 'Greenland', 'Botswana', 'Kosovo', 'Iceland']) expect(matchLandFeature(n)).not.toBeNull();
  });
});
