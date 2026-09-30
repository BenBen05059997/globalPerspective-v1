import { describe, it, expect } from 'vitest';
import { phoneSheetStopFor, mapScrollTop } from '@/features/map/lib/phoneSheet.js';

describe('phoneSheetStopFor (Batch 3 / H2)', () => {
  it('a country opens at peek; situations and stories keep half', () => {
    expect(phoneSheetStopFor({ countryParam: 'Iran' })).toBe('peek');
    expect(phoneSheetStopFor({ focus: 'gdacs#1' })).toBe('half');
    expect(phoneSheetStopFor({ storyParam: 'thread-x' })).toBe('half');
    expect(phoneSheetStopFor({ focus: 'gdacs#1', countryParam: 'Iran' })).toBe('half');
    expect(phoneSheetStopFor({})).toBe('half');
  });
});
describe('mapScrollTop', () => {
  it('puts the map top under the header (measured 390x844: map top 499, header 56 -> scroll 443)', () => {
    expect(mapScrollTop({ mapTop: 499, scrollY: 0, headerHeight: 56 })).toBe(443);
    expect(mapScrollTop({ mapTop: 100, scrollY: 400, headerHeight: 56 })).toBe(444);
  });
  it('never negative; junk input -> null', () => {
    expect(mapScrollTop({ mapTop: 10, scrollY: 0, headerHeight: 56 })).toBe(0);
    expect(mapScrollTop({ mapTop: 'x', scrollY: 0 })).toBeNull();
  });
});
