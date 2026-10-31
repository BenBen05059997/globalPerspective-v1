// The briefs from the record (decision 0048) against live captures of 2026-10-31 (fixtures/briefs.json): the live latest_daily_brief
// and weekly_brief answers, and the views newsStoryRecord builds from the same live DAILY_BRIEF# / WEEKLY_BRIEF# rows. The record's
// answers must equal the actions' answers (data, dateKey, editions); anything the record does not hold answers null (the hooks then
// ask the action); a failed read is reported, never turned into "no brief".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fx from './fixtures/briefs.json';

const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/errorSink.js', () => sink);

import { loadBriefsIndex, clearBriefsIndexCache, briefsIndexUsable, dailyEditions, weekAgeDays, readDailyBrief, readLatestDaily, readWeeklyBrief } from '@/shared/api/briefViews.js';

const views = (over = {}) => ({
  fetchBriefsIndex: vi.fn(async () => fx.index),
  fetchDailyBriefView: vi.fn(async (d) => fx.dailyViews[d] ?? null),
  fetchWeeklyBriefView: vi.fn(async (w) => fx.weeklyViews[w] ?? null),
  ...over,
});
const latest = fx.action.latestDaily;
const weekly = fx.action.weekly;

beforeEach(() => { clearBriefsIndexCache(); sink.reportFetchError.mockReset(); });

describe('the latest daily brief equals the latest_daily_brief action', () => {
  it('data, dateKey and editions (the dates with a brief in the 30-day window, newest first)', async () => {
    const got = await readLatestDaily({ today: '2026-10-31', lookbackDays: 30 }, views());
    expect(got.data).toEqual(latest.data);
    expect(got.dateKey).toBe(latest.dateKey);
    expect(got.editions).toEqual(latest.editions);
    expect(latest.editions.length).toBe(22);
  });

  it('reads the index and one view, nothing else', async () => {
    const v = views();
    await readLatestDaily({ today: '2026-10-31', lookbackDays: 30 }, v);
    expect(v.fetchBriefsIndex).toHaveBeenCalledTimes(1);
    expect(v.fetchDailyBriefView).toHaveBeenCalledWith('2026-10-30');
    expect(v.fetchDailyBriefView).toHaveBeenCalledTimes(1);
  });

  it('a window with no brief answers null (the caller asks the action), and so does a view that is missing', async () => {
    expect(await readLatestDaily({ today: '2026-12-31', lookbackDays: 30 }, views())).toBeNull();
    expect(await readLatestDaily({ today: '2026-10-31', lookbackDays: 30 }, views({ fetchDailyBriefView: async () => null }))).toBeNull();
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });
});

describe('a daily brief by date', () => {
  it('is the view\'s brief, with iso3 on every story as the action gives it', async () => {
    const got = await readDailyBrief('2026-10-30', views());
    expect(got).toEqual(latest.data);
    expect(got.topStories.every((s) => Array.isArray(s.iso3))).toBe(true);
  });

  it('a date the index does not list is answered without a request for it', async () => {
    const v = views();
    expect(await readDailyBrief('2026-10-13', v)).toBeNull();
    expect(v.fetchDailyBriefView).not.toHaveBeenCalled();
  });

  it('a listed date whose view cannot be read is reported and answers null', async () => {
    const v = views({ fetchDailyBriefView: vi.fn(async () => { throw new Error('record view 500 for briefs/daily/2026-10-30.json'); }) });
    expect(await readDailyBrief('2026-10-30', v)).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledWith('daily-brief-view', expect.any(Error));
  });
});

describe('the weekly brief equals the weekly_brief action', () => {
  it('the newest published brief', async () => {
    expect(await readWeeklyBrief(null, views())).toEqual(weekly.data);
  });

  it('a past week by its weekOf; an unlisted week (a draft, a typo) is null', async () => {
    const got = await readWeeklyBrief('2026-10-18', views());
    expect(got.weekOf).toBe('2026-10-18');
    expect(got.status).toBe('published');
    expect(await readWeeklyBrief('2026-06-21', views())).toBeNull(); // a draft: in no view, in no index
    expect(fx.index.weekly.some((w) => w.weekOf === '2026-06-21')).toBe(false);
  });

  it('the signals carry iso3 and the sources the action gives', async () => {
    const got = await readWeeklyBrief(null, views());
    expect(got.signals.map((s) => s.iso3)).toEqual(weekly.data.signals.map((s) => s.iso3));
    expect(got.signals.every((s) => s.sources.length > 0)).toBe(true);
  });
});

describe('the index', () => {
  it('is usable when it lists daily and weekly briefs; anything else is not', () => {
    expect(briefsIndexUsable(fx.index)).toBe(true);
    for (const bad of [null, {}, { daily: [] }, { daily: {}, weekly: [] }]) expect(briefsIndexUsable(bad)).toBe(false);
  });

  it('one request is shared by every caller; a miss is not kept', async () => {
    const v = views();
    await Promise.all([loadBriefsIndex(v), loadBriefsIndex(v), readDailyBrief('2026-10-30', v)]);
    expect(v.fetchBriefsIndex).toHaveBeenCalledTimes(1);
    clearBriefsIndexCache();
    const miss = views({ fetchBriefsIndex: vi.fn(async () => null) });
    expect(await loadBriefsIndex(miss)).toBeNull();
    await Promise.resolve();
    await loadBriefsIndex(miss);
    expect(miss.fetchBriefsIndex).toHaveBeenCalledTimes(2);
  });

  it('a failed read is reported once and answers null for every reader', async () => {
    const down = views({ fetchBriefsIndex: vi.fn(async () => { throw new Error('record view 503 for index/briefs.json'); }) });
    expect(await readLatestDaily({ today: '2026-10-31', lookbackDays: 30 }, down)).toBeNull();
    expect(await readWeeklyBrief(null, down)).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledWith('briefs-index', expect.any(Error));
  });

  it('dailyEditions bounds the window by days, weekAgeDays counts whole days', () => {
    expect(dailyEditions(fx.index, '2026-10-31', 7)).toEqual(['2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27', '2026-10-26', '2026-10-25']);
    expect(dailyEditions(fx.index, '2026-10-31', 30)[0]).toBe('2026-10-30');
    expect(weekAgeDays('2026-10-25', '2026-10-31')).toBe(6);
    expect(weekAgeDays('2026-10-25', '2026-11-01')).toBe(7);
  });
});
