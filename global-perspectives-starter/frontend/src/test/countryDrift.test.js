import { describe, it, expect } from 'vitest';
import { computeCountryDrift } from '../utils/countryDrift';

const snap = (dateKey, riskLevel, riskScore, trajectory = '', headline = '') =>
  ({ dateKey, riskLevel, riskScore, trajectory, headline });

describe('computeCountryDrift', () => {
  it('returns null with fewer than 2 snapshots', () => {
    expect(computeCountryDrift([])).toBeNull();
    expect(computeCountryDrift([snap('2026-06-01', 'high', 80)])).toBeNull();
  });

  it('returns null when only the headline reworded (cosmetic — conclusion unchanged)', () => {
    const d = computeCountryDrift([
      snap('2026-06-01', 'high', 82, 'escalating', 'Iran faces naval blockade and stalled talks'),
      snap('2026-06-02', 'high', 82, 'escalating', 'Iran escalates Hormuz control amid fragile ceasefire'),
    ]);
    expect(d).toBeNull(); // gate is on the conclusion, not the headline
  });

  it('detects a risk-level flip and reports from → to', () => {
    const d = computeCountryDrift([
      snap('2026-06-01', 'elevated', 65, 'stable', 'Iran talks ongoing'),
      snap('2026-06-02', 'high', 85, 'escalating', 'Iran ceasefire collapses'),
    ]);
    expect(d).not.toBeNull();
    expect(d.since).toBe('2026-06-01');
    expect(d.daysSince).toBe(1);
    const level = d.dims.find((x) => x.k === 'Risk level');
    expect(level).toMatchObject({ from: 'elevated', to: 'high' });
    const score = d.dims.find((x) => x.k === 'Risk score');
    expect(score).toMatchObject({ from: 65, to: 85, delta: 20 });
    expect(d.headlineChanged).toBe(true);
  });

  it('detects a material score move (|Δ|≥8) even without a level flip', () => {
    const d = computeCountryDrift([
      snap('2026-06-01', 'high', 80),
      snap('2026-06-02', 'high', 90),
    ]);
    expect(d).not.toBeNull();
    expect(d.dims.some((x) => x.k === 'Risk score' && x.delta === 10)).toBe(true);
  });

  it('ignores a sub-threshold score wiggle (|Δ|<8)', () => {
    const d = computeCountryDrift([
      snap('2026-06-01', 'high', 80, 'x'),
      snap('2026-06-02', 'high', 85, 'x'),
    ]);
    expect(d).toBeNull();
  });

  it('walks back past cosmetic days to the last MATERIALLY-different read', () => {
    const d = computeCountryDrift([
      snap('2026-06-01', 'elevated', 60, 'calm', 'A'),        // the real prior conclusion
      snap('2026-06-02', 'high', 85, 'tense', 'B'),           // moved here
      snap('2026-06-03', 'high', 85, 'tense', 'B reworded'),  // cosmetic
      snap('2026-06-04', 'high', 84, 'tense', 'B again'),     // cosmetic (Δ1)
    ]);
    expect(d).not.toBeNull();
    expect(d.since).toBe('2026-06-01'); // not 06-03/06-04
    expect(d.dims.find((x) => x.k === 'Risk level')).toMatchObject({ from: 'elevated', to: 'high' });
  });

  // scoring-model-v2: per-axis drift from the dimensions vector.
  const dsnap = (dateKey, riskLevel, riskScore, dimensions) =>
    ({ dateKey, riskLevel, riskScore, trajectory: '', headline: '', dimensions });

  it('detects an axis move the blended scalar hides, and names the dimension', () => {
    // conflict stays 80 (the max → scalar flat at 80), but economic surges 30→72.
    const d = computeCountryDrift([
      dsnap('2026-06-01', 'high', 80, { conflict: 80, economic: 30 }),
      dsnap('2026-06-02', 'high', 80, { conflict: 80, economic: 72 }),
    ]);
    expect(d).not.toBeNull();                                    // pre-v2 (scalar-only) this was null
    expect(d.dims.some((x) => x.k === 'Risk score')).toBe(false); // scalar didn't move ≥8
    expect(d.dims.find((x) => x.k === 'Economic')).toMatchObject({ from: 30, to: 72, delta: 42, axis: true });
  });

  it('is sparsity-safe: no axis move when either side lacks that axis', () => {
    const d = computeCountryDrift([
      dsnap('2026-06-01', 'high', 80, { conflict: 80 }),                 // no economic signal
      dsnap('2026-06-02', 'high', 80, { conflict: 80, economic: 72 }),   // null→72 is not comparable
    ]);
    expect(d).toBeNull();
  });

  it('ignores a sub-threshold axis wiggle (|Δ|<8)', () => {
    const d = computeCountryDrift([
      dsnap('2026-06-01', 'high', 80, { conflict: 80, economic: 30 }),
      dsnap('2026-06-02', 'high', 80, { conflict: 80, economic: 35 }),
    ]);
    expect(d).toBeNull();
  });

  it('sorts axis moves worst-first and reads the {score} object shape', () => {
    const d = computeCountryDrift([
      dsnap('2026-06-01', 'high', 80, { conflict: { score: 80 }, economic: { score: 30 }, political: { score: 40 } }),
      dsnap('2026-06-02', 'high', 80, { conflict: { score: 80 }, economic: { score: 72 }, political: { score: 55 } }),
    ]);
    expect(d).not.toBeNull();
    expect(d.axisMoves.map((m) => m.axis)).toEqual(['economic', 'political']); // +42 before +15; conflict flat
  });
});
