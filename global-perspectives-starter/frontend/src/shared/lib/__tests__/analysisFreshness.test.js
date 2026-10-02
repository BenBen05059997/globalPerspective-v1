import { describe, it, expect, beforeEach } from 'vitest';
import { newestOf, reportAnalysisAt, __resetAnalysisFreshness } from '@/shared/lib/analysisFreshness.js';
import { pausedSince } from '@/shared/lib/freshness.js';

describe('newestOf', () => {
  it('picks the newest valid timestamp across ISO strings and numbers', () => {
    expect(newestOf(['2026-09-12T14:01:00Z', '2026-10-01T12:16:05Z', 'junk', null])).toBe(Date.parse('2026-10-01T12:16:05Z'));
  });
  it('is null for nothing valid', () => {
    expect(newestOf([])).toBeNull();
    expect(newestOf(['x', undefined])).toBeNull();
  });
});

describe('reportAnalysisAt', () => {
  beforeEach(() => __resetAnalysisFreshness());
  it('ignores invalid and future timestamps', async () => {
    const mod = await import('@/shared/lib/analysisFreshness.js');
    const now = Date.parse('2026-10-02T00:00:00Z');
    reportAnalysisAt('brief', 'nope', now);
    reportAnalysisAt('topics', '2026-12-01T00:00:00Z', now);
    expect(mod.newestOf([])).toBeNull();
  });
  it('feeds pausedSince with the newest of several sources', () => {
    const now = Date.parse('2026-10-20T00:00:00Z');
    const newest = newestOf(['2026-09-12T14:01:00Z', '2026-10-01T12:16:05Z', '2026-09-30T02:24:16Z']);
    const p = pausedSince({ newestAnalysisAt: newest, now });
    expect(p.date.toISOString()).toBe('2026-10-01T12:16:05.000Z');
    expect(pausedSince({ newestAnalysisAt: newest, now: Date.parse('2026-10-01T20:00:00Z') })).toBeNull();
  });
});
