import { describe, it, expect } from 'vitest';
import { estimateTokens, buildQuote } from '@/features/analysis-studio/lib/quote';

describe('estimateTokens', () => {
  it('uses the ~4 chars/token heuristic and rounds up', () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(5)).toBe(2);
    expect(estimateTokens(4000)).toBe(1000);
  });
});

describe('buildQuote', () => {
  const perStory = [
    { title: 'A', richness: 'RICH', counts: { NEWS: 1, ANALYSIS: 1, DRIFT: 0, FORECAST: 1 }, truncated: false },
    { title: 'B', richness: 'THIN', counts: { NEWS: 1, ANALYSIS: 0, DRIFT: 0, FORECAST: 0 }, truncated: false },
  ];

  it('never shows a money figure — BYOK path points to the provider\'s own pricing', () => {
    const q = buildQuote({ perStory, totalChars: 4000, model: 'gpt-5.6', maxOutputTokens: 2400, memberPath: false });
    expect(q.billingLine).toBe('Your provider bills you directly; see their pricing.');
    expect(q.lines.join(' ')).not.toMatch(/\$|USD|cent/i);
  });

  it('the member server path says "included", never a price', () => {
    const q = buildQuote({ perStory, totalChars: 4000, model: null, maxOutputTokens: null, memberPath: true });
    expect(q.billingLine).toBe('Included with your membership.');
    expect(q.lines).toContain('Included with your membership.');
  });

  it('counts RICH vs THIN correctly', () => {
    const q = buildQuote({ perStory, totalChars: 4000 });
    expect(q.richCount).toBe(1);
    expect(q.thinCount).toBe(1);
    expect(q.lines[0]).toMatch(/2 stories selected — 1 RICH.*1 THIN/);
  });

  it('labels the token count as an estimate', () => {
    const q = buildQuote({ perStory, totalChars: 4000 });
    expect(q.lines[1]).toMatch(/estimate/);
    expect(q.estInputTokens).toBe(1000);
  });

  it('surfaces the model and output cap when known', () => {
    const q = buildQuote({ perStory, totalChars: 100, model: 'deepseek-v4-pro', maxOutputTokens: 2400 });
    expect(q.lines.some((l) => l.includes('deepseek-v4-pro') && l.includes('2,400'))).toBe(true);
  });

  it('flags trimmed material when any story was truncated', () => {
    const truncatedPerStory = [{ ...perStory[0], truncated: true }, perStory[1]];
    const q = buildQuote({ perStory: truncatedPerStory, totalChars: 100 });
    expect(q.anyTruncated).toBe(true);
    expect(q.lines).toContain('Some stored material was trimmed to fit the per-story budget.');
  });
});
