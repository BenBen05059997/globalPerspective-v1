import { describe, it, expect } from 'vitest';
import { chipFor, legacyNote, hasOwnProbability } from '@/features/threads/lib/questionChips.js';
import { buildDeadlines } from '@/features/threads/lib/storyMode.js';

const q = (o = {}) => ({ id: '0-0', text: 'Country A ratifies', deadline: '2026-11-15', question: true, qid: 'x', p: 64, source: 'Reuters or AP wire report', scoring: 'sampled', state: 'awaiting', ...o });

describe('chipFor', () => {
  it('a question with its own probability gets the % first, then the source and the state', () => {
    expect(chipFor(q())).toEqual({ pct: '64%', source: 'Reuters or AP wire report', text: 'awaiting', kind: 'awaiting' });
  });
  it('past deadline is worded as such, never as a miss', () => {
    expect(chipFor(q({ state: 'past_deadline_unchecked' })).text).toBe('past deadline, not checked');
  });
  it('not sampled / warm-up / not eligible / awaiting draw are each named honestly', () => {
    expect(chipFor(q({ state: null, scoring: 'warm_up' })).text).toMatch(/before scoring began; not scored/);
    expect(chipFor(q({ state: null, scoring: 'not_eligible' })).text).toMatch(/lead time outside 7–84 days/);
    expect(chipFor(q({ state: null, scoring: 'not_sampled' })).text).toBe('not in a scored sample');
    expect(chipFor(q({ state: null, scoring: 'awaiting_draw' })).text).toMatch(/not drawn yet/);
  });
  it('resolved states carry their verdict', () => {
    expect(chipFor(q({ state: 'yes' })).text).toBe('happened');
    expect(chipFor(q({ state: 'no' })).text).toBe('didn’t happen');
    expect(chipFor(q({ state: 'void' })).text).toBe('void');
  });
  it('NO chip without a probability of its own: legacy trigger, demoted trigger, or missing p', () => {
    expect(chipFor({ id: 'a', text: 't', deadline: '2026-11-15' })).toBeNull();
    expect(chipFor({ ...q(), question: false })).toBeNull();
    expect(chipFor(q({ p: undefined }))).toBeNull();
    expect(hasOwnProbability(null)).toBe(false);
  });
});

describe('legacyNote', () => {
  it('appears once when some triggers have no probability of their own, and not otherwise', () => {
    expect(legacyNote([q(), { id: 'b', text: 'old', deadline: '2026-11-01' }])).toMatch(/have no probability of their own/);
    expect(legacyNote([q(), q({ id: '0-1' })])).toBeNull();
    expect(legacyNote([])).toBeNull();
  });
});

describe('buildDeadlines carries the per-question facts through', () => {
  it('adds them only for a question; legacy triggers are unchanged', () => {
    const forecast = { scenarios: [{ label: 'Likely', triggers: [q(), { id: '0-1', text: 'old', deadline: '2026-12-01', verdict: null }] }] };
    const d = buildDeadlines(forecast);
    expect(d[0]).toMatchObject({ question: true, p: 64, source: 'Reuters or AP wire report', state: 'awaiting' });
    expect(d[1].question).toBeUndefined();
    expect(d[1].p).toBeUndefined();
  });
});
