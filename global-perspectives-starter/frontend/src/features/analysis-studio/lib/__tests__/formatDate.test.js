import { describe, it, expect } from 'vitest';
import { formatCiteDate } from '../formatDate.js';

describe('formatCiteDate', () => {
  it('formats a bare YYYY-MM-DD date anchored to UTC (no local-timezone shift)', () => {
    expect(formatCiteDate('2026-09-22')).toBe('Sep 22, 2026');
  });
  it('formats a full ISO timestamp', () => {
    expect(formatCiteDate('2026-09-22T06:31:46.856Z')).toBe('Sep 22, 2026');
  });
  it('returns null for missing/invalid input, never throws', () => {
    expect(formatCiteDate(null)).toBeNull();
    expect(formatCiteDate('')).toBeNull();
    expect(formatCiteDate('not a date')).toBeNull();
  });
});
