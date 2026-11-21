import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const H = vi.hoisted(() => ({ line: null }));
vi.mock('@/shared/hooks/useStoryLinkLine', () => ({ useStoryLinkLine: () => H.line }));
vi.mock('@/shared/hooks/usePeek', () => ({ usePeek: () => ({ openId: null, openOnHover: () => {}, openOnFocus: () => {}, close: () => {}, style: {} }) }));

import StoryLinkLine from '@/shared/ui/StoryLinkLine.jsx';

const mount = () => render(<MemoryRouter><StoryLinkLine id="a" /></MemoryRouter>);

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
});
