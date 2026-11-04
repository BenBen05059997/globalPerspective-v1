// useDailyBrief reads the record's briefs first (decision 0048) and asks the action for what the record does not hold: a date it lacks,
// and everything when it is not generated or cannot be read. While the views are fresh (decision 0050) they are the answer for the latest
// brief, today included; only views older than 9 hours send it back to the action for today's brief.
// Fixtures: live captures of 2026-10-31 (shared/api/__tests__/fixtures/briefs.json).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import fx from '@/shared/api/__tests__/fixtures/briefs.json';

const rv = vi.hoisted(() => ({ fetchBriefsIndex: vi.fn(), fetchDailyBriefView: vi.fn(), fetchManifest: vi.fn() }));
vi.mock('@/shared/api/restProxy', () => ({ fetchDailyBrief: vi.fn(), fetchLatestDailyBrief: vi.fn() }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchBriefsIndex: (...a) => rv.fetchBriefsIndex(...a), fetchDailyBriefView: (...a) => rv.fetchDailyBriefView(...a), fetchManifest: (...a) => rv.fetchManifest(...a) }) }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));

const latest = fx.action.latestDaily;
const built = (ageMs) => ({ builtAt: new Date(Date.now() - ageMs).toISOString() });

async function freshModule() {
  vi.resetModules();
  const restProxy = await import('@/shared/api/restProxy');
  const errorSink = await import('@/shared/api/errorSink.js');
  const hookModule = await import('@/shared/hooks/useDailyBrief.js');
  return { ...hookModule, fetchDailyBrief: restProxy.fetchDailyBrief, fetchLatestDailyBrief: restProxy.fetchLatestDailyBrief, reportFetchError: errorSink.reportFetchError };
}
const setNow = (iso) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };

