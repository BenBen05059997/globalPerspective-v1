import { describe, it, expect } from 'vitest';
import { placeMapLabels } from '@/shared/map/mapLabels.js';

const measure = (t) => String(t).length * 10; // wide, deterministic glyphs

const mk = (id, x, y, text, r = 5) => ({ id, x, y, r, text });
const boxOf = (l) => {
  const w = measure(l.text) + 6;
  const x0 = l.anchor === 'start' ? l.x - 3 : l.anchor === 'end' ? l.x + 3 - w : l.x - w / 2;
  return { x0, x1: x0 + w, y0: l.y - 4 - 7, y1: l.y - 4 + 7 };
};
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

describe('placeMapLabels', () => {
  it('puts a label right of its marker when it fits', () => {
    const [l] = placeMapLabels([mk('a', 100, 50, 'Sudan')], { width: 800, height: 400, measure });
    expect(l).toMatchObject({ id: 'a', anchor: 'start', text: 'Sudan' });
    expect(l.x).toBeGreaterThan(105);
  });

  it('uses the measured width: a wide-glyph label flips left where the 6.2px guess would have fit', () => {
    const out = placeMapLabels([mk('g', 700, 50, 'Twelve chars')], { width: 800, height: 400, measure });
    expect(out[0].anchor).toBe('end');
    expect(boxOf(out[0]).x1).toBeLessThanOrEqual(792);
  });

  it('keeps every label inside the left and right edges (moves above/below when neither side fits)', () => {
    const out = placeMapLabels([mk('a', 100, 100, 'Long label here')], { width: 200, height: 300, measure });
    expect(out).toHaveLength(1);
    const b = boxOf(out[0]);
    expect(b.x0).toBeGreaterThanOrEqual(8);
    expect(b.x1).toBeLessThanOrEqual(192);
  });

  it('drops a label that fits nowhere inside the map', () => {
    const out = placeMapLabels([mk('a', 50, 100, 'This label is far too wide for the map')], { width: 200, height: 300, measure });
    expect(out).toEqual([]);
  });

  it('never overlaps another placed label; the higher priority one wins', () => {
    const items = [mk('a', 300, 100, 'France'), mk('b', 330, 104, 'Belgium'), mk('c', 340, 100, 'Germany')];
    const out = placeMapLabels(items, { width: 800, height: 400, measure });
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) expect(overlap(boxOf(out[i]), boxOf(out[j]))).toBe(false);
    }
    expect(out[0].id).toBe('a');
  });

  it('treats other markers as obstacles (moves to a free side) but ignores its own', () => {
    const obstacles = [{ id: 'a', x: 100, y: 100, r: 5 }, { id: 'z', x: 130, y: 100, r: 8 }];
    const [l] = placeMapLabels([mk('a', 100, 100, 'Qeshm')], { width: 800, height: 400, obstacles, measure });
    expect(l.anchor).not.toBe('start'); // the right side is covered by marker z
    expect(overlap(boxOf(l), { x0: 122, x1: 138, y0: 92, y1: 108 })).toBe(false);
  });

  it('re-running with zoomed (screen) positions re-checks the edge', () => {
    const at1 = placeMapLabels([mk('a', 600, 100, 'Sudan')], { width: 800, height: 400, measure });
    expect(at1[0].anchor).toBe('start');
    const zoomed = placeMapLabels([mk('a', 760, 100, 'Sudan')], { width: 800, height: 400, measure });
    expect(zoomed[0].anchor).not.toBe('start');
    expect(boxOf(zoomed[0]).x1).toBeLessThanOrEqual(792);
  });

  it('skips markers panned off screen and caps the number drawn', () => {
    const items = [mk('off', -20, 50, 'Gone'), mk('a', 100, 50, 'A'), mk('b', 100, 150, 'B'), mk('c', 100, 250, 'C')];
    const out = placeMapLabels(items, { width: 800, height: 400, measure, max: 2 });
    expect(out.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('ellipsizes very long text and keeps the full text', () => {
    const [l] = placeMapLabels([mk('a', 100, 50, 'x'.repeat(60))], { width: 800, height: 400, measure });
    expect(l.text.endsWith('…')).toBe(true);
    expect(l.full).toHaveLength(60);
  });
});
