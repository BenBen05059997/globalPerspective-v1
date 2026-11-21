import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const H = vi.hoisted(() => ({ line: null }));
vi.mock('@/shared/hooks/useStoryLinkLine', () => ({ useStoryLinkLine: () => H.line }));
vi.mock('@/shared/api/storyCategory.js', () => ({ useStoryCategory: () => 'economy' }));
vi.mock('@/shared/hooks/usePeek', () => ({ usePeek: () => ({ openId: null, openOnHover: () => {}, openOnFocus: () => {}, close: () => {}, style: {} }) }));

import StoryLinkLine from '@/shared/ui/StoryLinkLine.jsx';

const mount = () => render(<MemoryRouter><StoryLinkLine id="a" category="conflict" /></MemoryRouter>);

describe('StoryLinkLine', () => {
  it('no link: nothing at all', () => {
    H.line = null;
    expect(mount().container.firstChild).toBeNull();
  });
  it('a judged link: the board words, the other story as a story link, strength bars and word, MODEL JUDGMENT; no "confirmed"', () => {
    H.line = { dir: 'feeds', otherId: 'thread-b', title: 'Story B', strength: 'medium', confirmed: false };
    mount();
    expect(screen.getByText('→ feeds into')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Story B' })).toHaveAttribute('href', '/weekly/thread/thread-b');
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(document.querySelectorAll('.gp-strength__bar.is-on')).toHaveLength(2);
    expect(screen.getByText('MODEL JUDGMENT')).toBeInTheDocument();
    expect(screen.queryByText(/confirmed/)).toBeNull();
  });
  it('a judged link the weekly review also confirmed: "← fed by", bars, and the confirmed note', () => {
    H.line = { dir: 'fed', otherId: 'thread-b', title: 'Story B', strength: 'strong', confirmed: true };
    mount();
    expect(screen.getByText('← fed by')).toBeInTheDocument();
    expect(screen.getByText('confirmed in our weekly review')).toBeInTheDocument();
    expect(document.querySelectorAll('.gp-strength__bar.is-on')).toHaveLength(3);
  });
  it('the sign leads: solid square (this story), places, arrow, striped square (other story), places; shapes hidden from screen readers', () => {
    H.line = { dir: 'feeds', otherId: 'thread-b', title: 'Story B', strength: 'medium', confirmed: false, places: { mine: ['Yemen', 'Saudi Arabia'], other: ['Egypt'], same: false } };
    mount();
    const sign = screen.getByTestId('link-sign');
    expect(sign.textContent).toBe('This story: Yemen, Saudi Arabia→The other story: Egypt');
    const sw = sign.querySelectorAll('.gp-sign__sw');
    expect(sw[0]).toHaveClass('gp-sign__sw--solid');
    expect(sw[0].style.getPropertyValue('--h')).toBe('#ee7754'); // conflict
    expect(sw[1]).toHaveClass('gp-sign__sw--stripe');
    expect(sw[1].style.getPropertyValue('--h')).toBe('#8fd46a'); // economic
    expect([...sw].every((e) => e.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(sign.querySelector('.gp-sign__arr')).toHaveAttribute('aria-hidden', 'true');
  });
  it('"fed by" flips the arrow and its colour (the other story feeds), not the squares', () => {
    H.line = { dir: 'fed', otherId: 'thread-b', title: 'Story B', strength: 'medium', confirmed: false, places: { mine: ['Yemen'], other: [], same: true } };
    mount();
    const sign = screen.getByTestId('link-sign');
    expect(sign.querySelector('.gp-sign__arr').textContent).toBe('←');
    expect(sign.querySelector('.gp-sign__arr').style.getPropertyValue('--h')).toBe('#8fd46a');
    expect(sign.querySelectorAll('.gp-sign__sw')[0]).toHaveClass('gp-sign__sw--solid');
    expect(sign).toHaveTextContent('same places');
  });
  it('a link with no country data: the squares and arrow and "places not given", no "same places"', () => {
    H.line = { dir: 'feeds', otherId: 'thread-b', title: 'Story B', strength: 'medium', confirmed: false, places: { mine: [], other: [], same: false } };
    mount();
    expect(screen.getByTestId('link-sign').textContent).toBe('→places not given');
  });
});
