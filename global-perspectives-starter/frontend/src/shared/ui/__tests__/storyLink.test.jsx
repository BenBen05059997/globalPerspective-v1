// StoryLink — one story link for every place a story is named: a router link to the story that opens
// the shared StoryPeek on hover (after a short delay) / keyboard focus, closes on leave / Esc, shows
// nothing without a title to preview, and never opens a popover on a touch device (a tap navigates).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoryLink from '@/shared/ui/StoryLink.jsx';

const TOPIC = { title: 'Strait of Hormuz closure', category: 'conflict', regions: ['Iran'], sources: 3 };
const mount = (props = {}) => render(
  <MemoryRouter>
    <StoryLink threadId="thread-a-1" topic={TOPIC} {...props}>Open it</StoryLink>
  </MemoryRouter>,
);
const setHover = (hoverNone) => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: hoverNone && q === '(hover: none)', media: q, addEventListener() {}, removeEventListener() {} }));
};

afterEach(() => { vi.useRealTimers(); delete window.matchMedia; });

describe('StoryLink', () => {
  it('is a normal link to the story path (threadPath, with options)', () => {
    mount({ pathOpts: { from: 'country', country: 'Iran' } });
    expect(screen.getByRole('link', { name: 'Open it' })).toHaveAttribute('href', '/weekly/thread/thread-a-1?from=country&country=Iran');
  });

  it('an explicit `to` wins over the thread id', () => {
    mount({ to: '/weekly/thread/x-1?tab=economy' });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/weekly/thread/x-1?tab=economy');
  });

  it('hover opens the peek after the delay, with the headline, place, sources and the hint; leave closes it', () => {
    vi.useFakeTimers();
    setHover(false);
    mount({ hint: 'Open in a new tab' });
    const a = screen.getByRole('link');
    fireEvent.mouseEnter(a);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(300); });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Strait of Hormuz closure');
    expect(tip).toHaveTextContent('Iran');
    expect(tip).toHaveTextContent('3 sources');
    expect(tip).toHaveTextContent('Open in a new tab');
    expect(a).toHaveAttribute('aria-describedby', tip.id);
    fireEvent.mouseLeave(a);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keyboard focus opens it instantly and Esc closes it', () => {
    setHover(false);
    mount();
    const a = screen.getByRole('link');
    fireEvent.focus(a);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens nothing on a touch device (hover: none), neither on hover nor on the focus a tap causes', () => {
    vi.useFakeTimers();
    setHover(true);
    mount();
    const a = screen.getByRole('link');
    fireEvent.mouseEnter(a);
    fireEvent.focus(a);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(a).toHaveAttribute('href', '/weekly/thread/thread-a-1');
  });

  it('without a title there is nothing to preview: a plain link, never a placeholder peek', () => {
    setHover(false);
    mount({ topic: null });
    fireEvent.focus(screen.getByRole('link'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('inline mentions carry the story hue as a CSS variable', () => {
    mount({ inline: true });
    const a = screen.getByRole('link');
    expect(a.className).toContain('gp-storylink--text');
    expect(a.style.getPropertyValue('--story-hue')).not.toBe('');
  });
});
