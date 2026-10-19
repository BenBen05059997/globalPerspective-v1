import { describe, it, expect } from 'vitest';
import { pulseSet, changedAt, MOTION_BUDGET, HAPPENING_NOW_MS } from '@/shared/map/pulse.js';

const NOW = new Date('2026-09-26T12:00:00Z').getTime();
const h = (n) => new Date(NOW - n * 60 * 60 * 1000).toISOString(); // n hours before NOW

describe('happening now — pulseSet', () => {
  it('uses a 12h window and a cap of 5', () => {
    expect(HAPPENING_NOW_MS).toBe(12 * 60 * 60 * 1000);
    expect(MOTION_BUDGET.pulses).toBe(5);
  });

  it('includes a situation opened within the last 12h', () => {
    const s = [{ id: 'a', tier: 'moderate', opened_at: h(2) }];
    expect(pulseSet(s, NOW)).toEqual(new Set(['a']));
  });

  it('includes any recent change, escalating or not', () => {
    const s = [
      { id: 'a', tier: 'high', opened_at: h(50), escalating: true, tier_changed_at: h(1) },
      { id: 'b', tier: 'high', opened_at: h(200), escalating: false, last_change_at: h(3) },
    ];
    expect(pulseSet(s, NOW)).toEqual(new Set(['a', 'b']));
  });

  it('reads tier_changed_at first, then last_change_at, then opened_at', () => {
    expect(changedAt({ tier_changed_at: h(1), last_change_at: h(2), opened_at: h(3) })).toBe(h(1));
    expect(changedAt({ last_change_at: h(2), opened_at: h(3) })).toBe(h(2));
    expect(changedAt({ opened_at: h(3) })).toBe(h(3));
    expect(changedAt({})).toBe(null);
    // tier_changed_at wins even when it is old and last_change_at is recent
    expect(pulseSet([{ id: 'a', tier: 'high', tier_changed_at: h(20), last_change_at: h(1) }], NOW)).toEqual(new Set());
  });

  it('drops a situation whose change is older than 12h (13h ago is out, 11h ago is in)', () => {
    const s = [
      { id: 'old', tier: 'high', last_change_at: h(13) },
      { id: 'in', tier: 'low', last_change_at: h(11) },
    ];
    expect(pulseSet(s, NOW)).toEqual(new Set(['in']));
  });

  it('ignores a future timestamp rather than treating it as recent', () => {
    expect(pulseSet([{ id: 'a', tier: 'high', opened_at: h(-5) }], NOW)).toEqual(new Set());
  });

  it('caps at 5 by default, keeping the highest tier first', () => {
    const list = [];
    for (let i = 0; i < 10; i++) list.push({ id: `low-${i}`, tier: 'low', opened_at: h(1) });
    list.push({ id: 'high-1', tier: 'high', opened_at: h(5) });
    list.push({ id: 'elev-1', tier: 'elevated', opened_at: h(6) });
    const set = pulseSet(list, NOW);
    expect(set.size).toBe(5);
    expect(set.has('high-1')).toBe(true);
    expect(set.has('elev-1')).toBe(true);
  });

  it('breaks ties within the same tier by most recent change first', () => {
    const list = [
      { id: 'older', tier: 'high', opened_at: h(10) },
      { id: 'newer', tier: 'high', opened_at: h(1) },
    ];
    expect(pulseSet(list, NOW, 1)).toEqual(new Set(['newer']));
  });

  it('is empty for no situations, and ignores malformed entries', () => {
    expect(pulseSet([], NOW)).toEqual(new Set());
    expect(pulseSet(undefined, NOW)).toEqual(new Set());
    expect(pulseSet([null, {}, { id: 'x' }], NOW)).toEqual(new Set());
  });

  it('respects a custom cap', () => {
    const list = ['a', 'b', 'c'].map((id, i) => ({ id, tier: 'high', opened_at: h(i + 1) }));
    expect(pulseSet(list, NOW, 2)).toEqual(new Set(['a', 'b']));
  });
});
