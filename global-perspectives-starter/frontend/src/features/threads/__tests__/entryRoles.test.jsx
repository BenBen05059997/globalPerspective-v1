// The entry label (role, stamped by newsStoryRecord) wherever an entry renders on the story page: chapter slides (desktop and
// phone share ChapterSlide), the phone deck, CompactTimeline rows, the opened StoryEntryCard and Read in full's plain list.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { viewEntriesToThread } from '@/features/threads/lib/viewEntries.js';

const H = vi.hoisted(() => ({ thread: null, analysis: null }));
vi.mock('@/shared/map/StoryMap.jsx', () => ({ default: () => null, STORY_MAP_FALLBACK_HEIGHT: 300 }));
vi.mock('@/features/threads/hooks/useNarrativeThread', () => ({ useNarrativeThread: () => H.thread }));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({ useWeeklyArchive: () => ({ dayMap: {}, sortedDates: [] }) }));
vi.mock('@/features/threads/hooks/useStoryAnalysis', () => ({ useStoryAnalysis: () => H.analysis }));
vi.mock('@/features/threads/hooks/useThreadForecast', () => ({ useThreadForecast: () => ({ snapshot: null, loading: false }) }));
vi.mock('@/features/threads/hooks/useStoryLinks', () => ({ useStoryLinks: () => ({ fedInto: [], fedFrom: [], loading: false, note: null, shared: [], hiddenOlder: 0, provenance: null }) }));
vi.mock('@/shared/ui/SaveButton', () => ({ SaveButton: () => null }));

import { ChapterSlide } from '@/features/threads/components/StoryMode.jsx';
import PhoneStoryMode from '@/features/threads/components/PhoneStoryMode.jsx';
import CompactTimeline from '@/features/threads/components/CompactTimeline.jsx';
import ThreadPage from '@/features/threads/ThreadPage.jsx';

const row = (eventId, date, title, role, o = {}) => ({ eventId, date, at: `${date}T04:00:00.000Z`, title, category: 'politics', eventType: role === 'measure' ? 'measure' : 'policy', sources: [], topicId: `${eventId}-t`, iso3: [], ...(role !== undefined ? { role } : {}), ...o });
const view = {
  threadId: 'thread-x',
  entries: [
    row('e1', '2026-11-06', 'Opening headline', 'start'),
    { eventId: 'a1', kind: 'article', date: '2026-11-07', at: '2026-11-07T04:00:00.000Z', title: 'Placed article', summary: null, sources: [], recovered: true, recoveredFrom: 'x' },
    row('e2', '2026-11-08', 'Later headline', 'move'),
    row('e3', '2026-11-10', 'Figure headline', 'measure'),
    row('e4', '2026-11-12', 'Unlabelled headline', null),
  ],
};
const entries = viewEntriesToThread(view); // oldest first, as the view keeps them; articles dropped
const newestFirst = [...entries].reverse();
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const labelOf = (title) => within(screen.getByText(title).closest('li, .tp-tl-row, .compact-timeline-content, .story-entry-card'));

describe('viewEntriesToThread maps role', () => {
  it('passes the builder\'s role through; a row without one maps to null; article rows are not entries', () => {
    expect(entries.map((e) => [e.title, e.role])).toEqual([['Opening headline', 'start'], ['Later headline', 'move'], ['Figure headline', 'measure'], ['Unlabelled headline', null]]);
    expect(viewEntriesToThread({ threadId: 't', entries: [{ eventId: 'x', date: '2026-11-01', at: '2026-11-01T00:00:00Z', title: 'Old view row', sources: [] }] })[0].role).toBeNull();
  });
});

describe('chapter slide (desktop and phone)', () => {
  it('labels each entry with its word, MEASURED CHANGE with the model judgment tag, and a null role with nothing', () => {
    wrap(<ChapterSlide chapter={{ key: 'ch1', label: 'Chapter', from: '2026-11-06', to: '2026-11-12', country: null, entries, isInflection: false }} index={0} />);
    expect(labelOf('Opening headline').getByText('START')).toBeInTheDocument();
    expect(labelOf('Later headline').getByText('MOVE')).toBeInTheDocument();
    expect(labelOf('Figure headline').getByText('MEASURED CHANGE')).toBeInTheDocument();
    expect(labelOf('Figure headline').getByText('MODEL JUDGMENT')).toBeInTheDocument();
    expect(labelOf('Unlabelled headline').queryByText(/^(START|MOVE|MEASURED CHANGE)$/)).toBeNull();
    expect(screen.getAllByText('MODEL JUDGMENT')).toHaveLength(1);
    expect(screen.queryByText('Placed article')).toBeNull();
  });

  it('the phone deck shows the labels on its chapter slides', () => {
    const thread = { threadId: 'thread-x', entries: newestFirst, allSources: [], dateRange: { from: '2026-11-06', to: '2026-11-12' }, dayCount: 4 };
    wrap(<PhoneStoryMode thread={thread} analysis={null} forecast={null} displayTitle="X" category="politics" links={{ fedInto: [], fedFrom: [], loading: false, note: null, index: null }} onReadFull={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByText('START')).toBeInTheDocument();
  });
});

describe('Read in full', () => {
  it('CompactTimeline rows carry the label, and the opened entry card shows it again', () => {
    wrap(<CompactTimeline entries={newestFirst} entryShortTitles={[]} />);
    expect(labelOf('Opening headline').getByText('START')).toBeInTheDocument();
    expect(labelOf('Figure headline').getByText('MEASURED CHANGE')).toBeInTheDocument();
    expect(labelOf('Unlabelled headline').queryByText(/^(START|MOVE|MEASURED CHANGE)$/)).toBeNull();
    fireEvent.click(screen.getByText('Later headline').closest('button'));
    const card = within(document.querySelector('.story-entry-card'));
    expect(card.getByText('MOVE')).toBeInTheDocument();
    expect(card.getByText('Later headline')).toBeInTheDocument();
  });

  it('the plain list (no analysis) labels each row', () => {
    H.thread = { entries, title: 'X', loading: false, error: null, refetch: vi.fn() };
    H.analysis = { analysis: null, loading: false, error: null, refetch: vi.fn() };
    render(<MemoryRouter initialEntries={['/weekly/thread/thread-x?tab=timeline']}><Routes><Route path="/weekly/thread/:threadId" element={<ThreadPage />} /></Routes></MemoryRouter>);
    expect(labelOf('Opening headline').getByText('START')).toBeInTheDocument();
    expect(labelOf('Later headline').getByText('MOVE')).toBeInTheDocument();
    expect(labelOf('Figure headline').getByText('MODEL JUDGMENT')).toBeInTheDocument();
    expect(labelOf('Unlabelled headline').queryByText(/^(START|MOVE|MEASURED CHANGE)$/)).toBeNull();
  });
});
