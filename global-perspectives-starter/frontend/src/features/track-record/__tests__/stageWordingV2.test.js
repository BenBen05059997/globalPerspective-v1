import { describe, it, expect } from 'vitest';
import { stageWording } from '@/features/track-record/lib/stageWording.js';

const base = { eraCutFrom: '2026-07-04', pilotCount: 122, lastResolvedAt: '2026-07-24T22:22:14.709Z' };
const q = (resolved, extra = {}) => ({
  firstCommit: { weekId: '2026-W41', committedAt: '2026-10-01T10:30:00Z' }, counts: { resolved, void: 3 },
  weeks: [{ weekId: '2026-W41', weekStart: '2026-10-05', drawn: true }], ...extra,
});

describe('stageWording', () => {
  it('stage 0 without a questions block: pilot detail with the real last-resolved date and count', () => {
    const w = stageWording({ ...base, questions: null });
    expect(w.stage).toBe(0);
    expect(w.detail).toMatch(/Jul 24 2026/);
    expect(w.detail).toMatch(/122/);
    expect(w.detail).not.toMatch(/awaiting/i);
  });
  it('stage 0 says nothing was resolved when there is no pilot date either', () => {
    expect(stageWording({ eraCutFrom: '2026-07-04', questions: null }).detail).toMatch(/Nothing has been resolved yet/);
  });
  it('stage 0 with questions logged but no commitment names the first issue date', () => {
    const w = stageWording({ ...base, questions: { issued: 5, firstIssuedAt: '2026-10-01T05:00:00Z', firstCommit: null } });
    expect(w.stage).toBe(0);
    expect(w.detail).toMatch(/Oct 1 2026/);
    expect(w.detail).toMatch(/not been committed yet/);
  });
  it('stage 1 starts at the first commitment even with 0 resolved, with the real counts', () => {
    const w = stageWording({ ...base, questions: q(0) });
    expect(w.stage).toBe(1);
    expect(w.headline).toMatch(/Since Oct 1 2026 we lock a pre-selected sample each week/);
    expect(w.detail).toMatch(/0 resolved, 3 voided/);
    expect(w.detail).not.toMatch(/strong|weak|excellent/i);
  });
  it('stage 1 up to 149, stage 2 at exactly 150', () => {
    expect(stageWording({ ...base, questions: q(149) }).stage).toBe(1);
    expect(stageWording({ ...base, questions: q(150) }).stage).toBe(2);
  });
  it('stage 3 needs 400 resolved AND six months since the first draw', () => {
    expect(stageWording({ ...base, questions: q(400), now: new Date('2027-01-15T00:00:00Z') }).stage).toBe(2);
    expect(stageWording({ ...base, questions: q(400), now: new Date('2027-04-15T00:00:00Z') }).stage).toBe(3);
    expect(stageWording({ ...base, questions: q(399), now: new Date('2027-04-15T00:00:00Z') }).stage).toBe(2);
  });
});
