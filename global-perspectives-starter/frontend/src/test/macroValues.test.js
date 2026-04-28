/**
 * Tests for macro value extraction — guards against the {value,year} object bug.
 * World Bank macros from newsMarketsData are stored as {value, year} objects,
 * not raw numbers. Both CountryPage and WorldMapV2 crashed rendering them
 * directly as React children before the fix.
 */

import { describe, it, expect } from 'vitest';

// ── The extraction function (mirrors what's in CountryPage + WorldMapV2) ──
const mv = (f) => (f != null && typeof f === 'object' ? f.value : f);

// ── The formatting function (also used in both components) ───────────
function fmtMacro(val, opts = {}) {
  const { prefix = '', suffix = '', decimals = 1 } = opts;
  const n = mv(val);
  if (n == null || isNaN(Number(n))) return '—';
  return `${prefix}${Number(n).toFixed(decimals)}${suffix}`;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('mv() — macro value extraction', () => {
  it('extracts .value from {value, year} objects', () => {
    expect(mv({ value: 3.5, year: 2023 })).toBe(3.5);
    expect(mv({ value: 0, year: 2022 })).toBe(0);
    expect(mv({ value: -1.2, year: 2024 })).toBe(-1.2);
  });

  it('passes through raw numbers unchanged', () => {
    expect(mv(42)).toBe(42);
    expect(mv(0)).toBe(0);
    expect(mv(-5.5)).toBe(-5.5);
  });

  it('returns null for null input', () => {
    expect(mv(null)).toBeNull();
  });

  it('returns undefined for undefined input', () => {
    expect(mv(undefined)).toBeUndefined();
  });

  it('passes through strings (edge case)', () => {
    expect(mv('32.5')).toBe('32.5');
  });

  it('handles nested objects missing .value', () => {
    expect(mv({ year: 2023 })).toBeUndefined(); // .value is undefined → undefined
  });
});

describe('fmtMacro() — formatted macro display', () => {
  it('formats a {value, year} object correctly', () => {
    expect(fmtMacro({ value: 32.5, year: 2024 }, { suffix: '%' })).toBe('32.5%');
  });

  it('formats a raw number correctly', () => {
    expect(fmtMacro(8.3, { suffix: '%' })).toBe('8.3%');
  });

  it('returns — for null', () => {
    expect(fmtMacro(null)).toBe('—');
  });

  it('returns — for undefined', () => {
    expect(fmtMacro(undefined)).toBe('—');
  });

  it('returns — for NaN', () => {
    expect(fmtMacro(NaN)).toBe('—');
  });

  it('does not return [object Object] for raw objects — the old crash path', () => {
    const result = fmtMacro({ value: 3.5, year: 2023 });
    expect(result).not.toContain('[object Object]');
    expect(result).toBe('3.5');
  });

  it('handles prefix (e.g. GDP in trillions)', () => {
    expect(fmtMacro({ value: 24.0, year: 2023 }, { prefix: '$', suffix: 'T', decimals: 0 })).toBe('$24T');
  });
});

describe('World Bank macro field shapes (from newsMarketsData)', () => {
  // These are the actual field shapes stored in DynamoDB by newsMarketsData
  const IRAN_MACRO = {
    gdp: { value: 0.37, year: 2022 },
    cpi_yoy: { value: 32.5, year: 2023 },
    unemployment: { value: 8.3, year: 2022 },
    debt_to_gdp: { value: null, year: null },
    current_account: { value: -2.1, year: 2021 },
    reserves_usd: { value: 5.2, year: 2021 },
  };

  it('extracts all standard macro fields without throwing', () => {
    expect(() => {
      Object.entries(IRAN_MACRO).forEach(([, v]) => mv(v));
    }).not.toThrow();
  });

  it('CPI YoY renders correctly', () => {
    expect(fmtMacro(IRAN_MACRO.cpi_yoy, { suffix: '%' })).toBe('32.5%');
  });

  it('unemployment renders correctly', () => {
    expect(fmtMacro(IRAN_MACRO.unemployment, { suffix: '%' })).toBe('8.3%');
  });

  it('handles null value inside the object gracefully', () => {
    expect(fmtMacro(IRAN_MACRO.debt_to_gdp)).toBe('—');
  });

  it('raw number field (from older data) still works', () => {
    expect(fmtMacro(32.5, { suffix: '%' })).toBe('32.5%');
  });
});
