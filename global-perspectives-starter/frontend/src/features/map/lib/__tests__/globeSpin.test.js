import { describe, it, expect } from 'vitest';
import { textureUrl, wrapLongitude, spinStep, defaultMapView, spinControlState } from '@/features/map/lib/globeSpin.js';

describe('globeSpin — textureUrl', () => {
  it('builds the path under a root base', () => {
    expect(textureUrl('/')).toBe('/textures/earth-night.jpg');
  });
  it('strips a trailing slash so the path never doubles up', () => {
    expect(textureUrl('/app/')).toBe('/app/textures/earth-night.jpg');
  });
  it('defaults to root when base is missing', () => {
    expect(textureUrl()).toBe('/textures/earth-night.jpg');
    expect(textureUrl('')).toBe('/textures/earth-night.jpg');
  });
});

describe('globeSpin — wrapLongitude', () => {
  it('leaves an in-range longitude untouched', () => {
    expect(wrapLongitude(12)).toBe(12);
    expect(wrapLongitude(-90)).toBe(-90);
  });
  it('wraps past +180 back around', () => {
    expect(wrapLongitude(190)).toBeCloseTo(-170);
  });
  it('wraps past -180 back around', () => {
    expect(wrapLongitude(-190)).toBeCloseTo(170);
  });
});

describe('globeSpin — spinStep', () => {
  it('advances longitude proportional to elapsed time and rate', () => {
    expect(spinStep(0, 1000, 3)).toBeCloseTo(3);
    expect(spinStep(0, 500, 3)).toBeCloseTo(1.5);
  });
  it('wraps the result across the antimeridian', () => {
    expect(spinStep(179, 1000, 3)).toBeCloseTo(-178);
  });
  it('is a no-op for a non-positive or non-finite dt (e.g. the first animation frame)', () => {
    expect(spinStep(10, 0)).toBe(10);
    expect(spinStep(10, -5)).toBe(10);
    expect(spinStep(10, NaN)).toBe(10);
  });
});

describe('globeSpin — defaultMapView', () => {
  it('opens on the globe for a desktop-width viewport with WebGL', () => {
    expect(defaultMapView(1280, true)).toBe('globe');
    expect(defaultMapView(900, true)).toBe('globe');
  });
  it('keeps the flat default under 900px even with WebGL', () => {
    expect(defaultMapView(599, true)).toBe('flat');
  });
  it('always falls back to flat without WebGL', () => {
    expect(defaultMapView(1920, false)).toBe('flat');
  });
});

describe('globeSpin — spinControlState', () => {
  it('is disabled with an explanatory label under reduced motion, regardless of spinOn', () => {
    expect(spinControlState(true, true)).toEqual({ disabled: true, pressed: false, label: 'Spin off (reduced motion)' });
    expect(spinControlState(true, false)).toEqual({ disabled: true, pressed: false, label: 'Spin off (reduced motion)' });
  });
  it('reflects spinning/paused state when motion is allowed', () => {
    expect(spinControlState(false, true)).toEqual({ disabled: false, pressed: true, label: 'Pause spin' });
    expect(spinControlState(false, false)).toEqual({ disabled: false, pressed: false, label: 'Resume spin' });
  });
});
