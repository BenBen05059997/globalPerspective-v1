import { describe, it, expect } from 'vitest';
import { currencyForCountry, fxRowForCountry } from '@/features/countries/lib/countryCurrency.js';

describe('countryCurrency', () => {
  it('maps a known country to its ISO currency code', () => {
    expect(currencyForCountry('Germany')).toBe('EUR');
    expect(currencyForCountry('Japan')).toBe('JPY');
  });

  it('returns null for an unlisted country (no guessing)', () => {
    expect(currencyForCountry('Atlantis')).toBeNull();
  });

  it('builds an FX row only when the currency is present in the fetched ECB-sourced rates', () => {
    const fx = { rates: { EUR: 0.92, JPY: 148.2 }, base: 'USD' };
    expect(fxRowForCountry('Germany', fx)).toEqual({ currency: 'EUR', rate: 0.92, base: 'USD' });
  });

  it('omits the row when the currency is not in the feed (e.g. IRR, YER)', () => {
    const fx = { rates: { EUR: 0.92, JPY: 148.2 }, base: 'USD' };
    expect(fxRowForCountry('Iran', fx)).toBeNull();
    expect(fxRowForCountry('Yemen', fx)).toBeNull();
  });

  it('omits the row when there is no fx data at all', () => {
    expect(fxRowForCountry('Germany', null)).toBeNull();
    expect(fxRowForCountry('Germany', { rates: null })).toBeNull();
  });
});
