import { describe, it, expect } from 'vitest';
import { itemState, stateMeta } from '@/features/track-record/lib/questionStates.js';

describe('questionStates', () => {
  it('a past deadline is its own state: never "awaiting", never a miss', () => {
    expect(stateMeta('past_deadline_unchecked').label).toBe('Past deadline, not checked');
    expect(stateMeta('past_deadline_unchecked').label).not.toMatch(/await|miss/i);
    expect(stateMeta('awaiting').label).toBe('Awaiting');
  });
  it('maps archived pilot verdicts and server states to one vocabulary', () => {
    expect(itemState({ verdict: 'fired' })).toBe('yes');
    expect(itemState({ verdict: 'not_fired' })).toBe('no');
    expect(itemState({ state: 'void' })).toBe('void');
    expect(itemState({ state: 'past_deadline_unchecked' })).toBe('past_deadline_unchecked');
    expect(itemState({})).toBeNull();
    expect(itemState(null)).toBeNull();
  });
});
