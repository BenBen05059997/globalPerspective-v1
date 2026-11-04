// The corrections ledger (hook cache + error, one line helper for both pages) and the state words.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

let authUser = null;
const fetchCorrectionsFeed = vi.fn();
const reportFetchError = vi.fn();
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/shared/api/restProxy.js', () => ({ fetchCorrectionsFeed: (...a) => fetchCorrectionsFeed(...a) }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: (...a) => reportFetchError(...a) }));

import { useCorrectionsFeed } from '@/features/track-record/hooks/useCorrectionsFeed';
import { ledgerLine, ledgerGateText } from '@/features/track-record/lib/ledgerLine.js';
import { questionLine } from '@/features/track-record/lib/questionLine.js';

const ok = (notes, extra = {}) => ({ success: true, notes, total: notes.length, gated: false, ...extra });

describe('useCorrectionsFeed', () => {
  beforeEach(() => { localStorage.clear(); authUser = null; fetchCorrectionsFeed.mockReset(); reportFetchError.mockReset(); });

  it('keys the cache by limit and by who is signed in, so a member ledger never reaches an anonymous reader', async () => {
    fetchCorrectionsFeed.mockResolvedValueOnce(ok([{ name: 'a' }], { total: 9, gated: true }));
    const anon = renderHook(() => useCorrectionsFeed(40));
    await waitFor(() => expect(anon.result.current.loading).toBe(false));
    expect(anon.result.current.gated).toBe(true);

    authUser = { uid: 'member-1' };
    fetchCorrectionsFeed.mockResolvedValueOnce(ok([{ name: 'a' }, { name: 'b' }], { total: 9 }));
    const member = renderHook(() => useCorrectionsFeed(40));
    await waitFor(() => expect(member.result.current.loading).toBe(false));
    expect(member.result.current.notes).toHaveLength(2);

    authUser = null; // signed out again: the anonymous entry, not the member's
    const again = renderHook(() => useCorrectionsFeed(40));
    expect(again.result.current.notes).toHaveLength(1);
    // another limit is another entry
    fetchCorrectionsFeed.mockResolvedValueOnce(ok([]));
    const other = renderHook(() => useCorrectionsFeed(100));
    expect(other.result.current.loading).toBe(true);
  });

  it('a failed read is an error (reported once), not an empty ledger', async () => {
    fetchCorrectionsFeed.mockRejectedValueOnce(new Error('Proxy HTTP 500'));
    const { result } = renderHook(() => useCorrectionsFeed(40));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/500/);
    expect(result.current.notes).toEqual([]);
    expect(reportFetchError).toHaveBeenCalledWith('corrections-feed', expect.any(Error));
    expect(localStorage.getItem('gp_corrections_feed:40:anon')).toBeNull();
  });
});

describe('ledgerLine', () => {
  const thread = { scope: 'thread', name: 'thread-russia-says-it-will-open-human-cbeb97', threadId: 'thread-russia-says-it-will-open-human-cbeb97', asOf: '2026-11-04', changeScore: { from: 90, to: 95 }, triggerEvent: { title: 'Russia bombards the grid', threadId: 'thread-x', date: '2026-11-03' } };

  it('a story row is "A story" linked by a real thread id, never the id text', () => {
    const l = ledgerLine(thread);
    expect(l.name).toBe('A story');
    expect(l.threadId).toBe(thread.threadId);
    expect(l.change).toBe('risk 90 → 95');
    expect(l.event.title).toBe('Russia bombards the grid');
    expect(ledgerLine({ ...thread, threadId: undefined, name: 'topic-123' }).threadId).toBeNull();
  });

  it('shows only what moved: never "72 → 72"', () => {
    const same = { ...thread, changeScore: { from: 72, to: 72 }, changeLevel: { from: 'HIGH', to: 'HIGH' } };
    expect(ledgerLine(same).change).toBe('read revised');
    expect(ledgerLine({ ...same, changeDimensions: { conflict: { from: 60, to: 60, delta: 0 }, economic: { from: 40, to: 48, delta: 8 } } }).change).toBe('Economic 40 → 48');
    expect(ledgerLine({ ...same, changeLevel: { from: 'MODERATE', to: 'HIGH' } }).change).toBe('MODERATE → HIGH');
    expect(ledgerLine({ ...same, changeScore: { from: 72, to: 75 } }).change).toBe('risk 72 → 75');
  });

  it('a flagged note shows numbers only, never the cited event', () => {
    const l = ledgerLine({ ...thread, directionFlag: { backfilled: true }, whyChanged: 'Risk fell because of an escalation.', changeDimensions: { conflict: { from: 85, to: 95, delta: 10 } } });
    expect(l.event).toBeNull();
    expect(l.why).toMatch(/Conflict risk rose 10 points/);
  });

  it('the gate line says n of total only when the server capped the list', () => {
    expect(ledgerGateText({ notes: [1, 2, 3, 4, 5], total: 389, gated: true })).toBe('Showing the 5 most recent of 389 corrections.');
    expect(ledgerGateText({ notes: [1], total: 1, gated: false })).toBeNull();
  });
});

describe('questionLine (design words)', () => {
  it('open, happened, not reported, could not be checked, awaiting check', () => {
    expect(questionLine({ state: 'awaiting', deadline: '2027-01-27' }).text).toBe('open · due 27 Jan');
    expect(questionLine({ state: 'yes', verdict: { decidedAt: '2026-11-03T10:00:00Z', quote: 'q' } })).toMatchObject({ text: 'happened · 3 Nov', quote: 'q' });
    expect(questionLine({ state: 'no', deadline: '2026-10-25' }).text).toBe('not reported by 25 Oct');
    expect(questionLine({ state: 'void', voidReason: 'issued_before_method' }).text).toBe('could not be checked · recorded before scoring began');
    expect(questionLine({ state: 'past_deadline_unchecked', deadline: '2026-10-26' }).text).toBe('awaiting check · due 26 Oct');
    expect(questionLine({})).toBeNull();
  });
});
