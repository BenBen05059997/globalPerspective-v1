import { describe, it, expect } from 'vitest';
import { peekData } from '@/shared/lib/peekData.js';

const TOPIC = {
  title: 'Saudi Arabia Shuts East-West Pipeline After Drone Attack',
  threadId: 'thread-houthi-attacks-on-saudi-arabia-ee3354',
  category: 'energy',
  primaryCountry: 'Saudi Arabia',
  regions: ['Saudi Arabia', 'Iraq', 'Yemen', 'Iran'],
  sources: Array.from({ length: 8 }, (_, i) => ({ domain: `outlet${i}.com` })),
};

describe('peekData', () => {
  it('returns null for a record with no title', () => {
    expect(peekData(null)).toBeNull();
    expect(peekData({})).toBeNull();
  });

  it('fills known fields from a full topic', () => {
    const d = peekData(TOPIC, { asOf: '2026-09-13T00:00:46.696Z' });
    expect(d.headline).toBe(TOPIC.title);
    expect(d.category).toBe('energy');
    expect(d.crisisType).toBe('economic');
    expect(typeof d.hue).toBe('string');
    expect(d.primaryCountry).toBe('Saudi Arabia');
    expect(d.sourcesLabel).toBe('8 sources');
    expect(d.updatedLabel).toBe(`updated ${new Date('2026-09-13T00:00:46.696Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
    expect(d.hint).toBe('Click to open the story card');
  });

  it('omits fields that are not present rather than padding them', () => {
    const d = peekData({ title: 'A bare topic' });
    expect(d.headline).toBe('A bare topic');
    expect(d.category).toBeUndefined();
    expect(d.primaryCountry).toBeUndefined();
    expect(d.sourcesLabel).toBeUndefined();
    expect(d.updatedLabel).toBeUndefined();
  });

  it('falls back to the first region when primaryCountry is missing', () => {
    const d = peekData({ title: 'x', regions: ['Middle East', 'Yemen'] });
    expect(d.primaryCountry).toBe('Middle East');
  });

  it('uses a singular "1 source" for exactly one source', () => {
    const d = peekData({ title: 'x', sources: [{ domain: 'a.com' }] });
    expect(d.sourcesLabel).toBe('1 source');
  });

  it('never sets sourcesLabel for zero sources', () => {
    const d = peekData({ title: 'x', sources: [] });
    expect(d.sourcesLabel).toBeUndefined();
  });
});
