// The track record page reads the record view only (decisions 0044, 0052). Fixture: trackRecordView.json is the view built from a
// read-only copy of the live record on 2026-10-31 (newsStoryRecord trackRecord.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, render, screen, fireEvent } from '@testing-library/react';

const rv = vi.hoisted(() => ({ fetchTrackRecordView: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/recordViews.js', () => rv);
vi.mock('@/shared/api/errorSink.js', () => sink);

import view from '@/features/track-record/__tests__/fixtures/trackRecordView.json';
import { useTrackRecord } from '@/features/track-record/hooks/useTrackRecord.js';
import { trackRecordFromView } from '@/features/track-record/lib/trackRecordFromView.js';
import { buildTrackRecordView } from '@/features/track-record/lib/trackRecordView.js';
import DrawRow from '@/features/track-record/components/DrawRow.jsx';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const NOW = new Date('2026-10-31T12:00:00Z');

beforeEach(() => {
  clearMemoryCache(); localStorage.clear();
  rv.fetchTrackRecordView.mockReset(); sink.reportFetchError.mockReset();
});

describe('the page model from the record view', () => {
  const data = trackRecordFromView(view);

  it('the data has the pilot-era fields and the question scheme, nothing else', () => {
    expect(Object.keys(data).sort()).toEqual(['eraCutFrom', 'legacyPredictionsExcluded', 'questions', 'recent', 'resolvedTriggers', 'totalDatedTriggers']);
    expect(data.legacyPredictionsExcluded).toBe(2418);
  });

  it('builds the page model from it', () => {
    const model = buildTrackRecordView(data, NOW);
    expect(model.q.issued).toBe(view.questions.issued);
    expect(model.q.weeks.length).toBe(view.questions.weeks.length);
  });
});

describe('useTrackRecord (the record view is the only source)', () => {
  it('reads the record view', async () => {
    rv.fetchTrackRecordView.mockResolvedValue(view);
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.questions.sampledTotal).toBe(66);
    expect(result.current.data.totalDatedTriggers).toBe(20963);
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('a view not generated (404 -> null): no data, reported once', async () => {
    rv.fetchTrackRecordView.mockResolvedValue(null);
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledTimes(1);
    expect(sink.reportFetchError).toHaveBeenCalledWith('track-record-view', expect.any(Error));
  });

  it('a failed view read: no data, reported once', async () => {
    rv.fetchTrackRecordView.mockRejectedValue(new Error('record view 500 for track-record.json'));
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledTimes(1);
    expect(sink.reportFetchError).toHaveBeenCalledWith('track-record-view', expect.any(Error));
  });

  it('a view of another shape: no data, reported once', async () => {
    rv.fetchTrackRecordView.mockResolvedValue({ schemaVersion: 2 });
    const { result } = renderHook(() => useTrackRecord());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledTimes(1);
  });
});

describe('Verify this draw with a record-view week that has no draw', () => {
  const weeks = trackRecordFromView(view).questions.weeks;

  it('a drawn week without a draw offers no Verify control', () => {
    render(<DrawRow weeks={weeks.map((w) => ({ ...w, draw: undefined }))} now={NOW} />);
    expect(screen.queryByRole('button', { name: /Verify this draw/ })).not.toBeInTheDocument();
  });
});

describe('Verify this draw with a draw in the view (decision 0052)', () => {
  it('a week that carries its draw is verified from the view', async () => {
    const { drawFromPool, sha256Hex } = await import('@/features/track-record/lib/sampleRule.js');
    const seedHex = 'ab'.repeat(32);
    const pool = [{ q: 'q1', c: 'th-a' }, { q: 'q2', c: 'th-a' }, { q: 'q3', c: 'th-b' }];
    const drawn = await drawFromPool(seedHex, pool, 22);
    const week = {
      weekId: '2026-W43', weekStart: '2026-10-19', commit: { hash: await sha256Hex(seedHex), committedAt: '2026-10-05T10:30:00.000Z' }, reveal: { seedHex, revealedAt: '2026-10-26T10:30:00.000Z' },
      drawn: true, eligible: 3, clusters: 2, picked: drawn.picked.length, due: 0, settled: 0, void: 0, draw: { K: 22, pool, picked: drawn.picked },
    };
    render(<DrawRow weeks={[week]} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: /Verify this draw/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/verified|matches|confirmed|recomputed/i));
  });
});
