import { describe, it, expect } from 'vitest';
import { placeMapLabels } from '@/shared/map/mapLabels.js';

describe('placeMapLabels', () => {
  it('puts a label right of its marker when it fits', () => {
    const [l] = placeMapLabels([{ id: 'a', x: 100, y: 50, off: 10, text: 'Sudan' }], { width: 800 });
    expect(l).toEqual({ id: 'a', x: 110, y: 50, anchor: 'start', text: 'Sudan' });
  });

  it('flips a label left of its marker near the right edge instead of clipping it', () => {
    const [l] = placeMapLabels([{ id: 'g', x: 780, y: 50, off: 10, text: 'Guam, Northern Mariana Islands' }], { width: 800 });
    expect(l.anchor).toBe('end');
    expect(l.x).toBe(770);
  });

  it('drops a lower-priority label that would overlap one already placed', () => {
    const out = placeMapLabels([
      { id: 'a', x: 400, y: 100, off: 10, text: 'France — strikes' },
      { id: 'b', x: 410, y: 106, off: 10, text: 'Belgium — protests' },
      { id: 'c', x: 400, y: 200, off: 10, text: 'Spain — floods' },
    ], { width: 800 });
    expect(out.map((l) => l.id)).toEqual(['a', 'c']);
  });
});
