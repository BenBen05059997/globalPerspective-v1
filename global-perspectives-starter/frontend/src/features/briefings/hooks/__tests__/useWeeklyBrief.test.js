// useWeeklyBrief reads the record's weekly brief first (decision 0048). The newest one is the record's while the views are fresh (they
// are rebuilt right after the Sunday brief, decision 0050); views older than 9 hours send it to the action and the newer of the two wins.
// Fixtures: live captures of 2026-10-31 (shared/api/__tests__/fixtures/briefs.json).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import fx from '@/shared/api/__tests__/fixtures/briefs.json';

const rv = vi.hoisted(() => ({ fetchBriefsIndex: vi.fn(), fetchWeeklyBriefView: vi.fn(), fetchManifest: vi.fn() }));
const api = vi.hoisted(() => ({ fetchWeeklyBrief: vi.fn() }));
vi.mock('@/shared/api/restProxy', () => api);
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchBriefsIndex: (...a) => rv.fetchBriefsIndex(...a), fetchWeeklyBriefView: (...a) => rv.fetchWeeklyBriefView(...a), fetchManifest: (...a) => rv.fetchManifest(...a) }) }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));

import { useWeeklyBrief } from '@/features/briefings/hooks/useWeeklyBrief.js';
import { clearBriefsIndexCache } from '@/shared/api/briefViews.js';
import { clearViewsFreshCache } from '@/shared/api/viewsFresh.js';

const live = fx.action.weekly.data; // weekOf 2026-10-25
const built = (ageMs) => ({ builtAt: new Date(Date.now() - ageMs).toISOString() });
const setNow = (iso) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };
const load = async (week) => {
  const { result } = renderHook(() => useWeeklyBrief(week));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  clearBriefsIndexCache();
  clearViewsFreshCache();
  rv.fetchManifest.mockImplementation(async () => built(0));
  rv.fetchBriefsIndex.mockResolvedValue(fx.index);
  rv.fetchWeeklyBriefView.mockImplementation(async (w) => fx.weeklyViews[w] ?? null);
  api.fetchWeeklyBrief.mockResolvedValue(fx.action.weekly);
});
afterEach(() => vi.useRealTimers());

describe('useWeeklyBrief', () => {
  it('latest, fresh views: the record\'s brief, equal to the action\'s, and no action call', async () => {
    setNow('2026-10-31T08:00:00Z');
    const r = await load();
    expect(r.brief).toEqual(live);
    expect(r.error).toBeNull();
    expect(api.fetchWeeklyBrief).not.toHaveBeenCalled();
  });

  it('latest, fresh views a week on (the Sunday brief is built in right after it is written): still no action call', async () => {
    setNow('2026-11-01T10:00:00Z');
    expect((await load()).brief).toEqual(live);
    expect(api.fetchWeeklyBrief).not.toHaveBeenCalled();
  });

  it('latest, stale views (the new Sunday brief may not be built in): the action is asked, a newer brief wins, the staleness is reported', async () => {
    setNow('2026-11-01T10:00:00Z');
    rv.fetchManifest.mockImplementation(async () => built(10 * 3600000));
    const newer = { ...live, weekOf: '2026-11-01', asOf: '2026-11-01' };
    api.fetchWeeklyBrief.mockResolvedValue({ success: true, data: newer });
    expect((await load()).brief).toEqual(newer);
    expect(api.fetchWeeklyBrief).toHaveBeenCalledWith(null);
  });

  it('latest, stale views and the action has nothing newer: the record\'s brief', async () => {
    setNow('2026-11-01T10:00:00Z');
    rv.fetchManifest.mockImplementation(async () => built(10 * 3600000));
    expect((await load()).brief).toEqual(live);
  });

  it('a week: the record\'s brief of that week; a week the record lacks asks the action', async () => {
    setNow('2026-10-31T08:00:00Z');
    expect((await load('2026-10-18')).brief.weekOf).toBe('2026-10-18');
    expect(api.fetchWeeklyBrief).not.toHaveBeenCalled();
    localStorage.clear();
    api.fetchWeeklyBrief.mockResolvedValue({ success: true, data: null });
    expect((await load('2026-06-21')).brief).toBeNull(); // a draft: nothing is published for it
    expect(api.fetchWeeklyBrief).toHaveBeenCalledWith('2026-06-21');
  });

  it('the record is not generated: the weekly_brief action answers as before', async () => {
    setNow('2026-10-31T08:00:00Z');
    rv.fetchBriefsIndex.mockResolvedValue(null);
    expect((await load()).brief).toEqual(live);
    expect(api.fetchWeeklyBrief).toHaveBeenCalledTimes(1);
  });

  it('an action failure with nothing in the record is an error, not an empty brief', async () => {
    setNow('2026-10-31T08:00:00Z');
    rv.fetchBriefsIndex.mockResolvedValue(null);
    api.fetchWeeklyBrief.mockRejectedValue(new Error('Proxy HTTP 502'));
    const r = await load();
    expect(r.brief).toBeNull();
    expect(r.error).toMatch(/502/);
  });
});
