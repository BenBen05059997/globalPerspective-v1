import { describe, it, expect } from 'vitest';
import { dateKeyOrNull } from '@/features/briefings/lib/dateKey.js';

describe('dateKeyOrNull', () => {
  it('accepts only YYYY-MM-DD', () => {
    expect(dateKeyOrNull('2026-10-01')).toBe('2026-10-01');
    expect(dateKeyOrNull('yesterday')).toBe(null);
    expect(dateKeyOrNull(null)).toBe(null);
  });
  it('rejects days that are not on the calendar', () => {
    expect(dateKeyOrNull('2026-13-45')).toBe(null);
    expect(dateKeyOrNull('2026-02-30')).toBe(null);
    expect(dateKeyOrNull('2028-02-29')).toBe('2028-02-29');
  });
});
