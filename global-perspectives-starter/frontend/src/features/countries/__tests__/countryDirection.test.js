import { describe, it, expect } from 'vitest';
import { computeCountryDirection, directionLabel } from '@/features/countries/lib/countryDirection.js';

const DAY = 86400000;
function iso(daysAgo, now) {
  return new Date(now - daysAgo * DAY).toISOString().slice(0, 10);
}

function snap(dateKey, score, dims = null) {
  return dims ? { dateKey, dimensions: dims } : { dateKey, riskScore: score };
}

describe('computeCountryDirection', () => {
  const now = Date.UTC(2026, 8, 27); // 2026-09-27

  it('hides when the latest reading is older than 30 days', () => {
    const snaps = [snap(iso(40, now), 80), snap(iso(35, now), 82), snap(iso(31, now), 85)];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('hidden');
  });

  it('says not enough readings with no history', () => {
    expect(computeCountryDirection([], now).state).toBe('not_enough');
  });

  it('says not enough readings when the recent bucket has a gap > 5 days', () => {
    const snaps = [snap(iso(20, now), 50), snap(iso(10, now), 50), snap(iso(0, now), 50)];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('not_enough');
  });

  it('reports "at top of scale" when both medians are >= 95', () => {
    const snaps = [
      snap(iso(17, now), 96), snap(iso(15, now), 97), snap(iso(13, now), 96),
      snap(iso(2, now), 98), snap(iso(1, now), 97), snap(iso(0, now), 99),
    ];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('top');
    expect(d.arrow).toBeNull();
    expect(directionLabel(d)).toBe('at top of scale');
  });

  it('reports an "up" (worse) arrow when the delta is >= 10', () => {
    const snaps = [
      snap(iso(17, now), 30), snap(iso(15, now), 32), snap(iso(13, now), 31),
      snap(iso(2, now), 55), snap(iso(1, now), 56), snap(iso(0, now), 54),
    ];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('arrow');
    expect(d.arrow).toBe('up');
    expect(directionLabel(d)).toBe('worse');
  });

  it('reports a "down" (better) arrow when the delta is <= -10', () => {
    const snaps = [
      snap(iso(17, now), 70), snap(iso(15, now), 72), snap(iso(13, now), 71),
      snap(iso(2, now), 40), snap(iso(1, now), 41), snap(iso(0, now), 39),
    ];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('arrow');
    expect(d.arrow).toBe('down');
    expect(directionLabel(d)).toBe('better');
  });

  it('reports "unchanged" when |delta| < 10', () => {
    const snaps = [
      snap(iso(17, now), 50), snap(iso(15, now), 51), snap(iso(13, now), 49),
      snap(iso(2, now), 53), snap(iso(1, now), 52), snap(iso(0, now), 51),
    ];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('unchanged');
    expect(d.arrow).toBeNull();
  });

  it('names an axis only when its own delta is >= 15', () => {
    const dimsPrior = { conflict: 30, political: 40, economic: 20, humanitarian: 10 };
    const dimsLater = { conflict: 30, political: 60, economic: 20, humanitarian: 10 }; // +20 political
    const snaps = [
      snap(iso(17, now), null, dimsPrior), snap(iso(15, now), null, dimsPrior), snap(iso(13, now), null, dimsPrior),
      snap(iso(2, now), null, dimsLater), snap(iso(1, now), null, dimsLater), snap(iso(0, now), null, dimsLater),
    ];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('arrow');
    expect(d.axis?.key).toBe('political');
  });

  it('marks 7-30 day-old readings amber, <=7 day full', () => {
    const snapsFresh = [
      snap(iso(17, now), 50), snap(iso(15, now), 50), snap(iso(13, now), 50),
      snap(iso(2, now), 50), snap(iso(1, now), 50), snap(iso(0, now), 50),
    ];
    expect(computeCountryDirection(snapsFresh, now).freshness).toBe('full');

    const snapsOlder = [
      snap(iso(30, now), 50), snap(iso(28, now), 50), snap(iso(26, now), 50),
      snap(iso(16, now), 50), snap(iso(15, now), 50), snap(iso(14, now), 50),
    ];
    expect(computeCountryDirection(snapsOlder, now).freshness).toBe('amber');
  });
});
