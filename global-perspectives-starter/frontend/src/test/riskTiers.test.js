import { describe, it, expect } from 'vitest';
import {
  tierFromScore, tierFromLevel, tierLabel, TIER_ORDER,
  headlineFromDimensions, deriveHeadline, AXES,
} from '../utils/riskTiers';

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

describe('headlineFromDimensions — worst axis + breadth (scoring v2)', () => {
  it('headline is the max axis, not an average', () => {
    // Japan from the Phase-0 spike: economy is the story, not conflict.
    const h = headlineFromDimensions({ conflict: 50, political: 25, economic: 75, humanitarian: null });
    expect(h.score).toBe(75);
    expect(h.tier).toBe('high');       // an average (50) would read "elevated" — max preserves the signal
    expect(h.leadAxis).toBe('economic');
    expect(h.leadLabel).toBe('Economic');
  });

  it('breadth counts elevated (>=50) axes; ignores nulls', () => {
    const h = headlineFromDimensions({ conflict: 85, political: 60, economic: 55, humanitarian: null });
    expect(h.breadth).toBe(3);
    expect(h.elevated).toEqual(expect.arrayContaining(['conflict', 'political', 'economic']));
    expect(h.axes).toHaveLength(3); // null humanitarian is dropped from the breakdown
  });

  it('accepts { score, why } axis objects and keeps the why', () => {
    const h = headlineFromDimensions({ conflict: { score: 90, why: 'active multi-front war' } });
    expect(h.score).toBe(90);
    expect(h.axes[0].why).toBe('active multi-front war');
  });

  it('axes come back sorted worst-first', () => {
    const h = headlineFromDimensions({ conflict: 40, political: 80, economic: 60 });
    expect(h.axes.map((a) => a.axis)).toEqual(['political', 'economic', 'conflict']);
  });

  it('treats {score:null} as no-signal (sparsity), not 0', () => {
    const h = headlineFromDimensions({ conflict: { score: null, why: 'x' }, economic: 60 });
    expect(h.axes.map((a) => a.axis)).toEqual(['economic']); // conflict dropped, not scored 0
    expect(h.leadAxis).toBe('economic');
  });

  it('empty / all-null vector → stable empty headline', () => {
    for (const v of [null, undefined, {}, { conflict: null, political: null }]) {
      const h = headlineFromDimensions(v);
      expect(h.score).toBeNull();
      expect(h.tier).toBeNull();
      expect(h.axes).toEqual([]);
      expect(h.breadth).toBe(0);
    }
  });

  it('covers the whole axis vocabulary', () => {
    expect(AXES).toEqual(['conflict', 'political', 'economic', 'humanitarian']);
  });
});

describe('deriveHeadline — one call for vector OR legacy scalar (back-compat)', () => {
  it('prefers the dimensions vector when present', () => {
    const h = deriveHeadline({ dimensions: { conflict: 88, economic: 40 }, riskScore: 40 });
    expect(h.score).toBe(88);
    expect(h.leadAxis).toBe('conflict');
  });

  it('falls back to legacy riskScore for pre-v2 records', () => {
    const h = deriveHeadline({ riskScore: 62, riskLevel: 'elevated' });
    expect(h.score).toBe(62);
    expect(h.tier).toBe('elevated');
    expect(h.leadAxis).toBeNull(); // no per-axis breakdown for scalar-only rows
    expect(h.axes).toEqual([]);
  });

  it('falls back to riskLevel string when there is no numeric score', () => {
    const h = deriveHeadline({ riskLevel: 'high' });
    expect(h.tier).toBe('high');
  });

  it('empty record → empty headline', () => {
    expect(deriveHeadline({}).tier).toBeNull();
    expect(deriveHeadline(null).tier).toBeNull();
  });
});
