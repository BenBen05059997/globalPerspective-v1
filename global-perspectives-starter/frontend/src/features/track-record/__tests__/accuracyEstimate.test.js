import { describe, it, expect } from 'vitest';
import { estimateAccuracyWindow } from '@/features/track-record/lib/accuracyEstimate.js';

const weeks = (n, start = '2026-10-05') => Array.from({ length: n }, (_, i) => ({
  weekId: `w${i}`, weekStart: new Date(Date.parse(`${start}T00:00:00Z`) + i * 7 * 86400000).toISOString().slice(0, 10), drawn: false, picked: null,
}));

describe('estimateAccuracyWindow', () => {
  it('reproduces the plan arithmetic: first week 2026-10-05, K 22, published 7-84 day window -> 2027-01-11 to 2027-01-25', () => {
    const est = estimateAccuracyWindow({ sampled: [], weeks: weeks(2), target: 150, now: new Date('2026-10-01T10:00:00Z'), plannedK: 22 });
    expect(est.earliest).toBe('2027-01-11');
    expect(est.latest).toBe('2027-01-25');
    expect(est.basis).toMatchObject({ locked: 0, perWeek: 22, perWeekSource: 'published', leadSource: 'published' });
  });

  it('a smaller weekly sample moves the date later; a larger one earlier', () => {
    const at = (K) => estimateAccuracyWindow({ sampled: [], weeks: weeks(1), target: 150, now: new Date('2026-10-01T00:00:00Z'), plannedK: K }).earliest;
    expect(at(20) > at(22)).toBe(true);
    expect(at(25) < at(22)).toBe(true);
  });

  it('a higher void rate never brings the date forward', () => {
    const a = estimateAccuracyWindow({ sampled: [], weeks: weeks(1), now: new Date('2026-10-01T00:00:00Z'), voidHigh: 0.1 });
    const b = estimateAccuracyWindow({ sampled: [], weeks: weeks(1), now: new Date('2026-10-01T00:00:00Z'), voidHigh: 0.4 });
    expect(b.latest >= a.latest).toBe(true);
  });

  it('returns null with nothing committed (no basis)', () => {
    expect(estimateAccuracyWindow({ sampled: [], weeks: [], now: new Date() })).toBeNull();
  });

  it('counts questions already resolved and settles open ones on a Monday after deadline + 3 days', () => {
    const sampled = [
      ...Array.from({ length: 149 }, () => ({ state: 'yes', deadline: '2026-11-01', issuedAt: '2026-10-05' })),
      { state: 'awaiting', deadline: '2026-11-19', issuedAt: '2026-10-06' },
    ];
    const est = estimateAccuracyWindow({ sampled, weeks: [{ weekId: 'a', weekStart: '2026-10-05', drawn: true, picked: 150 }], target: 150, now: new Date('2026-11-10T00:00:00Z'), voidHigh: 0, plannedK: 0 });
    // deadline Thu 2026-11-19 + 3 = Sun 11-22 -> Monday 2026-11-23 (149 resolved + 1 = 150)
    expect(est.earliest).toBe('2026-11-23');
  });

  it('uses the observed average sample size after two drawn weeks', () => {
    const w = [{ weekId: 'a', weekStart: '2026-10-05', drawn: true, picked: 10 }, { weekId: 'b', weekStart: '2026-10-12', drawn: true, picked: 12 }, ...weeks(1, '2026-10-19')];
    const est = estimateAccuracyWindow({ sampled: [], weeks: w, now: new Date('2026-10-20T00:00:00Z') });
    expect(est.basis).toMatchObject({ perWeek: 11, perWeekSource: 'observed' });
  });
});
