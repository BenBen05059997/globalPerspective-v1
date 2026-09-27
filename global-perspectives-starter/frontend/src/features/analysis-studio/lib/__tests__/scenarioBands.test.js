import { describe, it, expect } from 'vitest';
import { buildScenarioBands } from '../scenarioBands.js';

describe('buildScenarioBands', () => {
  it('builds sorted, dated bands with days-from-today', () => {
    const scenarios = [
      { name: 'Late trigger', pLow: 10, pHigh: 20, by: '2026-11-01' },
      { name: 'Early trigger', pLow: 30, pHigh: 40, by: '2026-10-01', places: ['Taiwan'] },
    ];
    const { today, bands, undated } = buildScenarioBands(scenarios, '2026-09-27');
    expect(today).toBe('2026-09-27');
    expect(bands.map((b) => b.name)).toEqual(['Early trigger', 'Late trigger']);
    expect(bands[0].days).toBe(4);
    expect(bands[0].places).toEqual(['Taiwan']);
    expect(undated).toEqual([]);
  });

  it('groups scenarios with no `by` into undated, never inventing a position', () => {
    const scenarios = [{ name: 'Timing unclear', pLow: 5, pHigh: 15 }];
    const { bands, undated } = buildScenarioBands(scenarios, '2026-09-27');
    expect(bands).toEqual([]);
    expect(undated).toEqual([{ name: 'Timing unclear', pLow: 5, pHigh: 15, places: [] }]);
  });

  it('falls back to today\'s real date when none is supplied', () => {
    const { today } = buildScenarioBands([], undefined);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('never throws on malformed input', () => {
    expect(() => buildScenarioBands(null, 'bad-date')).not.toThrow();
    expect(buildScenarioBands([{ by: '2026-13-40' }], '2026-09-27').bands).toEqual([]);
  });
});
