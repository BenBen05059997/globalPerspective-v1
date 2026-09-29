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

  it('says not enough readings when there is no reading 4-10 days before the latest', () => {
    // only same-week and 20-day-old readings: nothing near 7 days earlier
    const snaps = [snap(iso(20, now), 50), snap(iso(2, now), 50), snap(iso(0, now), 50)];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('not_enough');
    expect(d.reason).toMatch(/7 days earlier/);
    expect(directionLabel(d)).toMatch(/not enough readings/);
    expect(computeCountryDirection([snap(iso(0, now), 50)], now).state).toBe('not_enough');
  });

  it('reports "at top of scale" when both readings are >= 95', () => {
    const snaps = [snap(iso(7, now), 97), snap(iso(0, now), 99)];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('top');
    expect(d.arrow).toBeNull();
    expect(directionLabel(d)).toBe('at top of scale');
  });

  it('weekly readings: an "up" (worse) arrow when the delta is >= 15, comparing with the reading ~7 days earlier', () => {
    const snaps = [snap(iso(14, now), 20), snap(iso(7, now), 30), snap(iso(0, now), 46)];
    const d = computeCountryDirection(snaps, now);
    expect(d.state).toBe('arrow');
    expect(d.arrow).toBe('up');
    expect(d.delta).toBe(16);
    expect(d.priorAsOf).toBe(iso(7, now));   // not the 14-day-old one
    expect(directionLabel(d)).toBe('worse');
  });

  it('reports a "down" (better) arrow when the delta is <= -15', () => {
    const d = computeCountryDirection([snap(iso(7, now), 70), snap(iso(0, now), 52)], now);
    expect(d.state).toBe('arrow');
    expect(d.arrow).toBe('down');
    expect(directionLabel(d)).toBe('better');
  });

  it('a 10-14 point move is "unchanged" now (single readings are noisier than a median of 3)', () => {
    for (const later of [40, 44, 16, 20]) {
      const d = computeCountryDirection([snap(iso(7, now), 30), snap(iso(0, now), later)], now);
      expect(d.state).toBe('unchanged');
      expect(d.arrow).toBeNull();
    }
    expect(computeCountryDirection([snap(iso(7, now), 30), snap(iso(0, now), 45)], now).state).toBe('arrow'); // exactly 15
  });

  it('accepts a prior reading 4-10 days back, picks the one nearest 7, rejects 3 and 11', () => {
    const d = computeCountryDirection([snap(iso(10, now), 10), snap(iso(6, now), 50), snap(iso(0, now), 70)], now);
    expect(d.priorAsOf).toBe(iso(6, now));
    expect(computeCountryDirection([snap(iso(3, now), 10), snap(iso(0, now), 70)], now).state).toBe('not_enough');
    expect(computeCountryDirection([snap(iso(11, now), 10), snap(iso(0, now), 70)], now).state).toBe('not_enough');
    expect(computeCountryDirection([snap(iso(4, now), 10), snap(iso(0, now), 70)], now).state).toBe('arrow');
    expect(computeCountryDirection([snap(iso(10, now), 10), snap(iso(0, now), 70)], now).state).toBe('arrow');
  });

  it('uses the median of readings within 3 days of the latest as "now" (an early refresh does not swing it)', () => {
    const d = computeCountryDirection([snap(iso(7, now), 30), snap(iso(2, now), 50), snap(iso(1, now), 52), snap(iso(0, now), 90)], now);
    expect(d.scoreA).toBe(52);
    expect(d.priorAsOf).toBe(iso(7, now));
  });

  it('names an axis only when its own delta is >= 15', () => {
    const dimsPrior = { conflict: 30, political: 40, economic: 20, humanitarian: 10 };
    const dimsLater = { conflict: 30, political: 60, economic: 20, humanitarian: 10 }; // +20 political
    const d = computeCountryDirection([snap(iso(7, now), null, dimsPrior), snap(iso(0, now), null, dimsLater)], now);
    expect(d.state).toBe('arrow');
    expect(d.axis?.key).toBe('political');
  });

  it('marks readings 14-30 days old amber, <14 days full', () => {
    expect(computeCountryDirection([snap(iso(20, now), 50), snap(iso(13, now), 50)], now).freshness).toBe('full');
    const older = computeCountryDirection([snap(iso(22, now), 50), snap(iso(15, now), 50)], now);
    expect(older.freshness).toBe('amber');
    expect(older.state).toBe('unchanged');
  });
});
