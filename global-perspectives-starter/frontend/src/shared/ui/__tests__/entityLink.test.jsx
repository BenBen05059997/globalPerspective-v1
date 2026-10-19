// EntityLink — one link for a story, country, situation or forecast: the canonical address from
// shared/lib/links.js, a hover/focus preview when there is something to preview, plain text when the
// thing has no page (a non-country, a missing id). ClaimTag — the one fact/judgment mark.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';

const mount = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const setHover = () => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
};
afterEach(() => { vi.useRealTimers(); delete window.matchMedia; });

describe('EntityLink', () => {
  it('country: links to the canonical display name, label stays the text shown', () => {
    mount(<EntityLink kind="country" id="United Arab Emirates" />);
    const a = screen.getByRole('link', { name: 'United Arab Emirates' });
    expect(a).toHaveAttribute('href', '/weekly/country/UAE');
  });

  it('country: a sub-national place links to its country and the peek names it', () => {
    vi.useFakeTimers();
    setHover();
    mount(<EntityLink kind="country" id="West Bank" />);
    const a = screen.getByRole('link', { name: 'West Bank' });
    expect(a).toHaveAttribute('href', '/weekly/country/Palestine');
    fireEvent.mouseEnter(a);
    act(() => { vi.advanceTimersByTime(300); });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Palestine');
    expect(tip).toHaveTextContent('Open the country page');
  });

  it('country: the plain canonical name has nothing extra to preview (no popover)', () => {
    vi.useFakeTimers();
    setHover();
    mount(<EntityLink kind="country" id="France" />);
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'France' }));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a non-country renders plain text, never a link', () => {
    mount(<EntityLink kind="country" id="Strait of Hormuz" className="x" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Strait of Hormuz')).toHaveClass('x');
  });

  it('a missing id renders the children as text', () => {
    mount(<EntityLink kind="forecast" id={null}>Will the ceasefire hold?</EntityLink>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Will the ceasefire hold?')).toBeInTheDocument();
  });

  it('story / situation / forecast addresses', () => {
    mount(
      <>
        <EntityLink kind="story" id="thread-a-1" pathOpts={{ tab: 'timeline' }}>story</EntityLink>
        <EntityLink kind="situation" id="news#x">situation</EntityLink>
        <EntityLink kind="forecast" id="q-7">forecast</EntityLink>
      </>,
    );
    expect(screen.getByRole('link', { name: 'story' })).toHaveAttribute('href', '/weekly/thread/thread-a-1?tab=timeline');
    expect(screen.getByRole('link', { name: 'situation' })).toHaveAttribute('href', '/?focus=news%23x');
    expect(screen.getByRole('link', { name: 'forecast' })).toHaveAttribute('href', '/track-record?q=q-7');
  });

  it('a caller-supplied peek previews a forecast on keyboard focus; Esc closes it', () => {
    mount(<EntityLink kind="forecast" id="q-7" peek={{ kicker: 'Forecast', title: 'Ceasefire holds to 1 Nov', meta: ['p 0.62'] }}>q</EntityLink>);
    const a = screen.getByRole('link', { name: 'q' });
    fireEvent.focus(a);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Ceasefire holds to 1 Nov');
    expect(tip).toHaveTextContent('p 0.62');
    expect(tip).toHaveTextContent('Open in the track record');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

// The story case: a router link to the story that opens the shared StoryPeek on hover (after a short delay) /
// keyboard focus, closes on leave / Esc, shows nothing without a title to preview, never opens on touch.
describe('EntityLink kind="story"', () => {
  const TOPIC = { title: 'Strait of Hormuz closure', category: 'conflict', regions: ['Iran'], sources: 3 };
  const story = (props = {}) => mount(<EntityLink kind="story" id="thread-a-1" topic={TOPIC} {...props}>Open it</EntityLink>);
  const setTouch = (hoverNone) => {
    window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: hoverNone && q === '(hover: none)', media: q, addEventListener() {}, removeEventListener() {} }));
  };

  it('is a normal link to the story path (storyHref, with options)', () => {
    story({ pathOpts: { from: 'country', country: 'Iran' } });
    expect(screen.getByRole('link', { name: 'Open it' })).toHaveAttribute('href', '/weekly/thread/thread-a-1?from=country&country=Iran');
    expect(screen.getByRole('link')).toHaveClass('gp-storylink');
  });

  it('an explicit `to` wins over the thread id', () => {
    story({ to: '/weekly/thread/x-1?tab=economy' });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/weekly/thread/x-1?tab=economy');
  });

  it('no thread id and no `to`: plain text, never a guessed link', () => {
    story({ id: null, className: 'x' });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Open it')).toHaveClass('x');
  });

  it('hover opens the peek after the delay, with the headline, place, sources and the hint; leave closes it', () => {
    vi.useFakeTimers();
    setTouch(false);
    story({ hint: 'Open in a new tab' });
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
    setTouch(false);
    story();
    const a = screen.getByRole('link');
    fireEvent.focus(a);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens nothing on a touch device (hover: none), neither on hover nor on the focus a tap causes', () => {
    vi.useFakeTimers();
    setTouch(true);
    story();
    const a = screen.getByRole('link');
    fireEvent.mouseEnter(a);
    fireEvent.focus(a);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(a).toHaveAttribute('href', '/weekly/thread/thread-a-1');
  });

  it('without a title there is nothing to preview: a plain link, never a placeholder peek', () => {
    setTouch(false);
    story({ topic: null });
    fireEvent.focus(screen.getByRole('link'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('inline mentions carry the story hue as a CSS variable', () => {
    story({ inline: true });
    const a = screen.getByRole('link');
    expect(a.className).toContain('gp-storylink--text');
    expect(a.style.getPropertyValue('--story-hue')).not.toBe('');
  });
});

describe('ClaimTag (shared)', () => {
  it('fact / inference / judgment wording; unknown kind renders nothing', () => {
    const { container } = render(<><ClaimTag kind="fact" /><ClaimTag kind="inference" /><ClaimTag kind="judgment" /><ClaimTag kind="opinion" /></>);
    expect([...container.querySelectorAll('.claim-tag')].map((n) => n.textContent)).toEqual(['FACT', 'INFERENCE', 'MODEL JUDGMENT']);
  });
});
