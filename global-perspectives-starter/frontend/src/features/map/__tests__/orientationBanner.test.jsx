// OrientationBanner (H1, M5b): shows once, dismisses, remembers the dismissal, and survives a
// throwing localStorage (private-window / blocked storage — CLAUDE.md: never crash on it).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrientationBanner from '@/features/map/components/OrientationBanner.jsx';

const KEY = 'gp_map_orientation_dismissed_v2';

describe('OrientationBanner', () => {
  beforeEach(() => { localStorage.clear(); });

  it('shows the orientation line on first visit', () => {
    render(<OrientationBanner />);
    expect(screen.getByText(/each dot is a story/i)).toBeInTheDocument();
  });

  it('opens with the promise sentence and the kind key; without a map on screen it drops the dot line', () => {
    const { unmount } = render(<OrientationBanner />);
    expect(screen.getByText(/^We follow the world’s stories day by day/)).toBeInTheDocument();
    expect(screen.getByText('Moves a story')).toBeInTheDocument();
    expect(screen.getByText('Starts a story')).toBeInTheDocument();
    unmount();
    render(<OrientationBanner withMap={false} />);
    expect(screen.getByText(/^We follow the world’s stories day by day/)).toBeInTheDocument();
    expect(screen.queryByText(/each dot is a story/i)).toBeNull();
  });

  it('dismisses on click and remembers it in localStorage', () => {
    render(<OrientationBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/each dot is a story/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('does not render again once already dismissed', () => {
    localStorage.setItem(KEY, '1');
    render(<OrientationBanner />);
    expect(screen.queryByText(/each dot is a story/i)).not.toBeInTheDocument();
  });

  it('still renders and dismisses correctly when localStorage throws', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<OrientationBanner />);
    expect(screen.getByText(/each dot is a story/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/each dot is a story/i)).not.toBeInTheDocument();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
