import { describe, it, expect } from 'vitest';
import {
  ROUTE, storyHref, countryHref, mapHref, briefingHref, forecastHref, forecastAnchorId, studioHref, todayHref, breakingHref,
  entityHref,
} from '@/shared/lib/links.js';

describe('links — one address per destination', () => {
  it('ROUTE lists the reader routes', () => {
    expect(ROUTE).toMatchObject({ map: '/', today: '/today', story: '/weekly/thread/:threadId', country: '/weekly/country/:countryName', briefings: '/briefings', trackRecord: '/track-record', studio: '/analyze' });
  });

  it('storyHref encodes the id and keeps the story options (tab, from, country)', () => {
    expect(storyHref('thread a/1')).toBe('/weekly/thread/thread%20a%2F1');
    expect(storyHref('t-1', { tab: 'timeline', from: 'country', country: 'Iran' })).toBe('/weekly/thread/t-1?tab=timeline&from=country&country=Iran');
    expect(storyHref('')).toBe('/weekly');
  });

  it('breakingHref is the alert resolver address; no id -> the map', () => {
    expect(breakingHref('alert 1/x')).toBe('/breaking/alert%201%2Fx');
    expect(breakingHref(null)).toBe('/');
  });

  it('countryHref keeps the canonical display name; places go to their country; non-countries are null', () => {
    expect(countryHref('United Arab Emirates')).toBe('/weekly/country/UAE');
    expect(countryHref('ARE')).toBe('/weekly/country/UAE');
    expect(countryHref('Democratic Republic of Congo')).toBe('/weekly/country/DR%20Congo');
    expect(countryHref('USA')).toBe('/weekly/country/United%20States');
    expect(countryHref('West Bank')).toBe('/weekly/country/Palestine');
    expect(countryHref("Côte d'Ivoire")).toBe("/weekly/country/C%C3%B4te%20d'Ivoire");
    expect(countryHref('Strait of Hormuz')).toBeNull();
    expect(countryHref('Europe')).toBeNull();
    expect(countryHref(null)).toBeNull();
  });

  it('mapHref: situation, story or country (as ISO3), optional layer', () => {
    expect(mapHref({ situation: 'news#conflict#UKR#x' })).toBe('/?focus=news%23conflict%23UKR%23x');
    expect(mapHref({ story: 'thread-a-1' })).toBe('/?story=thread-a-1');
    expect(mapHref({ country: 'Iran', layer: 'risk' })).toBe('/?country=IRN&layer=risk');
    expect(mapHref({ country: 'Strait of Hormuz' })).toBeNull();
    expect(mapHref()).toBe('/');
  });

  it('briefingHref: mode, date, week; malformed values are left out', () => {
    expect(briefingHref({ mode: 'read', date: '2026-10-18' })).toBe('/briefings?mode=read&date=2026-10-18');
    expect(briefingHref({ mode: 'weekly', week: '2026-10-13' })).toBe('/briefings?mode=weekly&week=2026-10-13');
    expect(briefingHref({ mode: 'present' })).toBe('/briefings?mode=present');
    expect(briefingHref({ mode: 'present', week: '2026-10-12', deck: 'weekly' })).toBe('/briefings?mode=present&week=2026-10-12&deck=weekly');
    expect(briefingHref({ mode: 'present', deck: 'daily' })).toBe('/briefings?mode=present');
    expect(briefingHref({ mode: 'slides', date: '18 Oct' })).toBe('/briefings');
    expect(briefingHref()).toBe('/briefings');
  });

  it('forecastHref / forecastAnchorId', () => {
    expect(forecastHref('2026-W42#q3')).toBe('/track-record?q=2026-W42%23q3');
    expect(forecastHref()).toBe('/track-record');
    expect(forecastAnchorId('abc')).toBe('q-abc');
  });

  it('studioHref takes thread ids; todayHref', () => {
    expect(studioHref(['thread-a', 'thread-b'])).toBe('/analyze?stories=thread-a%2Cthread-b');
    expect(studioHref('thread-a')).toBe('/analyze?stories=thread-a');
    expect(studioHref([])).toBe('/analyze');
    expect(todayHref()).toBe('/today');
  });

  it('entityHref resolves each kind or returns null', () => {
    expect(entityHref('story', 't-1')).toBe('/weekly/thread/t-1');
    expect(entityHref('country', 'UK')).toBe('/weekly/country/United%20Kingdom');
    expect(entityHref('country', 'NATO')).toBeNull();
    expect(entityHref('situation', 's1')).toBe('/?focus=s1');
    expect(entityHref('forecast', 'q1')).toBe('/track-record?q=q1');
    expect(entityHref('story', '')).toBeNull();
    expect(entityHref('nope', 'x')).toBeNull();
  });
});
