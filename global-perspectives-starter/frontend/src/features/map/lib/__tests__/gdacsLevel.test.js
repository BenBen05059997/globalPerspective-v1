import { describe, it, expect } from 'vitest';
import { gdacsLevelBadge } from '@/features/map/lib/gdacsLevel.js';

describe('gdacsLevelBadge', () => {
  it('returns null for a non-GDACS situation, whatever it carries', () => {
    expect(gdacsLevelBadge({ source: 'news', what_changed: 'Alert raised Green→Orange' })).toBeNull();
  });

  it('returns null for a GDACS situation with nothing to read a level from', () => {
    expect(gdacsLevelBadge({ source: 'gdacs' })).toBeNull();
    expect(gdacsLevelBadge({ source: 'gdacs', what_changed: 'Spread to 2 new countries: KEN, UGA' })).toBeNull();
  });

  it('prefers the structured evidence field when present', () => {
    const s = { source: 'gdacs', what_changed: 'Alert raised Green→Red' };
    expect(gdacsLevelBadge(s, { gdacs_level: 'Orange' })).toBe('ORANGE ALERT');
  });

  it('reads evidence carried on the situation itself when no separate evidence arg is given', () => {
    const s = { source: 'gdacs', evidence: { gdacs_level: 'Red' } };
    expect(gdacsLevelBadge(s)).toBe('RED ALERT');
  });

  it('falls back to parsing "Alert raised X→Y" from what_changed', () => {
    const s = { source: 'gdacs', what_changed: 'Alert raised Green→Orange · Tropical cyclone' };
    expect(gdacsLevelBadge(s)).toBe('ORANGE ALERT');
  });

  it('falls back to parsing "Alert lowered X→Y" from what_changed', () => {
    const s = { source: 'gdacs', what_changed: 'Alert lowered Orange→Green' };
    expect(gdacsLevelBadge(s)).toBe('GREEN ALERT');
  });

  it('falls back to parsing the opening template', () => {
    const s = { source: 'gdacs', what_changed: 'GDACS Orange alert opened · Flood · 1 country affected' };
    expect(gdacsLevelBadge(s)).toBe('ORANGE ALERT');
  });

  it('never invents a level for "Gone" (event no longer current)', () => {
    const s = { source: 'gdacs', what_changed: 'Event no longer current in GDACS', evidence: { gdacs_level: 'Gone' } };
    expect(gdacsLevelBadge(s)).toBeNull();
  });
});
