import { describe, it, expect } from 'vitest';
import { writtenLateText, writtenLateOf } from '@/shared/lib/writtenLate.js';

const ok = { writtenAt: '2026-11-16T23:30:00.000Z', slot: '2026-11-15T12:15:00.000Z' };

describe('writtenLateText', () => {
  it('words a valid marker with UTC days', () => {
    expect(writtenLateText({ writtenLate: ok })).toBe('Written 16 Nov from articles saved on 15 Nov');
    expect(writtenLateText({ writtenLate: { writtenAt: '2026-11-17T01:30:00+02:00', slot: '2026-11-14T20:15:00Z' } })).toBe('Written 16 Nov from articles saved on 14 Nov');
  });
  it('shows nothing for an entry without a marker', () => {
    expect(writtenLateText({})).toBeNull();
    expect(writtenLateText(null)).toBeNull();
    expect(writtenLateText({ writtenLate: null })).toBeNull();
  });
  it('shows nothing for a malformed marker', () => {
    for (const bad of [{ slot: ok.slot }, { writtenAt: ok.writtenAt }, { writtenAt: 'soon', slot: ok.slot }, { writtenAt: ok.writtenAt, slot: '' }, { writtenAt: 5, slot: ok.slot }, 'late', []]) {
      expect(writtenLateText({ writtenLate: bad })).toBeNull();
    }
  });
  it('writtenLateOf passes only a valid marker through', () => {
    expect(writtenLateOf({ writtenLate: ok })).toEqual({ writtenLate: ok });
    expect(writtenLateOf({ writtenLate: { slot: ok.slot } })).toEqual({});
    expect(writtenLateOf({})).toEqual({});
  });
});
