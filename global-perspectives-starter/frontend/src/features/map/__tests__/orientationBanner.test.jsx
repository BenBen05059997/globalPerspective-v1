// OrientationBanner (H1, M5b): shows once, dismisses, remembers the dismissal, and survives a
// throwing localStorage (private-window / blocked storage — CLAUDE.md: never crash on it).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrientationBanner from '@/features/map/components/OrientationBanner.jsx';

const KEY = 'gp_map_orientation_dismissed_v1';

describe('OrientationBanner', () => {
  beforeEach(() => { localStorage.clear(); });

  it('shows the orientation line on first visit', () => {
    render(<OrientationBanner />);
    expect(screen.getByText(/shaded countries for stories without an exact place/i)).toBeInTheDocument();
  });

  it('dismisses on click and remembers it in localStorage', () => {
    render(<OrientationBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/shaded countries for stories without an exact place/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('does not render again once already dismissed', () => {
    localStorage.setItem(KEY, '1');
    render(<OrientationBanner />);
    expect(screen.queryByText(/shaded countries for stories without an exact place/i)).not.toBeInTheDocument();
  });

  it('still renders and dismisses correctly when localStorage throws', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<OrientationBanner />);
    expect(screen.getByText(/shaded countries for stories without an exact place/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/shaded countries for stories without an exact place/i)).not.toBeInTheDocument();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
