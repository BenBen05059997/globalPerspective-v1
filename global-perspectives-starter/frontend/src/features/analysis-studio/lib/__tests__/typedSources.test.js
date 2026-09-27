// D2 (TASK_2026-09-27_pages_local.md S5b) — the typed, numbered, dated source
// pipeline: buildStorySources() per story + assembleContext() across the selection.
import { describe, it, expect } from 'vitest';
import { buildStorySources, assembleContext } from '@/features/analysis-studio/lib/analysisPrompt';

describe('buildStorySources — RICH vs THIN classification', () => {
  it('is THIN when only headlines/NEWS material exists', () => {
    const { sources, richness, counts } = buildStorySources({
      analysis: null,
      forecast: null,
      drift: null,
      news: [
        { title: 'Ferry catches fire off Palawan', outlet: 'cbc.ca', date: '2026-09-10', snippet: 'Rescuers struggled to reach the burning ferry.', url: 'https://cbc.ca/x' },
      ],
    });
    expect(richness).toBe('THIN');
    expect(counts.NEWS).toBe(1);
    expect(counts.ANALYSIS).toBe(0);
    expect(sources).toHaveLength(1);
    expect(sources[0].kind).toBe('NEWS');
  });

  it('is RICH when a stored thread analysis exists, even with no news', () => {
    const { richness, counts } = buildStorySources({
      analysis: { text: 'The AfD is heading towards a coalition standoff.', generatedAt: '2026-09-22T06:31:46.856Z' },
      forecast: null,
      drift: null,
      news: [],
    });
    expect(richness).toBe('RICH');
    expect(counts.ANALYSIS).toBe(1);
  });

  it('is RICH from a drift note or forecast snapshot alone', () => {
    expect(buildStorySources({ drift: { text: 'Risk level moderate → elevated', generatedAt: '2026-09-12' } }).richness).toBe('RICH');
    expect(buildStorySources({ forecast: { text: 'Most Likely (60%) — ...', generatedAt: '2026-09-04' } }).richness).toBe('RICH');
  });

  it('with nothing at all, is THIN and produces no sources', () => {
    const { sources, richness, counts } = buildStorySources({});
    expect(richness).toBe('THIN');
    expect(sources).toHaveLength(0);
    expect(counts).toEqual({ NEWS: 0, ANALYSIS: 0, DRIFT: 0, FORECAST: 0 });
  });

  it('caps NEWS items at maxNews and orders candidates ANALYSIS > FORECAST > DRIFT > NEWS', () => {
    const news = Array.from({ length: 6 }, (_, i) => ({ title: `Article ${i}`, outlet: 'x.com', date: '2026-09-0' + (i + 1), snippet: 'snippet ' + i, url: `https://x.com/${i}` }));
    const { sources } = buildStorySources({
      analysis: { text: 'analysis text', generatedAt: '2026-09-20' },
      forecast: { text: 'forecast text', generatedAt: '2026-09-04' },
      drift: { text: 'drift text', generatedAt: '2026-09-12' },
      news,
    }, { maxNews: 4 });
    const kinds = sources.map((s) => s.kind);
    expect(kinds.slice(0, 3)).toEqual(['ANALYSIS', 'FORECAST', 'DRIFT']);
    expect(kinds.filter((k) => k === 'NEWS')).toHaveLength(4);
  });

  it('clips to the per-story character budget and marks truncated', () => {
    const longText = 'x'.repeat(5000);
    const { sources, truncated } = buildStorySources({
      analysis: { text: longText, generatedAt: '2026-09-20' },
    }, { budget: 500 });
    expect(truncated).toBe(true);
    expect(sources[0].text.length).toBeLessThanOrEqual(500);
  });
});

describe('assembleContext — flat typed numbering across all selected stories', () => {
  const richStory = {
    topic: { title: 'Germany AfD thread', regions: ['Germany'] },
    ...buildStorySources({
      analysis: { text: 'Trajectory: coalition standoff likely.', generatedAt: '2026-09-22' },
      forecast: { text: 'Most Likely (60%) — coalition talks fail by Oct 2026', generatedAt: '2026-09-04' },
      news: [{ title: 'AfD wins Saxony-Anhalt', outlet: 'npr.org', date: '2026-09-04', snippet: 'The AfD is poised for a historic win.', url: 'https://npr.org/x' }],
    }),
  };
  const thinStory = {
    topic: { title: 'Philippines ferry fire', regions: ['Philippines'] },
    ...buildStorySources({
      news: [{ title: 'Ferry fire off Palawan', outlet: 'cbc.ca', date: '2026-09-10', snippet: 'Five dead, 86 missing.', url: 'https://cbc.ca/x' }],
    }),
  };

  it('numbers sources sequentially across stories, not per-story', () => {
    const { citations } = assembleContext([richStory, thinStory]);
    // richStory has 3 sources (ANALYSIS, FORECAST, NEWS); thinStory has 1 (NEWS).
    expect(citations.map((c) => c.n)).toEqual([1, 2, 3, 4]);
    expect(citations[0].kind).toBe('ANALYSIS');
    expect(citations[3].kind).toBe('NEWS');
    expect(citations[3].storyTitle).toBe('Philippines ferry fire');
  });

  it('each citation carries its real kind + date, never invented', () => {
    const { citations } = assembleContext([richStory]);
    for (const c of citations) {
      expect(['NEWS', 'ANALYSIS', 'DRIFT', 'FORECAST']).toContain(c.kind);
      expect(c.date === null || typeof c.date === 'string').toBe(true);
    }
  });

  it('reports per-story richness and overall thin only when EVERY story is thin', () => {
    const mixed = assembleContext([richStory, thinStory]);
    expect(mixed.perStory).toEqual([
      { title: 'Germany AfD thread', richness: 'RICH', counts: { NEWS: 1, ANALYSIS: 1, DRIFT: 0, FORECAST: 1 }, truncated: false },
      { title: 'Philippines ferry fire', richness: 'THIN', counts: { NEWS: 1, ANALYSIS: 0, DRIFT: 0, FORECAST: 0 }, truncated: false },
    ]);
    expect(mixed.thin).toBe(false); // richStory clears the bar

    const allThin = assembleContext([thinStory]);
    expect(allThin.thin).toBe(true);
    expect(allThin.thinTitles).toEqual(['Philippines ferry fire']);
  });

  it('the context string carries the kind + date for every numbered source', () => {
    const { context } = assembleContext([richStory]);
    expect(context).toMatch(/\[1\] \(ANALYSIS · 2026-09-22/);
    expect(context).toMatch(/\[2\] \(FORECAST · 2026-09-04/);
    expect(context).toMatch(/\[3\] \(NEWS · 2026-09-04/);
  });

  it('a story with no material at all still gets a block, honestly labelled', () => {
    const empty = { topic: { title: 'Nothing stored yet' }, ...buildStorySources({}) };
    const { context, citations } = assembleContext([empty]);
    expect(citations).toHaveLength(0);
    expect(context).toMatch(/no material available/);
  });
});
