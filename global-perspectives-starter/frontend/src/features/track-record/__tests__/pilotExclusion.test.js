import { describe, it, expect } from 'vitest';
import { isPilotItem, splitPilot } from '@/features/track-record/lib/pilotExclusion.js';

const pilotAt = '2026-07-24T22:22:14.709Z';

describe('isPilotItem', () => {
  it('flags the 24 Jul pilot run', () => {
    expect(isPilotItem({ confirmedAt: pilotAt })).toBe(true);
  });
  it('does not flag a later resolution', () => {
    expect(isPilotItem({ confirmedAt: '2026-09-01T00:00:00.000Z' })).toBe(false);
  });
  it('does not flag an item with no confirmedAt', () => {
    expect(isPilotItem({})).toBe(false);
  });
});

describe('splitPilot', () => {
  it('separates the pilot from anything resolved after it', () => {
    const items = [
      { title: 'A', confirmedAt: pilotAt },
      { title: 'B', confirmedAt: pilotAt },
      { title: 'C', confirmedAt: '2026-09-01T00:00:00.000Z' },
    ];
    const { pilot, postPilot } = splitPilot(items);
    expect(pilot.map((i) => i.title)).toEqual(['A', 'B']);
    expect(postPilot.map((i) => i.title)).toEqual(['C']);
  });

  it('treats all-pilot live data as zero post-pilot resolved (today\'s real state)', () => {
    const liveRecent = Array.from({ length: 30 }, () => ({ confirmedAt: pilotAt }));
    const { postPilot } = splitPilot(liveRecent);
    expect(postPilot.length).toBe(0);
  });
});
