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

async function renderCard(topic = TOPIC, asOf = '2026-09-20T00:00:00.000Z') {
  const StoryCard = (await import('@/features/map/components/StoryCard.jsx')).default;
  render(
    <MemoryRouter>
      <StoryCard topic={topic} asOf={asOf} onBack={() => {}} activeCount={13} />
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
    expect(screen.getByText('What it means')).toBeInTheDocument();
    expect(screen.getByText(/Repairs are likely within weeks/)).toBeInTheDocument();
    expect(screen.getByText('Why')).toBeInTheDocument();
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText(/Open full story/)).toBeInTheDocument();
    expect(screen.getByText(/Analyze in Studio/)).toBeInTheDocument();
    expect(reportFetchError).not.toHaveBeenCalled();
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

  it('on a genuine fetch error, renders only the header and Open full story, and reports it', async () => {
    summaryImpl = async () => { throw new Error('Proxy HTTP 503: upstream unavailable'); };
    analysisImpl = async () => ({ data: { [TOPIC.threadId]: { trajectory: 'x' } } });
    await renderCard();

    await waitFor(() => expect(reportFetchError).toHaveBeenCalled());
    expect(screen.getByText('Saudi Arabia pipeline attack')).toBeInTheDocument();
    expect(screen.getByText(/Open full story/)).toBeInTheDocument();
    expect(screen.queryByText('What is happening')).not.toBeInTheDocument();
    expect(screen.queryByText('What it means')).not.toBeInTheDocument();
    expect(screen.queryByText(/Analyze in Studio/)).not.toBeInTheDocument();
  });
});
