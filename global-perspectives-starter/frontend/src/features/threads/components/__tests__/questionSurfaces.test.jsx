// The own-% chip on WATCH and on the story page's forecast board; a trigger without a probability
// of its own shows no chip and the surface says so once.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WatchSlide } from '@/features/threads/components/StoryMode.jsx';
import ThreadForecast from '@/features/threads/components/ThreadForecast.jsx';

const FUTURE = '2099-01-01';
const question = (o = {}) => ({ id: '0-0', label: 'Country A ratifies the treaty', text: 'Country A ratifies the treaty', deadline: FUTURE, question: true, qid: 'x', p: 64, source: 'Reuters or AP wire report', scoring: 'sampled', state: 'awaiting', scenarioLabel: 'Most Likely', ...o });
const old = { id: '0-1', label: 'An old trigger', text: 'An old trigger', deadline: FUTURE, verdict: null, scenarioLabel: 'Most Likely' };

describe('WATCH slide', () => {
  it('shows the question with its own % and source, and one note about triggers without a probability', () => {
    render(<WatchSlide deadlines={[question(), old]} />);
    const chips = screen.getAllByTestId('question-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toBe('64% · source: Reuters or AP wire report · awaiting');
    expect(screen.getAllByText(/have no probability of their own/)).toHaveLength(1);
  });
  it('all-legacy: no chips, the honest note', () => {
    render(<WatchSlide deadlines={[old]} />);
    expect(screen.queryByTestId('question-chip')).toBeNull();
    expect(screen.getByText(/have no probability of their own/)).toBeInTheDocument();
  });
  it('all questions: no note', () => {
    render(<WatchSlide deadlines={[question()]} />);
    expect(screen.queryByText(/have no probability of their own/)).toBeNull();
  });
});

describe('ThreadForecast (story page)', () => {
  const snapshot = (triggers) => ({ generatedAt: '2026-10-06T05:00:00Z', scenarios: [{ label: 'Most Likely', probability: 0.6, triggers }] });
  it('shows a chip per question and states past-deadline in words', () => {
    const t1 = { id: '0-0', text: 'Q one', deadline: '2026-10-20', question: true, qid: 'a', p: 62, source: 'AP', scoring: 'sampled', state: 'past_deadline_unchecked', verdict: null };
    const t2 = { id: '0-1', text: 'Q two', deadline: '2026-11-20', question: true, qid: 'b', p: 30, source: 'Reuters', scoring: 'not_sampled', state: null, verdict: null };
    render(<MemoryRouter><ThreadForecast snapshot={snapshot([t1, t2])} /></MemoryRouter>);
    const chips = screen.getAllByTestId('question-chip').map((c) => c.textContent);
    expect(chips).toEqual(['62% · source: AP · past deadline, not checked', '30% · source: Reuters · not in a scored sample']);
    expect(screen.getAllByText(/past deadline, not checked/).length).toBeGreaterThan(0);
  });
  it('a confirmed question counts as resolved and shows its verdict', () => {
    const t = { id: '0-0', text: 'Q one', deadline: '2026-10-20', question: true, qid: 'a', p: 62, source: 'AP', scoring: 'sampled', state: 'yes', verdict: null };
    render(<MemoryRouter><ThreadForecast snapshot={snapshot([t])} /></MemoryRouter>);
    expect(screen.getByText(/1\/1 resolved so far/)).toBeInTheDocument();
    expect(screen.getByTestId('question-chip').textContent).toMatch(/happened/);
  });
  it('legacy snapshot: no chips, unchanged rendering plus the note', () => {
    render(<MemoryRouter><ThreadForecast snapshot={snapshot([{ id: '0-0', text: 'Old', deadline: '2026-11-20', verdict: null }])} /></MemoryRouter>);
    expect(screen.queryByTestId('question-chip')).toBeNull();
    expect(screen.getByText(/have no probability of their own/)).toBeInTheDocument();
  });
});
