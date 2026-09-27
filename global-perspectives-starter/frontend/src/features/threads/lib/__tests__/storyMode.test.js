import { describe, it, expect } from 'vitest';
import {
  analysisTextState, buildChapters, buildScrubberDays, buildDeadlines, buildSlides, viewFrom,
  scrubberRange, pctForDate, rawDateLabel, spanDays, buildScrubberTicks, mostLikelyScenario,
} from '@/features/threads/lib/storyMode.js';

const ENTRIES = [
  { topicId: 't1', date: '2026-08-01', title: 'A begins', regions: ['Iran'], sources: [] },
  { topicId: 't2', date: '2026-08-05', title: 'B escalates', regions: ['Iran'], sources: [] },
  { topicId: 't3', date: '2026-08-15', title: 'C turning point', regions: ['United States'], sources: [] },
  { topicId: 't4', date: '2026-08-20', title: 'D reaction', regions: ['United States'], sources: [] },
  { topicId: 't5', date: '2026-08-25', title: 'E aftermath', regions: ['Oman'], sources: [] },
];

describe('analysisTextState', () => {
  it('is fresh under 7 days', () => {
    expect(analysisTextState(new Date(Date.now() - 2 * 86400000).toISOString())).toBe('fresh');
  });
  it('is older between 7 and 30 days', () => {
    expect(analysisTextState(new Date(Date.now() - 10 * 86400000).toISOString())).toBe('older');
  });
  it('is hidden past 30 days', () => {
    expect(analysisTextState(new Date(Date.now() - 40 * 86400000).toISOString())).toBe('hidden');
  });
  it('is unknown with no timestamp', () => {
    expect(analysisTextState(null)).toBe('unknown');
  });
});

describe('buildChapters', () => {
  const iso3ForName = (n) => ({ Iran: 'IRN', 'United States': 'USA', Oman: 'OMN' }[n] || null);

  it('splits a 5-entry story into 4 chapters, none empty', () => {
    const chapters = buildChapters(ENTRIES, null, 't3', iso3ForName);
    expect(chapters.length).toBe(4);
    expect(chapters.every((c) => c.entries.length > 0)).toBe(true);
  });

  it('flags the chapter containing the inflection topic', () => {
    const chapters = buildChapters(ENTRIES, null, 't3', iso3ForName);
    const flagged = chapters.find((c) => c.isInflection);
    expect(flagged).toBeTruthy();
    expect(flagged.entries.some((e) => e.topicId === 't3')).toBe(true);
  });

  it('a thin story (1 entry) gets exactly 1 chapter, not 4', () => {
    const chapters = buildChapters([ENTRIES[0]], null, null, iso3ForName);
    expect(chapters.length).toBe(1);
    expect(chapters[0].entries.length).toBe(1);
  });

  it('uses the analysis short title when available', () => {
    const shortTitles = [{ topicId: 't1', shortTitle: 'Short A' }];
    const chapters = buildChapters(ENTRIES.slice(0, 1), shortTitles, null, iso3ForName);
    expect(chapters[0].label).toBe('Short A');
  });

  it('resolves country to iso3 via the injected lookup (S7 approx-place rule)', () => {
    const chapters = buildChapters(ENTRIES, null, null, iso3ForName);
    expect(chapters.every((c) => !c.country || c.iso3)).toBe(true);
  });

  it('returns [] for no entries', () => {
    expect(buildChapters([], null, null, iso3ForName)).toEqual([]);
  });
});

describe('buildScrubberDays', () => {
  it('counts real news-per-day from entries, sorted ascending', () => {
    const days = buildScrubberDays([
      { date: '2026-08-05' }, { date: '2026-08-01' }, { date: '2026-08-01' },
    ]);
    expect(days).toEqual([{ date: '2026-08-01', count: 2 }, { date: '2026-08-05', count: 1 }]);
  });
  it('is empty for no entries', () => {
    expect(buildScrubberDays([])).toEqual([]);
  });
});

describe('buildDeadlines', () => {
  it('collects only triggers with a real deadline', () => {
    const forecast = {
      scenarios: [
        { label: 'Escalation', triggers: [{ id: 'a', text: 'X happens', deadline: '2026-12-01' }, { id: 'b', text: 'no deadline' }] },
      ],
    };
    const deadlines = buildDeadlines(forecast);
    expect(deadlines).toEqual([{ id: 'a', label: 'X happens', deadline: '2026-12-01', verdict: null, scenarioLabel: 'Escalation' }]);
  });
  it('is empty with no forecast (S6-style skip)', () => {
    expect(buildDeadlines(null)).toEqual([]);
  });
});

