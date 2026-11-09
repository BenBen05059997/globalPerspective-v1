import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ICON_MAPPING, CORNER_SIZE, BRACKET_GAP, ATLAS_W, ATLAS_H,
  diamondSize, bracketCorners, getIconAtlas,
} from '@/shared/map/globeIcons.js';

describe('globeIcons (pixel-space alert and bracket sprites)', () => {
  it('contains the alert diamond and selection corner', () => {
    expect(Object.keys(ICON_MAPPING)).toEqual(['diamond', 'corner']);
  });

  it('every sprite lies inside the atlas and is tinted per marker (mask)', () => {
    for (const [k, m] of Object.entries(ICON_MAPPING)) {
      expect(m.mask, k).toBe(true);
      expect(m.x + m.width, k).toBeLessThanOrEqual(ATLAS_W);
      expect(m.y + m.height, k).toBeLessThanOrEqual(ATLAS_H);
    }
  });

  it('diamond sprite height is proportional to its half-diagonal (constant in screen px)', () => {
    expect(diamondSize(10)).toBeCloseTo(2 * diamondSize(5), 6);
    expect(diamondSize(5)).toBeGreaterThan(10); // the sprite has a little AA margin around the shape
  });

  it('four bracket corners around the marker, one per quadrant, rotated a quarter turn each', () => {
    const b = 9 + BRACKET_GAP;
    const cs = bracketCorners(b);
    expect(cs).toHaveLength(4);
    expect(new Set(cs.map((c) => `${Math.sign(c.offset[0])},${Math.sign(c.offset[1])}`)).size).toBe(4);
    for (const c of cs) expect(Math.abs(c.offset[0])).toBe(b);
    expect(cs.map((c) => c.angle)).toEqual([0, -90, -180, -270]);
    expect(CORNER_SIZE).toBeGreaterThan(0);
  });

  describe('atlas', () => {
    afterEach(() => vi.restoreAllMocks());

    it('draws no atlas where there is no 2D canvas, instead of a wrong stand-in', () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      expect(getIconAtlas()).toBeNull();
    });

    it('paints every sprite white (tinted per marker later): the diamond filled, one bracket corner stroked', () => {
      const calls = { fill: 0, stroke: 0 };
      const ctx = new Proxy({}, { get: (t, k) => (k === 'fill' ? () => { calls.fill += 1; } : k === 'stroke' ? () => { calls.stroke += 1; } : (t[k] ?? (() => {}))), set: (t, k, v) => { t[k] = v; return true; } });
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
      const cv = getIconAtlas();
      expect(cv.width).toBe(ATLAS_W);
      expect(cv.height).toBe(ATLAS_H);
      expect(calls).toEqual({ fill: 1, stroke: 1 });
      expect(getIconAtlas()).toBe(cv); // built once, shared by every layer
    });
  });
});
