// ForecastBoard: BOARD tiles show each question's state wording, locked percentage, source, deadline and
// verdict evidence; the MAP view hands RadarMap one count per named country (never a score) and the side
// panel lists that country's questions. A passed deadline is never shown as a miss.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

let radarProps;
vi.mock('@/shared/map/RadarMap.jsx', () => ({
  default: (props) => {
    radarProps = props;
    return (
      <div data-testid="radar">
        {props.shading.map((s) => (
          <button key={s.iso3} type="button" onClick={() => props.onSelectCountry(s.iso3)}>{`${s.top.title}: ${s.count}`}</button>
        ))}
      </div>
    );
  },
}));

import ForecastBoard from '@/features/track-record/components/ForecastBoard.jsx';

const items = [
  {
    qid: 'q-fired', clusterKey: 'thread-hormuz-1', storyTitle: 'Hormuz blockade',
    question: 'Will Iran and Oman announce a shipping corridor?', state: 'yes', p: 62,
    resolutionSource: 'Reuters', deadline: '2026-10-20',
    verdict: { url: 'https://reuters.com/x', quote: 'Both states announced the corridor' },
  },
  {
    qid: 'q-no', storyTitle: 'Iran talks', question: 'Will Iran sign the accord?', state: 'no', p: 30,
    deadline: '2026-10-25', verdict: { url: 'javascript:alert(1)' },
  },
  { qid: 'q-open', storyTitle: 'Open one', question: 'Will Oman mediate again?', state: 'awaiting', p: 55, deadline: '2026-12-01' },
  { qid: 'q-late', storyTitle: 'Late one', question: 'Will Japan raise rates?', state: 'past_deadline_unchecked', p: 40, deadline: '2026-10-01' },
  { qid: 'q-void', storyTitle: 'Void one', question: 'Will Peru hold the vote?', state: 'void', voidReason: 'source_unavailable' },
  { qid: 'q-none', storyTitle: 'No place', question: 'Will prices rise?', state: 'awaiting' },
];

const mount = (props) => render(<MemoryRouter><ForecastBoard items={items} {...props} /></MemoryRouter>);

beforeEach(() => { radarProps = null; Element.prototype.scrollIntoView = vi.fn(); });

describe('ForecastBoard: board view', () => {
  it('shows every question with its honest state label and locked percentage', () => {
    mount();
    fireEvent.click(screen.getByRole('radio', { name: 'BOARD' }));
    const tiles = document.querySelectorAll('.tr-fb-boardlist > li');
    expect(tiles).toHaveLength(items.length);

    const fired = tiles[0];
    expect(fired).toHaveTextContent('✓ Happened');
    expect(fired).toHaveTextContent('Will Iran and Oman announce a shipping corridor?');
    expect(fired).toHaveTextContent('62% when locked');
    expect(fired).toHaveTextContent('source: Reuters');
    expect(fired).toHaveTextContent('by Oct 20 2026');
    expect(fired).toHaveTextContent('“Both states announced the corridor”');
    expect(within(fired).getByRole('link', { name: 'source →' })).toHaveAttribute('href', 'https://reuters.com/x');
    expect(within(fired).getByRole('link', { name: 'Hormuz blockade' })).toHaveAttribute('href', '/weekly/thread/thread-hormuz-1');

    expect(tiles[1]).toHaveTextContent('✗ Not reported');
    expect(tiles[2]).toHaveTextContent('▢ Awaiting');
    // a passed deadline with no verdict is "awaiting check", never a miss
    expect(tiles[3]).toHaveTextContent('▢ Awaiting check');
    expect(tiles[3]).not.toHaveTextContent('Not reported');
    expect(tiles[4]).toHaveTextContent('◌ Could not be checked');
    expect(tiles[4]).toHaveTextContent('Could not be checked · the source was unavailable.');
  });

  it('only http(s) evidence becomes a source link', () => {
    mount();
    fireEvent.click(screen.getByRole('radio', { name: 'BOARD' }));
    const tile = document.getElementById('q-q-no');
    expect(within(tile).queryByRole('link', { name: 'source →' })).toBeNull();
  });

  it('focusQid opens the BOARD view on that question, highlights its tile and scrolls to it', () => {
    mount({ focusQid: 'q-open' });
    expect(screen.getByRole('radio', { name: 'BOARD' })).toHaveAttribute('aria-checked', 'true');
    const tile = document.getElementById('q-q-open');
    expect(tile).toHaveClass('gp-card--selected');
    expect(document.getElementById('q-q-fired')).not.toHaveClass('gp-card--selected');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('a focusQid that is not on the board is ignored: stays on the MAP', () => {
    mount({ focusQid: 'q-unknown' });
    expect(screen.getByRole('radio', { name: 'MAP' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('radar')).toBeInTheDocument();
  });

  it('no items: says nothing to show (board) and shows the caller\'s empty text when given', () => {
    mount({ items: [], emptyText: 'No forecasts yet.' });
    expect(screen.getByText('No forecasts yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'BOARD' }));
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
  });
});

describe('ForecastBoard: map view', () => {
  it('hands RadarMap one neutral count per country named in the questions, most questions first', () => {
    mount();
    const byIso = Object.fromEntries(radarProps.shading.map((s) => [s.iso3, s]));
    expect(byIso.IRN.count).toBe(2);
    expect(byIso.OMN.count).toBe(2);
    expect(byIso.JPN.count).toBe(1);
    expect(byIso.PER.count).toBe(1);
    // one hue for every place (a per-country colour would read as a score)
    expect(new Set(radarProps.shading.map((s) => s.hue)).size).toBe(1);
    expect(radarProps.shading.every((s) => !('score' in s) && !('accuracy' in s))).toBe(true);
  });

  it('with no selection the panel says counts only, never an accuracy score', () => {
    mount();
    expect(screen.getByText(/Counts only/)).toHaveTextContent('Never an accuracy score for a country.');
  });

  it('selecting a place lists its questions with fired / not / open / void counts; selecting again clears', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Iran: 2' }));
    const panel = document.querySelector('.tr-fb-panel');
    expect(within(panel).getByRole('heading', { name: 'Iran' })).toBeInTheDocument();
    expect(panel.querySelector('.tr-fb-tag.fired')).toHaveTextContent('✓ 1');
    expect(panel.querySelector('.tr-fb-tag.notfired')).toHaveTextContent('✗ 1');
    expect(panel.querySelector('.tr-fb-tag.open')).toHaveTextContent('▢ 0');
    expect(panel.querySelector('.tr-fb-tag.void')).toHaveTextContent('◌ 0');
    expect(panel.querySelectorAll('.tr-fb-panel-item')).toHaveLength(2);
    expect(radarProps.storyFocusIso3).toBe('IRN');

    fireEvent.click(screen.getByRole('button', { name: 'Iran: 2' }));
    expect(document.querySelector('.tr-fb-panel-title')).toBeNull();
    expect(radarProps.storyFocusIso3).toBeNull();
  });

  it('open counts add awaiting and past-deadline questions together', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Oman: 2' }));
    // Oman is named by the fired corridor question and by the open "mediate again" one
    expect(document.querySelector('.tr-fb-tag.fired')).toHaveTextContent('✓ 1');
    expect(document.querySelector('.tr-fb-tag.open')).toHaveTextContent('▢ 1');
  });

  it('when no question names a country it says so instead of drawing pins', () => {
    mount({ items: [items[5]] });
    expect(radarProps.shading).toEqual([]);
    expect(screen.getByText('No question names a country we can plot.')).toBeInTheDocument();
  });
});
