import { describe, it, expect } from 'vitest';
import { boardQid } from '@/shared/lib/questionChips.js';

const q = (o = {}) => ({ question: true, qid: 'x', p: 64, scoring: 'sampled', ...o });

describe('boardQid', () => {
  it('gives the qid only for a sampled question', () => {
    expect(boardQid(q())).toBe('x');
  });
  it('every question that is not on the board has no track-record link', () => {
    for (const scoring of ['not_sampled', 'awaiting_draw', 'warm_up', 'not_eligible', undefined]) expect(boardQid(q({ scoring }))).toBeNull();
  });
  it('no qid, not a question, or no trigger: no link', () => {
    expect(boardQid(q({ qid: undefined }))).toBeNull();
    expect(boardQid(q({ question: false }))).toBeNull();
    expect(boardQid(null)).toBeNull();
  });
});
