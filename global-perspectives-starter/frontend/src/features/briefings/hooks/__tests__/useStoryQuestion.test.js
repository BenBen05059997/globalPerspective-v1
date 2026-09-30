import { describe, it, expect } from 'vitest';
import { pickNextQuestion } from '@/features/briefings/hooks/useStoryQuestion.js';

const t = (o) => ({ id: 'x', text: 'T', deadline: '2026-11-15', question: true, qid: 'q', p: 50, state: 'awaiting', ...o });
const snap = (triggers) => ({ scenarios: [{ label: 'A', triggers }] });

describe('pickNextQuestion', () => {
  const today = '2026-11-01';
  it('the earliest open question that has its own probability', () => {
    const s = snap([t({ text: 'later', deadline: '2026-12-01' }), t({ text: 'sooner', deadline: '2026-11-10' })]);
    expect(pickNextQuestion(s, today).text).toBe('sooner');
  });
  it('skips passed deadlines, resolved questions and triggers without a probability of their own', () => {
    const s = snap([t({ deadline: '2026-10-01' }), t({ state: 'yes' }), t({ question: undefined, p: undefined }), t({ text: 'ok', deadline: '2026-11-30' })]);
    expect(pickNextQuestion(s, today).text).toBe('ok');
  });
  it('nothing usable -> null (the slide shows nothing)', () => {
    expect(pickNextQuestion(snap([t({ question: undefined })]), today)).toBeNull();
    expect(pickNextQuestion(null, today)).toBeNull();
  });
});
