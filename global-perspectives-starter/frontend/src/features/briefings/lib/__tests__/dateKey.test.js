import { describe, it, expect } from 'vitest';
import { dateKeyOrNull } from '@/features/briefings/lib/dateKey.js';

describe('dateKeyOrNull', () => {
  it('accepts only YYYY-MM-DD', () => {
    expect(dateKeyOrNull('2026-10-01')).toBe('2026-10-01');
    expect(dateKeyOrNull('yesterday')).toBe(null);
    expect(dateKeyOrNull(null)).toBe(null);
  });
});
