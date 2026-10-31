// useDailyBrief reads the record's briefs first (decision 0048) and asks the action for what the record does not hold: today's
// brief (the views are rebuilt nightly), a date it lacks, and everything when it is not generated or cannot be read.
// Fixtures: live captures of 2026-10-31 (shared/api/__tests__/fixtures/briefs.json).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import fx from '@/shared/api/__tests__/fixtures/briefs.json';

const rv = vi.hoisted(() => ({ fetchBriefsIndex: vi.fn(), fetchDailyBriefView: vi.fn() }));
vi.mock('@/shared/api/restProxy', () => ({ fetchDailyBrief: vi.fn(), fetchLatestDailyBrief: vi.fn() }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchBriefsIndex: (...a) => rv.fetchBriefsIndex(...a), fetchDailyBriefView: (...a) => rv.fetchDailyBriefView(...a) }) }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));

const latest = fx.action.latestDaily;

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

  it('latest: the record is behind (today\'s brief is not built in yet), so the action is asked for today alone and its brief wins', async () => {
    setNow('2026-10-31T16:00:00Z');
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

  it('latest: no brief for today yet, so the record\'s newest is served', async () => {
    setNow('2026-10-31T08:00:00Z');
    const { useDailyBrief, fetchDailyBrief } = await freshModule();
    fetchDailyBrief.mockResolvedValue({ data: null });
    const { result } = renderHook(() => useDailyBrief());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.brief).toEqual(latest.data);
    expect(result.current.servedDateKey).toBe('2026-10-30');
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
});
