import { describe, it, expect } from 'vitest';
import { placesInText, forecastPlaceCounts } from '@/features/track-record/lib/forecastPlaces.js';

describe('placesInText', () => {
  it('matches a full country name at a word boundary', () => {
    expect(placesInText('A Russian missile strikes within 10 km of the NATO summit venue in Turkey')).toEqual(['TUR']);
  });

  it('matches more than one country in the same sentence', () => {
    const places = placesInText('India and Indonesia issue a joint statement');
    expect(places.sort()).toEqual(['IDN', 'IND']);
  });

  it('does not double-count "Congo" inside "DR Congo"', () => {
    expect(placesInText('unrest spreads across DR Congo')).toEqual(['COD']);
  });

  it('does not match a city name alone (no country named)', () => {
    expect(placesInText('Pakistan Navy confirms wreckage off Karachi coast')).toEqual(['PAK']);
    expect(placesInText('a plane went missing off Karachi coast')).toEqual([]);
  });

  it('returns nothing for empty text', () => {
    expect(placesInText('')).toEqual([]);
    expect(placesInText(null)).toEqual([]);
  });
});

describe('forecastPlaceCounts', () => {
  const items = [
    { title: 'India to supply Indonesia with missiles', trigger: 'joint statement', verdict: 'fired' },
    { title: 'China test-launches missile', trigger: 'Australia, Japan, and New Zealand condemn the test', verdict: 'not_fired' },
    { title: 'Unrelated', trigger: 'no country named here', verdict: 'fired' },
  ];

  it('counts fired/notFired per matched place', () => {
    const counts = forecastPlaceCounts(items);
    const byIso3 = Object.fromEntries(counts.map((c) => [c.iso3, c]));
    expect(byIso3.IND).toMatchObject({ fired: 1, notFired: 0, total: 1 });
    expect(byIso3.IDN).toMatchObject({ fired: 1, notFired: 0, total: 1 });
    expect(byIso3.CHN).toMatchObject({ fired: 0, notFired: 1, total: 1 });
    expect(byIso3.AUS).toMatchObject({ fired: 0, notFired: 1, total: 1 });
  });

  it('never plots an item with no country name', () => {
    const counts = forecastPlaceCounts([{ title: 'Unrelated', trigger: 'nothing here', verdict: 'fired' }]);
    expect(counts).toEqual([]);
  });

  it('sorts by total descending', () => {
    const counts = forecastPlaceCounts(items);
    for (let i = 1; i < counts.length; i++) expect(counts[i - 1].total).toBeGreaterThanOrEqual(counts[i].total);
  });
});
