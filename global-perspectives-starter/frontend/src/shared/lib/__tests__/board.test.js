import { describe, it, expect } from 'vitest';
import { PIN_BUDGET, pairKey, normalizeActor, stringTexture } from '@/shared/lib/board.js';

describe('board rules (mirrored from backend/shared/src/record.js)', () => {
  it('pairKey is order-free and rejects a pin paired with itself', () => {
    expect(pairKey('b', 'a')).toBe('a__b');
    expect(pairKey('a', 'b')).toBe('a__b');
    expect(() => pairKey('a', 'a')).toThrow();
  });

  it('normalizeActor trims, collapses whitespace and lowercases', () => {
    expect(normalizeActor('  Vladimir   Putin ')).toBe('vladimir putin');
    expect(normalizeActor(null)).toBe('');
  });

  it('stringTexture: cut, solid, dashed, dashed-alt', () => {
    expect(PIN_BUDGET).toBe(12);
    expect(stringTexture({ owner: 'ours', strength: 'medium' })).toBe('solid');
    expect(stringTexture({ owner: 'ours', strength: 'inferred' })).toBe('dashed');
    expect(stringTexture({ owner: 'ours' })).toBe('dashed');
    expect(stringTexture({ owner: 'yours', strength: 'strong' })).toBe('dashed-alt');
    expect(stringTexture({ owner: 'ours', strength: 'strong', cutAt: '2026-10-20T00:00:00Z' })).toBe('cut');
  });
});
