import { describe, it, expect } from 'vitest';
import {
  buildDailySlides, buildWeeklySlides, countryLinkPath,
  mapFocusForDailySlide, mapFocusForWeeklySlide,
} from '@/features/briefings/lib/briefingSlides.js';

const dailyBrief = {
  dateKey: '2026-09-12',
  headline: 'Test headline',
  topStories: [
    { title: 'Story A', category: 'conflict', regions: ['Saudi Arabia'], sourceCount: 3 },
    { title: 'Story B', category: 'energy', regions: ['Iraq'], sourceCount: 1 },
  ],
  countryToWatch: { countryName: 'Saudi Arabia', riskLevel: 'high', trajectory: 'escalating' },
};

const weeklyBrief = {
  weekOf: '2026-09-06',
  signals: [
    { lede: 'Signal A', fact: 'fact A', kind: 'threat', region: 'Israel · Palestine' },
    { lede: 'Signal B', fact: 'fact B', kind: 'development', region: 'Global · Africa' },
  ],
  watch: [{ event: 'Event A', stake: 'stake A' }],
};

describe('briefingSlides.js', () => {
  it('countryLinkPath builds the real CountryPage route and is null without a name', () => {
    expect(countryLinkPath('Saudi Arabia')).toBe('/weekly/country/Saudi%20Arabia');
    expect(countryLinkPath(null)).toBeNull();
  });

  it('buildDailySlides produces THE DAY, one slide per top story, and COUNTRY TO WATCH', () => {
    const slides = buildDailySlides(dailyBrief);
    expect(slides.map((s) => s.kind)).toEqual(['day', 'story', 'story', 'watch']);
    expect(slides[1].story.title).toBe('Story A');
    expect(slides[3].countryToWatch.countryName).toBe('Saudi Arabia');
  });

  it('buildDailySlides never emits a watch slide when there is no country to watch', () => {
    const slides = buildDailySlides({ ...dailyBrief, countryToWatch: null });
    expect(slides.some((s) => s.kind === 'watch')).toBe(false);
  });

  it('buildDailySlides returns [] for no brief (never a placeholder slide)', () => {
    expect(buildDailySlides(null)).toEqual([]);
  });

  it('buildWeeklySlides produces THE WEEK, one per signal, and NEXT WEEK', () => {
    const slides = buildWeeklySlides(weeklyBrief);
    expect(slides.map((s) => s.kind)).toEqual(['week', 'signal', 'signal', 'next']);
    expect(slides[3].watch).toHaveLength(1);
  });

  it('buildWeeklySlides omits NEXT WEEK when there is no watchlist', () => {
    const slides = buildWeeklySlides({ ...weeklyBrief, watch: [] });
    expect(slides.some((s) => s.kind === 'next')).toBe(false);
  });

  it('mapFocusForDailySlide resolves the story/watch country to an iso3', () => {
    const slides = buildDailySlides(dailyBrief);
    expect(mapFocusForDailySlide(slides[1])).toBe('SAU');
    expect(mapFocusForDailySlide(slides[3])).toBe('SAU');
    expect(mapFocusForDailySlide(slides[0])).toBeNull(); // the day-level slide has no single country
  });

  it('mapFocusForWeeklySlide reads the first region out of the "A · B · C" string', () => {
    const slides = buildWeeklySlides(weeklyBrief);
    expect(mapFocusForWeeklySlide(slides[1])).toBe('ISR');
  });
});
