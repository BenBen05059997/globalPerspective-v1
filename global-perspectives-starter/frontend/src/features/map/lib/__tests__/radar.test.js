import { describe, it, expect } from 'vitest';
import {
  bearingDeg, beamCrossed, lapAngle, LAP_MS, LAP_START_DEG, gainedIds,
  NO_CARDS, enqueueCard, advanceCards, agoShort, scanCardText, scanControlLabel,
} from '@/features/map/lib/radar.js';

describe('radar — bearingDeg', () => {
  it('reads 0° due east of centre', () => {
    expect(bearingDeg(10, 0, 0, 0)).toBeCloseTo(0);
  });
  it('reads 90° due south (screen y grows downward)', () => {
    expect(bearingDeg(0, 10, 0, 0)).toBeCloseTo(90);
  });
  it('reads 180° due west', () => {
    expect(bearingDeg(-10, 0, 0, 0)).toBeCloseTo(180);
  });
  it('reads 270° due north, never negative', () => {
    expect(bearingDeg(0, -10, 0, 0)).toBeCloseTo(270);
  });
});

describe('radar — beamCrossed', () => {
  it('detects a crossing within a simple forward tick', () => {
    expect(beamCrossed(10, 20, 15)).toBe(true);
  });
  it('does not fire for a marker the beam has not reached yet', () => {
    expect(beamCrossed(10, 20, 25)).toBe(false);
  });
  it('does not re-fire for a marker already passed earlier this lap', () => {
    expect(beamCrossed(10, 20, 5)).toBe(false);
  });
  it('handles the wrap at 360→0', () => {
    expect(beamCrossed(350, 10, 5)).toBe(true);
    expect(beamCrossed(350, 10, 355)).toBe(true);
    expect(beamCrossed(350, 10, 200)).toBe(false);
  });
  it('is a no-op for a zero-length tick', () => {
    expect(beamCrossed(40, 40, 40)).toBe(false);
  });
  it('is false for null/missing inputs', () => {
    expect(beamCrossed(null, 10, 5)).toBe(false);
    expect(beamCrossed(10, null, 5)).toBe(false);
    expect(beamCrossed(10, 20, null)).toBe(false);
  });
});

describe('radar — one lap', () => {
  it('lasts about 4-5 seconds', () => {
    expect(LAP_MS).toBeGreaterThanOrEqual(4000);
    expect(LAP_MS).toBeLessThanOrEqual(5000);
  });
  it('starts due north and runs clockwise', () => {
    expect(lapAngle(0)).toEqual({ angle: LAP_START_DEG, done: false });
    expect(lapAngle(LAP_MS / 4).angle).toBeCloseTo(0);   // a quarter lap: due east
    expect(lapAngle(LAP_MS / 2).angle).toBeCloseTo(90);  // half: due south
  });
  it('is done after one lap and holds where it started', () => {
    expect(lapAngle(LAP_MS)).toEqual({ angle: LAP_START_DEG, done: true });
    expect(lapAngle(LAP_MS * 3)).toEqual({ angle: LAP_START_DEG, done: true });
    expect(lapAngle(LAP_MS - 1).done).toBe(false);
  });
  it('treats a bad clock as a finished lap rather than spinning', () => {
    expect(lapAngle(NaN).done).toBe(true);
    expect(lapAngle(100, 0).done).toBe(true);
  });
  it('passes every marker exactly once over a lap of frames', () => {
    const markers = [0, 45, 90, 179.9, 269.99, 270, 270.01, 359.9];
    const hits = new Map(markers.map((m) => [m, 0]));
    let prev = LAP_START_DEG;
    for (let t = 16; ; t += 16) {
      const { angle, done } = lapAngle(t);
      for (const m of markers) if (beamCrossed(prev, angle, m)) hits.set(m, hits.get(m) + 1);
      prev = angle;
      if (done) break;
    }
    for (const m of markers) expect(hits.get(m), `marker at ${m}°`).toBe(1);
  });
});

