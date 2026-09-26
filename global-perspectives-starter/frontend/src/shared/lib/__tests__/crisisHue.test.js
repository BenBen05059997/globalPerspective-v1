import { describe, it, expect } from 'vitest';
import { crisisTypeForCategory, crisisHueForCategory, CRISIS_HUE } from '@/shared/lib/crisisHue.js';

describe('crisisTypeForCategory', () => {
  it('maps conflict/military categories to conflict', () => {
    expect(crisisTypeForCategory('conflict')).toBe('conflict');
    expect(crisisTypeForCategory('military')).toBe('conflict');
    expect(crisisTypeForCategory('Security')).toBe('conflict');
  });

  it('maps politics/election/diplomacy categories to political', () => {
    expect(crisisTypeForCategory('politics')).toBe('political');
    expect(crisisTypeForCategory('election')).toBe('political');
    expect(crisisTypeForCategory('diplomacy')).toBe('political');
  });

  it('maps economy/energy/business/markets/trade categories to economic', () => {
    expect(crisisTypeForCategory('energy')).toBe('economic');
    expect(crisisTypeForCategory('economy')).toBe('economic');
    expect(crisisTypeForCategory('business')).toBe('economic');
    expect(crisisTypeForCategory('markets')).toBe('economic');
    expect(crisisTypeForCategory('trade')).toBe('economic');
  });

  it('maps humanitarian/disaster/health/climate categories to humanitarian', () => {
    expect(crisisTypeForCategory('humanitarian')).toBe('humanitarian');
    expect(crisisTypeForCategory('disaster')).toBe('humanitarian');
    expect(crisisTypeForCategory('health')).toBe('humanitarian');
    expect(crisisTypeForCategory('climate')).toBe('humanitarian');
  });

  // Real categories seen in the 2026-09-13 topics feed that carry no crisis claim.
  it('falls back to neutral for categories with no crisis claim', () => {
    expect(crisisTypeForCategory('technology')).toBe('neutral');
    expect(crisisTypeForCategory('society')).toBe('neutral');
    expect(crisisTypeForCategory(undefined)).toBe('neutral');
    expect(crisisTypeForCategory('')).toBe('neutral');
    expect(crisisTypeForCategory('something-unseen')).toBe('neutral');
  });

  it('is case-insensitive and hue lookup matches the type', () => {
    expect(crisisTypeForCategory('CONFLICT')).toBe('conflict');
    expect(crisisHueForCategory('CONFLICT')).toBe(CRISIS_HUE.conflict);
    expect(crisisHueForCategory('society')).toBe(CRISIS_HUE.neutral);
  });
});
