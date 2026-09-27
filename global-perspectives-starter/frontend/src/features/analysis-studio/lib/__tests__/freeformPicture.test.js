import { describe, it, expect } from 'vitest';
import { sentenceCitations } from '../freeformPicture.js';

describe('sentenceCitations', () => {
  it('maps each sentence to the citation markers it carries', () => {
    const prose = 'The standoff persists [1]. Fresh coverage confirms it [2][W1]. A third sentence cites nothing.';
    const out = sentenceCitations(prose);
    expect(out.length).toBe(3);
    expect(out[0].citations).toEqual(['1']);
    expect(out[1].citations).toEqual(['2', 'W1']);
    expect(out[2].citations).toEqual([]);
  });

  it('returns an empty list for empty prose', () => {
    expect(sentenceCitations('')).toEqual([]);
    expect(sentenceCitations(null)).toEqual([]);
  });
});
