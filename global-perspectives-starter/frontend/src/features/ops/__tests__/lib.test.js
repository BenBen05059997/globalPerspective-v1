import { describe, it, expect } from 'vitest';
import { pivot, noRun, factLines, dayParts, statusOf } from '@/features/ops/lib/pipeline.js';
import { usd, tokens, byLambda, dailyBars, unitRows } from '@/features/ops/lib/money.js';
import { devHealth, devOpsData } from '@/features/ops/dev/fixtures.js';

describe('pipeline lib', () => {
  it('pivots days x rows into stages x cells; a missing row stays null', () => {
    const health = devHealth();
    health.days[0].rows = health.days[0].rows.filter((r) => r.stage !== 'compare');
    const stages = pivot(health);
    expect(stages.map((s) => s.id)).toEqual(health.stages.map((s) => s.id));
    const compare = stages.find((s) => s.id === 'compare');
    expect(compare.cells.length).toBe(14);
    expect(compare.cells[0].row).toBeNull();
    expect(compare.cells[1].row.stage).toBe('compare');
    expect(pivot(null)).toEqual([]);
  });

  it('noRun: all no-data (or absent) cells; the first error is carried', () => {
    expect(noRun([{ row: null }, { row: { status: 'nodata', error: null } }])).toEqual({ noRun: true, error: null });
    expect(noRun([{ row: { status: 'nodata', error: 'AccessDenied' } }, { row: { status: 'nodata', error: 'x' } }])).toEqual({ noRun: true, error: 'AccessDenied' });
    expect(noRun([{ row: { status: 'nodata' } }, { row: { status: 'ok' } }]).noRun).toBe(false);
  });

  it('factLines drops empty values and shows objects as key n pairs', () => {
    expect(factLines({ a: 1, b: null, c: '', d: [], e: {}, f: { x: 2, y: 0, z: null }, g: ['p', 'q'], h: false })).toEqual([['a', '1'], ['f', 'x 2, y 0'], ['g', 'p, q'], ['h', 'false']]);
    expect(factLines(null)).toEqual([]);
  });

  it('dayParts and statusOf', () => {
    expect(dayParts('2026-11-03')).toEqual({ day: '3', month: 'Nov', long: '3 Nov' });
    expect(dayParts('bad').long).toBe('bad');
    expect(statusOf('weird').label).toBe('no data');
  });
});

describe('money lib', () => {
  it('formats dollars and tokens', () => {
    expect(usd(0)).toBe('$0.00');
    expect(usd(12.4)).toBe('$12.40');
    expect(usd(0.373)).toBe('$0.37');
    expect(usd(0.078)).toBe('$0.078');
    expect(usd(0.00037)).toBe('$0.00037');
    expect(usd(null)).toBeNull();
    expect(tokens(1234567)).toBe('1.2M');
    expect(tokens(52000)).toBe('52k');
    expect(tokens(900)).toBe('900');
  });

  it('by Lambda: yesterday and month to date, an all-unpriced Lambda has no amount', () => {
    const rows = byLambda(devOpsData().deepseek);
    const ing = rows.find((r) => r.fn === 'newsSituationIngest');
    expect(ing.yesterday).toBeCloseTo(0.0878, 4);
    expect(ing.month).toBeGreaterThan(ing.yesterday);
    const jev = rows.find((r) => r.fn === 'newsSelectionShadow');
    expect(jev.yesterday).toBeNull();
    expect(jev.unpriced).toBe(true);
    expect(rows[0].month).toBeGreaterThanOrEqual(rows[1].month);
  });

  it('bars: the last 14 days, null where a source has no day', () => {
    const bars = dailyBars(devOpsData());
    expect(bars.length).toBe(14);
    expect(bars[0]).toEqual({ date: '2026-10-22', deepseek: null, aws: 0.75 });
    expect(bars[13].aws).toBeNull();
    expect(dailyBars(null)).toEqual([]);
  });

  it('unit rows take the newest day with a per-unit figure', () => {
    const ops = devOpsData();
    ops.unitCosts.days.push({ date: '2026-11-04', entry: { usd: 0.005, count: null, per: null } });
    const rows = unitRows(ops.unitCosts);
    expect(rows.find((r) => r.id === 'entry').date).toBe('2026-11-03');
    expect(unitRows(null)).toEqual([]);
  });
});
