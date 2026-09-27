import { describe, it, expect } from 'vitest';
import { buildRiskSeries, buildChangeLog } from '../whatChangedPicture.js';

describe('buildRiskSeries', () => {
  it('sorts points and never interpolates a gap', () => {
    const history = [
      { date: '2026-09-25', score: 50 },
      { date: '2026-08-01', score: 40 },
    ];
    const { points, gaps } = buildRiskSeries(history);
    expect(points.map((p) => p.date)).toEqual(['2026-08-01', '2026-09-25']);
    expect(gaps).toEqual([{ from: '2026-08-01', to: '2026-09-25', days: 55 }]);
  });

  it('reports no gap under the threshold', () => {
    const { gaps } = buildRiskSeries([{ date: '2026-09-01', score: 40 }, { date: '2026-09-10', score: 45 }]);
    expect(gaps).toEqual([]);
  });

  it('drops malformed entries rather than crashing', () => {
    const { points } = buildRiskSeries([null, { date: '2026-09-01' }, { score: 5 }, { date: '2026-09-01', score: 'x' }]);
    expect(points).toEqual([]);
  });
});

describe('buildChangeLog', () => {
  it('flags an entry whose text contradicts its score movement', () => {
    const log = buildChangeLog([
      { date: '2026-09-20', text: 'The embargo shifts conditions worse as pressure builds.', scoreBefore: 60, scoreAfter: 45 },
    ]);
    expect(log[0].flag).toBeTruthy();
    expect(log[0].flag.reason).toMatch(/worse.*score moved down/i);
  });

  it('does not flag a consistent entry, and passes through entries with no scores', () => {
    const log = buildChangeLog([
      { date: '2026-09-20', text: 'Risk deteriorated further.', scoreBefore: 40, scoreAfter: 55 },
      { date: '2026-09-10', text: 'A dated trigger passed with no change in tone.' },
    ]);
    expect(log[0].flag).toBeNull();
    expect(log[1].flag).toBeNull();
  });

  it('drops entries with no text', () => {
    expect(buildChangeLog([{ date: '2026-09-01' }, null])).toEqual([]);
  });
});
