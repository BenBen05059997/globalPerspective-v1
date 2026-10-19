import { describe, it, expect } from 'vitest';
import { countryTier, compareByRisk } from '@/features/countries/lib/countryTier';
import { trajectoryOf } from '@/features/countries/lib/trajectory';

describe('countryTier', () => {
  it('is score-first, level only without a score, null when unscored', () => {
    expect(countryTier({ riskScore: 95, riskLevel: 'moderate' })).toBe('high');
    expect(countryTier({ riskLevel: 'elevated' })).toBe('elevated');
    expect(countryTier({})).toBe(null);
    expect(countryTier(null)).toBe(null);
  });
});

describe('compareByRisk', () => {
  it('ranks by score, not by tier then coverage (Ukraine 95 above United States 85)', () => {
    const list = [
      { name: 'United States', intel: { riskScore: 85, riskLevel: 'high' } },
      { name: 'Ukraine', intel: { riskScore: 95, riskLevel: 'high' } },
      { name: 'Peru', intel: { riskLevel: 'elevated' } },
      { name: 'Chile', intel: { riskScore: 30 } },
    ];
    const order = [...list].sort((a, b) => compareByRisk(a.intel, b.intel)).map((c) => c.name);
    expect(order).toEqual(['Ukraine', 'United States', 'Chile', 'Peru']);
  });
});

describe('trajectoryOf', () => {
  it('maps the backend enum to a direction + word; unknown reads stable; empty is null', () => {
    expect(trajectoryOf('escalating')).toEqual({ dir: 'up', label: 'Escalating' });
    expect(trajectoryOf('de-escalating')).toEqual({ dir: 'down', label: 'De-escalating' });
    expect(trajectoryOf('sideways')).toEqual({ dir: 'flat', label: 'Stable' });
    expect(trajectoryOf(null)).toBe(null);
  });
});
