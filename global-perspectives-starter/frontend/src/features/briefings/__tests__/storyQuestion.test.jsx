// Briefings: a top story with a threadId shows its next dated question with its own %; with no
// question (or no threadId) the slide shows nothing extra.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/shared/hooks/usePeek.js', () => ({ usePeek: () => ({ openId: null, bind: () => ({}), open: () => {}, close: () => {} }) }));
const holder = vi.hoisted(() => ({ q: null }));
vi.mock('@/features/briefings/hooks/useStoryQuestion.js', () => ({ useStoryQuestion: () => holder.q }));

import { StorySlide } from '@/features/briefings/components/BriefingSlides.jsx';

const story = { title: 'Treaty talks', category: 'politics', regions: ['France'], prediction: 'p', sourceCount: 2, threadId: 'thread-treaty-1' };
const wrap = (s) => render(<MemoryRouter><StorySlide story={s} index={0} /></MemoryRouter>);

describe('briefing story slide: next dated question', () => {
  it('shows the question, its date and the own-% chip', () => {
    holder.q = { text: 'France ratifies the treaty', deadline: '2026-11-20', question: true, qid: 'q', p: 55, source: 'Official Journal of France', scoring: 'sampled', state: 'awaiting' };
    wrap(story);
    expect(screen.getByText('Next dated question')).toBeInTheDocument();
    expect(screen.getByText(/France ratifies the treaty/)).toBeInTheDocument();
    expect(screen.getByTestId('question-chip').textContent).toBe('55% · source: Official Journal of France · awaiting');
  });
  it('no question -> nothing extra', () => {
    holder.q = null;
    wrap(story);
    expect(screen.queryByText('Next dated question')).toBeNull();
  });
  it('no threadId -> nothing extra even if a question were available', () => {
    holder.q = { text: 'x', deadline: '2026-11-20', question: true, p: 55, state: 'awaiting' };
    wrap({ ...story, threadId: null });
    expect(screen.queryByText('Next dated question')).toBeNull();
  });
});
