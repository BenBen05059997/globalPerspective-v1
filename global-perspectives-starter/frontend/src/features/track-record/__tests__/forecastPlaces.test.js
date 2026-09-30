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

  it('sorts by everything placed there, descending', () => {
    const counts = forecastPlaceCounts(items);
    for (let i = 1; i < counts.length; i++) expect(counts[i - 1].all).toBeGreaterThanOrEqual(counts[i].all);
  });

  it('counts sampled questions by state, awaiting and past-deadline included, and never scores a place', () => {
    const q = [
      { question: 'Turkey hosts the summit', state: 'yes' },
      { question: 'Turkey signs the accord', state: 'awaiting' },
      { question: 'Turkey expels an envoy', state: 'past_deadline_unchecked' },
      { question: 'Turkey holds the vote', state: 'void' },
    ];
    const tur = forecastPlaceCounts(q).find((c) => c.iso3 === 'TUR');
    expect(tur).toMatchObject({ fired: 1, notFired: 0, awaiting: 1, pastUnchecked: 1, void: 1, all: 4, total: 1 });
    expect(Object.keys(tur)).not.toContain('accuracy');
  });
});
