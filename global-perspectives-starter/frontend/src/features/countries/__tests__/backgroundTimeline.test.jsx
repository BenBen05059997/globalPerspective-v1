// BackgroundTimeline: the country page's "Detailed background". Events group by day (oldest first), are
// numbered per category, link to the covering article only when the day has a real match, and the legend
// counts what is actually listed. No events -> nothing is drawn.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BackgroundTimeline from '@/features/countries/components/BackgroundTimeline.jsx';

const events = [
  { date: '2026-10-29', category: 'conflict', event: 'Rebels seize the northern border crossing near Kassala', topicId: 'topic-a' },
  { date: '2026-10-29', category: 'conflict', event: 'Army counterattack on the crossing', topicId: 'topic-b' },
  { date: '2026-10-27', category: 'economy', event: 'Central bank devalues the pound', topicId: null },
  { date: '2026-10-30', category: 'conflict', event: 'Ceasefire talks announced' },
];
const entries = [
  { date: '2026-10-29', topicId: 'topic-a', title: 'Rebels seize northern border crossing', sources: [{ source: 'reuters.com' }] },
  { date: '2026-10-29', topicId: 'topic-z', title: 'Border crossing near Kassala falls to rebels after counterattack', sources: [{ title: 'AP' }] },
  { date: '2026-10-29', topicId: 'topic-y', title: 'Unrelated sports result', sources: [] },
];

describe('BackgroundTimeline', () => {
  it('renders nothing without events', () => {
    expect(render(<BackgroundTimeline events={[]} entries={entries} />).container.firstChild).toBeNull();
    expect(render(<BackgroundTimeline />).container.firstChild).toBeNull();
  });

  it('groups by day oldest first, with an event count per day and the first event shown', () => {
    const { container } = render(<BackgroundTimeline events={events} entries={entries} />);
    const days = [...container.querySelectorAll('.bgt-day')];
    expect(days.map((d) => d.querySelector('.bgt-day-date').textContent)).toEqual(['Tue, Oct 27', 'Thu, Oct 29', 'Fri, Oct 30']);
    expect(days.map((d) => d.querySelector('.bgt-day-count').textContent)).toEqual(['1 event', '2 events', '1 event']);
    // only the day's primary event is visible until expanded
    expect(screen.queryByText('Army counterattack on the crossing')).toBeNull();
  });

  it('numbers events per category in input order', () => {
    const { container } = render(<BackgroundTimeline events={events} entries={entries} />);
    const cats = [...container.querySelectorAll('.bgt-event-cat')].map((c) => c.textContent);
    expect(cats).toEqual(['economy #1', 'conflict #1', 'conflict #3']);
  });

  it('the legend counts every listed event per category, biggest first', () => {
    const { container } = render(<BackgroundTimeline events={events} entries={entries} />);
    expect([...container.querySelectorAll('.bgt-legend-item')].map((l) => l.textContent)).toEqual(['conflict (3)', 'economy (1)']);
  });

  it('an event with a topicId is clickable and reports the topic and day; one without is not', () => {
    const onEventClick = vi.fn();
    const { container } = render(<BackgroundTimeline events={events} entries={entries} onEventClick={onEventClick} />);
    fireEvent.click(screen.getByText('Rebels seize the northern border crossing near Kassala'));
    expect(onEventClick).toHaveBeenCalledWith('topic-a', '2026-10-29');
    onEventClick.mockClear();
    fireEvent.click(screen.getByText('Central bank devalues the pound'));
    expect(onEventClick).not.toHaveBeenCalled();
    const viewLinks = container.querySelectorAll('.bgt-event-link');
    expect(viewLinks).toHaveLength(1);
  });

  it('expanding a day reveals its other events and the articles that match, exact topic first, then keyword matches', () => {
    const onEventClick = vi.fn();
    render(<BackgroundTimeline events={events} entries={entries} onEventClick={onEventClick} />);
    fireEvent.click(screen.getByRole('button', { name: '+1 more event' }));
    expect(screen.getByText('Army counterattack on the crossing')).toBeInTheDocument();

    const linked = document.querySelectorAll('.bgt-linked-item');
    expect([...linked].map((l) => l.querySelector('.bgt-linked-title').textContent)).toEqual([
      'Rebels seize northern border crossing',
      'Border crossing near Kassala falls to rebels after counterattack',
    ]);
    expect(linked[0]).toHaveTextContent('reuters.com');
    expect(linked[1]).toHaveTextContent('AP');
    expect(screen.queryByText('Unrelated sports result')).toBeNull();

    fireEvent.click(linked[1]);
    expect(onEventClick).toHaveBeenCalledWith('topic-z', '2026-10-29');

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('Army counterattack on the crossing')).toBeNull();
  });

  it('a single-event day with same-day coverage offers related articles; one with none offers nothing', () => {
    render(<BackgroundTimeline events={[{ date: '2026-10-29', category: 'conflict', event: 'Rebels seize the border crossing near Kassala' }]} entries={entries} />);
    expect(screen.getByRole('button', { name: 'Show related articles' })).toBeInTheDocument();
    render(<BackgroundTimeline events={[{ date: '2026-10-27', category: 'economy', event: 'Pound devalued' }]} entries={entries} />);
    expect(within(document.body).getAllByRole('button')).toHaveLength(1);
  });
});
