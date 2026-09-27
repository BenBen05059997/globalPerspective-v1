import { describe, it, expect } from 'vitest';
import { macroRows } from '@/features/countries/lib/countryMacro';

const now = new Date('2026-09-27T00:00:00Z');

describe('macroRows', () => {
  it('labels each figure with its own data year, not the fetch asOf (live Iran payload)', () => {
    const rows = macroRows({
      gdp_usd: { year: '2025', value: 362682115433.364 },
      cpi_yoy: { year: '2025', value: 42.1712244965444 },
      reserves_usd: { year: '1982', value: 7685456407 },
      asOf: '2026-09-27T02:37:01.348Z',
    }, now);
    expect(rows).toEqual([
      { k: 'GDP', v: '$363B', year: 2025 },
      { k: 'CPI YoY', v: '42.2%', year: 2025 },
    ]);
  });

  it('drops a figure older than current year - 3', () => {
    expect(macroRows({ gdp_usd: { year: '2022', value: 1e9 }, cpi_yoy: { year: '2023', value: 2 } }, now))
      .toEqual([{ k: 'CPI YoY', v: '2.0%', year: 2023 }]);
  });

  it('omits bare numbers with no year and handles missing macro', () => {
    expect(macroRows({ gdp_usd: 5e9 }, now)).toEqual([]);
    expect(macroRows(null, now)).toEqual([]);
  });
});