describe('buildSlides', () => {
  it('always includes BRIEF and the chapters', () => {
    const slides = buildSlides({ chapters: [{ key: 'ch1' }, { key: 'ch2' }] });
    expect(slides.map((s) => s.key)).toEqual(['brief', 'ch1', 'ch2']);
  });
  it('skips FED INTO with no links (S6)', () => {
    const slides = buildSlides({ chapters: [], fedInto: [] });
    expect(slides.some((s) => s.key === 'fedinto')).toBe(false);
  });
  it('includes FED INTO only when links exist', () => {
    const slides = buildSlides({ chapters: [], fedInto: [{ targetThreadId: 'x' }] });
    expect(slides.some((s) => s.key === 'fedinto')).toBe(true);
  });
  it('skips WATCH with no deadlines', () => {
    const slides = buildSlides({ chapters: [], deadlines: [] });
    expect(slides.some((s) => s.key === 'watch')).toBe(false);
  });
});

describe('scrubberRange / pctForDate', () => {
  it('spans from the story start to at least today', () => {
    const { startMs, endMs } = scrubberRange('2020-01-01', '2020-01-05', [], Date.now());
    expect(endMs).toBeGreaterThanOrEqual(Date.now() - 1000);
    expect(startMs).toBe(new Date('2020-01-01').getTime());
  });
  it('extends the range to a future deadline', () => {
    const now = new Date('2026-09-27').getTime();
    const { endMs } = scrubberRange('2026-08-01', '2026-08-25', [{ deadline: '2026-12-31' }], now);
    expect(endMs).toBe(new Date('2026-12-31').getTime());
  });
  it('places a date proportionally on the track, clamped 0-100', () => {
    const startMs = new Date('2026-01-01').getTime();
    const endMs = new Date('2026-01-11').getTime();
    expect(pctForDate('2026-01-06', startMs, endMs)).toBe(50);
    expect(pctForDate('2025-01-01', startMs, endMs)).toBe(0);
    expect(pctForDate('2027-01-01', startMs, endMs)).toBe(100);
  });
});

describe('rawDateLabel / spanDays', () => {
  it('never collapses to "Today" even when the date is today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(rawDateLabel(today)).not.toBe('Today');
    expect(rawDateLabel(today)).toMatch(/\d/);
  });
  it('computes an inclusive calendar-day span', () => {
    expect(spanDays('2026-09-04', '2026-09-27')).toBe(24);
    expect(spanDays('2026-09-04', '2026-09-04')).toBe(1);
  });
  it('is 0 for missing dates', () => {
    expect(spanDays(null, '2026-09-04')).toBe(0);
  });
});

describe('buildScrubberTicks', () => {
  it('always includes the start and end', () => {
    const startMs = new Date('2026-09-04').getTime();
    const endMs = new Date('2026-12-31').getTime();
    const ticks = buildScrubberTicks(startMs, endMs);
    expect(ticks[0].ms).toBe(startMs);
    expect(ticks[ticks.length - 1].ms).toBe(endMs);
  });
  it('produces roughly targetCount intermediate ticks, not one per day', () => {
    const startMs = new Date('2026-09-04').getTime();
    const endMs = new Date('2026-12-31').getTime();
    const ticks = buildScrubberTicks(startMs, endMs, 5);
    expect(ticks.length).toBeLessThan(15);
    expect(ticks.length).toBeGreaterThan(2);
  });
  it('returns [] for an invalid/zero range', () => {
    expect(buildScrubberTicks(NaN, NaN)).toEqual([]);
    expect(buildScrubberTicks(100, 100)).toEqual([]);
  });
});

describe('viewFrom', () => {
  it('returns null when no source carries outlet metadata', () => {
    expect(viewFrom([{ sources: [{ source: 'Reuters' }] }])).toBeNull();
  });
  it('rolls up by outlet country and type when present', () => {
    const entries = [
      { sources: [{ source: 'Reuters', outletCountry: 'US', outletType: 'wire' }, { source: 'Le Monde', outletCountry: 'FR', outletType: 'national' }] },
      { sources: [{ source: 'Reuters', outletCountry: 'US', outletType: 'wire' }] }, // dedup by outlet
    ];
    const out = viewFrom(entries);
    expect(out.total).toBe(2);
    expect(out.byCountry.find((c) => c.code === 'US').count).toBe(1);
    expect(out.byType.find((t) => t.type === 'wire').count).toBe(1);
  });
  it('returns null for no entries', () => {
    expect(viewFrom([])).toBeNull();
  });
});

describe('mostLikelyScenario', () => {
  it('picks the scenario with the highest real probability', () => {
    const forecast = { scenarios: [{ label: 'Escalation', probability: 0.3 }, { label: 'De-escalation', probability: 0.55 }] };
    expect(mostLikelyScenario(forecast)).toEqual({ label: 'De-escalation', probability: 0.55 });
  });
  it('is null with no forecast or no probability field', () => {
    expect(mostLikelyScenario(null)).toBeNull();
    expect(mostLikelyScenario({ scenarios: [{ label: 'A' }] })).toBeNull();
  });
});
