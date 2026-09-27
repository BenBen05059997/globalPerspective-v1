import { describe, it, expect } from 'vitest';
import { buildComparePicture } from '../comparePicture.js';

describe('buildComparePicture', () => {
  const topics = [
    { title: 'Naval standoff', regions: ['East Asia', 'Taiwan Strait'] },
    { title: 'Trade talks reopen', regions: ['East Asia'] },
  ];
  const citations = [
    { n: 1, kind: 'NEWS', storyTitle: 'Naval standoff' },
    { n: 2, kind: 'ANALYSIS', storyTitle: 'Naval standoff' },
    { n: 3, kind: 'NEWS', storyTitle: 'Trade talks reopen' },
  ];

  it('builds one lane per story with its regions', () => {
    const { lanes } = buildComparePicture(topics, citations);
    expect(lanes).toEqual([
      { title: 'Naval standoff', regions: ['East Asia', 'Taiwan Strait'] },
      { title: 'Trade talks reopen', regions: ['East Asia'] },
    ]);
  });

  it('finds the shared region and a judged link labelled as a model judgment', () => {
    const { sharedPlaces, judgedLink } = buildComparePicture(topics, citations);
    expect(sharedPlaces).toEqual(['East Asia']);
    expect(judgedLink).toEqual({ from: 'Naval standoff', to: 'Trade talks reopen', via: 'East Asia', label: 'shares a region — model judgment' });
  });

  it('returns no judged link when stories share nothing', () => {
    const { judgedLink, sharedPlaces } = buildComparePicture(
      [{ title: 'A', regions: ['Sahel'] }, { title: 'B', regions: ['Andes'] }],
      []
    );
    expect(sharedPlaces).toEqual([]);
    expect(judgedLink).toBeNull();
  });

  it('builds a per-story citation-kind grid', () => {
    const { grid } = buildComparePicture(topics, citations);
    expect(grid).toEqual([
      { title: 'Naval standoff', counts: { NEWS: 1, ANALYSIS: 1, DRIFT: 0, FORECAST: 0 } },
      { title: 'Trade talks reopen', counts: { NEWS: 1, ANALYSIS: 0, DRIFT: 0, FORECAST: 0 } },
    ]);
  });
});
