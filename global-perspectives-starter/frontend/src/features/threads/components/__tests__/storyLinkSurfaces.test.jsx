// FED INTO slide + BRIEF empty state + long-page rows: dated cited headlines, one story counted once, honest reasons.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/shared/hooks/usePeek', () => ({ usePeek: () => ({ openId: null, openOnHover: () => {}, openOnFocus: () => {}, close: () => {}, style: {} }) }));

import { FedIntoSlide } from '@/features/threads/components/StoryMode.jsx';
import StoryLinkNote from '@/features/threads/components/StoryLinkNote.jsx';
import FedIntoList from '@/features/threads/components/FedIntoList.jsx';
import { linkNote } from '@/features/threads/lib/linkStates.js';

const row = (o = {}) => ({
  targetThreadId: 'thread-b', targetTitle: 'Story B', confidence: 'strong', lagDays: 3, mechanism: 'Oil prices fed protests',
  citedEntries: ['t1'], cited: [{ topicId: 't1', date: '2026-09-04', title: 'US diesel prices hit all-time high' }, { topicId: 't2', date: '2026-09-11', title: 'Second headline' }, { topicId: 't3', date: '2026-09-12', title: 'Third' }, { topicId: 't4', date: '2026-09-13', title: 'Fourth' }],
  country: 'Iran', generatedAt: '2026-09-30T05:00:00Z', freshness: 'fresh', ...o,
});
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('FED INTO slide', () => {
  it('shows the cited dated headlines (3 + "more"), the confidence as words and the web it came from', () => {
    wrap(<FedIntoSlide fedInto={[row()]} />);
    expect(screen.getByText(/US diesel prices hit all-time high/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 more cited headline/)).toBeInTheDocument();
    expect(screen.getByText(/● ● ● strong|●●● strong/)).toBeInTheDocument();
    expect(screen.getByText(/from Iran's analysis, as of/)).toBeInTheDocument();
  });
  it('two webs linking the same story: two rows (own confidence each) but ONE linked story in the kicker', () => {
    wrap(<FedIntoSlide fedInto={[row(), row({ confidence: 'weak', country: 'Israel' })]} />);
    expect(screen.getByText(/FED INTO · 1 linked story/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Story B' })).toHaveLength(2);
  });
});

describe('FedIntoList without dated cites (an older web)', () => {
  it('falls back to the count line', () => {
    wrap(<FedIntoList links={[row({ cited: [], citedEntries: ['a', 'b'] })]} direction="into" />);
    expect(screen.getByText(/2 cited headlines in this story's own analysis/)).toBeInTheDocument();
  });
});

describe('StoryLinkNote', () => {
  const index = { generatedAt: '2026-09-30T05:00:00Z', targets: { count: 10 }, websUsed: [] };
  it('renders the reason and the refresh line for a single-update story', () => {
    render(<StoryLinkNote note={linkNote({ index, state: 'single_update', meta: {}, now: Date.parse('2026-10-01T00:00:00Z') })} />);
    expect(screen.getByTestId('story-link-note').getAttribute('data-state')).toBe('single_update');
    expect(screen.getByText(/It has one update so far/)).toBeInTheDocument();
    expect(screen.getByText(/Last refresh: Sep 30 2026/)).toBeInTheDocument();
  });
  it('renders nothing for a linked story or while unknown', () => {
    const { container } = render(<StoryLinkNote note={null} />);
    expect(container.firstChild).toBeNull();
  });
});
