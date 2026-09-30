import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ICON_MAPPING, GLYPH_PTS, GLYPH_SIZE, EDGE_SCALE, CORNER_SIZE, BADGE_GAP, BRACKET_GAP, ATLAS_W, ATLAS_H,
  diamondSize, badgeOffset, bracketCorners, getIconAtlas,
} from '@/features/map/lib/globeIcons.js';
import { STATUS_GLYPHS } from '@/features/map/lib/legend.js';

describe('globeIcons (pixel-space badge / alert / bracket sprites)', () => {
  it('has one sprite per legend glyph, plus the alert diamond and the bracket corner', () => {
    for (const key of Object.keys(STATUS_GLYPHS)) {
      expect(ICON_MAPPING[key], key).toBeTruthy();
      expect(GLYPH_PTS[key].length).toBeGreaterThanOrEqual(3);
    }
    expect(ICON_MAPPING.diamond).toBeTruthy();
    expect(ICON_MAPPING.corner).toBeTruthy();
  });

  it('every sprite lies inside the atlas and is tinted per marker (mask)', () => {
    for (const [k, m] of Object.entries(ICON_MAPPING)) {
      expect(m.mask, k).toBe(true);
      expect(m.x + m.width, k).toBeLessThanOrEqual(ATLAS_W);
      expect(m.y + m.height, k).toBeLessThanOrEqual(ATLAS_H);
    }
  });

  it('glyph sprites stay inside their cell, edge included (edge = glyph x1.45, same anchor)', () => {
    const half = GLYPH_SIZE / 2;
    for (const pts of Object.values(GLYPH_PTS)) {
      for (const [x, y] of pts) {
        expect(Math.abs(x) * EDGE_SCALE).toBeLessThan(half);
        expect(Math.abs(y) * EDGE_SCALE).toBeLessThan(half);
      }
    }
  });

  it('badge sits up-right of the marker by a fixed pixel offset (deck +y is down)', () => {
    expect(badgeOffset(9)).toEqual([9 + BADGE_GAP, -(9 + BADGE_GAP)]);
    expect(badgeOffset(14)[0]).toBeGreaterThan(badgeOffset(4)[0]);
    const [dx, dy] = badgeOffset(6.5);
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeLessThan(0);
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

    it('paints every sprite white (tinted per marker later): 4 glyphs + the diamond filled, one bracket corner stroked', () => {
      const calls = { fill: 0, stroke: 0 };
      const ctx = new Proxy({}, { get: (t, k) => (k === 'fill' ? () => { calls.fill += 1; } : k === 'stroke' ? () => { calls.stroke += 1; } : (t[k] ?? (() => {}))), set: (t, k, v) => { t[k] = v; return true; } });
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
      const cv = getIconAtlas();
      expect(cv.width).toBe(ATLAS_W);
      expect(cv.height).toBe(ATLAS_H);
      expect(calls).toEqual({ fill: 5, stroke: 1 });
      expect(getIconAtlas()).toBe(cv); // built once, shared by every layer
    });
  });
});
