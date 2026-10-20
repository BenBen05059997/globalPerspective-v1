import { describe, it, expect } from 'vitest';
import { whatWeDontKnow, missingArchiveDays, singleOutletCount, webCountries } from '@/features/countries/lib/countryUnknowns.js';

const days = (n, from = '2026-10-20') => Array.from({ length: n }, (_, i) => new Date(Date.parse(from) - i * 86400000).toISOString().slice(0, 10));
const web = { targets: { count: 2, countries: ['Iran', 'Ukraine'] } };
const base = { archiveDates: days(30), entries: [], intel: null, webIndex: null, country: 'Japan' };

describe('missingArchiveDays', () => {
  it('counts gaps in the 30 days ending on the newest archive day', () => {
    expect(missingArchiveDays(days(30).filter((_, i) => i !== 3 && i !== 9))).toEqual({ missing: 2, windowDays: 30 });
  });
  it('is null with no archive (nothing to say), and 0 with a full window', () => {
    expect(missingArchiveDays([])).toBeNull();
    expect(missingArchiveDays(days(30)).missing).toBe(0);
  });
  it('a thin archive reports the rest of the window as missing', () => {
    expect(missingArchiveDays(days(5)).missing).toBe(25);
  });
});

describe('singleOutletCount', () => {
  it('counts entries with one distinct outlet among entries that list any', () => {
    const entries = [
      { sources: [{ source: 'BBC' }, { source: 'bbc' }] },
      { sources: [{ source: 'BBC' }, { url: 'https://www.reuters.com/x' }] },
      { sources: [] },
      {},
    ];
    expect(singleOutletCount(entries)).toEqual({ single: 1, total: 2 });
  });
});

describe('webCountries', () => {
  it('reads names from strings or objects; null when the index does not say', () => {
    expect(webCountries(web)).toEqual(['Iran', 'Ukraine']);
    expect(webCountries({ targets: { countries: [{ countryName: 'Iran' }] } })).toEqual(['Iran']);
    expect(webCountries(null)).toBeNull();
    expect(webCountries({})).toBeNull();
  });
  it('prefers every per-country web (websUsed) over the last run\'s targets, and treats an empty list as unknown', () => {
    const idx = { websUsed: [{ country: 'Iran' }, { country: 'Japan' }], targets: { count: 0, countries: [] } };
    expect(webCountries(idx)).toEqual(['Iran', 'Japan']);
    expect(webCountries({ targets: { count: 0, countries: [] } })).toBeNull();
  });
});

describe('whatWeDontKnow', () => {
  it('says only "Not graded" when nothing else is true', () => {
    expect(whatWeDontKnow(base)).toEqual(['Not graded: we hold no outlet reliability data.']);
  });
  it('names missing archive days', () => {
    const lines = whatWeDontKnow({ ...base, archiveDates: days(30).slice(0, 27) });
    expect(lines[0]).toBe('Our archive has no stories for 3 of the last 30 days, so events on those days are absent here.');
  });
  it('names single-outlet reports, singular and plural', () => {
    const one = { sources: [{ source: 'BBC' }] };
    const two = { sources: [{ source: 'BBC' }, { source: 'AP' }] };
    expect(whatWeDontKnow({ ...base, entries: [one, two] })[0]).toBe('1 of 2 reports for Japan rests on a single outlet.');
    expect(whatWeDontKnow({ ...base, entries: [one, one, two] })[0]).toBe('2 of 3 reports for Japan rest on a single outlet.');
  });
  it('says the analysis is ungrounded only when an analysis exists and carries no sources', () => {
    expect(whatWeDontKnow({ ...base, intel: { groundingSources: [] } }).join(' ')).toMatch(/built only from our archive/);
    expect(whatWeDontKnow({ ...base, intel: {} }).join(' ')).toMatch(/built only from our archive/);
    expect(whatWeDontKnow({ ...base, intel: { groundingSources: [{ title: 'x' }] } }).join(' ')).not.toMatch(/built only/);
    expect(whatWeDontKnow({ ...base, intel: null }).join(' ')).not.toMatch(/built only/);
  });
  it('lists the story web countries when this country is outside them, and stays quiet inside or without an index', () => {
    expect(whatWeDontKnow({ ...base, webIndex: web }).pop()).toBe('No judged links; the story web covers 2 countries: Iran, Ukraine.');
    expect(whatWeDontKnow({ ...base, webIndex: web, country: 'iran' }).join(' ')).not.toMatch(/No judged links/);
    expect(whatWeDontKnow(base).join(' ')).not.toMatch(/No judged links/);
  });
  it('handles an empty archive without inventing gaps', () => {
    expect(whatWeDontKnow({ ...base, archiveDates: [] })).toEqual(['Not graded: we hold no outlet reliability data.']);
  });
});
