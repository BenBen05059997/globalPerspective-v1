// OrientationBanner (H1, M5b): shows once, dismisses, remembers the dismissal, and survives a
// throwing localStorage (private-window / blocked storage — CLAUDE.md: never crash on it).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrientationBanner from '@/features/map/components/OrientationBanner.jsx';

const KEY = 'gp_map_orientation_dismissed_v2';

describe('OrientationBanner', () => {
  beforeEach(() => { localStorage.clear(); });

  it('desktop: the sentence, then both kinds on one line with no dot line (design round 8); phone: the sentence only', () => {
    const { unmount, container } = render(<OrientationBanner />);
    expect(screen.getByText(/^We follow the world’s stories day by day/)).toBeInTheDocument();
    expect(container.querySelector('.gp-kindkey--line').textContent).toBe('Moves a story a new step in a story we already follow·Starts a story the first step of a new story');
    expect(container).not.toHaveTextContent(/each dot is a story/i);
    unmount();
    const r = render(<OrientationBanner phone />);
    expect(screen.getByText(/^We follow the world’s stories day by day/)).toBeInTheDocument();
    expect(r.container.querySelector('.gp-kindkey')).toBeNull();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('dismisses on click and remembers it in localStorage', () => {
    render(<OrientationBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/We follow the world’s stories/)).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('does not render again once already dismissed', () => {
    localStorage.setItem(KEY, '1');
    render(<OrientationBanner />);
    expect(screen.queryByText(/We follow the world’s stories/)).not.toBeInTheDocument();
  });

  it('still renders and dismisses correctly when localStorage throws', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<OrientationBanner />);
    expect(screen.getByText(/We follow the world’s stories/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/We follow the world’s stories/)).not.toBeInTheDocument();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
