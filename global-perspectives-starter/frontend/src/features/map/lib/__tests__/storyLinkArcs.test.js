import { describe, it, expect } from 'vitest';
import { buildLinkArcs, dashedArcPaths, DASH } from '@/features/map/lib/storyLinkArcs.js';

const threads = {
  F: { places: [{ name: 'Iran', n: 12 }, { name: 'Israel', n: 2 }] },
  S: { title: 'Strong story', places: [{ name: 'Iran', n: 5 }, { name: 'Saudi Arabia', n: 4 }] },  // most-mentioned non-focal = Saudi Arabia
  M: { title: 'Medium story', places: [{ name: 'Japan', n: 3 }] },
  W: { title: 'Weak story', places: [{ name: 'France', n: 3 }] },
  R: { title: 'Region only', places: [{ name: 'Middle East', n: 9 }] },
  N: { title: 'No place', places: [] },
  H: { title: 'Hidden', places: [{ name: 'Germany', n: 3 }] },
  IranOnly: { title: 'Same country', places: [{ name: 'Iran', n: 4 }] },
};
const L = (id, confidence, freshness = 'fresh', dir = 'target') => ({ [`${dir}ThreadId`]: id, confidence, freshness });

describe('buildLinkArcs', () => {
  it('draws strong and medium only; weak stays list-only', () => {
    const arcs = buildLinkArcs({ threadId: 'F', links: [L('S', 'strong'), L('M', 'medium'), L('W', 'weak')], threads });
    expect(arcs.map((a) => a.otherThreadId)).toEqual(['S', 'M']);
    expect(arcs.every((a) => a.confidence === 'strong' || a.confidence === 'medium')).toBe(true);
  });
  it('runs from the focal country to the linked story\'s most-mentioned OTHER country (approx.)', () => {
    const [a] = buildLinkArcs({ threadId: 'F', links: [L('S', 'strong')], threads });
    expect(a).toMatchObject({ fromIso3: 'IRN', toIso3: 'SAU', title: 'Strong story' });
  });
  it('a linked story with only a broad region, no place, or only the focal country gets NO line', () => {
    expect(buildLinkArcs({ threadId: 'F', links: [L('R', 'strong'), L('N', 'strong'), L('IranOnly', 'strong')], threads })).toEqual([]);
  });
  it('a link from a web older than 30 days is not drawn', () => {
    expect(buildLinkArcs({ threadId: 'F', links: [L('H', 'strong', 'hidden')], threads })).toEqual([]);
  });
  it('the story\'s own country can be passed (story mode uses its first chapter\'s); no focal country -> nothing', () => {
    expect(buildLinkArcs({ threadId: 'F', links: [L('M', 'medium')], threads, focalIso3: 'ISR' })[0].fromIso3).toBe('ISR');
    expect(buildLinkArcs({ threadId: 'X', links: [L('M', 'medium')], threads })).toEqual([]);
  });
  it('one line per other story (the strongest wins), incoming links included', () => {
    const arcs = buildLinkArcs({ threadId: 'F', links: [L('S', 'medium'), L('S', 'strong'), { sourceThreadId: 'M', confidence: 'medium', freshness: 'fresh' }], threads });
    expect(arcs).toHaveLength(2);
    expect(arcs.find((a) => a.otherThreadId === 'S').confidence).toBe('strong');
    expect(arcs.find((a) => a.otherThreadId === 'M')).toBeTruthy();
  });
});

describe('dashedArcPaths: strong = long dashes, medium = short dashes', () => {
  const from = [50, 32]; const to = [45, 24];
  it('strong covers more of the line than medium', () => {
    const s = dashedArcPaths(from, to, 'strong').length; const m = dashedArcPaths(from, to, 'medium').length;
    expect(s).toBeGreaterThan(m);
    expect(DASH.strong.width).toBeGreaterThan(DASH.medium.width);
  });
  it('segments start at the origin, are 2-point paths and lift in the middle', () => {
    const p = dashedArcPaths(from, to, 'strong');
    expect(p[0].path[0].slice(0, 2)).toEqual(from);
    expect(p.every((x) => x.path.length === 2)).toBe(true);
    const mid = Math.max(...p.flatMap((x) => x.path.map((pt) => pt[2])));
    expect(mid).toBeGreaterThan(0);
  });
});
