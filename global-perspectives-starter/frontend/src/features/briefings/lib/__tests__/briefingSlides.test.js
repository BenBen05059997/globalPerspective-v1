import { describe, it, expect } from 'vitest';
import {
  buildDailySlides, buildWeeklySlides, threadIdOf, placeNames, firstCountry,
  mapFocusForDailySlide, mapFocusForWeeklySlide, shadingForWeeklySlides,
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
  it('placeNames reads daily regions[] and the weekly "A · B" string', () => {
    expect(placeNames({ regions: ['Iraq', 'Syria'] })).toEqual(['Iraq', 'Syria']);
    expect(placeNames({ region: 'Israel · Palestine' })).toEqual(['Israel', 'Palestine']);
    expect(placeNames(null)).toEqual([]);
  });

  it('firstCountry prefers iso3[], else the first place that is a country (regions skipped)', () => {
    expect(firstCountry({ iso3: ['ARE'], regions: ['Middle East'] })).toEqual({ iso3: 'ARE', name: 'UAE' });
    expect(firstCountry({ regions: ['Middle East', 'Iran'] })).toEqual({ iso3: 'IRN', name: 'Iran' });
    expect(firstCountry({ region: 'Global · Africa' })).toBeNull();
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
    expect(mapFocusForWeeklySlide(slides[2])).toBeNull(); // Global · Africa: no country, no point
  });

  it('weekly shading washes only real countries', () => {
    expect(shadingForWeeklySlides(weeklyBrief).map((e) => e.iso3)).toEqual(['ISR']);
  });
});

describe('threadIdOf (Batch 3 / C)', () => {
  it('a real thread- id is linkable', () => {
    expect(threadIdOf({ threadId: 'thread-us-supreme-court-c1602d' })).toBe('thread-us-supreme-court-c1602d');
  });
  it('no id for null / missing / non-thread ids (old briefs, no confident match)', () => {
    expect(threadIdOf({ threadId: null })).toBeNull();
    expect(threadIdOf({ title: 'x' })).toBeNull();
    expect(threadIdOf({ threadId: 'Some Title' })).toBeNull();
    expect(threadIdOf(null)).toBeNull();
  });
});
