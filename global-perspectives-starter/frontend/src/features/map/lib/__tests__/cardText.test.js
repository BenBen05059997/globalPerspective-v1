import { describe, it, expect } from 'vitest';
import { summaryFacts, firstSentences } from '@/features/map/lib/cardText.js';

const SUMMARY = `- The BRICS group of nations unanimously adopted a joint declaration on Saturday expressing deep concern over the war in the Middle East and urging maximum restraint, per al-monitor.com.
- Chinese President Xi Jinping urged the BRICS bloc to be a peacemaker, per al-monitor.com.
- India hosted the 18th BRICS summit in New Delhi this weekend, per npr.org.
- Countries/regions mentioned: BRICS nations, India (New Delhi), China, Russia, and the Middle East.`;

describe('summaryFacts', () => {
  it('keeps whole bullets with their outlet attribution (no "com. com. org.")', () => {
    const f = summaryFacts(SUMMARY, 3);
    expect(f).toHaveLength(3);
    expect(f[0]).toMatch(/^The BRICS group/);
    expect(f[0]).toMatch(/per al-monitor\.com\.$/);
    expect(f.join(' ')).not.toMatch(/^com\./);
  });
  it('drops the Countries/regions metadata line', () => {
    expect(summaryFacts(SUMMARY, 10).some((l) => /Countries\/regions/.test(l))).toBe(false);
  });
  it('returns [] for empty input', () => {
    expect(summaryFacts('')).toEqual([]);
    expect(summaryFacts(null)).toEqual([]);
  });
});

describe('firstSentences', () => {
  it('does not split on domains or abbreviations mid-sentence', () => {
    const t = 'The U.S. said talks via al-monitor.com were stalled. Iran rejected it. A third.';
    expect(firstSentences(t, 2)).toBe('The U.S. said talks via al-monitor.com were stalled. Iran rejected it.');
  });
});
