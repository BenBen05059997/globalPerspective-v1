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

describe('ClaimTag (shared)', () => {
  it('fact / inference / judgment wording; unknown kind renders nothing', () => {
    const { container } = render(<><ClaimTag kind="fact" /><ClaimTag kind="inference" /><ClaimTag kind="judgment" /><ClaimTag kind="opinion" /></>);
    expect([...container.querySelectorAll('.claim-tag')].map((n) => n.textContent)).toEqual(['FACT', 'INFERENCE', 'MODEL JUDGMENT']);
  });
});
