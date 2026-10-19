import { describe, it, expect } from 'vitest';
import { resolveRequestedStories } from '@/features/analysis-studio/lib/requestedStories.js';

const topics = [{ topicId: 'Today A-0', threadId: 'thread-a-111111' }, { id: 'Today B-1' }];
const earlierRows = [{ topicId: 'Old C-4', threadId: 'thread-c-333333', title: 'C' }];

describe('resolveRequestedStories (/analyze?stories=)', () => {
  it('accepts thread ids (today or earlier) and today topic ids, in order, deduped', () => {
    const r = resolveRequestedStories(['thread-c-333333', 'Today B-1', 'thread-a-111111', 'Today A-0'], { topics, earlierRows, max: 4 });
    expect(r.selected).toEqual(['Old C-4', 'Today B-1', 'Today A-0']);
    expect(r.picked).toEqual({ 'Old C-4': earlierRows[0] });
  });

  it('drops ids that match nothing and stops at the cap', () => {
    expect(resolveRequestedStories(['thread-zzz', 'Today B-1'], { topics, earlierRows, max: 4 }).selected).toEqual(['Today B-1']);
    expect(resolveRequestedStories(['Today A-0', 'Today B-1'], { topics, earlierRows, max: 1 }).selected).toEqual(['Today A-0']);
  });
});
