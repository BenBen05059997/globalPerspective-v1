// StoryLinkCard words (story card consistency): every kind chip including "Moves a story", the shared since phrase.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StoryLinkCard from '@/features/board/components/StoryLinkCard.jsx';

const story = (o = {}) => ({
  id: 'a', title: 'Hodeidah operation', category: 'conflict', tier: 'high', riskScore: 85, born: '2026-09-08',
  newest: { date: '2026-11-20', role: 'move' }, stepCount: 64, stepDays: 37, firstStep: { role: 'start' }, ...o,
});
const rows = { feeds: [], fedBy: [], notes: [] };
const mount = (s) => render(<MemoryRouter><StoryLinkCard story={s} rows={rows} storyOf={(id) => ({ id, title: id })} mark={null} mode="week" /></MemoryRouter>);

describe('StoryLinkCard', () => {
  it('shows the "Moves a story" chip and the one since phrase', () => {
    mount(story());
    expect(screen.getByText('Moves a story')).toBeInTheDocument();
    expect(screen.getByText('since Sep 8 · 64 steps on 37 days')).toBeInTheDocument();
    expect(screen.getByText('newest step Nov 20')).toBeInTheDocument();
  });
  it('a first step that is not a start says "in our record since"; a one-step story has no since phrase', () => {
    const { unmount } = mount(story({ firstStep: { role: null } }));
    expect(screen.getByText('in our record since Sep 8 · 64 steps on 37 days')).toBeInTheDocument();
    unmount();
    mount(story({ stepCount: 1, stepDays: 1 }));
    expect(screen.queryByText(/since Sep 8/)).toBeNull();
  });
});
