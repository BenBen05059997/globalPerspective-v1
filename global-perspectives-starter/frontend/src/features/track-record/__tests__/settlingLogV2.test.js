import { describe, it, expect } from 'vitest';
import { weekSquare, buildWeeklySquares, settlingSummary, settlingSentence } from '@/features/track-record/lib/settlingLog.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const w = (weekStart, due, settled) => ({ weekId: weekStart, weekStart, due, settled });

describe('weekSquare', () => {
  it('nothing due in a finished week is grey, a fact and not a miss', () => {
    expect(weekSquare(w('2026-10-05', 0, 0), NOW).kind).toBe('grey');
  });
  it('the running week with nothing due is "open"', () => {
    expect(weekSquare(w('2026-11-09', 0, 0), NOW).kind).toBe('open');
  });
  it('red only when something was due, the week ended and nothing was confirmed', () => {
    expect(weekSquare(w('2026-10-12', 4, 0), NOW).kind).toBe('red');
    expect(weekSquare(w('2026-11-09', 4, 0), NOW).kind).toBe('open'); // week not over: review still to come
  });
  it('amber when some, green when all', () => {
    expect(weekSquare(w('2026-10-12', 4, 2), NOW).kind).toBe('amber');
    expect(weekSquare(w('2026-10-12', 4, 4), NOW).kind).toBe('green');
    expect(weekSquare(w('2026-10-12', 0, 3), NOW).kind).toBe('green'); // catch-up confirmations
  });
  it('labels carry real dates and counts', () => {
    expect(weekSquare(w('2026-10-12', 4, 0), NOW).label).toBe('Week of Oct 12 2026: 4 due, none settled');
  });
});

describe('buildWeeklySquares / settlingSummary', () => {
  it('one square per server week and an honest summary', () => {
    const sq = buildWeeklySquares([w('2026-10-05', 0, 0), w('2026-10-12', 4, 0), w('2026-10-19', 2, 2)], NOW);
    expect(sq.map((s) => s.kind)).toEqual(['grey', 'red', 'green']);
    expect(settlingSummary(sq)).toMatchObject({ total: 3, red: 1, green: 1, grey: 1 });
  });
  it('the sentence says what is counted: weeks ahead with questions due are not "nothing due" (R2-4)', () => {
    // the live data on 2026-11-04: W41/W42 nothing due, W43 1 and W44 4 ended unsettled, W45-W47 not over with 7/4/7 due
    const now = new Date('2026-11-04T12:00:00Z');
    const sq = buildWeeklySquares([w('2026-10-05', 0, 0), w('2026-10-12', 0, 0), w('2026-10-19', 1, 0), w('2026-10-26', 4, 0), w('2026-11-02', 7, 0), w('2026-11-09', 4, 0), w('2026-11-16', 7, 0)], now);
    expect(settlingSummary(sq)).toMatchObject({ total: 7, red: 2, grey: 2, open: 3, ahead: 3 });
    expect(settlingSentence(sq, '2026-10-05')).toBe('7 weeks since Oct 5 2026: 0 with settled questions, 2 where something was due and nothing was settled, 2 with nothing due, 3 not over yet with questions falling due.');
  });
  it('no weeks -> no squares (never invented)', () => {
    expect(buildWeeklySquares([], NOW)).toEqual([]);
    expect(buildWeeklySquares(undefined, NOW)).toEqual([]);
  });
});
