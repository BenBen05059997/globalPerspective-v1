import { describe, it, expect } from 'vitest';
import { buildEarlierStoryList } from '@/features/analysis-studio/lib/earlierStories';

describe('buildEarlierStoryList', () => {
  const dayMap = {
    '2026-09-27': {
      source: 'latest',
      entries: [{ topicId: 'today-1', threadId: 'thread-today', title: 'Today story', category: 'Politics', regions: ['X'] }],
    },
    '2026-09-20': {
      source: 'archive',
      entries: [
        { topicId: 'afd-old-1', threadId: 'thread-afd', title: 'AfD wins Saxony-Anhalt', category: 'Politics', regions: ['Germany'] },
        { topicId: 'ferry-1', threadId: 'thread-ferry', title: 'Ferry fire off Palawan', category: 'Disaster', regions: ['Philippines'] },
      ],
    },
    '2026-09-13': {
      source: 'archive',
      entries: [
        // Same threadId, evolved headline — genuinely a later real appearance.
        { topicId: 'afd-old-2', threadId: 'thread-afd', title: 'Protests erupt against AfD', category: 'Politics', regions: ['Germany'] },
        // Exact same title as a later date below — a re-dated repeat that must collapse
        // to its EARLIEST appearance (dropRedatedRepeats), not double-count.
        { topicId: 'redated-1', threadId: 'thread-redated', title: 'Duplicate headline bug', category: 'Other', regions: [] },
      ],
    },
    '2026-09-10': {
      source: 'archive',
      entries: [
        { topicId: 'redated-2', threadId: 'thread-redated', title: 'Duplicate headline bug', category: 'Other', regions: [] },
        // No threadId — must never surface (can't feed buildAnalysisContext's D2 path).
        { topicId: 'no-thread-1', threadId: null, title: 'Untracked story', category: 'Other', regions: [] },
      ],
    },
  };

  it('excludes today (source: latest)', () => {
    const rows = buildEarlierStoryList(dayMap);
    expect(rows.some((r) => r.threadId === 'thread-today')).toBe(false);
  });

  it('excludes entries with no threadId', () => {
    const rows = buildEarlierStoryList(dayMap);
    expect(rows.some((r) => r.title === 'Untracked story')).toBe(false);
  });

  it('excludes topicIds already shown in the today list', () => {
    const rows = buildEarlierStoryList(dayMap, { excludeTopicIds: new Set(['ferry-1']) });
    expect(rows.some((r) => r.topicId === 'ferry-1')).toBe(false);
  });

  it('collapses one row per threadId, keeping the LAST real (chronologically latest) date', () => {
    const rows = buildEarlierStoryList(dayMap);
    const afd = rows.find((r) => r.threadId === 'thread-afd');
    expect(afd).toBeTruthy();
    // 2026-09-20 is chronologically AFTER 2026-09-13 — the later, genuinely different headline.
    expect(afd.date).toBe('2026-09-20');
    expect(afd.title).toBe('AfD wins Saxony-Anhalt');
  });

  it('drops a re-dated exact-title repeat before collapsing, keeping its earliest date', () => {
    const rows = buildEarlierStoryList(dayMap);
    const redated = rows.find((r) => r.threadId === 'thread-redated');
    expect(redated).toBeTruthy();
    // Only one row for this thread (the repeat collapsed away, not counted as a
    // separate later appearance) and its date is the EARLIEST of the two duplicates
    // (dropRedatedRepeats keeps the earliest real appearance of an exact-title repeat).
    expect(redated.date).toBe('2026-09-10');
  });

  it('sorts newest real date first', () => {
    const rows = buildEarlierStoryList(dayMap);
    const dates = rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it('filters by a case-insensitive title substring', () => {
    const rows = buildEarlierStoryList(dayMap, { query: 'ferry' });
    expect(rows).toHaveLength(1);
    expect(rows[0].threadId).toBe('thread-ferry');
  });

  it('an empty/whitespace query returns the full list', () => {
    const all = buildEarlierStoryList(dayMap);
    const withBlankQuery = buildEarlierStoryList(dayMap, { query: '   ' });
    expect(withBlankQuery).toEqual(all);
  });
});
