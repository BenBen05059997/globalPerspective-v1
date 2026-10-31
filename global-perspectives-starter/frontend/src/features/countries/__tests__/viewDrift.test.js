import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { driftFromCountryView, combineDrift } from '@/features/countries/lib/viewDrift.js';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';
// Captured live 2026-10-31 (read-only, anonymous): the `country_history` response for Iran, snapshots trimmed to
// three, so the drift list is the one note an anonymous reader gets of 18 (driftNotesTotal 18, driftNotesGated true).
// The country view is built from that same note the way backend/record/newsStoryRecord/src/views.js (countryViews)
// writes it: the stored item plus generatedAt and model. `model` is the builder's field; its value here is a
// stand-in, as the action does not return it.
import history from './fixtures/countryHistoryAction.json';
import iranView from './fixtures/countryViewIran.json';

const fetchCountryHistory = vi.fn();
vi.mock('@/shared/api/restProxy.js', () => ({ fetchCountryHistory: (...a) => fetchCountryHistory(...a) }));
import { useCountryHistory } from '@/features/countries/hooks/useCountryHistory.js';

// What CountryWhatChanged / pickLatestChange / latestChange read off a note.
const READ_FIELDS = ['asOf', 'changeDimensions', 'changeScore', 'currentDimensions', 'currentHeadline', 'currentLead', 'currentRiskLevel',
  'currentRiskScore', 'noSingleDriver', 'priorHeadline', 'since', 'triggerEvent', 'whyChanged', 'generatedAt', 'countryName'];

describe('driftFromCountryView', () => {
  it('equals the notes country_history returned for the same country, whole and field by field', () => {
    const mapped = driftFromCountryView(iranView);
    expect(mapped).toEqual(history.driftNotes);
    for (const f of READ_FIELDS) expect(mapped[0][f], f).toEqual(history.driftNotes[0][f]);
    expect(mapped[0]).not.toHaveProperty('model');
  });

  it('answers [] for a view without drift, or no view', () => {
    expect(driftFromCountryView({ ...iranView, drift: [] })).toEqual([]);
    expect(driftFromCountryView({ success: true, data: {} })).toEqual([]);
    expect(driftFromCountryView(null)).toEqual([]);
  });
});

describe('combineDrift', () => {
  it('shows the view notes, keeping the action total and gate', () => {
    expect(combineDrift(iranView, history)).toEqual({ driftNotes: history.driftNotes, total: 18, gated: true });
  });

  it('cuts a longer view to the depth the action allowed this reader', () => {
    const older = { ...iranView.drift[0], asOf: '2026-08-18' };
    const long = { ...iranView, drift: [iranView.drift[0], older] };
    expect(combineDrift(long, history).driftNotes).toHaveLength(1);
  });

  it('keeps the action notes when the view is missing or holds fewer', () => {
    expect(combineDrift(null, history).driftNotes).toEqual(history.driftNotes);
    const member = { ...history, driftNotes: [history.driftNotes[0], { ...history.driftNotes[0], asOf: '2026-08-18' }], driftNotesGated: false };
    expect(combineDrift(iranView, member).driftNotes).toBe(member.driftNotes);
  });
});

describe('useCountryHistory', () => {
  beforeEach(() => { clearMemoryCache(); localStorage.clear(); fetchCountryHistory.mockReset(); fetchCountryHistory.mockResolvedValue(history); });

  it('reads /countries/IRN.json and gives the same notes and gate as the action', async () => {
    const seen = [];
    globalThis.fetch = vi.fn((url) => { seen.push(url); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(iranView) }); });
    const { result } = renderHook(() => useCountryHistory('Iran'));
    await waitFor(() => expect(result.current.snapshots.length).toBeGreaterThan(0));
    expect(seen).toEqual(['/data/record/views/countries/IRN.json']);
    expect(result.current.driftNotes).toEqual(history.driftNotes);
    expect(result.current.driftNotesTotal).toBe(18);
    expect(result.current.driftNotesGated).toBe(true);
  });

  it('falls back to the action notes on a 404', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    const { result } = renderHook(() => useCountryHistory('Iran'));
    await waitFor(() => expect(result.current.snapshots.length).toBeGreaterThan(0));
    expect(result.current.driftNotes).toEqual(history.driftNotes);
  });

  it('falls back when the view fetch fails', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')));
    const { result } = renderHook(() => useCountryHistory('Iran'));
    await waitFor(() => expect(result.current.snapshots.length).toBeGreaterThan(0));
    expect(result.current.driftNotes).toEqual(history.driftNotes);
  });
});
