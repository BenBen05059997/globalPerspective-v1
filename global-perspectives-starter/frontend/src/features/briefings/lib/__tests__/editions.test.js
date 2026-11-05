import { describe, it, expect } from 'vitest';
import {
  todayKey, addDaysKey, lastNDateKeys,
  buildDailyEditionMarks, labelledDateKeys, nearestWeek, editionDateLabel,
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

  describe('nearestWeek', () => {
    const weeks = ['2026-10-04', '2026-09-06', '2026-10-25'];
    it('steps to the nearest existing earlier or later edition, skipping empty weeks', () => {
      expect(nearestWeek(weeks, '2026-10-04', -1)).toBe('2026-09-06');
      expect(nearestWeek(weeks, '2026-10-04', 1)).toBe('2026-10-25');
      expect(nearestWeek(weeks, '2026-09-27', -1)).toBe('2026-09-06'); // a week with no edition
    });
    it('null at either end and with no index', () => {
      expect(nearestWeek(weeks, '2026-09-06', -1)).toBeNull();
      expect(nearestWeek(weeks, '2026-10-25', 1)).toBeNull();
      expect(nearestWeek(null, '2026-10-04', -1)).toBeNull();
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

describe('editionDateLabel', () => {
  it('names today and yesterday by date, never Today or Yesterday', () => {
    const t = todayKey();
    for (const k of [t, addDaysKey(t, -1)]) {
      const label = editionDateLabel(k);
      expect(label).not.toMatch(/Today|Yesterday/);
      expect(label).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
    }
  });
  it('formats a fixed UTC day', () => {
    expect(editionDateLabel('2026-11-05')).toBe('Thu, Nov 5');
  });
});
