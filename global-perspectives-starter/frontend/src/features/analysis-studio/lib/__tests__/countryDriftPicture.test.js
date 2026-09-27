import { describe, it, expect } from 'vitest';
import { buildCountryRiskSeries, buildCountryChangeLog } from '../countryDriftPicture.js';

// Frozen fixtures fetched live from the country_history proxy action for Iran (2026-09-27),
// per the monitor's instruction — real data, not synthesized, but not re-fetched at test time.
const IRAN_SNAPSHOTS_SAMPLE = [
  { dateKey: '2026-04-28', riskScore: 88 },
  { dateKey: '2026-05-16', riskScore: 68 },
  { dateKey: '2026-05-17', riskScore: 85 },
  { dateKey: '2026-09-09', riskScore: 95 },
  { dateKey: '2026-09-10', riskScore: 95 },
  { dateKey: '2026-09-11', riskScore: 95 },
];

const IRAN_DRIFT_NOTE = {
  asOf: '2026-08-19',
  generatedAt: '2026-08-19T07:20:07.439Z',
  countryName: 'Iran',
  changeScore: { from: 95, to: 95, delta: 0 },
  since: '2026-08-18',
  triggerEvent: { title: null, date: null },
  whyChanged:
    "The UAE's indefinite trade embargo on Iran directly escalates economic isolation, driving " +
    'the economic score up from 80 to 90. This action also shifts the humanitarian score down as ' +
    'trade disruption worsens civilian conditions, while the prior missile attack (event 6) is the ' +
    'immediate cause but the embargo is the structural change.',
};

describe('buildCountryRiskSeries — real Iran snapshots', () => {
  it('sorts points ascending and finds the real 18-day gap (Apr 28 -> May 16)', () => {
    const { points, gaps } = buildCountryRiskSeries(IRAN_SNAPSHOTS_SAMPLE);
    expect(points.map((p) => p.date)).toEqual(['2026-04-28', '2026-05-16', '2026-05-17', '2026-09-09', '2026-09-10', '2026-09-11']);
    expect(gaps.some((g) => g.from === '2026-04-28' && g.to === '2026-05-16' && g.days === 18)).toBe(true);
    // May 17 -> Sep 9 is a much larger real gap in the live data (not sampled here in full) —
    // this fixture only asserts the smaller, fully-sampled gap to keep the test self-contained.
  });

  it('drops malformed entries and handles empty input', () => {
    expect(buildCountryRiskSeries(null)).toEqual({ points: [], gaps: [] });
    expect(buildCountryRiskSeries([{ dateKey: '2026-01-01' }, { riskScore: 5 }]).points).toEqual([]);
  });
});

describe('buildCountryChangeLog — real Iran drift note (2026-08-19)', () => {
  it('carries the note through with a humanitarian-axis flag, no economic flag', () => {
    const [entry] = buildCountryChangeLog([IRAN_DRIFT_NOTE]);
    expect(entry.date).toBe('2026-08-19');
    expect(entry.text).toBe(IRAN_DRIFT_NOTE.whyChanged);
    expect(entry.flags).toHaveLength(1);
    expect(entry.flags[0].axis).toBe('humanitarian');
  });

  it('sorts newest first and drops notes with no whyChanged', () => {
    const older = { ...IRAN_DRIFT_NOTE, asOf: '2026-07-01', whyChanged: 'Risk deteriorated further this week.' };
    const empty = { asOf: '2026-06-01' };
    const log = buildCountryChangeLog([older, IRAN_DRIFT_NOTE, empty]);
    expect(log.map((e) => e.date)).toEqual(['2026-08-19', '2026-07-01']);
    expect(log[1].flags).toEqual([]);
  });
});
