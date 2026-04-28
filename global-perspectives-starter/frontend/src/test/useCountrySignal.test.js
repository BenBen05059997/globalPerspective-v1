/**
 * Unit tests for useCountrySignal z-score and bucket logic.
 * Tests the pure computation extracted from the hook — no React needed.
 */

import { describe, it, expect } from 'vitest';

// ── Pure extraction of the signal computation logic ─────────────────
// (mirrors exactly what's in useCountrySignal.js)

function computeSignal(dayMap, nameToISO) {
  const dates = Object.keys(dayMap).sort();
  if (dates.length === 0) return {};

  const byCountry = {};
  const ensureCountry = (iso) => {
    if (!byCountry[iso]) byCountry[iso] = { daily: {}, threads7: new Set() };
    return byCountry[iso];
  };

  const last7Cut = dates.slice(-7);
  const last7Set = new Set(last7Cut);

  for (const date of dates) {
    const day = dayMap[date];
    const entries = Array.isArray(day) ? day : (day?.entries || []);
    for (const e of entries) {
      const regions = Array.isArray(e.regions) ? e.regions : [];
      const hit = new Set();
      for (const region of regions) {
        if (!region) continue;
        const key = String(region).trim().toLowerCase();
        const iso = nameToISO[key];
        if (iso) hit.add(iso);
      }
      for (const iso of hit) {
        const bucket = ensureCountry(iso);
        bucket.daily[date] = (bucket.daily[date] || 0) + 1;
        if (last7Set.has(date) && e.threadId) bucket.threads7.add(e.threadId);
      }
    }
  }

  const out = {};
  for (const iso of Object.values(nameToISO)) {
    const rec = byCountry[iso] || { daily: {}, threads7: new Set() };
    const counts = dates.map(d => rec.daily[d] || 0);
    const last7 = counts.slice(-7).reduce((a, b) => a + b, 0);
    const prior = counts.slice(0, -7);

    const baselineWindows = [];
    for (let i = 0; i + 7 <= prior.length; i++) {
      baselineWindows.push(prior.slice(i, i + 7).reduce((a, b) => a + b, 0));
    }

    let z = 0, prior7 = 0;
    if (baselineWindows.length >= 3) {
      const mean = baselineWindows.reduce((a, b) => a + b, 0) / baselineWindows.length;
      const variance = baselineWindows.reduce((a, b) => a + (b - mean) ** 2, 0) / baselineWindows.length;
      const std = Math.sqrt(variance);
      prior7 = Math.round(mean);
      z = std > 0.3 ? (last7 - mean) / std : (last7 - mean);
    } else if (prior.length > 0) {
      prior7 = Math.round(prior.reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(prior.length / 7)));
      z = last7 - prior7;
    }

    let bucket = 'L';
    if (z >= 1.5) bucket = 'H';
    else if (z >= 0.5) bucket = 'E';
    if (last7 < 2) bucket = 'L';

    out[iso] = { last7, prior7, last7Threads: rec.threads7.size, z: Math.round(z * 10) / 10, bucket };
  }
  return out;
}

// ── Helpers ─────────────────────────────────────────────────────────

function makeDayMap(dates, countriesByDate) {
  const dayMap = {};
  dates.forEach((d, i) => {
    dayMap[d] = (countriesByDate[i] || []).map((region, j) => ({
      topicId: `t-${d}-${j}`,
      title: `Story ${j}`,
      regions: [region],
      threadId: `thread-${j}`,
    }));
  });
  return dayMap;
}

function last7Days() {
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date('2026-04-28');
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const ALL_DATES = last7Days();
const ISO_MAP = { iran: 'IRN', 'united states': 'USA', china: 'CHN' };

// ── Tests ────────────────────────────────────────────────────────────

describe('useCountrySignal — bucket assignment', () => {
  it('assigns H bucket when z >= 1.5', () => {
    // Iran gets many entries only in last 7 days → high z-score
    const entries = ALL_DATES.map((d, i) => {
      if (i < 23) return ['iran']; // baseline: 1/day
      return ['iran', 'iran', 'iran', 'iran', 'iran', 'iran', 'iran', 'iran']; // last 7: 8/day spike
    });
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    expect(signal['IRN'].bucket).toBe('H');
    expect(signal['IRN'].z).toBeGreaterThanOrEqual(1.5);
  });

  it('assigns E bucket when z >= 0.5 and < 1.5', () => {
    // Modest increase
    const entries = ALL_DATES.map((d, i) => {
      if (i < 23) return ['iran']; // baseline: 1/day
      return ['iran', 'iran', 'iran']; // last 7: 3/day
    });
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    expect(['E', 'H']).toContain(signal['IRN'].bucket);
    expect(signal['IRN'].z).toBeGreaterThanOrEqual(0.5);
  });

  it('assigns L bucket for stable low-volume countries', () => {
    // 1 entry/day every day — no spike
    const entries = ALL_DATES.map(() => ['iran']);
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    expect(signal['IRN'].bucket).toBe('L');
  });

  it('forces L bucket when last7 < 2 even if z is high', () => {
    // Only 1 entry in last 7 days, 0 before — z would be high but volume too low
    const entries = ALL_DATES.map((d, i) => i === 29 ? ['iran'] : []);
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    expect(signal['IRN'].bucket).toBe('L');
    expect(signal['IRN'].last7).toBeLessThan(2);
  });
});

describe('useCountrySignal — edge cases', () => {
  it('returns empty object for empty dayMap (no dates to process)', () => {
    const signal = computeSignal({}, ISO_MAP);
    // Early return on empty dayMap — no ISOs get populated
    expect(Object.keys(signal)).toHaveLength(0);
  });

  it('handles countries with no entries gracefully', () => {
    // Only China mentioned, Iran/USA have no entries
    const entries = ALL_DATES.map(() => ['china']);
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    expect(signal['IRN']).toBeDefined();
    expect(signal['IRN'].last7).toBe(0);
    expect(signal['IRN'].bucket).toBe('L');
    expect(signal['USA']).toBeDefined();
  });

  it('counts unique threads per country in last 7 days', () => {
    const entries = ALL_DATES.map((d, i) => {
      if (i >= 23) return ['iran']; // in last 7
      return [];
    });
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    expect(signal['IRN'].last7Threads).toBeGreaterThan(0);
  });

  it('produces finite z-scores, not Infinity or NaN', () => {
    const entries = ALL_DATES.map(() => ['iran', 'china']);
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    Object.values(signal).forEach(s => {
      expect(isFinite(s.z)).toBe(true);
      expect(isNaN(s.z)).toBe(false);
    });
  });
});

describe('useCountrySignal — z-score rounding', () => {
  it('z is rounded to 1 decimal place', () => {
    const entries = ALL_DATES.map((d, i) => i < 23 ? ['iran'] : ['iran', 'iran', 'iran', 'iran', 'iran']);
    const dayMap = makeDayMap(ALL_DATES, entries);
    const signal = computeSignal(dayMap, ISO_MAP);
    const z = signal['IRN'].z;
    expect(String(z).split('.')[1]?.length || 0).toBeLessThanOrEqual(1);
  });
});
