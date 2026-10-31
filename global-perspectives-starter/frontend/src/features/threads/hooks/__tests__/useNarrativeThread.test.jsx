// useNarrativeThread: the story view answers alone while the views are fresh (they carry today's entries, provisional until the
// nightly run, decision 0050); a story with no view, or views older than 9 hours, ask the narrative_thread action as before.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const rv = vi.hoisted(() => ({ fetchStoryView: vi.fn(), fetchManifest: vi.fn() }));
const api = vi.hoisted(() => ({ fetchNarrativeThread: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/restProxy', () => api);
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchStoryView: (...a) => rv.fetchStoryView(...a), fetchManifest: (...a) => rv.fetchManifest(...a) }) }));
vi.mock('@/shared/api/errorSink', () => sink);
vi.mock('@/shared/api/errorSink.js', () => sink);

import { useNarrativeThread } from '@/features/threads/hooks/useNarrativeThread.js';
import { clearViewsFreshCache } from '@/shared/api/viewsFresh.js';

const entry = (title, date, extra = {}) => ({ eventId: title, date, at: `${date}T04:00:00.000Z`, title, category: 'conflict', eventType: null, iso3: ['FRA'], sources: [{ outlet: 'BBC', url: `https://bbc.test/${title}` }], topicId: title, ...extra });
const view = { threadId: 't1', builtFrom: { factsThrough: '2026-10-30', provisionalThrough: '2026-10-31' }, entries: [entry('Old', '2026-10-30'), entry('Today', '2026-10-31', { provisional: true })] };
const archive = [{ title: 'Today', date: '2026-10-31', threadId: 't1', sources: [], fromArchive: true }];
const built = (ageMs) => ({ builtAt: new Date(Date.now() - ageMs).toISOString() });
const load = async (id) => {
  const { result } = renderHook(() => useNarrativeThread(id));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
};

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  clearViewsFreshCache();
  rv.fetchStoryView.mockResolvedValue(view);
  rv.fetchManifest.mockImplementation(async () => built(1800000));
  api.fetchNarrativeThread.mockResolvedValue({ data: archive });
});

describe('useNarrativeThread', () => {
  it('fresh views: the view alone, today\'s provisional entry included, and no narrative_thread call', async () => {
    const r = await load('t1');
    expect(r.entries.map((e) => e.title)).toEqual(['Old', 'Today']);
    expect(api.fetchNarrativeThread).not.toHaveBeenCalled();
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('stale views: the action supplies the entries after the view\'s last day (provisional included), and the staleness is reported', async () => {
    rv.fetchManifest.mockImplementation(async () => built(10 * 3600000));
    const r = await load('t1');
    expect(api.fetchNarrativeThread).toHaveBeenCalledWith('t1');
    expect(r.entries.map((e) => e.title)).toEqual(['Old', 'Today']);
    api.fetchNarrativeThread.mockResolvedValue({ data: [...archive, { title: 'Later', date: '2026-11-01', threadId: 't1', sources: [] }] });
    sessionStorage.clear();
    expect((await load('t1')).entries.map((e) => e.title)).toEqual(['Old', 'Today', 'Later']);
    expect(sink.reportFetchError).toHaveBeenCalledWith('record-views-stale', expect.any(Error));
  });

  it('a story with no view asks the action, fresh views or not', async () => {
    rv.fetchStoryView.mockResolvedValue(null);
    const r = await load('t2');
    expect(api.fetchNarrativeThread).toHaveBeenCalledWith('t2');
    expect(r.entries).toEqual(archive);
  });

  it('a view that cannot be read is reported and the action answers', async () => {
    rv.fetchStoryView.mockRejectedValue(new Error('record view 502 for stories/t3.json'));
    const r = await load('t3');
    expect(sink.reportFetchError).toHaveBeenCalledWith('story-view', expect.any(Error));
    expect(r.entries).toEqual(archive);
  });
});
