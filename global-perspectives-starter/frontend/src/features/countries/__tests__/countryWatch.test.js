import { describe, it, expect } from 'vitest';
import { countryWatchFlag } from '@/features/countries/lib/countryWatch.js';

const now = Date.UTC(2026, 8, 27);

describe('countryWatchFlag', () => {
  it('flags an elevated/high GDACS alert affecting the country', () => {
    const situations = [{ source: 'gdacs', tier: 'high', iso3_affected: ['IRN'], verb_label: 'Earthquake' }];
    const w = countryWatchFlag(situations, 'IRN', now);
    expect(w).toEqual({ kind: 'gdacs', tier: 'high', label: 'Earthquake', situationId: undefined });
  });

  it('ignores a low/moderate GDACS alert', () => {
    const situations = [{ source: 'gdacs', tier: 'low', iso3_affected: ['IRN'] }];
    expect(countryWatchFlag(situations, 'IRN', now)).toBeNull();
  });

  it('flags an escalating origin situation within 24h', () => {
    const situations = [{
      source: 'news', escalating: true, iso3_affected: ['IRN'],
      last_change_at: new Date(now - 2 * 3600000).toISOString(), verb_label: 'Strikes intensify',
    }];
    expect(countryWatchFlag(situations, 'IRN', now)?.kind).toBe('news');
  });

  it('does not flag an escalating situation older than 24h', () => {
    const situations = [{
      source: 'news', escalating: true, iso3_affected: ['IRN'],
      last_change_at: new Date(now - 30 * 3600000).toISOString(),
    }];
    expect(countryWatchFlag(situations, 'IRN', now)).toBeNull();
  });

  it('does not flag a non-escalating news situation', () => {
    const situations = [{
      source: 'news', escalating: false, iso3_affected: ['IRN'],
      last_change_at: new Date(now - 1000).toISOString(),
    }];
    expect(countryWatchFlag(situations, 'IRN', now)).toBeNull();
  });

  it('returns null with no situations or no iso3', () => {
    expect(countryWatchFlag([], 'IRN', now)).toBeNull();
    expect(countryWatchFlag([{ source: 'gdacs', tier: 'high', iso3_affected: ['IRN'] }], null, now)).toBeNull();
  });
});
