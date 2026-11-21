import { describe, it, expect } from 'vitest';
import { sinceText } from '@/shared/ui/StoryCard.jsx';

describe('sinceText (the one since phrase)', () => {
  const s = { born: '2026-09-08', stepCount: 64, stepDays: 37, firstStep: { role: 'start' } };
  it('month first, steps on days', () => {
    expect(sinceText(s)).toBe('since Sep 8 · 64 steps on 37 days');
    expect(sinceText({ ...s, stepCount: 1, stepDays: 1 })).toBe('since Sep 8 · 1 step on 1 day');
  });
  it('a first step that is not a start: "in our record since"; a measured change is a start', () => {
    expect(sinceText({ ...s, firstStep: { role: null } })).toBe('in our record since Sep 8 · 64 steps on 37 days');
    expect(sinceText({ ...s, firstStep: { role: 'measure' } })).toMatch(/^since Sep 8/);
  });
  it('leaves out what the stamp lacks; no born, no phrase', () => {
    expect(sinceText({ born: '2026-09-08', stepCount: 5 })).toBe('since Sep 8 · 5 steps');
    expect(sinceText({ born: '2026-09-08' })).toBe('since Sep 8');
    expect(sinceText({ stepCount: 5 })).toBe('');
    expect(sinceText(null)).toBe('');
  });
});
