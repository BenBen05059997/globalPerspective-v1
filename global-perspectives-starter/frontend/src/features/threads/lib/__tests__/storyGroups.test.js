import { describe, it, expect } from 'vitest';
import {
  buildThreads, ageDaysOf, groupKeyOf, groupByAge, crisisOf, tierOf, inWindow, filterThreads, filterStandalone,
  sortThreads, tierCounts, crisisCounts, regionCounts, risingThreads, resolveVisit, changedSince,
  timelineLayout, timelineTicks, VISIT_GAP_MS, MS_DAY,
} from '@/features/threads/lib/storyGroups';

// "now" = 2026-10-01 12:00 local. Day keys are real YYYY-MM-DD strings.
const NOW = new Date('2026-10-01T12:00:00').getTime();
const ago = (days) => {
  const d = new Date(NOW - days * MS_DAY);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const entry = (threadId, title, extra = {}) => ({ topicId: `${threadId}-${title}`, threadId, title, category: 'conflict', regions: ['Iran'], sources: [{ source: 'a.com' }], ...extra });

function archive(spec) {
  // spec: { daysAgo: { updatedAt?, entries: [...] } }
  const dayMap = {};
  for (const [d, v] of Object.entries(spec)) dayMap[ago(Number(d))] = { entries: v.entries, updatedAt: v.updatedAt || null, source: 'archive' };
  const sortedDates = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));
  return { dayMap, sortedDates };
}

const iso = (hoursAgo) => new Date(NOW - hoursAgo * 3600000).toISOString();

function sample() {
  const { dayMap, sortedDates } = archive({
    0: { updatedAt: iso(2), entries: [entry('t-now', 'Strike on port', { category: 'conflict' }), entry('t-now', 'Port strike aftermath'), entry('t-single', 'One-off', { threadId: undefined, category: 'health' })] },
    1: { updatedAt: iso(20), entries: [entry('t-now', 'Strike earlier'), entry('t-yday', 'Election dispute', { category: 'politics', regions: ['Kenya'] })] },
    4: { updatedAt: iso(4 * 24), entries: [entry('t-week', 'Oil markets wobble', { category: 'economy', regions: ['Saudi Arabia'] })] },
    12: { updatedAt: iso(12 * 24), entries: [entry('t-old', 'Flood relief', { category: 'disaster', regions: ['Pakistan'] }), entry('t-old', 'Flood relief 2')] },
    40: { updatedAt: iso(40 * 24), entries: [entry('t-arch', 'Old summit', { category: 'technology', regions: ['Japan'] })] },
  });
  return { ...buildThreads(dayMap, sortedDates, NOW), dayMap, sortedDates };
}

describe('buildThreads', () => {
  it('groups by threadId with real dates, counts and a real changedAt', () => {
    const { threads, standalone } = sample();
    const now = threads.find((t) => t.threadId === 't-now');
    expect(now.dates).toEqual([ago(1), ago(0)]);
    expect(now.dateRange).toEqual({ from: ago(1), to: ago(0) });
    expect(now.articleCount).toBe(3);
    expect(now.dayCount).toBe(2);
    expect(now.changedAt).toBe(iso(2));
    expect(standalone).toHaveLength(1);
  });

  it('never invents a timestamp: today without updatedAt -> null; an older day falls to its own date', () => {
    const today = buildThreads({ [ago(0)]: { entries: [entry('a', 'x')] } }, [ago(0)], NOW);
    expect(today.threads[0].changedAt).toBeNull();
    const old = buildThreads({ [ago(3)]: { entries: [entry('a', 'x')] } }, [ago(3)], NOW);
    expect(old.threads[0].changedAt).toBe(`${ago(3)}T00:00:00`);
  });
});

describe('age groups', () => {
  it('buckets Moving now (<24h), This week (1-7d), Older (7-30d), Archive (>30d)', () => {
    const { threads } = sample();
    const g = groupByAge(threads, NOW);
    expect(g.moving.map((t) => t.threadId).sort()).toEqual(['t-now', 't-yday']);
    expect(g.week.map((t) => t.threadId)).toEqual(['t-week']);
    expect(g.older.map((t) => t.threadId)).toEqual(['t-old']);
    expect(g.archive.map((t) => t.threadId)).toEqual(['t-arch']);
  });

  it('uses the real timestamp, so an old updatedAt is not "moving now" even on today\'s day key', () => {
    const { threads } = buildThreads({ [ago(0)]: { entries: [entry('a', 'x')], updatedAt: iso(30) } }, [ago(0)], NOW);
    expect(ageDaysOf(threads[0], NOW)).toBeCloseTo(30 / 24, 3);
    expect(groupKeyOf(threads[0], NOW)).toBe('week');
  });

  it('boundaries: exactly 24h is This week; exactly 7d is This week; just over 7d is Older', () => {
    const mk = (h) => ({ changedAt: iso(h), dateRange: { to: ago(0) } });
    expect(groupKeyOf(mk(23.9), NOW)).toBe('moving');
    expect(groupKeyOf(mk(24), NOW)).toBe('week');
    expect(groupKeyOf(mk(7 * 24), NOW)).toBe('week');
    expect(groupKeyOf(mk(7 * 24 + 1), NOW)).toBe('older');
    expect(groupKeyOf(mk(30 * 24 + 1), NOW)).toBe('archive');
  });
});

