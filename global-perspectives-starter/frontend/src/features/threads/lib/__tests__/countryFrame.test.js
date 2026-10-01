import { describe, it, expect } from 'vitest';
import { countryFrameBounds, frameViewBox, WORLD_W, WORLD_H } from '@/features/threads/lib/countryFrame';

const mid = (b) => ({ lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 });

describe('countryFrameBounds (real 110m coastlines)', () => {
  it('Iran: a polygon box around Iran, centre near its catalogue centroid', () => {
    const b = countryFrameBounds('IR');
    expect(b.source).toBe('polygon');
    expect(b.west).toBeGreaterThan(43); expect(b.east).toBeLessThan(64);
    expect(b.south).toBeGreaterThan(24); expect(b.north).toBeLessThan(40);
  });
  it('Japan: spans the islands (Kyushu to Hokkaido), not one island', () => {
    const b = countryFrameBounds('JP');
    expect(b.source).toBe('polygon');
    expect(b.north).toBeGreaterThan(43); expect(b.south).toBeLessThan(33);
    expect(b.east).toBeLessThan(150);
  });
  it('Mexico', () => {
    const b = countryFrameBounds('MX');
    expect(b.west).toBeGreaterThan(-119); expect(b.east).toBeLessThan(-85);
    expect(b.north).toBeLessThan(33.5); expect(b.south).toBeGreaterThan(13);
  });
  it('France: overseas parts (French Guiana) do not stretch the frame', () => {
    const b = countryFrameBounds('FR');
    expect(b.west).toBeGreaterThan(-10); expect(b.east).toBeLessThan(15);
  });
  it('Singapore sits inside the 110m Malaysia polygon but is not framed as Malaysia', () => {
    const b = countryFrameBounds('SG');
    expect(b.source).toBe('centroid');
    expect(b.east - b.west).toBeLessThanOrEqual(6.01);
  });
  it('the United States is found by polygon although the mesh calls it "United States of America"', () => {
    const b = countryFrameBounds('US');
    expect(b.source).toBe('polygon');
    expect(b.west).toBeLessThan(-120); expect(b.east).toBeGreaterThan(-80);
  });
  it('a country absent from the 110m mesh gets a centroid box and says so', () => {
    const b = countryFrameBounds('MT');
    expect(b.source).toBe('centroid');
    expect(mid(b).lat).toBeCloseTo(35.9375, 3);
  });
  it('unknown / missing code -> null', () => {
    expect(countryFrameBounds('ZZ')).toBeNull();
    expect(countryFrameBounds(null)).toBeNull();
  });
});

describe('frameViewBox', () => {
  const size = { w: 1440, h: 200 };
  const insets = { top: 56 };
  // Where does the world point (lng, lat) land, in px, with this viewBox?
  const toPx = (vb, lng, lat) => ({
    x: (((lng + 180) / 360) * WORLD_W - vb.x) * vb.scale,
    y: (((90 - lat) / 180) * WORLD_H - vb.y) * vb.scale,
  });
  it('puts the country centre at the centre of the band below the overlay', () => {
    for (const code of ['IR', 'JP', 'MX', 'MT']) {
      const b = countryFrameBounds(code);
      const vb = frameViewBox(b, size, insets);
      const p = toPx(vb, mid(b).lng, mid(b).lat);
      expect(p.x).toBeCloseTo(720, 0);
      expect(p.y).toBeCloseTo(56 + (200 - 56) / 2, 0);
    }
  });
  it('fits the bounds inside the visible band (never under the overlay)', () => {
    const b = countryFrameBounds('MX');
    const vb = frameViewBox(b, size, insets);
    const nw = toPx(vb, b.west, b.north);
    const se = toPx(vb, b.east, b.south);
    expect(nw.y).toBeGreaterThanOrEqual(56);
    expect(se.y).toBeLessThanOrEqual(200);
    expect(nw.x).toBeGreaterThanOrEqual(0);
    expect(se.x).toBeLessThanOrEqual(1440);
  });
  it('the viewBox keeps the container aspect ratio', () => {
    const vb = frameViewBox(countryFrameBounds('JP'), size, insets);
    expect(vb.w / vb.h).toBeCloseTo(1440 / 200, 5);
  });
});
