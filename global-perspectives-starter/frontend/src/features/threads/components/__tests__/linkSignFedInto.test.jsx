// The link sign on the story page's feeds-into / fed-by list: on a medium or strong link only; a weak link keeps its words and no sign.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const H = vi.hoisted(() => ({
  view: {
    threadId: 'thread-a',
    judgedLinks: [{ from: 'thread-a', to: 'thread-b', confidence: 'strong' }, { from: 'thread-a', to: 'thread-c', confidence: 'weak' }],
    web: { places: [{ iso3: 'YEM', name: 'Yemen' }], otherPlaces: { 'thread-b': [{ iso3: 'EGY', name: 'Egypt' }] } },
  },
  index: { threads: { 'thread-b': { category: 'politics' }, 'thread-c': { category: 'energy' } } },
}));
vi.mock('@/shared/api/linksView.js', () => ({ useLinksView: (id) => ({ data: id ? H.view : null }), useLinksViews: (ids) => ({ data: (ids || []).map(() => H.view) }) }));
vi.mock('@/features/threads/hooks/useWebIndex.js', () => ({ useWebIndex: () => ({ index: H.index, loading: false, failed: false }) }));
vi.mock('@/shared/hooks/usePeek', () => ({ usePeek: () => ({ openId: null, openOnHover: () => {}, openOnFocus: () => {}, close: () => {}, style: {} }) }));

import FedIntoList from '@/features/threads/components/FedIntoList.jsx';
import { signEligible } from '@/shared/lib/linkLine.js';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('signEligible', () => {
  it('medium and strong only', () => {
    expect(['strong', 'medium', 'weak', null, undefined].map(signEligible)).toEqual([true, true, false, false, false]);
  });
});

describe('story page feeds-into list', () => {
  const links = [
    { targetThreadId: 'thread-b', targetTitle: 'Story B', confidence: 'strong', cited: [] },
    { targetThreadId: 'thread-c', targetTitle: 'Story C', confidence: 'weak', cited: [] },
  ];
  it('signs the strong row with the places of the links view, leaves the weak row with its words only', () => {
    wrap(<FedIntoList links={links} direction="into" story={{ id: 'thread-a', category: 'conflict' }} />);
    const signs = screen.getAllByTestId('link-sign');
    expect(signs).toHaveLength(1);
    expect(signs[0].textContent).toBe('This story: Yemen→The other story: Egypt');
    expect(screen.getByRole('link', { name: 'Story C' })).toBeInTheDocument();
  });
  it('fed by: the arrow turns; no story given: no sign', () => {
    wrap(<FedIntoList links={[{ sourceThreadId: 'thread-b', sourceTitle: 'Story B', confidence: 'medium', cited: [] }]} direction="from" story={{ id: 'thread-a', category: 'conflict' }} />);
    expect(screen.getByTestId('link-sign').textContent).toContain('←');
    wrap(<FedIntoList links={links} direction="into" />);
    expect(screen.getAllByTestId('link-sign')).toHaveLength(1);
  });
});
