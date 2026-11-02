// DeskFollowing and DeskSinceLastVisit rendered directly (the DeskPanel tests cover them only as
// part of the whole desk): member gate, empty states, the chip/row content that traces back to the
// data passed in, links, and the "last visit" stamp that is written only after rows were shown.
// Country data below is test input, not claims about any real country.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import DeskFollowing from '@/features/account/components/DeskFollowing';
import DeskSinceLastVisit from '@/features/account/components/DeskSinceLastVisit';
import { LAST_VISIT_KEY } from '@/features/account/lib/desk';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('DeskFollowing', () => {
  it('non-member: says following is part of membership, no map and no chips', () => {
    const { container } = wrap(<DeskFollowing isMember={false} followedCountries={['Iran']} countryResults={[]} />);
    expect(screen.getByText('FOLLOWING')).toBeInTheDocument();
    expect(screen.getByText('Following countries is part of membership.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each([[[]], [undefined], [null]])('member with %j followed: honest "don\'t follow any country yet" state', (followed) => {
    wrap(<DeskFollowing isMember followedCountries={followed} countryResults={[]} />);
    expect(screen.getByText("You don't follow any country yet.")).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('member: one chip per followed country linking to its page, showing the latest snapshot score and tier', () => {
    const countryResults = [
      {
        country: 'Iran',
        // out of order on purpose: the chip must use the newest dateKey, not the last array entry
        snapshots: [
          { dateKey: '2026-08-17', riskScore: 80 },
          { dateKey: '2026-08-15', riskScore: 30 },
          { dateKey: '2026-08-16', riskScore: 55 },
        ],
      },
      { country: 'Japan', snapshots: [{ dateKey: '2026-08-15', riskScore: 12 }] },
    ];
    wrap(<DeskFollowing isMember followedCountries={['Iran', 'Japan']} countryResults={countryResults} />);
    const iran = screen.getByRole('link', { name: /Iran/ });
    expect(iran).toHaveTextContent('🔔 Iran · risk 80 · high');
    expect(iran).toHaveAttribute('href', '/weekly/country/Iran');
    const japan = screen.getByRole('link', { name: /Japan/ });
    expect(japan).toHaveTextContent('🔔 Japan · risk 12 · low');
    expect(japan).toHaveAttribute('href', '/weekly/country/Japan');
    // the controls are links: clicking one must not throw or remove anything
    fireEvent.click(iran);
    fireEvent.click(japan);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('draws the map with one dot per followed country that has an outline; a country with no data still gets a bare chip (no invented score)', () => {
    const { container } = wrap(
      <DeskFollowing
        isMember
        followedCountries={['Iran', 'Japan']}
        countryResults={[{ country: 'Iran', error: 'HTTP 500' }]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Small world map with followed countries outlined' })).toBeInTheDocument();
    expect(container.querySelectorAll('circle.desk-following-dot')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Iran/ })).toHaveTextContent(/^🔔 Iran$/);
    expect(screen.getByRole('link', { name: /Japan/ })).not.toHaveTextContent(/risk/);
  });

  it('a followed name that is not a country renders as plain text with no dot and no dead link', () => {
    const { container } = wrap(
      <DeskFollowing isMember followedCountries={['Strait of Hormuz']} countryResults={[]} />,
    );
    expect(screen.getByText(/Strait of Hormuz/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelectorAll('circle.desk-following-dot')).toHaveLength(0);
  });
});

describe('DeskSinceLastVisit', () => {
  const NOTE_NEW = {
    asOf: '2026-09-10',
    changeScore: { from: 40, to: 62 },
    whyChanged: 'Stored explanation for the newer note.',
    triggerEvent: { title: 'A triggering story', date: '2026-09-09', threadId: 'thread-42' },
  };
  const NOTE_OLD = { asOf: '2026-08-01', changeScore: { from: 10, to: 20 }, whyChanged: 'Stored explanation for the older note.' };

  // Pin "today" two days after the newer note so the "no new changes since ..." staleness line
  // (7+ days old) does not depend on the real clock. Only Date is faked: timers stay real.
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-12T09:00:00.000Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  function renderCard(props = {}) {
    return wrap(
      <DeskSinceLastVisit
        isMember
        followedCountries={['Iran']}
        countryResults={[{ country: 'Iran', snapshots: [], driftNotes: [NOTE_NEW, NOTE_OLD] }]}
        loading={false}
        paused={false}
        {...props}
      />,
    );
  }

  it('non-member: membership upsell with a link to /membership, nothing else', () => {
    renderCard({ isMember: false });
    expect(screen.getByText('SINCE YOUR LAST VISIT')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'See membership →' });
    expect(link).toHaveAttribute('href', '/membership');
    fireEvent.click(link);
    expect(screen.queryByText(/Stored explanation/)).not.toBeInTheDocument();
  });

  it.each([[[]], [undefined]])('member following nobody (%j): empty state with a link to the countries list', (followed) => {
    renderCard({ followedCountries: followed });
    expect(screen.getByText(/You don't follow any country yet/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Follow from a country page.' });
    expect(link).toHaveAttribute('href', '/weekly/countries');
    fireEvent.click(link);
  });

  it('while loading: skeleton rows only, no notes and no "no changes" claim', () => {
    const { container } = renderCard({ loading: true });
    expect(container.querySelectorAll('.desk-skeleton-row')).toHaveLength(3);
    expect(screen.queryByText(/No changes since/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Stored explanation/)).not.toBeInTheDocument();
  });

  it('first visit (no stored timestamp): says so and lists the notes with their score move, trigger link and stored explanation', () => {
    renderCard();
    expect(screen.getByText('First visit on this browser — showing the latest changes.')).toBeInTheDocument();
    const heads = Array.from(document.querySelectorAll('.desk-row-head')).map((e) => e.textContent);
    expect(heads).toEqual(['Sep 10 · IRAN · 40→62', 'Aug 1 · IRAN · 10→20']);
    expect(screen.getByText('Stored explanation for the newer note.')).toBeInTheDocument();
    expect(screen.getAllByText(/MODEL JUDGMENT/)).toHaveLength(2);
    const trigger = screen.getByRole('link', { name: 'A triggering story' });
    expect(trigger).toHaveAttribute('href', expect.stringContaining('thread-42'));
    expect(screen.getByText(/After:/)).toHaveTextContent('(Sep 9)');
    const country = screen.getAllByRole('link', { name: 'IRAN' })[0];
    expect(country).toHaveAttribute('href', '/weekly/country/Iran');
    fireEvent.click(trigger);
    fireEvent.click(country);
  });

  it('returning visit: shows only notes on or after the stored last-visit day', () => {
    window.localStorage.setItem(LAST_VISIT_KEY, '2026-09-01T10:00:00.000Z');
    renderCard();
    expect(screen.queryByText(/First visit on this browser/)).not.toBeInTheDocument();
    expect(screen.getByText('Stored explanation for the newer note.')).toBeInTheDocument();
    expect(screen.queryByText('Stored explanation for the older note.')).not.toBeInTheDocument();
  });

  it('returning visit with nothing newer: "No changes since your last visit."', () => {
    window.localStorage.setItem(LAST_VISIT_KEY, '2026-09-20T10:00:00.000Z');
    renderCard();
    expect(screen.getByText('No changes since your last visit.')).toBeInTheDocument();
    expect(screen.queryByText(/Stored explanation/)).not.toBeInTheDocument();
  });

  it('names a country that failed to load, keeps the other countries rows, and says earlier changes are gated when the server gated them', () => {
    renderCard({
      followedCountries: ['Iran', 'Japan'],
      countryResults: [
        { country: 'Iran', snapshots: [], driftNotes: [NOTE_NEW], driftNotesGated: true },
        { country: 'Japan', error: 'HTTP 500' },
      ],
    });
    expect(screen.getByText("Couldn't load changes for Japan.")).toBeInTheDocument();
    expect(screen.getByText('Stored explanation for the newer note.')).toBeInTheDocument();
    expect(screen.getByText('Earlier changes are part of membership.')).toBeInTheDocument();
  });

  it('every country failed: lists the failures and does NOT claim there were no changes', () => {
    window.localStorage.setItem(LAST_VISIT_KEY, '2026-09-20T10:00:00.000Z');
    renderCard({
      followedCountries: ['Iran', 'Japan'],
      countryResults: [{ country: 'Iran', error: 'x' }, { country: 'Japan', error: 'y' }],
    });
    expect(screen.getByText("Couldn't load changes for Iran.")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load changes for Japan.")).toBeInTheDocument();
    expect(screen.queryByText('No changes since your last visit.')).not.toBeInTheDocument();
  });

  describe('last-visit stamp', () => {
    beforeEach(() => {
      vi.useRealTimers();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-15T09:00:00.000Z'));
    });

    it('is not written immediately (a refresh must not erase the list), but 10 seconds after the rows rendered', () => {
      renderCard();
      expect(window.localStorage.getItem(LAST_VISIT_KEY)).toBeNull();
      act(() => { vi.advanceTimersByTime(9999); });
      expect(window.localStorage.getItem(LAST_VISIT_KEY)).toBeNull();
      act(() => { vi.advanceTimersByTime(1); });
      expect(window.localStorage.getItem(LAST_VISIT_KEY)).toBe('2026-09-15T09:00:10.000Z');
    });

    it('is written when the reader leaves the desk before the 10 seconds', () => {
      const { unmount } = renderCard();
      expect(window.localStorage.getItem(LAST_VISIT_KEY)).toBeNull();
      unmount();
      expect(window.localStorage.getItem(LAST_VISIT_KEY)).toBe('2026-09-15T09:00:00.000Z');
    });

    it('is never written while the rows are still loading, even after leaving or waiting', () => {
      const { unmount } = renderCard({ loading: true });
      act(() => { vi.advanceTimersByTime(20000); });
      unmount();
      expect(window.localStorage.getItem(LAST_VISIT_KEY)).toBeNull();
    });
  });
});
