// Story mode's FED INTO slide shows both directions with the Read-in-full wording: the news this story feeds into, then the
// earlier news judged to feed in. The slide is there when either list has a row.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('@/shared/hooks/usePeek', () => ({ usePeek: () => ({ openId: null, openOnHover: () => {}, openOnFocus: () => {}, close: () => {}, style: {} }) }));

import { FedIntoSlide } from '@/features/threads/components/StoryMode.jsx';
import { buildSlides } from '@/features/threads/lib/storyMode.js';

const link = (o) => ({ confidence: 'strong', lagDays: 2, mechanism: 'A mechanism', cited: [], country: 'Iran', generatedAt: '2026-11-17T05:00:00Z', freshness: 'fresh', ...o });
const into = link({ targetThreadId: 'thread-down', targetTitle: 'Downstream story' });
const from = link({ sourceThreadId: 'thread-up', sourceTitle: 'Upstream story', confidence: 'medium' });
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const headings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

describe('FED INTO slide, both directions', () => {
  it('lists the stories this one feeds into, then the earlier news judged to feed in, each linked', () => {
    wrap(<FedIntoSlide fedInto={[into]} fedFrom={[from]} />);
    expect(headings()).toEqual(['News this story is judged to feed into', 'Earlier news judged to feed in']);
    expect(screen.getByText('JUDGED TO FEED INTO · 2 linked stories')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Downstream story' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upstream story' })).toBeInTheDocument();
    expect(screen.getAllByText(/Links are between stories/)).toHaveLength(1);
  });

  it('a story only fed by others shows just the earlier news, with the caption', () => {
    wrap(<FedIntoSlide fedInto={[]} fedFrom={[from]} />);
    expect(headings()).toEqual(['Earlier news judged to feed in']);
    expect(screen.getByText('JUDGED TO FEED INTO · 1 linked story')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByRole('link', { name: 'Upstream story' })).toBeInTheDocument();
    expect(screen.getByText(/Links are between stories/)).toBeInTheDocument();
  });

  it('a story linked both ways to the same story counts it once', () => {
    wrap(<FedIntoSlide fedInto={[into]} fedFrom={[{ ...from, sourceThreadId: 'thread-down' }]} />);
    expect(screen.getByText('JUDGED TO FEED INTO · 1 linked story')).toBeInTheDocument();
  });

  it('buildSlides adds the slide for fed-by rows alone, and not with neither', () => {
    expect(buildSlides({ fedFrom: [from] }).map((s) => s.key)).toEqual(['brief', 'fedinto']);
    expect(buildSlides({ fedInto: [], fedFrom: [] }).map((s) => s.key)).toEqual(['brief']);
  });
});
