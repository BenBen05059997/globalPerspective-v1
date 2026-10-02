// StoryCard (M5b): each section renders only when its data exists (CLAUDE.md — no placeholder
// UI). Covers the four data shapes named in the task: full data, summary missing, analysis
// missing, and a genuine fetch error (header + "Open full story" only, reported to the sink).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const TOPIC = {
  topicId: 'topic-saudi-pipeline', threadId: 'thread-saudi-pipeline',
  title: 'Saudi Arabia pipeline attack', category: 'conflict', primaryCountry: 'Saudi Arabia',
};

let summaryImpl;
let analysisImpl;

vi.mock('@/shared/data/contentService.js', () => ({
  contentService: { getTopicSummary: (...args) => summaryImpl(...args) },
}));
vi.mock('@/shared/api/restProxy.js', () => ({
  fetchThreadAnalyses: (...args) => analysisImpl(...args),
}));
const reportFetchError = vi.fn();
vi.mock('@/shared/api/errorSink.js', () => ({
  reportFetchError: (...args) => reportFetchError(...args),
}));

async function renderCard(topic = TOPIC, asOf = '2026-09-20T00:00:00.000Z', extra = {}) {
  const StoryCard = (await import('@/features/map/components/StoryCard.jsx')).default;
  render(
    <MemoryRouter>
      <StoryCard topic={topic} asOf={asOf} onBack={() => {}} activeCount={13} {...extra} />
    </MemoryRouter>
  );
}

