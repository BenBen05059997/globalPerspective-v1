// The track record page reads the record view first (decision 0044). Fixtures: trackRecordView.json is the view built from a
// read-only copy of the live record on 2026-10-31 (newsStoryRecord trackRecord.js); trackRecordAction.json is the live
// `prediction_track_record` payload of the same hour (curl, pools shortened). The two must give the page the same view model.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, render, screen, fireEvent } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchPredictionTrackRecord: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchTrackRecordView: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/restProxy.js', () => api);
vi.mock('@/shared/api/recordViews.js', () => rv);
vi.mock('@/shared/api/errorSink.js', () => sink);

import view from '@/features/track-record/__tests__/fixtures/trackRecordView.json';
import action from '@/features/track-record/__tests__/fixtures/trackRecordAction.json';
import { useTrackRecord } from '@/features/track-record/hooks/useTrackRecord.js';
import { trackRecordFromView } from '@/features/track-record/lib/trackRecordFromView.js';
import { buildTrackRecordView } from '@/features/track-record/lib/trackRecordView.js';
import { loadDrawPool } from '@/features/track-record/lib/drawPool.js';
import DrawRow from '@/features/track-record/components/DrawRow.jsx';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const NOW = new Date('2026-10-31T12:00:00Z');

beforeEach(() => {
  clearMemoryCache(); localStorage.clear();
  api.fetchPredictionTrackRecord.mockReset(); rv.fetchTrackRecordView.mockReset(); sink.reportFetchError.mockReset();
});

// what the record does not hold, or holds differently on the day of capture: see the decision (0044)
const stripped = (m) => {
  const out = JSON.parse(JSON.stringify(m));
  for (const w of out.q.weeks) { delete w.draw; delete w.reviewed; }
  delete out.q.schema; delete out.q.builtAt; delete out.q.settleHealth;
  // questions due on the same day in one week come in scan order from the action and in draw order from the record
  const byQid = (x, y) => x.qid.localeCompare(y.qid);
  out.q.sampled.sort(byQid); out.boardItems.sort(byQid);
  return out;
};

describe('the page model from the record view equals the one from the action', () => {
  const fromAction = buildTrackRecordView(action.data, NOW);
  const fromView = buildTrackRecordView(trackRecordFromView(view), NOW);

  it('every field the page derives is equal, except the issued count (two 2026-10-10 forecasts never reached the facts, and the newest day lags)', () => {
    const a = stripped(fromAction);
    const v = stripped(fromView);
    expect([v.q.issued, a.q.issued]).toEqual([5259, 5283]);
    a.q.issued = v.q.issued;
    expect(v).toEqual(a);
  });

  it('the pilot-era fields are the action\'s, except legacyPredictionsExcluded (2418 legacy PRED rows; the action also counted the question scheme\'s own rows)', () => {
    const data = trackRecordFromView(view);
    expect(data.eraCutFrom).toBe(action.data.eraCutFrom);
    expect(data.totalDatedTriggers).toBe(action.data.totalDatedTriggers);
    expect(data.resolvedTriggers).toBe(action.data.resolvedTriggers);
    expect(data.recent).toEqual(action.data.recent);
    expect([data.legacyPredictionsExcluded, action.data.legacyPredictionsExcluded]).toEqual([2418, 2546]);
    expect(Object.keys(data).sort()).toEqual(['eraCutFrom', 'legacyPredictionsExcluded', 'questions', 'recent', 'resolvedTriggers', 'totalDatedTriggers']);
  });

  it('the questions block matches field by field (qid-keyed), apart from issued and the parts the record leaves out', () => {
    const key = (xs) => Object.fromEntries(xs.map((s) => [s.qid, s]));
    const a = JSON.parse(JSON.stringify(action.data.questions));
    const v = JSON.parse(JSON.stringify(view.questions));
    for (const w of a.weeks) { delete w.draw; delete w.reviewed; }
    delete a.schema; delete a.builtAt; delete a.settleHealth; a.issued = v.issued;
    a.sampled = key(a.sampled); v.sampled = key(v.sampled);
    expect(v).toEqual(a);
  });
});

