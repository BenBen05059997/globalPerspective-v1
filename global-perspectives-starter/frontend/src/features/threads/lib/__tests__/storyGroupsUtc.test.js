/* global process */
// S7 + S8: archive day keys are UTC days, so day maths gives the same answer in every reader's time zone;
// buildThreads drops re-dated repeats exactly as the story page does.
import { describe, it, expect, afterAll } from 'vitest';
import {
  daysSince, dayKeyAgo, buildThreads, dayCounts, deriveBoardStatus, timelineLayout, timelineTicks, filterStandalone, ageDaysOf,
} from '@/features/threads/lib/storyGroups';

const ZONES = ['America/Los_Angeles', 'Asia/Tokyo', 'UTC'];
const ORIGINAL_TZ = process.env.TZ;
afterAll(() => { if (ORIGINAL_TZ === undefined) delete process.env.TZ; else process.env.TZ = ORIGINAL_TZ; });

// 2026-11-05 05:00Z: 21:00 on Nov 4 in Los Angeles (the key 2026-11-05 already exists), 14:00 in Tokyo.
// 2026-11-04 18:00Z: 03:00 on Nov 5 in Tokyo (the UTC day is still Nov 4).
const LA_EVENING = Date.parse('2026-11-05T05:00:00Z');
const TOKYO_MORNING = Date.parse('2026-11-04T18:00:00Z');

describe.each(ZONES)('UTC day maths in %s', (tz) => {
  const withTz = (fn) => () => { process.env.TZ = tz; fn(); };

  it('daysSince counts UTC calendar days', withTz(() => {
    expect(daysSince('2026-11-05', LA_EVENING)).toBe(0);
    expect(daysSince('2026-11-04', LA_EVENING)).toBe(1);
    expect(daysSince('2026-11-04', TOKYO_MORNING)).toBe(0);
    expect(daysSince('2026-11-03', TOKYO_MORNING)).toBe(1);
    expect(daysSince('2026-11-06', LA_EVENING)).toBe(-1);
  }));

  it('dayKeyAgo is the UTC key', withTz(() => {
    expect(dayKeyAgo(0, LA_EVENING)).toBe('2026-11-05');
    expect(dayKeyAgo(2, TOKYO_MORNING)).toBe('2026-11-02');
  }));

  it("today's items stay in the board counts and the timeline", withTz(() => {
    const thread = { entries: [{ date: '2026-11-05' }, { date: '2026-11-05' }, { date: '2026-11-04' }], dates: ['2026-11-04', '2026-11-05'] };
    expect(dayCounts(thread, 3, LA_EVENING)).toEqual([0, 1, 2]);
    expect(deriveBoardStatus(thread, LA_EVENING)).toMatchObject({ firstAgo: 1, lastAgo: 0, last3: 3 });
    const lay = timelineLayout(thread.dates, 3, LA_EVENING);
    expect(lay.dots.map((d) => d.date)).toEqual(['2026-11-04', '2026-11-05']);
    expect(lay.dots.at(-1).pct).toBe(100);
  }));

  it('the same story reads the same in every zone (Tokyo: no +1 day)', withTz(() => {
    const thread = { entries: [{ date: '2026-11-04' }], dates: ['2026-11-04'] };
    expect(deriveBoardStatus(thread, TOKYO_MORNING)).toMatchObject({ firstAgo: 0, lastAgo: 0 });
    expect(timelineLayout(thread.dates, 7, TOKYO_MORNING).dots[0].pct).toBe(100);
  }));

  it('a story dated today with no updatedAt is not aged by the zone; yesterday is aged from its UTC midnight', withTz(() => {
    const day = (entries) => ({ entries, updatedAt: null });
    const e = { threadId: 't', title: 'x', regions: [], sources: [] };
    const { threads } = buildThreads({ '2026-11-05': day([e]) }, ['2026-11-05'], LA_EVENING);
    expect(threads[0].changedAt).toBeNull();
    expect(ageDaysOf(threads[0], LA_EVENING)).toBe(0);
    const y = buildThreads({ '2026-11-04': day([e]) }, ['2026-11-04'], LA_EVENING).threads[0];
    expect(y.changedAt).toBe('2026-11-04T00:00:00Z');
    expect(ageDaysOf(y, LA_EVENING)).toBeCloseTo(29 / 24, 5);
  }));

  it('timeline ticks are UTC dates', withTz(() => {
    expect(timelineTicks(3, LA_EVENING, 3).map((t) => t.label)).toEqual(['Nov 3', 'Nov 4', 'Nov 5']);
  }));

  it('the standalone window filter uses the same days', withTz(() => {
    const entries = [{ date: '2026-11-05', title: 'a' }, { date: '2026-11-04', title: 'b' }];
    expect(filterStandalone(entries, { window: '1d' }, LA_EVENING).map((x) => x.title)).toEqual(['a']);
  }));
});

describe('buildThreads drops re-dated repeats (same rule as the story page)', () => {
  const e = (title, extra = {}) => ({ threadId: 't1', title, regions: ['Iran'], sources: [{ source: 'a.com' }], ...extra });
  const NOW = Date.parse('2026-11-05T12:00:00Z');
  const dayMap = {
    '2026-11-05': { entries: [e('Old headline'), e('Fresh headline', { regions: ['Kenya'], sources: [{ source: 'b.com' }] })], updatedAt: '2026-11-05T01:00:00Z' },
    '2026-11-04': { entries: [e('Old headline')], updatedAt: '2026-11-04T01:00:00Z' },
    '2026-11-03': { entries: [e('Old headline')], updatedAt: '2026-11-03T01:00:00Z' },
  };
  const dates = Object.keys(dayMap).sort().reverse();

  it('counts a repeated headline once, on its first day', () => {
    const [t] = buildThreads(dayMap, dates, NOW).threads;
    expect(t.articleCount).toBe(2);
    expect(t.dateRange).toEqual({ from: '2026-11-03', to: '2026-11-05' });
    expect(t.dayCount).toBe(2);
  });

  it('a story that is only a re-dated repeat keeps its first span and age', () => {
    const only = { '2026-11-05': { entries: [e('Old headline')], updatedAt: '2026-11-05T01:00:00Z' }, '2026-11-01': { entries: [e('Old headline')], updatedAt: '2026-11-01T01:00:00Z' } };
    const [t] = buildThreads(only, ['2026-11-05', '2026-11-01'], NOW).threads;
    expect(t.articleCount).toBe(1);
    expect(t.dateRange).toEqual({ from: '2026-11-01', to: '2026-11-01' });
    expect(t.changedAt).toBe('2026-11-01T01:00:00.000Z');
  });
});
