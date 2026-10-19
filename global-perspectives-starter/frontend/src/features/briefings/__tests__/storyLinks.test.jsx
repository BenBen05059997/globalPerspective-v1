// Batch 3 / C: a daily top story links to its story page only when it carries a real threadId.
// Present mode: the rising thread on the country-to-watch slide is a story link only with a real id.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('@/shared/hooks/usePeek.js', () => ({ usePeek: () => ({ openId: null, bind: () => ({}), open: () => {}, close: () => {} }) }));

import { StorySlide, WatchSlide, SignalSlide } from '@/features/briefings/components/BriefingSlides.jsx';

const withId = { title: 'US Supreme Court Allows Third-Country Deportations', category: 'politics', regions: ['United States'], prediction: 'p', sourceCount: 3, threadId: 'thread-us-supreme-court-c1602d' };
const withoutId = { title: 'Some story with no confident match', category: 'politics', regions: ['France'], prediction: 'p', sourceCount: 2, threadId: null };

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('/briefings story slide links', () => {
  it('slide with a threadId shows "Read the full story" -> /weekly/thread/<id>', () => {
    wrap(<StorySlide story={withId} index={0} />);
    const a = screen.getByRole('link', { name: /read the full story/i });
    expect(a.getAttribute('href')).toBe('/weekly/thread/thread-us-supreme-court-c1602d');
  });
  it('slide without a threadId shows no story link (country links stay)', () => {
    wrap(<StorySlide story={withoutId} index={1} />);
    expect(screen.queryByRole('link', { name: /read the full story/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'France' })).toBeTruthy();
  });
  it('the rising thread on the watch slide links its story only when it has a thread id', () => {
    const country = { countryName: 'Sudan', riskLevel: 'high', trajectory: 'escalating' };
    const first = wrap(<WatchSlide countryToWatch={country} risingThread={{ title: 'Arc', threadId: 'thread-x' }} />);
    expect(screen.getByRole('link', { name: 'Arc' }).getAttribute('href')).toBe('/weekly/thread/thread-x');
    expect(screen.getByText('Escalating')).toBeInTheDocument();
    first.unmount();
    wrap(<WatchSlide countryToWatch={country} risingThread={{ title: 'Arc' }} />);
    expect(screen.queryByRole('link', { name: 'Arc' })).toBeNull();
  });
  it('a signal slide shows its as-of date', () => {
    wrap(<SignalSlide signal={{ lede: 'L', region: 'Sudan', asOf: '2026-10-10', riskLevel: 'high' }} index={0} />);
    expect(screen.getByText('as of 2026-10-10')).toBeInTheDocument();
  });
});
