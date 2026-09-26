import { describe, it, expect } from 'vitest';
import { textureUrl, wrapLongitude, spinStep, defaultMapView, normalizeStoredView, spinControlState, globeZoomForHeight, globeFitFraction, GLOBE_LIMB_FACTOR } from '@/features/map/lib/globeSpin.js';

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

describe('globeSpin — defaultMapView (M4: radar replaces the old flat default)', () => {
  it('opens on the globe for a desktop-width viewport with WebGL', () => {
    expect(defaultMapView(1280, true)).toBe('globe');
    expect(defaultMapView(900, true)).toBe('globe');
  });
  it('opens on radar under 900px even with WebGL', () => {
    expect(defaultMapView(599, true)).toBe('radar');
  });
  it('always falls back to radar without WebGL, any width', () => {
    expect(defaultMapView(1920, false)).toBe('radar');
    expect(defaultMapView(320, false)).toBe('radar');
  });
});

describe('globeSpin — normalizeStoredView', () => {
  it('keeps a stored globe choice', () => {
    expect(normalizeStoredView('globe')).toBe('globe');
  });
  it('keeps a stored radar choice', () => {
    expect(normalizeStoredView('radar')).toBe('radar');
  });
  it('migrates a pre-M4 stored "flat" choice to radar', () => {
    expect(normalizeStoredView('flat')).toBe('radar');
  });
  it('returns null for missing/unrecognised values, so the caller computes a default', () => {
    expect(normalizeStoredView(null)).toBeNull();
    expect(normalizeStoredView(undefined)).toBeNull();
    expect(normalizeStoredView('bogus')).toBeNull();
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

describe('globeSpin — globeZoomForHeight (M6: size the globe from the panel height)', () => {
  it('makes the globe diameter ~80% of the panel height by default', () => {
    const height = 620;
    const zoom = globeZoomForHeight(height);
    const diameter = (512 * 2 ** zoom) / Math.PI;
    expect(diameter / height).toBeCloseTo(0.8, 5);
  });
  it('grows with a taller panel', () => {
    expect(globeZoomForHeight(900)).toBeGreaterThan(globeZoomForHeight(500));
  });
  it('respects a custom fraction within the 75–85% band', () => {
    const height = 700;
    for (const fraction of [0.75, 0.8, 0.85]) {
      const zoom = globeZoomForHeight(height, fraction);
      const diameter = (512 * 2 ** zoom) / Math.PI;
      expect(diameter / height).toBeCloseTo(fraction, 5);
    }
  });
  it('falls back to the pre-M6 default zoom for a missing/invalid height', () => {
    expect(globeZoomForHeight(0)).toBe(0.55);
    expect(globeZoomForHeight(-10)).toBe(0.55);
    expect(globeZoomForHeight(NaN)).toBe(0.55);
    expect(globeZoomForHeight(undefined)).toBe(0.55);
  });
});

describe('globeSpin — globeFitFraction (R4a: full-bleed console band)', () => {
  const visibleShare = (w, h) => (globeFitFraction(w, h) * GLOBE_LIMB_FACTOR);
  it('asks for a visible disc of 78% of the map height when the band is wide enough', () => {
    expect(visibleShare(900, 848)).toBeCloseTo(0.78, 5);
  });
  it('shrinks the globe to 92% of a narrow band so the HUD columns never crop it', () => {
    expect(visibleShare(500, 848)).toBeCloseTo((0.92 * 500) / 848, 5);
  });
  it('keeps at least 70% of the height at the 1440×900 and 1280×720 console bands', () => {
    expect(visibleShare(712, 848)).toBeGreaterThanOrEqual(0.7);
    expect(visibleShare(622, 668)).toBeGreaterThanOrEqual(0.7);
  });
  it('falls back to the default for missing sizes', () => {
    expect(visibleShare(null, 700)).toBeCloseTo(0.78, 5);
    expect(visibleShare(700, 0)).toBeCloseTo(0.78, 5);
  });
});
