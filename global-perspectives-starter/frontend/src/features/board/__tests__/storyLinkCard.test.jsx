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
  it('a link row carries only the other story\'s striped square and the places the page rule gave; "same places" when none are left', () => {
    const feeds = { feeds: [{ from: 'a', to: 'b', strength: 'strong', reason: '' }], fedBy: [], notes: [] };
    const storyOf = () => ({ id: 'b', title: 'Oil deal', category: 'economy' });
    const go = (places) => render(<MemoryRouter><StoryLinkCard story={story()} rows={feeds} storyOf={storyOf} placesOf={(id, other) => (id === 'a' && other === 'b' ? places : null)} mark={null} mode="week" /></MemoryRouter>);
    const { container, unmount } = go({ mine: ['Saudi Arabia'], other: ['Japan'], same: false });
    const sign = container.querySelector('[data-testid="link-sign"]');
    expect(sign.querySelectorAll('.gp-sign__sw--solid')).toHaveLength(0);
    expect(sign.querySelector('.gp-sign__sw--stripe').style.getPropertyValue('--h')).toBe('#8fd46a');
    expect(sign).toHaveTextContent('Japan');
    expect(sign).not.toHaveTextContent('Saudi');
    unmount();
    expect(go({ mine: ['Yemen'], other: [], same: true }).container.querySelector('[data-testid="link-sign"]')).toHaveTextContent('same places');
  });
  it('no places known for the pair: "places not given", never a square alone and no "same places"', () => {
    const feeds = { feeds: [{ from: 'a', to: 'b', strength: 'strong', reason: '' }], fedBy: [], notes: [] };
    const { container } = render(<MemoryRouter><StoryLinkCard story={story()} rows={feeds} storyOf={() => ({ id: 'b', title: 'B', category: 'economy' })} mark={null} mode="week" /></MemoryRouter>);
    expect(container.querySelector('[data-testid="link-sign"]').textContent).toBe('places not given');
  });
  it('a weak link keeps its row and bars but carries no sign, as on every other page', () => {
    const feeds = { feeds: [{ from: 'a', to: 'b', strength: 'weak', reason: '' }], fedBy: [], notes: [] };
    const { container } = render(<MemoryRouter><StoryLinkCard story={story()} rows={feeds} storyOf={() => ({ id: 'b', title: 'B', category: 'economy' })} mark={null} mode="week" /></MemoryRouter>);
    expect(container.querySelector('[data-testid="link-sign"]')).toBeNull();
    expect(container.querySelector('.bl-row')).toHaveTextContent('feeds into');
  });
});