describe('crisis mapping', () => {
  it('maps topic categories onto the four crisis types, unknown -> neutral', () => {
    const c = (category) => crisisOf({ category });
    expect(c('conflict')).toBe('conflict');
    expect(c('military')).toBe('conflict');
    expect(c('politics')).toBe('political');
    expect(c('economy')).toBe('economic');
    expect(c('energy')).toBe('economic');
    expect(c('disaster')).toBe('humanitarian');
    expect(c('health')).toBe('humanitarian');
    expect(c('technology')).toBe('neutral');
    expect(c(null)).toBe('neutral');
  });
  it('counts only the four types', () => {
    const { threads } = sample();
    expect(crisisCounts(threads)).toEqual({ conflict: 1, political: 1, economic: 1, humanitarian: 1 });
  });
});

describe('tier', () => {
  it('reads tier + score from the analysis, nulls when unscored', () => {
    expect(tierOf({ riskScore: 80 })).toEqual({ tier: 'high', score: 80 });
    expect(tierOf({ riskScore: 30 }).tier).toBe('moderate');
    expect(tierOf(undefined)).toEqual({ tier: null, score: null });
  });
  it('tierCounts counts unscored as none', () => {
    const { threads } = sample();
    const c = tierCounts(threads, { 't-now': { riskScore: 80 }, 't-week': { riskScore: 55 } });
    expect(c).toMatchObject({ high: 1, elevated: 1, none: 3, total: 5 });
  });
});

describe('window + filters', () => {
  it('window filters by last change', () => {
    const { threads } = sample();
    const ids = (w) => threads.filter((t) => inWindow(t, w, NOW)).map((t) => t.threadId).sort();
    expect(ids('1d')).toEqual(['t-now', 't-yday']);
    expect(ids('3d')).toEqual(['t-now', 't-yday']);
    expect(ids('7d')).toEqual(['t-now', 't-week', 't-yday']);
    expect(ids('30d')).toEqual(['t-arch', 't-now', 't-old', 't-week', 't-yday']);
  });
  it('crisis, tier, region, category and search combine', () => {
    const { threads } = sample();
    const analyses = { 't-now': { riskScore: 80, threadTitle: 'Gulf escalation' }, 't-old': { riskScore: 10 } };
    const f = (x) => filterThreads(threads, x, analyses, NOW).map((t) => t.threadId).sort();
    expect(f({ crisis: ['conflict'] })).toEqual(['t-now']);
    expect(f({ crisis: ['conflict', 'political'] })).toEqual(['t-now', 't-yday']);
    expect(f({ tiers: ['high'] })).toEqual(['t-now']);
    expect(f({ tiers: ['none'] })).toEqual(['t-arch', 't-week', 't-yday']);
    expect(f({ region: 'Middle East' }).every((id) => id !== 't-old')).toBe(true);
    expect(f({ category: 'politics' })).toEqual(['t-yday']);
    expect(f({ q: 'gulf' })).toEqual(['t-now']); // matches the analysis title
    expect(f({ q: 'kenya' })).toEqual(['t-yday']); // matches a region
    expect(f({ window: '7d', crisis: ['humanitarian'] })).toEqual([]);
  });
  it('single mentions follow window/crisis/search; a tier filter hides them unless it includes "none"', () => {
    const { standalone } = sample();
    expect(filterStandalone(standalone, {}, NOW)).toHaveLength(1);
    expect(filterStandalone(standalone, { crisis: ['conflict'] }, NOW)).toHaveLength(0);
    expect(filterStandalone(standalone, { crisis: ['humanitarian'] }, NOW)).toHaveLength(1);
    expect(filterStandalone(standalone, { tiers: ['high'] }, NOW)).toHaveLength(0);
    expect(filterStandalone(standalone, { tiers: ['none'] }, NOW)).toHaveLength(1);
  });
});

