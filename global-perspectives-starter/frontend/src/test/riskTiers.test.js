import { describe, it, expect } from 'vitest';
import { tierFromScore, tierFromLevel, tierLabel, TIER_ORDER } from '../utils/riskTiers';

describe('tierFromScore — canonical 25/50/75 bands', () => {
  it('maps the four bands at their boundaries', () => {
    expect(tierFromScore(0)).toBe('low');
    expect(tierFromScore(24)).toBe('low');
    expect(tierFromScore(25)).toBe('moderate');
    expect(tierFromScore(49)).toBe('moderate');
    expect(tierFromScore(50)).toBe('elevated');
    expect(tierFromScore(74)).toBe('elevated');
    expect(tierFromScore(75)).toBe('high');
    expect(tierFromScore(100)).toBe('high');
  });

  it('fixes the old divergent boundaries (72 is elevated, not high; 45 is moderate, not elevated)', () => {
    expect(tierFromScore(72)).toBe('elevated'); // RiskScoreBadge used to call this "high"
    expect(tierFromScore(45)).toBe('moderate');  // used to be "elevated"
  });

  it('returns null for null / non-numeric', () => {
    expect(tierFromScore(null)).toBeNull();
    expect(tierFromScore(undefined)).toBeNull();
    expect(tierFromScore('abc')).toBeNull();
  });
});

describe('tierFromLevel — string normalization', () => {
  it('keeps moderate as its own tier (was aliased to elevated)', () => {
    expect(tierFromLevel('moderate')).toBe('moderate');
    expect(tierFromLevel('MODERATE')).toBe('moderate');
    expect(tierFromLevel('medium')).toBe('moderate');
  });

  it('normalizes synonyms', () => {
    expect(tierFromLevel('critical')).toBe('high');
    expect(tierFromLevel('severe')).toBe('high');
    expect(tierFromLevel('high')).toBe('high');
    expect(tierFromLevel('elevated')).toBe('elevated');
    expect(tierFromLevel('minimal')).toBe('low');
    expect(tierFromLevel('low')).toBe('low');
  });

  it('returns null for unknown / empty', () => {
    expect(tierFromLevel('')).toBeNull();
    expect(tierFromLevel(null)).toBeNull();
    expect(tierFromLevel('bananas')).toBeNull();
  });
});

describe('TIER_ORDER + tierLabel', () => {
  it('ranks most severe first', () => {
    expect(TIER_ORDER.high).toBeLessThan(TIER_ORDER.elevated);
    expect(TIER_ORDER.elevated).toBeLessThan(TIER_ORDER.moderate);
    expect(TIER_ORDER.moderate).toBeLessThan(TIER_ORDER.low);
  });

  it('labels uppercase, em dash for null', () => {
    expect(tierLabel('high')).toBe('HIGH');
    expect(tierLabel(null)).toBe('—');
  });
});
