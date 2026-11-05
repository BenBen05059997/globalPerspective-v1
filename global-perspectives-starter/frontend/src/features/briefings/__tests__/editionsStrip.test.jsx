// The /briefings editions strip (daily marks and the pause), the weekly edition step links, and the
// failed-request panel. Marks and wording come from real dates only; a gap is explained, never hidden.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const report = vi.fn();
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => report(...a) }));

import EditionsStrip, { WeeklyEditionNav } from '@/features/briefings/components/EditionsStrip.jsx';
import BriefingError from '@/features/briefings/components/BriefingError.jsx';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
  report.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

// newest first, as the hook hands them over
const marks = [
  { dateKey: '2026-10-30', status: 'exists', current: true },
  { dateKey: '2026-10-29', status: 'none', current: false },
  { dateKey: '2026-10-28', status: 'unknown', current: false },
  { dateKey: '2026-10-27', status: 'exists', current: false },
];

describe('EditionsStrip', () => {
  it('renders nothing without marks', () => {
    expect(render(<EditionsStrip marks={[]} />).container.firstChild).toBeNull();
    expect(render(<EditionsStrip />).container.firstChild).toBeNull();
  });

  it('draws marks oldest to newest with an accessible label per state', () => {
    render(<EditionsStrip marks={marks} currentDateKey="2026-10-30" onSelect={vi.fn()} />);
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Tue, Oct 27, edition available',
      'Wed, Oct 28, not yet checked',
      'Thu, Oct 29, no edition was published',
      'Fri, Oct 30, edition available, currently showing',
    ]);
  });

  it('clicking an available edition selects that date', () => {
    const onSelect = vi.fn();
    render(<EditionsStrip marks={marks} currentDateKey="2026-10-30" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tue, Oct 27, edition available' }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-27');
  });

  it('available marks are disabled when nothing can select them', () => {
    render(<EditionsStrip marks={marks} currentDateKey="2026-10-30" />);
    expect(screen.getByRole('button', { name: 'Tue, Oct 27, edition available' })).toBeDisabled();
  });

  it('a gap mark explains itself and offers the latest edition, then dismisses', () => {
    const onGoLatest = vi.fn();
    render(<EditionsStrip marks={marks} currentDateKey="2026-10-30" onSelect={vi.fn()} onGoLatest={onGoLatest} latestLabel="Fri, Oct 30" />);
    fireEvent.click(screen.getByRole('button', { name: 'Thu, Oct 29, no edition was published' }));
    expect(screen.getByRole('status')).toHaveTextContent('No edition was published for Thu, Oct 29.');
    fireEvent.click(screen.getByRole('button', { name: 'Show the latest edition (Fri, Oct 30) →' }));
    expect(onGoLatest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thu, Oct 29, no edition was published' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('there is no paused mark and no "paused" wording', () => {
    render(<EditionsStrip marks={marks} currentDateKey="2026-10-30" />);
    expect(screen.queryByRole('button', { name: /^Paused/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/paused/i);
  });
});

describe('WeeklyEditionNav', () => {
  const hrefForWeek = (w) => (w ? `/briefings?mode=weekly&week=${w}` : '/briefings?mode=weekly');

  it('renders nothing without a week', () => {
    expect(render(<MemoryRouter><WeeklyEditionNav hrefForWeek={hrefForWeek} /></MemoryRouter>).container.firstChild).toBeNull();
  });

  it('latest edition: shows the week and a link to the week before, no "latest" link', () => {
    render(<MemoryRouter><WeeklyEditionNav weekOf="2026-10-26" weeks={['2026-10-26', '2026-10-19']} hrefForWeek={hrefForWeek} /></MemoryRouter>);
    expect(screen.getByLabelText('Week ending Mon, Oct 26, currently showing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Week before' })).toHaveAttribute('href', '/briefings?mode=weekly&week=2026-10-19');
    expect(screen.queryByRole('link', { name: /Latest edition/ })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a past week offers a way back to the latest edition', () => {
    render(<MemoryRouter><WeeklyEditionNav weekOf="2026-10-19" requestedWeek="2026-10-19" weeks={['2026-10-26', '2026-10-19', '2026-09-06']} hrefForWeek={hrefForWeek} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Latest edition →' })).toHaveAttribute('href', '/briefings?mode=weekly');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('the week before is the nearest existing edition, not the previous calendar week', () => {
    render(<MemoryRouter><WeeklyEditionNav weekOf="2026-10-04" weeks={['2026-10-04', '2026-09-06']} hrefForWeek={hrefForWeek} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '← Week before' })).toHaveAttribute('href', '/briefings?mode=weekly&week=2026-09-06');
  });

  it('no earlier edition, or no index to know it: no "Week before" link (never a guessed week)', () => {
    const { unmount } = render(<MemoryRouter><WeeklyEditionNav weekOf="2026-09-06" weeks={['2026-09-06']} hrefForWeek={hrefForWeek} /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: '← Week before' })).toBeNull();
    unmount();
    render(<MemoryRouter><WeeklyEditionNav weekOf="2026-10-04" weeks={null} hrefForWeek={hrefForWeek} /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: '← Week before' })).toBeNull();
  });

  it('when the API answers with a different week than asked, it says so plainly', () => {
    render(<MemoryRouter><WeeklyEditionNav weekOf="2026-10-26" requestedWeek="2026-10-05" hrefForWeek={hrefForWeek} /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('The edition for the week ending Mon, Oct 5 is not available here yet; showing the latest edition (week ending Mon, Oct 26).');
  });
});

describe('BriefingError', () => {
  it('says the request failed (not "no brief published"), reports once, and retries on click', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<BriefingError what="daily" error={new Error('Proxy HTTP 500')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The daily brief could not be loaded: the request to the server failed.');
    expect(document.body.textContent).not.toMatch(/something went wrong|Proxy HTTP 500/i);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('briefings-daily', expect.objectContaining({ message: 'Proxy HTTP 500' }));
    rerender(<BriefingError what="daily" error={report.mock.calls[0][1]} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('wraps a non-Error value, and omits the button without a retry handler', () => {
    render(<BriefingError what="weekly" error="timeout" />);
    expect(report).toHaveBeenCalledWith('briefings-weekly', expect.any(Error));
    expect(report.mock.calls[0][1].message).toBe('timeout');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not report when there is no error value', () => {
    render(<BriefingError what="daily" error={null} />);
    expect(report).not.toHaveBeenCalled();
  });
});