describe('sorts', () => {
  it('Most covered / Most recent / Rising first', () => {
    const { threads } = sample();
    expect(sortThreads(threads, 'articles')[0].threadId).toBe('t-now');
    expect(sortThreads(threads, 'recent').map((t) => t.threadId)[0]).toBe('t-now');
    expect(sortThreads(threads, 'recent').map((t) => t.threadId).slice(-1)[0]).toBe('t-arch');
    const mk = (id, trend, articleCount) => ({ threadId: id, trend, articleCount, dateRange: { to: ago(0) } });
    const r = sortThreads([mk('stable', 'stable', 9), mk('rise', 'rising', 2), mk('new', 'new', 5)], 'rising').map((t) => t.threadId);
    expect(r).toEqual(['rise', 'new', 'stable']);
  });
  it('risingThreads keeps the old rule (rising/new, >= 2 articles)', () => {
    const mk = (id, trend, articleCount) => ({ threadId: id, trend, articleCount });
    const out = risingThreads([mk('a', 'rising', 3), mk('b', 'new', 1), mk('c', 'stable', 5), mk('d', 'new', 4)], 5);
    expect(out.map((t) => t.threadId)).toEqual(['a', 'd']);
  });
  it('regionCounts: biggest first, World last', () => {
    const r = regionCounts([{ primaryRegion: 'World' }, { primaryRegion: 'Asia' }, { primaryRegion: 'Asia' }, { primaryRegion: 'Europe' }]);
    expect(r).toEqual([{ region: 'Asia', count: 2 }, { region: 'Europe', count: 1 }, { region: 'World', count: 1 }]);
  });
});

describe('last visit', () => {
  it('first visit has no baseline', () => {
    expect(resolveVisit(null, NOW)).toEqual({ baseline: null, next: { prev: null, last: NOW } });
  });
  it('a return after the gap uses the previous "last" as the baseline', () => {
    const last = NOW - 5 * 3600000;
    expect(resolveVisit({ prev: NOW - 99, last }, NOW)).toEqual({ baseline: last, next: { prev: last, last: NOW } });
  });
  it('a reload inside the gap continues the same visit (baseline stays)', () => {
    const prev = NOW - 5 * 3600000;
    const stored = { prev, last: NOW - VISIT_GAP_MS + 1000 };
    expect(resolveVisit(stored, NOW).baseline).toBe(prev);
    expect(resolveVisit({ prev: null, last: NOW - 1000 }, NOW).baseline).toBeNull();
  });
  it('changedSince lists only stories with a real timestamp after the baseline, newest first', () => {
    const { threads } = sample();
    const out = changedSince(threads, NOW - 24 * 3600000);
    expect(out.map((t) => t.threadId)).toEqual(['t-now', 't-yday']);
    expect(changedSince(threads, null)).toEqual([]);
    expect(changedSince([{ changedAt: null }], 0)).toEqual([]);
  });
});

describe('timeline layout', () => {
  it('puts a dot on each REAL coverage day only, at its date position, line first..last', () => {
    const dates = [ago(29), ago(10), ago(0)];
    const l = timelineLayout(dates, 30, NOW);
    expect(l.dots.map((d) => d.date)).toEqual([ago(29), ago(10), ago(0)]);
    expect(l.dots[0].pct).toBe(0);
    expect(l.dots[2].pct).toBe(100);
    expect(l.dots[1].pct).toBeCloseTo((19 / 29) * 100, 5);
    expect(l.line).toEqual({ from: 0, to: 100 });
    expect(l.first).toBe(ago(29));
    expect(l.last).toBe(ago(0));
  });
  it('a gap day gets no dot (no synthetic dates)', () => {
    const l = timelineLayout([ago(5), ago(3)], 7, NOW);
    expect(l.dots).toHaveLength(2);
    expect(l.dots.map((d) => d.date)).toEqual([ago(5), ago(3)]);
  });
  it('dates outside the axis are dropped, not clamped; one dot has no line', () => {
    const l = timelineLayout([ago(40), ago(1)], 30, NOW);
    expect(l.dots.map((d) => d.date)).toEqual([ago(1)]);
    expect(l.line).toBeNull();
  });
  it('ticks run oldest to today across the span', () => {
    const t = timelineTicks(30, NOW, 6);
    expect(t).toHaveLength(6);
    expect(t[0].pct).toBe(0);
    expect(t[5].pct).toBe(100);
    expect(t[5].label).toBe('Oct 1');
    expect(t[0].label).toBe('Sep 2');
  });
});
