import { describe, it, expect } from 'vitest';
import { stageWording } from '@/features/track-record/lib/stageWording.js';

describe('stageWording — stage 0 (today\'s real state: 0 post-pilot resolved)', () => {
  it('says scoring is paused and names the real last-resolved date + pilot count', () => {
    const w = stageWording({
      postPilotResolved: 0,
      lastResolvedAt: '2026-07-24T22:22:14.709Z',
      eraCutFrom: '2026-07-04',
      pilotCount: 122,
    });
    expect(w.stage).toBe(0);
    expect(w.detail).toMatch(/Jul 24 2026/);
    expect(w.detail).toMatch(/122/);
    expect(w.detail).not.toMatch(/awaiting/i);
  });

  it('handles never having resolved anything at all', () => {
    const w = stageWording({ postPilotResolved: 0, lastResolvedAt: null, eraCutFrom: '2026-07-04' });
    expect(w.stage).toBe(0);
    expect(w.detail).toMatch(/Nothing has been resolved yet/);
  });
});

describe('stageWording — stage 1 (1..149 post-pilot resolved)', () => {
  it('reports the real n and never claims accuracy', () => {
    const w = stageWording({ postPilotResolved: 40, eraCutFrom: '2026-07-04' });
    expect(w.stage).toBe(1);
    expect(w.detail).toMatch(/40 resolved/);
    expect(w.detail).not.toMatch(/strong|weak|excellent/i);
  });
});

describe('stageWording — stage 2/3 thresholds', () => {
  it('reaches stage 2 at exactly 150', () => {
    expect(stageWording({ postPilotResolved: 150, eraCutFrom: '2026-07-04' }).stage).toBe(2);
  });
  it('reaches stage 3 at exactly 400', () => {
    expect(stageWording({ postPilotResolved: 400, eraCutFrom: '2026-07-04' }).stage).toBe(3);
  });
});