describe('useTrackRecord', () => {
  it('reads the record view and does not call the action', async () => {
    rv.fetchTrackRecordView.mockResolvedValue(view);
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.questions.sampledTotal).toBe(66);
    expect(result.current.data.totalDatedTriggers).toBe(20963);
    expect(api.fetchPredictionTrackRecord).not.toHaveBeenCalled();
  });

  it('falls back to the action when the view is not generated (404 -> null)', async () => {
    rv.fetchTrackRecordView.mockResolvedValue(null);
    api.fetchPredictionTrackRecord.mockResolvedValue({ success: true, data: action.data });
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.questions.issued).toBe(5283);
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('a failed view read is reported, then the action answers', async () => {
    rv.fetchTrackRecordView.mockRejectedValue(new Error('record view 500 for track-record.json'));
    api.fetchPredictionTrackRecord.mockResolvedValue({ success: true, data: action.data });
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sink.reportFetchError).toHaveBeenCalledWith('track-record-view', expect.any(Error));
    expect(result.current.data.questions.issued).toBe(5283);
  });

  it('a view of another shape is ignored; with no action data either, the page gets nothing (it shows its honest empty state)', async () => {
    rv.fetchTrackRecordView.mockResolvedValue({ schemaVersion: 2 });
    api.fetchPredictionTrackRecord.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });
});

describe('Verify this draw with a record-view week (no draw on the week: the action is the fallback)', () => {
  const weeks = trackRecordFromView(view).questions.weeks;

  it('loadDrawPool takes the week\'s draw from the action payload', async () => {
    api.fetchPredictionTrackRecord.mockResolvedValue({ success: true, data: action.data });
    const draw = await loadDrawPool('2026-W41');
    expect(draw.K).toBe(22);
    expect(draw.picked.length).toBe(22);
    api.fetchPredictionTrackRecord.mockResolvedValue({ success: false });
    expect(await loadDrawPool('2026-W41')).toBeNull();
  });

  it('pressing Verify asks for the draw of the last drawn week', async () => {
    const loadDraw = vi.fn().mockResolvedValue(null);
    render(<DrawRow weeks={weeks} now={NOW} loadDraw={loadDraw} />);
    fireEvent.click(screen.getByRole('button', { name: /Verify this draw/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/not published for this week/));
    const last = [...weeks].reverse().find((w) => w.drawn).weekId;
    expect(loadDraw).toHaveBeenCalledWith(last);
  });

  it('without a way to load the pool, a week with no draw offers no Verify control', () => {
    render(<DrawRow weeks={weeks} now={NOW} />);
    expect(screen.queryByRole('button', { name: /Verify this draw/ })).not.toBeInTheDocument();
  });
});

describe('Verify this draw with a draw in the view (decision 0052)', () => {
  it('a week that carries its draw is verified from the view, without asking the action', async () => {
    const { drawFromPool, sha256Hex } = await import('@/features/track-record/lib/sampleRule.js');
    const seedHex = 'ab'.repeat(32);
    const pool = [{ q: 'q1', c: 'th-a' }, { q: 'q2', c: 'th-a' }, { q: 'q3', c: 'th-b' }];
    const drawn = await drawFromPool(seedHex, pool, 22);
    const week = {
      weekId: '2026-W43', weekStart: '2026-10-19', commit: { hash: await sha256Hex(seedHex), committedAt: '2026-10-05T10:30:00.000Z' }, reveal: { seedHex, revealedAt: '2026-10-26T10:30:00.000Z' },
      drawn: true, eligible: 3, clusters: 2, picked: drawn.picked.length, due: 0, settled: 0, void: 0, draw: { K: 22, pool, picked: drawn.picked },
    };
    const loadDraw = vi.fn();
    render(<DrawRow weeks={[week]} now={NOW} loadDraw={loadDraw} />);
    fireEvent.click(screen.getByRole('button', { name: /Verify this draw/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/verified|matches|confirmed|recomputed/i));
    expect(loadDraw).not.toHaveBeenCalled();
  });
});
