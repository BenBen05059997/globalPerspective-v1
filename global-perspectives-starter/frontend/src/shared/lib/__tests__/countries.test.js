import { describe, it, expect } from 'vitest';
import { COUNTRIES, resolveCountry, isCountry, parentCountry } from '@/shared/lib/countries.js';
import { iso3Name, iso3ForName, ISO3_NAME } from '@/shared/lib/situationLabels.js';
import { isRealCountryName } from '@/shared/lib/placeNames.js';
import { regionToCountryCode, getTopicRegion, getBroadRegionsForCountry } from '@/shared/lib/countryMapping';

describe('country resolver (one table, short display names)', () => {
  it('long forms, aliases and ISO3 codes resolve to the display name', () => {
    expect(resolveCountry('United Arab Emirates')).toEqual({ iso3: 'ARE', name: 'UAE' });
    expect(resolveCountry('Democratic Republic of the Congo')).toEqual({ iso3: 'COD', name: 'DR Congo' });
    expect(resolveCountry('Democratic Republic of Congo')).toEqual({ iso3: 'COD', name: 'DR Congo' });
    expect(resolveCountry('u.s.')).toEqual({ iso3: 'USA', name: 'United States' });
    expect(resolveCountry('VAT')).toEqual({ iso3: 'VAT', name: 'Vatican City' });
    expect(resolveCountry('Cote d’Ivoire')).toEqual({ iso3: 'CIV', name: "Côte d'Ivoire" });
  });
  it('GUM, HKG and VAT now have names (the map showed raw codes)', () => {
    expect(iso3Name('GUM')).toBe('Guam');
    expect(iso3Name('HKG')).toBe('Hong Kong');
    expect(iso3Name('VAT')).toBe('Vatican City');
    expect(iso3Name('ZZZ')).toBe('ZZZ');
  });
  it('non-countries are null; sub-national places belong to their country', () => {
    for (const n of ['Strait of Hormuz', 'Europe', 'NATO', 'Global', 'Various', 'West Bank']) expect(isCountry(n)).toBe(false);
    expect(parentCountry('West Bank')).toEqual({ iso3: 'PSE', name: 'Palestine' });
    expect(parentCountry('Scotland')).toEqual({ iso3: 'GBR', name: 'United Kingdom' });
    expect(parentCountry('Strait of Hormuz')).toBeNull();
  });
  it('iso3ForName is alias-aware (the risk layer missed "United Arab Emirates")', () => {
    expect(iso3ForName('United Arab Emirates')).toBe('ARE');
    expect(iso3ForName('Democratic Republic of the Congo')).toBe('COD');
    expect(iso3ForName('Strait of Hormuz')).toBeNull();
    expect(iso3ForName('')).toBeNull();
  });
  it('ISO3_NAME is derived from the table', () => {
    expect(Object.keys(ISO3_NAME)).toEqual(Object.keys(COUNTRIES));
    expect(ISO3_NAME.ARE).toBe('UAE');
  });
  it('isRealCountryName is the resolver', () => {
    expect(isRealCountryName('Gambia')).toBe(true);
    expect(isRealCountryName('Gaza')).toBe(false);
  });
  it('region grouping reads ISO-2 from the same table', () => {
    expect(regionToCountryCode('Scotland')).toBe('GB');
    expect(regionToCountryCode('United Arab Emirates')).toBe('AE');
    expect(regionToCountryCode('European Union')).toBe('EU');
    expect(regionToCountryCode('Global')).toBeNull();
    expect(getTopicRegion({ regions: ['European Union'] })).toBe('Europe');
    expect(getBroadRegionsForCountry('United Arab Emirates')).toContain('Middle East');
    expect(getBroadRegionsForCountry('Czechia')).toContain('EU');
  });
});
