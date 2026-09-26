import { describe, it, expect } from 'vitest';
import { hudCompactSummary } from '@/features/map/lib/hudCompact.js';

describe('hudCompactSummary (M7)', () => {
  it('leads with the highest non-zero tier and reports GDACS + paused news', () => {
    const tierCounts = { high: 0, elevated: 1, moderate: 2, low: 0 };
    const sensorRows = [{ key: 'gdacs', ok: true }, { key: 'news', ok: false }];
    const paused = { beyondLookback: false, label: 'Sep 12', text: 'analysis paused since Sep 12' };
    const summary = hudCompactSummary(tierCounts, sensorRows, paused);
    expect(summary).toBe('1 elevated · sensors: GDACS live · news paused since Sep 12');
  });

  it('reports "quiet" when nothing is open and no paused state', () => {
    const tierCounts = { high: 0, elevated: 0, moderate: 0, low: 0 };
    const summary = hudCompactSummary(tierCounts, [{ key: 'news', ok: true }], null);
    expect(summary).toBe('quiet · news live');
  });

  it('never says "news live" once analysis is paused', () => {
    const tierCounts = { high: 1, elevated: 0, moderate: 0, low: 0 };
    const paused = { beyondLookback: true, text: 'no analysis in the last 30 days' };
    const summary = hudCompactSummary(tierCounts, [{ key: 'news', ok: false }], paused);
    expect(summary).not.toMatch(/news live/);
    expect(summary).toMatch(/no analysis in the last 30 days/);
  });
});
