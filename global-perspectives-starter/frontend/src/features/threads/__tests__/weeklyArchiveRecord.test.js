// What the pages built on the 30-day archive see when it comes from the record's weekly index instead of the action.
// Fixtures: live captures of 2026-10-31 (days 2026-10-26 to 2026-10-31), see shared/api/__tests__/archiveRange.test.js. The 30-day
// measurements (all pages) are in decision 0045.
import { describe, it, expect } from 'vitest';
import action from '@/shared/api/__tests__/fixtures/archiveRangeAction.json';
import weekly from '@/shared/api/__tests__/fixtures/weeklyIndex.json';
import { dayMapFromIndex } from '@/shared/api/archiveRange.js';
import { buildThreads, groupKeyOf } from '@/features/threads/lib/storyGroups.js';
import { parentCountry } from '@/shared/lib/countries.js';

const NOW = new Date('2026-10-31T15:05:00Z');
const sorted = (m) => Object.keys(m).sort((a, b) => b.localeCompare(a));

describe('what the Stories page and the countries list see (fixture window, now = 2026-10-31 15:05Z)', () => {
  const rec = { ...dayMapFromIndex(weekly, '2026-10-31'), ...Object.fromEntries(Object.entries(action.data).filter(([d]) => d >= '2026-10-31')) };
  const summarize = (m) => {
    const { threads } = buildThreads(m, sorted(m), NOW.getTime());
    const groups = { moving: 0, week: 0, older: 0, archive: 0 };
    for (const t of threads) groups[groupKeyOf(t, NOW.getTime())]++;
    return { threads, groups };
  };

  it('the Stories page: one story fewer (two folded into others, one re-seated), the same ages otherwise', () => {
    const a = summarize(action.data), r = summarize(rec);
    expect([a.threads.length, r.threads.length]).toEqual([107, 106]);
    expect([a.groups, r.groups]).toEqual([{ moving: 30, week: 77, older: 0, archive: 0 }, { moving: 29, week: 77, older: 0, archive: 0 }]); // the merged story was one of the moving ones
    const ids = new Set(a.threads.map((t) => t.threadId)), rids = new Set(r.threads.map((t) => t.threadId));
    expect(r.threads.filter((t) => !ids.has(t.threadId)).map((t) => t.articleCount)).toEqual([2]); // one story under an id the archive did not have (entries re-seated)
    expect(a.threads.filter((t) => !rids.has(t.threadId)).length).toBe(2); // and two archive stories folded into stories the record keeps
  });

  it('the countries list: 15 of 63 countries change count, almost all up, because the record\'s iso3 names countries the archive\'s regions do not (United States 39 to 48)', () => {
    const rows = (m) => {
      const map = {};
      for (const day of Object.values(m)) for (const e of day.entries) for (const n of new Set((e.regions || []).map((x) => parentCountry(x)?.name).filter(Boolean))) map[n] = (map[n] || 0) + 1;
      return map;
    };
    const a = rows(action.data), r = rows(rec);
    const names = [...new Set([...Object.keys(a), ...Object.keys(r)])];
    const changed = names.filter((n) => (a[n] || 0) !== (r[n] || 0)).map((n) => [n, a[n] || 0, r[n] || 0]).sort();
    expect(names.length).toBe(63);
    expect(changed).toEqual([['Israel', 16, 18], ['Palestine', 5, 7], ['Yemen', 6, 7], ['United States', 39, 48], ['Iran', 6, 9], ['United Kingdom', 4, 6], ['France', 8, 9], ['Germany', 4, 5],
      ['Uganda', 1, 0], ['Italy', 1, 2], ['Ukraine', 13, 12], ['India', 3, 5], ['North Korea', 3, 4], ['Canada', 2, 5], ['Pakistan', 1, 2]].sort());
  });
});
