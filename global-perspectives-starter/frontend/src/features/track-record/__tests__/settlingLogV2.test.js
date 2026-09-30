import { describe, it, expect } from 'vitest';
import { weekSquare, buildWeeklySquares, settlingSummary } from '@/features/track-record/lib/settlingLog.js';

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
    expect(weekSquare(w('2026-10-12', 4, 0), NOW).label).toBe('Week of Oct 12 2026: 4 due, none confirmed');
  });
});

describe('buildWeeklySquares / settlingSummary', () => {
  it('one square per server week and an honest summary', () => {
    const sq = buildWeeklySquares([w('2026-10-05', 0, 0), w('2026-10-12', 4, 0), w('2026-10-19', 2, 2)], NOW);
    expect(sq.map((s) => s.kind)).toEqual(['grey', 'red', 'green']);
    expect(settlingSummary(sq)).toMatchObject({ total: 3, red: 1, green: 1, grey: 1 });
  });
  it('no weeks -> no squares (never invented)', () => {
    expect(buildWeeklySquares([], NOW)).toEqual([]);
    expect(buildWeeklySquares(undefined, NOW)).toEqual([]);
  });
});
