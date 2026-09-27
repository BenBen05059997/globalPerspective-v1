import { describe, it, expect } from 'vitest';
import { buildSettlingLog, settlingSummary } from '@/features/track-record/lib/settlingLog.js';

// Real shape: one settling run on 2026-07-24, then nothing through 2026-09-27 (verified live).
describe('buildSettlingLog — the real one-run-then-silence shape', () => {
  const confirmedAt = Array.from({ length: 30 }, () => '2026-07-24T22:22:14.709Z');
  const weeks = buildSettlingLog(confirmedAt, '2026-07-04', new Date('2026-09-27T00:00:00Z'));

  it('produces one square per week from the era cut through now', () => {
    expect(weeks.length).toBeGreaterThan(10);
    expect(weeks.length).toBeLessThan(14);
  });

  it('marks exactly one week settled (the week of 24 Jul)', () => {
    const settledWeeks = weeks.filter((w) => !w.missed);
    expect(settledWeeks.length).toBe(1);
    expect(settledWeeks[0].settled).toBe(30);
  });

  it('marks every other week missed, in red per the caller\'s styling', () => {
    const missed = weeks.filter((w) => w.missed);
    expect(missed.length).toBe(weeks.length - 1);
  });
});

describe('buildSettlingLog — an empty log', () => {
  it('every week is missed when nothing has ever settled', () => {
    const weeks = buildSettlingLog([], '2026-07-04', new Date('2026-07-25T00:00:00Z'));
    expect(weeks.every((w) => w.missed)).toBe(true);
  });
});

describe('settlingSummary', () => {
  it('counts settled vs missed', () => {
    const weeks = [{ missed: false }, { missed: true }, { missed: true }];
    expect(settlingSummary(weeks)).toEqual({ total: 3, missed: 2, settled: 1 });
  });
});
