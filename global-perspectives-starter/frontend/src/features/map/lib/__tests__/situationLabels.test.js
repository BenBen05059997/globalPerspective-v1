// buildLede's empty-state message (F4, review R2): the caller can supply a precise, computed
// empty message (e.g. "no disaster alerts open · news situations paused since <date>") instead
// of the generic "quiet" claim, which used to show even while news analysis was paused.
import { describe, it, expect } from 'vitest';
import { buildLede } from '@/features/map/lib/situationLabels.js';

describe('buildLede', () => {
  it('uses the generic quiet line when no situations are open and no emptyMessage is given', () => {
    expect(buildLede([], null)).toBe('The map is quiet — no situations open right now.');
  });

  it('uses the caller-supplied emptyMessage when no situations are open', () => {
    expect(buildLede([], null, 'No disaster alerts open · news situations paused since Sep 12')).toBe(
      'No disaster alerts open · news situations paused since Sep 12'
    );
  });

  it('ignores emptyMessage when situations ARE open', () => {
    const open = [{ tier: 'high', axis: 'conflict', iso3_affected: [] }];
    expect(buildLede(open, null, 'should not appear')).not.toBe('should not appear');
    expect(buildLede(open, null, 'should not appear')).toMatch(/high-tier situation/);
  });
});
