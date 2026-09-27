import { describe, it, expect } from 'vitest';
import {
  todayKey, addDaysKey, lastNDateKeys,
  buildDailyEditionMarks, daysBetween, buildPausedSegment, labelledDateKeys,
} from '@/features/briefings/lib/editions.js';

describe('editions.js', () => {
  it('todayKey returns a UTC YYYY-MM-DD for a fixed date', () => {
    expect(todayKey(new Date('2026-09-27T23:59:00Z'))).toBe('2026-09-27');
  });

  it('addDaysKey shifts forward and backward across month/year boundaries', () => {
    expect(addDaysKey('2026-09-27', -27)).toBe('2026-08-31');
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysKey('2026-09-12', 0)).toBe('2026-09-12');
  });

  it('lastNDateKeys returns n dates ending at the anchor, newest first', () => {
    const keys = lastNDateKeys('2026-09-12', 5);
    expect(keys).toEqual(['2026-09-12', '2026-09-11', '2026-09-10', '2026-09-09', '2026-09-08']);
    expect(keys).toHaveLength(5);
  });

  it('buildDailyEditionMarks maps known true/false and leaves the rest unknown', () => {
    const marks = buildDailyEditionMarks(['2026-09-12', '2026-09-13', '2026-09-14'], {
      '2026-09-12': true, '2026-09-13': false,
    }, '2026-09-12');
    expect(marks).toEqual([
      { dateKey: '2026-09-12', status: 'exists', current: true },
      { dateKey: '2026-09-13', status: 'none', current: false },
      { dateKey: '2026-09-14', status: 'unknown', current: false },
    ]);
  });

  it('buildDailyEditionMarks treats an undefined index as all-unknown, never all-missing', () => {
    const marks = buildDailyEditionMarks(['2026-09-12'], undefined, '2026-09-12');
    expect(marks[0].status).toBe('unknown');
  });

  describe('daysBetween', () => {
    it('counts whole days forward and returns 0 for the same date', () => {
      expect(daysBetween('2026-09-12', '2026-09-27')).toBe(15);
      expect(daysBetween('2026-09-12', '2026-09-12')).toBe(0);
      expect(daysBetween('2026-09-27', '2026-09-12')).toBe(-15);
    });
  });

  describe('buildPausedSegment — the false-cause fix', () => {
    it('returns null when the anchor edition is today (no gap to explain)', () => {
      expect(buildPausedSegment('2026-09-27', '2026-09-27')).toBeNull();
    });

    it('returns null when the anchor is somehow after "today" (never a negative range)', () => {
      expect(buildPausedSegment('2026-09-28', '2026-09-27')).toBeNull();
    });

    it('builds the real gap from the day after the anchor edition through today', () => {
      const seg = buildPausedSegment('2026-09-12', '2026-09-27');
      expect(seg).toEqual({ fromKey: '2026-09-13', toKey: '2026-09-27', days: 15 });
    });
  });

  describe('labelledDateKeys', () => {
    it('always labels the first, last, and current mark', () => {
      const keys = ['2026-09-01', '2026-09-05', '2026-09-10', '2026-09-12'];
      const labelled = labelledDateKeys(keys, '2026-09-05');
      expect(labelled.has('2026-09-01')).toBe(true); // first
      expect(labelled.has('2026-09-12')).toBe(true); // last
      expect(labelled.has('2026-09-05')).toBe(true); // current
    });

    it('labels the first mark of a new month', () => {
      const keys = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'];
      const labelled = labelledDateKeys(keys, null);
      expect(labelled.has('2026-09-01')).toBe(true); // month boundary
      expect(labelled.has('2026-08-31')).toBe(false); // not first/last/current/boundary
    });
  });
});
