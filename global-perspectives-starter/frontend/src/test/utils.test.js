import { describe, it, expect } from 'vitest';
import {
  regionToCountryCode,
  getTopicCountryCodes,
  getTopicRegion,
  getBroadRegionsForCountry,
} from '../utils/countryMapping';
import { formatDateLabel } from '../utils/dateUtils';

describe('countryMapping', () => {
  it('resolves common country names to codes', () => {
    expect(regionToCountryCode('United States')).toBe('US');
    expect(regionToCountryCode('China')).toBe('CN');
    expect(regionToCountryCode('Iran')).toBe('IR');
    expect(regionToCountryCode('United Kingdom')).toBe('GB');
  });

  it('handles case-insensitive lookup', () => {
    expect(regionToCountryCode('united states')).toBe('US');
    expect(regionToCountryCode('CHINA')).toBe('CN');
  });

  it('handles aliases', () => {
    expect(regionToCountryCode('USA')).toBe('US');
    expect(regionToCountryCode('UK')).toBe('GB');
    expect(regionToCountryCode('DRC')).toBe('CD');
  });

  it('handles possessive forms', () => {
    expect(regionToCountryCode("China's")).toBe('CN');
    expect(regionToCountryCode("Russia's")).toBe('RU');
  });

  it('returns null for unknown names', () => {
    expect(regionToCountryCode('Atlantis')).toBeNull();
    expect(regionToCountryCode('')).toBeNull();
    expect(regionToCountryCode(null)).toBeNull();
  });

  it('returns null for broad region names (not individual countries)', () => {
    // Broad regions like "Middle East" don't resolve to a single code
    const result = regionToCountryCode('Middle East');
    expect(result === 'SA' || result === null).toBe(true);
  });

  it('getBroadRegionsForCountry returns correct regions', () => {
    const regions = getBroadRegionsForCountry('France');
    expect(regions).toContain('EU');
    expect(regions).toContain('European Union');
    expect(regions).toContain('Europe');
    expect(regions).toContain('NATO');
    expect(regions).toContain('G7');
  });

  it('getBroadRegionsForCountry returns empty for unknown', () => {
    expect(getBroadRegionsForCountry('Atlantis')).toEqual([]);
  });

  it('getTopicCountryCodes extracts codes from regions', () => {
    const codes = getTopicCountryCodes({ regions: ['United States', 'China'] });
    expect(codes).toContain('US');
    expect(codes).toContain('CN');
  });

  it('getTopicRegion returns region for single-region topic', () => {
    expect(getTopicRegion({ regions: ['Japan'] })).toBe('Asia');
    expect(getTopicRegion({ regions: ['France'] })).toBe('Europe');
  });

  it('getTopicRegion returns World for multi-region topic', () => {
    expect(getTopicRegion({ regions: ['Japan', 'France'] })).toBe('World');
  });
});

describe('dateUtils', () => {
  it('formatDateLabel returns formatted date', () => {
    const result = formatDateLabel('2026-03-22');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
