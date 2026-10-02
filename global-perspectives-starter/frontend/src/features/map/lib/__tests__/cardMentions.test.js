import { describe, it, expect } from 'vitest';
import { knownStoryTitles, linkMentions, linkedStoryLines, MIN_TITLE_CHARS } from '@/features/map/lib/cardMentions.js';

const THREADS = {
  'thread-a': { title: 'US diesel prices hit all-time high' },
  'thread-b': { title: 'Strait of Hormuz closure' },
  'thread-self': { title: 'The open story headline here' },
  'thread-short': { title: 'Iran talks' },
  'thread-dup1': { title: 'Same headline in two stories' },
  'thread-dup2': { title: 'same headline in two stories' },
};

describe('knownStoryTitles', () => {
  const known = knownStoryTitles(THREADS, 'thread-self');
  it('skips the open story, short titles and titles shared by two stories', () => {
    const ids = known.map((k) => k.id);
    expect(ids).toEqual(expect.arrayContaining(['thread-a', 'thread-b']));
    expect(ids).not.toContain('thread-self');
    expect(ids).not.toContain('thread-short');
    expect(ids).not.toContain('thread-dup1');
    expect(ids).not.toContain('thread-dup2');
    expect('Iran talks'.length).toBeLessThan(MIN_TITLE_CHARS);
  });
  it('is longest-first and tolerates junk input', () => {
    expect(known[0].title.length).toBeGreaterThanOrEqual(known[known.length - 1].title.length);
    expect(knownStoryTitles(null)).toEqual([]);
  });
});

describe('linkMentions', () => {
  const known = knownStoryTitles(THREADS, 'thread-self');
  it('links an exact whole-title mention, case-insensitively, and keeps the text intact', () => {
    const t = 'Pressure followed as US Diesel Prices Hit All-Time High again, per npr.org.';
    const segs = linkMentions(t, known);
    expect(segs.map((s) => s.text).join('')).toBe(t);
    const linked = segs.filter((s) => s.threadId);
    expect(linked).toEqual([{ text: 'US Diesel Prices Hit All-Time High', threadId: 'thread-a' }]);
  });
  it('never links a partial or similar title', () => {
    expect(linkMentions('Diesel prices hit a high in the US.', known)).toEqual([{ text: 'Diesel prices hit a high in the US.' }]);
    expect(linkMentions('The Strait of Hormuz closure-related talks', known).filter((s) => s.threadId)).toHaveLength(0);
  });
  it('needs whole-word boundaries', () => {
    expect(linkMentions('xStrait of Hormuz closure', known).filter((s) => s.threadId)).toHaveLength(0);
    expect(linkMentions('Strait of Hormuz closure.', known).filter((s) => s.threadId)).toHaveLength(1);
  });
  it('links several mentions and drops overlaps', () => {
    const t = 'Strait of Hormuz closure then US diesel prices hit all-time high.';
    expect(linkMentions(t, known).filter((s) => s.threadId).map((s) => s.threadId)).toEqual(['thread-b', 'thread-a']);
  });
  it('returns plain text with no known titles, and [] for empty text', () => {
    expect(linkMentions('hello', [])).toEqual([{ text: 'hello' }]);
    expect(linkMentions('', known)).toEqual([]);
  });
});

describe('linkedStoryLines', () => {
  const derived = {
    fedInto: [
      { targetThreadId: 'B', targetTitle: 'Story B', confidence: 'weak' },
      { targetThreadId: 'B', targetTitle: 'Story B', confidence: 'strong' },
      { targetThreadId: 'C', targetTitle: 'Story C', confidence: 'medium' },
      { targetThreadId: 'D', targetTitle: null, confidence: 'strong' },
    ],
    fedFrom: [{ sourceThreadId: 'E', sourceTitle: 'Story E', confidence: null }],
  };
  it('one entry per distinct story, strongest analysis wins, strongest first, untitled dropped', () => {
    const l = linkedStoryLines(derived);
    expect(l.into).toEqual([{ id: 'B', title: 'Story B', confidence: 'strong' }, { id: 'C', title: 'Story C', confidence: 'medium' }]);
    expect(l.from).toEqual([{ id: 'E', title: 'Story E', confidence: null }]);
  });
  it('is empty without links and respects max', () => {
    expect(linkedStoryLines(null)).toEqual({ into: [], from: [] });
    expect(linkedStoryLines(derived, 1).into).toHaveLength(1);
  });
});
