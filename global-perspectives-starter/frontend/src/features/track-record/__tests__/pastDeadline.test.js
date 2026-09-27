import { describe, it, expect } from 'vitest';
import { pastDeadlineSummary } from '@/features/track-record/lib/pastDeadline.js';

describe('pastDeadlineSummary — today\'s real gap (no per-pending-trigger deadlines served)', () => {
  it('refuses to guess a split and says why, keeping the honest aggregate', () => {
    const s = pastDeadlineSummary({ pendingTriggers: 20607 });
    expect(s.computable).toBe(false);
    expect(s.pendingTriggers).toBe(20607);
    expect(s.reason).toMatch(/no per-trigger deadline/);
  });

  it('never fabricates pastDeadlineCount when uncomputable', () => {
    const s = pastDeadlineSummary({ pendingTriggers: 20607 });
    expect(s.pastDeadlineCount).toBeUndefined();
  });
});

describe('pastDeadlineSummary — once real per-item deadlines are available', () => {
  it('splits past-deadline vs not-yet-due from real dates', () => {
    const s = pastDeadlineSummary({
      pendingDeadlines: ['2026-01-01', '2026-12-01', '2026-06-01'],
      now: new Date('2026-09-27T00:00:00Z'),
    });
    expect(s.computable).toBe(true);
    expect(s.pastDeadlineCount).toBe(2);
    expect(s.notYetDueCount).toBe(1);
    expect(s.total).toBe(3);
  });
});
