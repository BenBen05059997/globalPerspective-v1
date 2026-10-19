// /today links through shared/lib/links.js: "Story arc" opens the story itself (only with a real
// threadId), a topic's country goes to its country page, a region is plain text.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

let topicsState;
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/data/useGeminiTopics', () => ({ useGeminiTopics: () => topicsState }));
vi.mock('@/features/home/hooks/useTodayArchive', () => ({ useTodayArchive: () => ({ entries: [] }) }));
vi.mock('@/shared/hooks/useDisruptionsList', () => ({ useDisruptionsList: () => ({ data: [] }) }));
vi.mock('@/features/track-record/hooks/useTrackRecord', () => ({ useTrackRecord: () => ({ data: null }) }));
vi.mock('@/features/track-record/hooks/useCorrectionsFeed', () => ({ useCorrectionsFeed: () => ({ notes: [], total: 0 }) }));
vi.mock('@/shared/ui/SubscribeCard', () => ({ default: () => null }));
vi.mock('@/features/breaking/components/BreakingStrip', () => ({ default: () => null }));

import Home from '@/features/home/Home';

describe('/today links', () => {
  it('Story arc goes to the thread; countries link, regions do not; no arc link without a thread', () => {
    topicsState = {
      topics: [
        { topicId: 't1', threadId: 'thread-france-strike-abc123', title: 'French strike', category: 'politics', primaryCountry: 'France', sources: [] },
        { topicId: 't2', title: 'Gulf shipping', category: 'economy', regions: ['Strait of Hormuz'], sources: [] },
      ],
      loading: false, error: null, refetch: vi.fn(), isStale: false, updatedAt: null, hasNewData: false,
    };
    render(<MemoryRouter><Home /></MemoryRouter>);

    const first = document.getElementById('topic-t1');
    expect(within(first).getByRole('link', { name: /Story arc/ })).toHaveAttribute('href', '/weekly/thread/thread-france-strike-abc123');
    expect(within(first).getByRole('link', { name: 'France' })).toHaveAttribute('href', '/weekly/country/France');

    const second = document.getElementById('topic-t2');
    expect(within(second).queryByRole('link', { name: /Story arc/ })).toBeNull();
    expect(within(second).getByText('Strait of Hormuz').closest('a')).toBeNull();
  });
});