describe('useDailyBrief from the record', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    rv.fetchBriefsIndex.mockResolvedValue(fx.index);
    rv.fetchDailyBriefView.mockImplementation(async (d) => fx.dailyViews[d] ?? null);
    rv.fetchManifest.mockImplementation(async () => built(0));
  });
  afterEach(() => vi.useRealTimers());

  it('latest: the record holds today\'s brief, so the action is not called at all', async () => {
    setNow('2026-10-30T20:00:00Z');
    const { useDailyBrief, fetchDailyBrief, fetchLatestDailyBrief } = await freshModule();
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(latest.data);
    expect(result.current.servedDateKey).toBe('2026-10-30');
    expect(fetchDailyBrief).not.toHaveBeenCalled();
    expect(fetchLatestDailyBrief).not.toHaveBeenCalled();
  });

  it('latest: the views are older than 9 hours (today\'s brief may not be built in), so the action is asked for today alone and its brief wins', async () => {
    setNow('2026-10-31T16:00:00Z');
    rv.fetchManifest.mockImplementation(async () => built(10 * 3600000));
    const { useDailyBrief, fetchDailyBrief, fetchLatestDailyBrief, loadLatestDailyBrief } = await freshModule();
    const todays = { ...latest.data, dateKey: '2026-10-31', headline: 'Today' };
    fetchDailyBrief.mockResolvedValue({ data: todays });
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(todays);
    expect(fetchDailyBrief).toHaveBeenCalledTimes(1);
    expect(fetchDailyBrief).toHaveBeenCalledWith('2026-10-31');
    expect(fetchLatestDailyBrief).not.toHaveBeenCalled();
    expect((await loadLatestDailyBrief()).editions.slice(0, 2)).toEqual(['2026-10-31', '2026-10-30']);
  });

  it('latest: fresh views and no brief for today yet, so the record\'s newest is served and the action is not asked (decision 0050)', async () => {
    setNow('2026-10-31T08:00:00Z');
    const { useDailyBrief, fetchDailyBrief, fetchLatestDailyBrief } = await freshModule();
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(latest.data);
    expect(result.current.servedDateKey).toBe('2026-10-30');
    expect(fetchDailyBrief).not.toHaveBeenCalled();
    expect(fetchLatestDailyBrief).not.toHaveBeenCalled();
  });

  it('latest: stale views and no brief for today yet, so the action is asked for today and the record\'s newest is served', async () => {
    setNow('2026-10-31T08:00:00Z');
    rv.fetchManifest.mockImplementation(async () => built(10 * 3600000));
    const { useDailyBrief, fetchDailyBrief, reportFetchError } = await freshModule();
    fetchDailyBrief.mockResolvedValue({ data: null });
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(latest.data);
    expect(result.current.servedDateKey).toBe('2026-10-30');
    expect(fetchDailyBrief).toHaveBeenCalledWith('2026-10-31');
    expect(reportFetchError).toHaveBeenCalledWith('record-views-stale', expect.any(Error));
  });

  it('latest: the record is not generated, so the latest_daily_brief action answers as before', async () => {
    setNow('2026-10-31T08:00:00Z');
    rv.fetchBriefsIndex.mockResolvedValue(null);
    const { useDailyBrief, fetchLatestDailyBrief } = await freshModule();
    fetchLatestDailyBrief.mockResolvedValue(latest);
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(latest.data);
    expect(fetchLatestDailyBrief).toHaveBeenCalledTimes(1);
  });

  it('latest: the record cannot be read, so the failure is reported and the action answers', async () => {
    setNow('2026-10-31T08:00:00Z');
    rv.fetchBriefsIndex.mockRejectedValue(new Error('record view 503 for index/briefs.json'));
    const { useDailyBrief, fetchLatestDailyBrief, reportFetchError } = await freshModule();
    fetchLatestDailyBrief.mockResolvedValue(latest);
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(latest.data);
    expect(reportFetchError).toHaveBeenCalledWith('briefs-index', expect.any(Error));
  });

  it('a date: the record\'s brief, with no action call', async () => {
    setNow('2026-10-31T08:00:00Z');
    const { useDailyBrief, fetchDailyBrief } = await freshModule();
    const { result } = renderHook(() => useDailyBrief('2026-10-30'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(latest.data);
    expect(fetchDailyBrief).not.toHaveBeenCalled();
  });

  describe('an explicit date with no edition', () => {
    const idx = { daily: [{ dateKey: '2026-11-03' }, { dateKey: '2026-10-20' }], weekly: [] };
    const views = async (d) => (idx.daily.some((x) => x.dateKey === d) ? { brief: { dateKey: d } } : null);
    const daysAsked = (fn) => fn.mock.calls.map((c) => c[0]);
    beforeEach(() => {
      rv.fetchBriefsIndex.mockResolvedValue(idx);
      rv.fetchDailyBriefView.mockImplementation(views);
    });

    it('serves the nearest earlier edition from the index, even after an older edition was viewed, asking the action for the requested day only', async () => {
      setNow('2026-11-04T08:00:00Z');
      const { useDailyBrief, fetchDailyBrief } = await freshModule();
      fetchDailyBrief.mockResolvedValue({ data: null });
      const old = renderHook(() => useDailyBrief('2026-10-20'));
      await waitFor(() => expect(old.result.current.servedDateKey).toBe('2026-10-20'));
      const { result } = renderHook(() => useDailyBrief('2026-11-04'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.servedDateKey).toBe('2026-11-03');
      expect(result.current.brief).toEqual({ dateKey: '2026-11-03' });
      expect(daysAsked(fetchDailyBrief)).toEqual(['2026-11-04']);
      await waitFor(() => expect(result.current.latestDateKey).toBe('2026-11-03'));
    });

    it('a day newer than the index that the action holds is served as itself', async () => {
      setNow('2026-11-04T08:00:00Z');
      const { useDailyBrief, fetchDailyBrief } = await freshModule();
      fetchDailyBrief.mockResolvedValue({ data: { dateKey: '2026-11-04' } });
      const { result } = renderHook(() => useDailyBrief('2026-11-04'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.servedDateKey).toBe('2026-11-04');
    });

    it('a gap inside the index costs no action call', async () => {
      setNow('2026-11-04T08:00:00Z');
      const { useDailyBrief, fetchDailyBrief } = await freshModule();
      const { result } = renderHook(() => useDailyBrief('2026-10-25'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.servedDateKey).toBe('2026-10-20');
      expect(fetchDailyBrief).not.toHaveBeenCalled();
    });

    it('stale views: the action is probed only for the days after the index\'s newest edition, never more than 8 calls', async () => {
      setNow('2026-11-20T08:00:00Z');
      rv.fetchManifest.mockImplementation(async () => built(10 * 3600000));
      const { useDailyBrief, fetchDailyBrief } = await freshModule();
      fetchDailyBrief.mockResolvedValue({ data: null });
      const { result } = renderHook(() => useDailyBrief('2026-11-19'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      const probed = daysAsked(fetchDailyBrief).filter((d) => d !== '2026-11-20'); // today is the latest lookup's own call (stale views)
      expect(probed.length).toBeLessThanOrEqual(8);
      expect(probed).toContain('2026-11-19');
      expect(probed.every((d) => d > '2026-11-03')).toBe(true);
      expect(result.current.servedDateKey).toBe('2026-11-03');
    });

    it('no index: the action is probed for the requested day and the 7 before it, nearest wins', async () => {
      setNow('2026-11-04T08:00:00Z');
      rv.fetchBriefsIndex.mockResolvedValue(null);
      const { useDailyBrief, fetchDailyBrief } = await freshModule();
      fetchDailyBrief.mockImplementation(async (d) => ({ data: d <= '2026-11-02' ? { dateKey: d } : null }));
      const { result } = renderHook(() => useDailyBrief('2026-11-04'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetchDailyBrief).toHaveBeenCalledTimes(8);
      expect(result.current.servedDateKey).toBe('2026-11-02');
    });

    it('a future day is not asked for: the newest earlier edition is served', async () => {
      setNow('2026-11-04T08:00:00Z');
      const { useDailyBrief, fetchDailyBrief } = await freshModule();
      const { result } = renderHook(() => useDailyBrief('2026-11-05'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.servedDateKey).toBe('2026-11-03');
      expect(fetchDailyBrief).not.toHaveBeenCalled();
    });

    it.each(['2026-13-45', '2026-02-30', 'tomorrow'])('an impossible date (%s) is treated as no date: the latest edition, no error', async (bad) => {
      setNow('2026-11-04T08:00:00Z');
      const { useDailyBrief, fetchDailyBrief } = await freshModule();
      const { result } = renderHook(() => useDailyBrief(bad));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBeNull();
      expect(result.current.servedDateKey).toBe('2026-11-03');
      expect(result.current.latestDateKey).toBe('2026-11-03');
      expect(fetchDailyBrief).not.toHaveBeenCalled();
    });
  });
});
