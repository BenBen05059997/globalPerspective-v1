import { describe, it, expect } from 'vitest';
import {
  chunkNames, MAX_NAMES_PER_CALL, outlineForTier, countryRiskEntry, buildCountryRiskLayer, riskPeekData,
} from '@/features/map/lib/countryRiskLayer.js';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

describe('countryRiskLayer — batching', () => {
  it('never yields a chunk bigger than the backend cap (15)', () => {
    const names = Array.from({ length: 37 }, (_, i) => `Country${i}`);
    const chunks = chunkNames(names);
    expect(chunks.length).toBe(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX_NAMES_PER_CALL);
    expect(chunks.flat()).toEqual(names);
  });
  it('an empty list chunks to nothing', () => {
    expect(chunkNames([])).toEqual([]);
  });
});

describe('countryRiskLayer — tier -> outline weight', () => {
  it('increases weight with tier and reserves the double outline for HIGH only', () => {
    const widths = ['low', 'moderate', 'elevated', 'high'].map((t) => outlineForTier(t).width);
    expect(widths[0]).toBeLessThan(widths[1]);
    expect(widths[1]).toBeLessThan(widths[2]);
    expect(widths[2]).toBeLessThan(widths[3]);
    expect(outlineForTier('high').double).toBe(true);
    for (const t of ['low', 'moderate', 'elevated']) expect(outlineForTier(t).double).toBe(false);
  });
  it('treats an unknown tier as low, never as high', () => {
    expect(outlineForTier('bogus')).toEqual(outlineForTier('low'));
  });
});

describe('countryRiskLayer — worst axis -> hue', () => {
  it('hue follows the worst axis, not a blended average', () => {
    // Japan-style case (project_risk_scoring): economic=75 dominates a lower conflict score.
    const e = countryRiskEntry('Japan', { dimensions: { conflict: 50, economic: 75 } }, NOW);
    expect(e.leadAxis).toBe('economic');
    expect(e.tier).toBe('high');
    expect(e.score).toBe(75);
  });
  it('falls back to the legacy scalar riskScore/riskLevel when no dimensions vector exists', () => {
    const e = countryRiskEntry('Egypt', { riskScore: 40 }, NOW);
    expect(e.tier).toBe('moderate');
    expect(e.leadAxis).toBeNull();
  });
  it('a country never briefed (no record) draws nothing', () => {
    expect(countryRiskEntry('Nowhereland', null, NOW)).toBeNull();
  });
  it('a country with no resolvable ISO3 draws nothing (never a guessed geometry)', () => {
    expect(countryRiskEntry('Atlantis', { riskScore: 80 }, NOW)).toBeNull();
  });
});

describe('countryRiskLayer — briefing age -> brightness / hidden', () => {
  it('under 14 days (weekly cadence) draws at full weight, including 10 days', () => {
    expect(countryRiskEntry('France', { riskScore: 60, generatedAt: daysAgo(10) }, NOW).older).toBe(false);
    const e = countryRiskEntry('France', { riskScore: 60, generatedAt: daysAgo(3) }, NOW);
    expect(e.hidden).toBe(false);
    expect(e.older).toBe(false);
  });
  it('14-30 days draws desaturated and flagged "older"', () => {
    expect(countryRiskEntry('France', { riskScore: 60, generatedAt: daysAgo(14.5) }, NOW).older).toBe(true);
    const e = countryRiskEntry('France', { riskScore: 60, generatedAt: daysAgo(15) }, NOW);
    expect(e.hidden).toBe(false);
    expect(e.older).toBe(true);
  });
  it('>30 days is not drawn at all', () => {
    const e = countryRiskEntry('France', { riskScore: 60, generatedAt: daysAgo(45) }, NOW);
    expect(e.hidden).toBe(true);
  });
});

describe('countryRiskLayer — buildCountryRiskLayer', () => {
  const intelByName = {
    France: { riskScore: 60, generatedAt: daysAgo(3) },        // elevated
    Iran: { dimensions: { conflict: 85 }, generatedAt: daysAgo(1) }, // high
    Egypt: { riskScore: 30, generatedAt: daysAgo(45) },        // hidden — too old
    Sudan: { dimensions: { humanitarian: 85 }, generatedAt: daysAgo(2) }, // high
    Atlantis: { riskScore: 90, generatedAt: daysAgo(1) },      // no ISO3 — never drawn
  };

  it('orders worst tier first, then score desc, and counts (never drops) old briefings', () => {
    const { drawn, hiddenOld, hiddenOldDates } = buildCountryRiskLayer(intelByName, NOW);
    expect(drawn.map((d) => d.name)).toEqual(['Iran', 'Sudan', 'France']);
    expect(hiddenOld).toBe(1);
    expect(hiddenOldDates.length).toBe(1);
  });
});

describe('countryRiskLayer — riskPeekData', () => {
  it('names, score, tier, leading axis and a briefed date, honest about "older"', () => {
    const e = countryRiskEntry('Sudan', { dimensions: { humanitarian: 85 }, generatedAt: daysAgo(15) }, NOW);
    const peek = riskPeekData(e);
    expect(peek.headline).toBe('Sudan');
    expect(peek.category).toContain('85');
    expect(peek.category).toContain('High');
    expect(peek.primaryCountry).toBe('Humanitarian');
    expect(peek.updatedLabel).toContain('older');
  });
  it('returns null for no entry', () => {
    expect(riskPeekData(null)).toBeNull();
  });
});
