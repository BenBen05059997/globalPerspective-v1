import { describe, it, expect } from 'vitest';
import { pulseSet } from '@/features/map/lib/pulse.js';

const NOW = new Date('2026-09-26T12:00:00Z').getTime();
const h = (n) => new Date(NOW - n * 60 * 60 * 1000).toISOString(); // n hours before NOW

describe('pulseSet', () => {
  it('pulses a situation opened within the last 24h', () => {
    const s = [{ id: 'a', tier: 'moderate', opened_at: h(2), escalating: false }];
    expect(pulseSet(s, NOW)).toEqual(new Set(['a']));
  });

  it('pulses an escalating situation whose tier_changed_at is within 24h', () => {
    const s = [{ id: 'a', tier: 'high', opened_at: h(50), escalating: true, tier_changed_at: h(1) }];
    expect(pulseSet(s, NOW)).toEqual(new Set(['a']));
  });

  it('falls back to last_change_at, then opened_at, when tier_changed_at is missing', () => {
    const a = { id: 'a', tier: 'high', escalating: true, last_change_at: h(3) };
    const b = { id: 'b', tier: 'high', escalating: true, opened_at: h(4) };
    expect(pulseSet([a, b], NOW)).toEqual(new Set(['a', 'b']));
  });

  it('does not pulse an old situation, even if escalating, once past 24h', () => {
    const s = [{ id: 'a', tier: 'high', opened_at: h(200), escalating: true, tier_changed_at: h(48) }];
    expect(pulseSet(s, NOW)).toEqual(new Set());
  });

  it('does not pulse a static (non-escalating, not new) situation', () => {
    const s = [{ id: 'a', tier: 'high', opened_at: h(200), escalating: false, last_change_at: h(1) }];
    expect(pulseSet(s, NOW)).toEqual(new Set());
  });

  it('ignores a future timestamp rather than treating it as recent', () => {
    const s = [{ id: 'a', tier: 'high', opened_at: h(-5), escalating: false }];
    expect(pulseSet(s, NOW)).toEqual(new Set());
  });

  it('caps at 8, keeping the highest tier first', () => {
    const list = [];
    for (let i = 0; i < 10; i++) list.push({ id: `low-${i}`, tier: 'low', opened_at: h(1), escalating: false });
    list.push({ id: 'high-1', tier: 'high', opened_at: h(1), escalating: false });
    list.push({ id: 'high-2', tier: 'high', opened_at: h(2), escalating: false });
    const set = pulseSet(list, NOW, 8);
    expect(set.size).toBe(8);
    expect(set.has('high-1')).toBe(true);
    expect(set.has('high-2')).toBe(true);
  });

  it('breaks ties within the same tier by most recent first', () => {
    const list = [
      { id: 'older', tier: 'high', opened_at: h(20), escalating: false },
      { id: 'newer', tier: 'high', opened_at: h(1), escalating: false },
    ];
    const set = pulseSet(list, NOW, 1);
    expect(set).toEqual(new Set(['newer']));
  });

  it('is empty for no situations, and ignores malformed entries', () => {
    expect(pulseSet([], NOW)).toEqual(new Set());
    expect(pulseSet([null, {}, { id: 'x' }], NOW)).toEqual(new Set());
  });

  it('respects a custom cap', () => {
    const list = [
      { id: 'a', tier: 'high', opened_at: h(1), escalating: false },
      { id: 'b', tier: 'high', opened_at: h(2), escalating: false },
      { id: 'c', tier: 'high', opened_at: h(3), escalating: false },
    ];
    expect(pulseSet(list, NOW, 2).size).toBe(2);
  });
});
