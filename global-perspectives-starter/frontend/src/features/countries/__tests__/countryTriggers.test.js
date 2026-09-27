import { describe, it, expect } from 'vitest';
import { futureDatedTriggers } from '@/features/countries/lib/countryTriggers.js';

const now = Date.UTC(2026, 8, 27); // 2026-09-27

describe('futureDatedTriggers', () => {
  it('drops passed triggers and keeps future ones, soonest first', () => {
    const deadlines = [
      { id: 'a', label: 'past', deadline: '2026-09-01' },
      { id: 'b', label: 'far', deadline: '2026-12-01' },
      { id: 'c', label: 'near', deadline: '2026-10-01' },
    ];
    const out = futureDatedTriggers(deadlines, now);
    expect(out.map((d) => d.id)).toEqual(['c', 'b']);
  });

  it('caps at the given limit (default 2)', () => {
    const deadlines = [
      { id: 'a', deadline: '2026-10-01' },
      { id: 'b', deadline: '2026-10-02' },
      { id: 'c', deadline: '2026-10-03' },
    ];
    expect(futureDatedTriggers(deadlines, now)).toHaveLength(2);
  });

  it('computes days left from now', () => {
    const out = futureDatedTriggers([{ id: 'a', deadline: '2026-10-02' }], now);
    expect(out[0].daysLeft).toBe(5);
  });

  it('handles empty/missing input honestly', () => {
    expect(futureDatedTriggers(undefined, now)).toEqual([]);
    expect(futureDatedTriggers([], now)).toEqual([]);
    expect(futureDatedTriggers([{ id: 'x' }], now)).toEqual([]);
  });
});