describe('StoryCard', () => {
  beforeEach(() => {
    reportFetchError.mockClear();
  });

  it('renders every section when summary + analysis are both present', async () => {
    summaryImpl = async () => ({ content: 'Attackers struck the pipeline. Output fell sharply. Markets reacted within hours.', generatedAt: '2026-09-19T00:00:00.000Z' });
    analysisImpl = async () => ({
      data: {
        [TOPIC.threadId]: {
          trajectory: 'Repairs are likely within weeks. A wider escalation is possible if strikes continue.',
          rootCauseChain: { proximate: 'A drone strike hit the export line.', medium_term: 'Ongoing regional conflict.', deeper_structural: 'Decades of contested oil infrastructure.' },
          generatedAt: '2026-09-12T00:00:00.000Z',
        },
      },
    });
    await renderCard();

    await waitFor(() => expect(screen.getByText('What is happening')).toBeInTheDocument());
    expect(screen.getByText(/Attackers struck the pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/AI SUMMARY OF THE SOURCES · Sep 19/)).toBeInTheDocument();
    expect(screen.getByText('What it means')).toBeInTheDocument();
    expect(screen.getByText(/Repairs are likely within weeks/)).toBeInTheDocument();
    expect(screen.getByText('Why')).toBeInTheDocument();
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText(/Open full story/)).toBeInTheDocument();
    expect(screen.getByText(/Analyze in Studio/)).toBeInTheDocument();
    expect(reportFetchError).not.toHaveBeenCalled();
    // F1.7: the header shows the topic's real category word, not a crisis-type relabel
    // ("conflict", not "Conflict"/"HUMANITARIAN") — consistent with StoryPeek.
    expect(screen.getByText('conflict')).toBeInTheDocument();
  });

  it('omits WHAT IS HAPPENING when the summary is a normal cache-miss', async () => {
    summaryImpl = async () => { throw new Error('Summary cache unavailable'); };
    analysisImpl = async () => ({ data: { [TOPIC.threadId]: { trajectory: 'It will likely continue.' } } });
    await renderCard();

    await waitFor(() => expect(screen.getByText('What it means')).toBeInTheDocument());
    expect(screen.queryByText('What is happening')).not.toBeInTheDocument();
    expect(reportFetchError).not.toHaveBeenCalled();
  });

  it('omits WHAT IT MEANS / WHY when there is no thread analysis yet', async () => {
    summaryImpl = async () => ({ content: 'This just started developing today.' });
    analysisImpl = async () => ({ data: {} });
    await renderCard();

    await waitFor(() => expect(screen.getByText('What is happening')).toBeInTheDocument());
    expect(screen.queryByText('What it means')).not.toBeInTheDocument();
    expect(screen.queryByText('Why')).not.toBeInTheDocument();
    expect(reportFetchError).not.toHaveBeenCalled();
  });

  it('on a genuine fetch error in one source, keeps the section that loaded and omits the failed one', async () => {
    // F2.18 (review R2): the two fetches are independent — a real failure on the summary no
    // longer blanks the analysis section that loaded fine.
    summaryImpl = async () => { throw new Error('Proxy HTTP 503: upstream unavailable'); };
    analysisImpl = async () => ({ data: { [TOPIC.threadId]: { trajectory: 'It will likely continue.' } } });
    await renderCard();

    await waitFor(() => expect(reportFetchError).toHaveBeenCalledWith('story-card-summary', expect.anything()));
    expect(screen.getByText('Saudi Arabia pipeline attack')).toBeInTheDocument();
    expect(screen.getByText(/Open full story/)).toBeInTheDocument();
    expect(screen.queryByText('What is happening')).not.toBeInTheDocument();
    expect(screen.getByText('What it means')).toBeInTheDocument();
    expect(screen.getByText(/It will likely continue/)).toBeInTheDocument();
    // Studio still isn't offered when any fetch genuinely failed.
    expect(screen.queryByText(/Analyze in Studio/)).not.toBeInTheDocument();
  });

  it('shows "stories from <feed date>" when the topic carries no date of its own, and "updated <date>" when it does (F2.18)', async () => {
    summaryImpl = async () => { throw new Error('Summary cache unavailable'); };
    analysisImpl = async () => ({ data: {} });

    await renderCard(TOPIC, '2026-09-20T00:00:00.000Z');
    expect(await screen.findByText('stories from Sep 20')).toBeInTheDocument();

    await renderCard({ ...TOPIC, publishedAt: '2026-09-18T00:00:00.000Z' }, '2026-09-20T00:00:00.000Z');
    expect(await screen.findByText('updated Sep 18')).toBeInTheDocument();
  });

  it('on a genuine fetch error in BOTH sources, renders only the header and Open full story', async () => {
    summaryImpl = async () => { throw new Error('Proxy HTTP 503: upstream unavailable'); };
    analysisImpl = async () => { throw new Error('failed to fetch'); };
    await renderCard();

    await waitFor(() => expect(reportFetchError).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Saudi Arabia pipeline attack')).toBeInTheDocument();
    expect(screen.getByText(/Open full story/)).toBeInTheDocument();
    expect(screen.queryByText('What is happening')).not.toBeInTheDocument();
    expect(screen.queryByText('What it means')).not.toBeInTheDocument();
    expect(screen.queryByText(/Analyze in Studio/)).not.toBeInTheDocument();
  });

  // P8: WHY steps carry the story page's basis tag; in-text links only for exact real story titles.
  it('tags every WHY step INFERENCE (a stored cause step has no citation, so never FACT) and links an exact story title', async () => {
    summaryImpl = async () => ({ content: '- Talks resumed after Brent Crude Slumps To Five Month Low In Asia, per example.org.\n- Nothing else happened, per example.org.', generatedAt: '2026-09-19T00:00:00.000Z' });
    analysisImpl = async () => ({
      data: { [TOPIC.threadId]: { rootCauseChain: { proximate: 'A drone strike hit the export line.', medium_term: 'Ongoing regional conflict.' }, generatedAt: '2026-09-12T00:00:00.000Z' } },
    });
    await renderCard(TOPIC, '2026-09-20T00:00:00.000Z', {
      webThreads: {
        'thread-oil': { title: 'Brent Crude Slumps To Five Month Low In Asia' },
        'thread-saudi-pipeline': { title: 'Saudi Arabia pipeline attack headline here' },
        'thread-short': { title: 'Iran talks' },
      },
    });
    await waitFor(() => expect(screen.getByText('Why')).toBeInTheDocument());
    const tags = screen.getAllByText('INFERENCE');
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('FACT')).toBeNull();
    const mention = screen.getByRole('link', { name: 'Brent Crude Slumps To Five Month Low In Asia' });
    expect(mention).toHaveAttribute('href', '/weekly/thread/thread-oil');
    // the open story's own title is never linked to itself, and a short title is never matched
    expect(document.querySelectorAll('a[data-mention]')).toHaveLength(1);
  });

  it('shows "Linked stories" from the index rows, tagged model judgment, only when there are links', async () => {
    summaryImpl = async () => ({ content: '- A fact, per example.org.', generatedAt: '2026-09-19T00:00:00.000Z' });
    analysisImpl = async () => ({ data: {} });
    await renderCard(TOPIC, '2026-09-20T00:00:00.000Z', {
      linked: { into: [{ id: 'thread-b', title: 'Story B', confidence: 'strong' }], from: [{ id: 'thread-c', title: 'Story C', confidence: 'weak' }] },
    });
    await waitFor(() => expect(screen.getByTestId('card-linked')).toBeInTheDocument());
    expect(screen.getByText(/Judged to feed into:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Story B' })).toHaveAttribute('href', '/weekly/thread/thread-b');
    expect(screen.getByText(/Earlier news judged to feed in:/)).toBeInTheDocument();
    expect(screen.getByTestId('card-linked')).toHaveTextContent(/model judgment/i);
  });

  it('has no Linked stories block without links', async () => {
    summaryImpl = async () => ({ content: '- A fact, per example.org.', generatedAt: '2026-09-19T00:00:00.000Z' });
    analysisImpl = async () => ({ data: {} });
    await renderCard();
    await waitFor(() => expect(screen.getByText('What is happening')).toBeInTheDocument());
    expect(screen.queryByTestId('card-linked')).toBeNull();
  });
});
