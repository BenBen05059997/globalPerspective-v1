import { describe, it, expect } from 'vitest';
import { storiesForShading } from '@/features/map/lib/storyShading.js';

const TOPICS = [
  { title: 'A', threadId: 't-a', category: 'energy', iso3: ['SAU', 'IRQ'] },
  { title: 'B', threadId: 't-b', category: 'society', iso3: ['DEU'] },
  { title: 'C', threadId: 't-c', category: 'military', iso3: ['DEU'] },
  { title: 'D', threadId: 't-d', category: 'politics', regions: ['Middle East'] }, // no iso3 — broad region
  { title: 'E', threadId: 't-e', category: 'conflict', iso3: ['UKR'] },
];

describe('storiesForShading', () => {
  it('groups stories by their primary (first) ISO3', () => {
    const out = storiesForShading(TOPICS, []);
    const deu = out.find((o) => o.iso3 === 'DEU');
    expect(deu.count).toBe(2);
    expect(deu.stories.map((s) => s.title).sort()).toEqual(['B', 'C']);
  });

  it('skips stories with no resolvable ISO3 (broad regions)', () => {
    const out = storiesForShading(TOPICS, []);
    expect(out.some((o) => o.stories.some((s) => s.title === 'D'))).toBe(false);
  });

  it('skips stories whose threadId already has a world-situation pin', () => {
    const out = storiesForShading(TOPICS, [{ id: 'sit-1', threadId: 't-e' }]);
    expect(out.some((o) => o.iso3 === 'UKR')).toBe(false);
  });

  it('prefers a real crisis category over neutral to represent a mixed group', () => {
    const out = storiesForShading(TOPICS, []);
    const deu = out.find((o) => o.iso3 === 'DEU');
    // 'society' -> neutral, 'military' -> conflict: the group should surface conflict.
    expect(deu.crisisType).toBe('conflict');
    expect(deu.top.title).toBe('C');
  });

  it('returns an empty array for no topics', () => {
    expect(storiesForShading([], [])).toEqual([]);
    expect(storiesForShading(undefined, undefined)).toEqual([]);
  });

  it('each entry carries a hue matching its crisisType', () => {
    const out = storiesForShading(TOPICS, []);
    const sau = out.find((o) => o.iso3 === 'SAU');
    expect(sau.crisisType).toBe('economic');
    expect(typeof sau.hue).toBe('string');
  });
});