describe('radar — gainedIds (when to run a lap)', () => {
  it('is true the first time there are markers', () => {
    expect(gainedIds(new Set(), ['a'])).toBe(true);
  });
  it('is false with no markers at all', () => {
    expect(gainedIds(new Set(), [])).toBe(false);
  });
  it('is false for a refresh with the same or fewer ids', () => {
    expect(gainedIds(new Set(['a', 'b']), ['b', 'a'])).toBe(false);
    expect(gainedIds(new Set(['a', 'b']), ['a'])).toBe(false);
  });
  it('is true when a refresh adds an id', () => {
    expect(gainedIds(new Set(['a']), ['a', 'c'])).toBe(true);
  });
});

describe('radar — beam-pass card queue', () => {
  const SHOW = 3000;
  it('shows the first card at once', () => {
    const q = enqueueCard(NO_CARDS, 'a', 1000, SHOW);
    expect(q).toEqual({ current: { id: 'a', until: 4000 }, queue: [] });
  });
  it('queues later cards in order, one at a time', () => {
    let q = enqueueCard(NO_CARDS, 'a', 0, SHOW);
    q = enqueueCard(q, 'b', 100, SHOW);
    q = enqueueCard(q, 'c', 200, SHOW);
    expect(q.current.id).toBe('a');
    expect(q.queue).toEqual(['b', 'c']);
  });
  it('ignores an id already showing or waiting', () => {
    let q = enqueueCard(NO_CARDS, 'a', 0, SHOW);
    q = enqueueCard(q, 'b', 0, SHOW);
    expect(enqueueCard(q, 'a', 10, SHOW)).toBe(q);
    expect(enqueueCard(q, 'b', 10, SHOW)).toBe(q);
  });
  it('keeps the current card until its time is up, then shows the next for its own full time', () => {
    let q = enqueueCard(NO_CARDS, 'a', 0, SHOW);
    q = enqueueCard(q, 'b', 500, SHOW);
    expect(advanceCards(q, 2999, SHOW)).toBe(q);
    q = advanceCards(q, 3000, SHOW);
    expect(q).toEqual({ current: { id: 'b', until: 6000 }, queue: [] });
    q = advanceCards(q, 6000, SHOW);
    expect(q).toEqual({ current: null, queue: [] });
  });
  it('is a no-op when nothing is showing', () => {
    expect(advanceCards(NO_CARDS, 5000, SHOW)).toBe(NO_CARDS);
  });
  it('never mutates the queue it was given', () => {
    const q0 = enqueueCard(NO_CARDS, 'a', 0, SHOW);
    const q1 = enqueueCard(q0, 'b', 0, SHOW);
    expect(q0.queue).toEqual([]);
    expect(NO_CARDS.queue).toEqual([]);
    advanceCards(q1, SHOW, SHOW);
    expect(q1.queue).toEqual(['b']);
  });
});

describe('radar — card text', () => {
  const NOW = Date.parse('2026-10-19T12:00:00Z');
  it('has headline, crisis type, tier word and how long ago it changed', () => {
    const s = { verb_label: 'Strikes hit port', axis: 'conflict', tier: 'high', tier_changed_at: '2026-10-19T09:00:00Z', opened_at: '2026-10-10T00:00:00Z' };
    expect(scanCardText(s, NOW)).toEqual({ headline: 'Strikes hit port', type: 'Conflict', tier: 'High', ago: '3h ago' });
  });
  it('leaves out what the bundle lacks instead of inventing it', () => {
    expect(scanCardText({ verb_label: 'X', axis: 'other' }, NOW)).toEqual({ headline: 'X', type: null, tier: null, ago: null });
  });
  it('agoShort reads minutes, hours, days, and "" for a bad time', () => {
    expect(agoShort('2026-10-19T11:59:50Z', NOW)).toBe('just now');
    expect(agoShort('2026-10-19T11:48:00Z', NOW)).toBe('12m ago');
    expect(agoShort('2026-10-17T12:00:00Z', NOW)).toBe('2d ago');
    expect(agoShort(null, NOW)).toBe('');
    expect(agoShort('nope', NOW)).toBe('');
  });
});

describe('radar — scan control', () => {
  it('reads "Scan again", and says so while a lap runs', () => {
    expect(scanControlLabel(false)).toBe('Scan again');
    expect(scanControlLabel(true)).toBe('Scanning…');
  });
});
