import { describe, it, expect } from 'vitest';
import { pausedSince, freshnessState, olderLabel } from '@/shared/lib/freshness.js';

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('pausedSince', () => {
  it('returns null when newestAnalysisAt is missing', () => {
    expect(pausedSince({ now: NOW })).toBeNull();
    expect(pausedSince({ newestAnalysisAt: null, now: NOW })).toBeNull();
    expect(pausedSince({ newestAnalysisAt: undefined, now: NOW })).toBeNull();
  });

  it('returns null when newestAnalysisAt is unparseable', () => {
    expect(pausedSince({ newestAnalysisAt: 'not-a-date', now: NOW })).toBeNull();
  });

  it('returns null when analysis is fresh (well under 36h)', () => {
    const twoHoursAgo = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(pausedSince({ newestAnalysisAt: twoHoursAgo, now: NOW })).toBeNull();
  });

  it('returns null exactly at the 36h boundary', () => {
    const exactly36h = new Date(NOW.getTime() - 36 * 60 * 60 * 1000).toISOString();
    expect(pausedSince({ newestAnalysisAt: exactly36h, now: NOW })).toBeNull();
  });

  it('returns a paused result just over the 36h boundary', () => {
    const justOver = new Date(NOW.getTime() - (36 * 60 * 60 * 1000 + 1)).toISOString();
    const result = pausedSince({ newestAnalysisAt: justOver, now: NOW });
    expect(result).not.toBeNull();
    expect(result.date instanceof Date).toBe(true);
    expect(typeof result.label).toBe('string');
    expect(result.label.length).toBeGreaterThan(0);
  });

  it('returns a paused result for a multi-day-old analysis, with a label matching the real date', () => {
    // 2026-09-12T09:00:00Z, well over 14 days before NOW
    const oldIso = '2026-09-12T09:00:00.000Z';
    const result = pausedSince({ newestAnalysisAt: oldIso, now: NOW });
    expect(result).not.toBeNull();
    expect(result.date.toISOString()).toBe(oldIso);
    expect(result.label).toBe(new Date(oldIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  });

  it('defaults `now` to Date.now() when not passed', () => {
    // Just checks it does not throw and returns a sane type given a real old date.
    const result = pausedSince({ newestAnalysisAt: '2020-01-01T00:00:00.000Z' });
    expect(result).not.toBeNull();
  });
});

describe('pausedSince — nothing found after a completed search (monitor fix)', () => {
  it('says there was no analysis in the lookback window instead of hiding the line', () => {
    const r = pausedSince({ newestAnalysisAt: null, searched: true, lookbackDays: 30 });
    expect(r).not.toBeNull();
    expect(r.beyondLookback).toBe(true);
    expect(r.text).toBe('no analysis in the last 30 days');
  });
  it('stays silent while the search is still running or failed', () => {
    expect(pausedSince({ newestAnalysisAt: null, searched: false, lookbackDays: 30 })).toBeNull();
  });
  it('found case carries text with the computed date', () => {
    const r = pausedSince({ newestAnalysisAt: '2026-09-12T14:01:12Z', now: '2026-09-26T00:00:00Z' });
    expect(r.beyondLookback).toBe(false);
    expect(r.text).toBe(`analysis paused since ${r.label}`);
  });
});

describe('freshnessState', () => {
  it('is live under 24h', () => {
    expect(freshnessState(0)).toBe('live');
    expect(freshnessState(0.99)).toBe('live');
  });
  it('is plain from 1 day up to (not including) 7 days', () => {
    expect(freshnessState(1)).toBe('plain');
    expect(freshnessState(6.9)).toBe('plain');
  });
  it('is older from 7 days up to (not including) 30 days', () => {
    expect(freshnessState(7)).toBe('older');
    expect(freshnessState(13)).toBe('older'); // the paused topics feed's real age as of 2026-09-26
    expect(freshnessState(29.9)).toBe('older');
  });
  it('is hidden at 30 days and beyond', () => {
    expect(freshnessState(30)).toBe('hidden');
    expect(freshnessState(365)).toBe('hidden');
  });
  it('is hidden for invalid input rather than guessing', () => {
    expect(freshnessState(NaN)).toBe('hidden');
    expect(freshnessState(undefined)).toBe('hidden');
  });
  it('clamps a slightly-future timestamp (negative age from clock skew) to live, not hidden (F2.4)', () => {
    expect(freshnessState(-1)).toBe('live');
    expect(freshnessState(-0.01)).toBe('live');
  });
});

describe('olderLabel', () => {
  it('formats a real date as "older · <date>"', () => {
    expect(olderLabel('2026-09-13T00:00:46.696Z')).toBe(
      `older · ${new Date('2026-09-13T00:00:46.696Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    );
  });
  it('returns null for an unparseable date instead of inventing one', () => {
    expect(olderLabel('not-a-date')).toBeNull();
    expect(olderLabel(undefined)).toBeNull();
  });
});
