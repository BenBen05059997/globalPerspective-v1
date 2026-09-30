// Batch 3 / C: a daily top story links to its story page only when it carries a real threadId.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/shared/hooks/usePeek.js', () => ({ usePeek: () => ({ openId: null, bind: () => ({}), open: () => {}, close: () => {} }) }));

import { StorySlide } from '@/features/briefings/components/BriefingSlides.jsx';
import ReadAsText from '@/features/briefings/components/ReadAsText.jsx';

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
  it('ReadAsText links the title only when a threadId exists', () => {
    const brief = { headline: 'h', summary: 's', topStories: [withId, withoutId] };
    wrap(<ReadAsText brief={brief} mode="daily" />);
    expect(screen.getByRole('link', { name: withId.title }).getAttribute('href')).toBe('/weekly/thread/thread-us-supreme-court-c1602d');
    expect(screen.queryByRole('link', { name: withoutId.title })).toBeNull();
  });
});
