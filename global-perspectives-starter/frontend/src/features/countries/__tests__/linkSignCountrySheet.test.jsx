// The link sign on the country sheet's "How it connects" rows: medium or strong rows only.
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

import { HowItConnects } from '@/features/countries/components/CountrySheet.jsx';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('country sheet "How it connects"', () => {
  it('a sign above each medium or strong row, none above a weak or unrated row', () => {
    const row = (o) => ({ fromId: 'thread-a', fromTitle: 'A', toId: 'thread-b', toTitle: 'B', fromCategory: 'conflict', toCategory: 'politics', confidence: 'strong', lag: 'lag 2d', cited: [], ...o });
    wrap(<HowItConnects country="Yemen" rows={[row({}), row({ toId: 'thread-c', toTitle: 'C', confidence: 'weak' }), row({ toId: 'thread-d', toTitle: 'D', confidence: null })]} />);
    expect(screen.getAllByTestId('cs-sign')).toHaveLength(1);
    expect(screen.getByTestId('cs-sign').textContent).toBe('This story: Yemen→The other story: Egypt');
    expect(screen.getAllByText('feeds into')).toHaveLength(3); // the words stay on every row
  });
});
