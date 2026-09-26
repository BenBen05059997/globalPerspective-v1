import { describe, it, expect } from 'vitest';
import { bearingDeg, beamCrossed, scanGlow, sweepControlState } from '@/features/map/lib/radar.js';

describe('radar — bearingDeg', () => {
  it('reads 0° due east of centre', () => {
    expect(bearingDeg(10, 0, 0, 0)).toBeCloseTo(0);
  });
  it('reads 90° due south (screen y grows downward)', () => {
    expect(bearingDeg(0, 10, 0, 0)).toBeCloseTo(90);
  });
  it('reads 180° due west', () => {
    expect(bearingDeg(-10, 0, 0, 0)).toBeCloseTo(180);
  });
  it('reads 270° due north, never negative', () => {
    expect(bearingDeg(0, -10, 0, 0)).toBeCloseTo(270);
  });
});

describe('radar — beamCrossed', () => {
  it('detects a crossing within a simple forward tick', () => {
    expect(beamCrossed(10, 20, 15)).toBe(true);
  });
  it('does not fire for a marker the beam has not reached yet', () => {
    expect(beamCrossed(10, 20, 25)).toBe(false);
  });
  it('does not re-fire for a marker already passed earlier this lap', () => {
    expect(beamCrossed(10, 20, 5)).toBe(false);
  });
  it('handles the wrap at 360→0', () => {
    expect(beamCrossed(350, 10, 5)).toBe(true);   // just past the wrap
    expect(beamCrossed(350, 10, 355)).toBe(true); // just before the wrap — still within this tick's span
    expect(beamCrossed(350, 10, 200)).toBe(false); // nowhere near this tick's span
  });
  it('is a no-op for a zero-length tick (paused sweep)', () => {
    expect(beamCrossed(40, 40, 40)).toBe(false);
  });
  it('is false for null/missing inputs', () => {
    expect(beamCrossed(null, 10, 5)).toBe(false);
    expect(beamCrossed(10, null, 5)).toBe(false);
    expect(beamCrossed(10, 20, null)).toBe(false);
  });
});

describe('radar — scanGlow', () => {
  it('is 1 right at the leading edge', () => {
    expect(scanGlow(40, 40)).toBeCloseTo(1);
  });
  it('fades linearly across the trail window', () => {
    expect(scanGlow(45, 10, 40)).toBeCloseTo(1 - 35 / 40);
  });
  it('is 0 once past the trail window', () => {
    expect(scanGlow(100, 10, 40)).toBe(0);
  });
  it('handles the wrap at 360→0', () => {
    expect(scanGlow(5, 355, 40)).toBeCloseTo(1 - 10 / 40);
  });
});

describe('radar — sweepControlState', () => {
  it('is disabled with an explanatory label under reduced motion', () => {
    expect(sweepControlState(true, true)).toEqual({ disabled: true, pressed: false, label: 'Sweep off (reduced motion)' });
  });
  it('reflects sweeping/paused state when motion is allowed', () => {
    expect(sweepControlState(false, true)).toEqual({ disabled: false, pressed: true, label: 'Pause sweep' });
    expect(sweepControlState(false, false)).toEqual({ disabled: false, pressed: false, label: 'Resume sweep' });
  });
});
