import { describe, it, expect } from 'vitest';
import { computeBrier } from '@/features/track-record/lib/postPilotBrier.js';

describe('computeBrier', () => {
  it('returns null with nothing scored', () => {
    expect(computeBrier([])).toBeNull();
    expect(computeBrier([{ verdict: null }])).toBeNull();
  });

  it('scores a perfect prediction as 0', () => {
    expect(computeBrier([{ probability: 1, verdict: 'fired' }])).toBe(0);
    expect(computeBrier([{ probability: 0, verdict: 'not_fired' }])).toBe(0);
  });

  it('scores a coin-flip guess as 0.25 regardless of outcome', () => {
    expect(computeBrier([{ probability: 0.5, verdict: 'fired' }])).toBe(0.25);
    expect(computeBrier([{ probability: 0.5, verdict: 'not_fired' }])).toBe(0.25);
  });

  it('averages across items and ignores ones with no numeric probability', () => {
    const items = [
      { probability: 1, verdict: 'fired' },
      { probability: 0, verdict: 'fired' }, // worst case: 1.0
      { probability: null, verdict: 'fired' }, // excluded
    ];
    expect(computeBrier(items)).toBe(0.5);
  });
});
