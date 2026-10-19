import { describe, it, expect } from 'vitest';
import { briefingPath, dateKeyOrNull } from '@/features/briefings/lib/briefingPath.js';

describe('briefingPath', () => {
  it('read is the default mode and is always written', () => {
    expect(briefingPath()).toBe('/briefings?mode=read');
    expect(briefingPath({ date: '2026-10-01' })).toBe('/briefings?mode=read&date=2026-10-01');
    expect(briefingPath({ date: null })).toBe('/briefings?mode=read');
  });
  it('weekly and present carry their mode, week and deck', () => {
    expect(briefingPath({ mode: 'weekly' })).toBe('/briefings?mode=weekly');
    expect(briefingPath({ mode: 'weekly', week: '2026-10-12' })).toBe('/briefings?mode=weekly&week=2026-10-12');
    expect(briefingPath({ mode: 'present', deck: 'weekly', week: '2026-10-12' })).toBe('/briefings?mode=present&week=2026-10-12&deck=weekly');
    expect(briefingPath({ mode: 'present', deck: 'daily', date: '2026-10-01' })).toBe('/briefings?mode=present&date=2026-10-01');
  });
});

describe('dateKeyOrNull', () => {
  it('accepts only YYYY-MM-DD', () => {
    expect(dateKeyOrNull('2026-10-01')).toBe('2026-10-01');
    expect(dateKeyOrNull('yesterday')).toBe(null);
    expect(dateKeyOrNull(null)).toBe(null);
  });
});
