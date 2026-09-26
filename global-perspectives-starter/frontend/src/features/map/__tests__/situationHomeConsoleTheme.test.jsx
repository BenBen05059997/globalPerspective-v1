// M1 (console tokens): asserts the /map page root carries the `gp-console` scoped-theme
// class, so it renders under the new DS1 tokens (tokens.css `.gp-console`) rather than the
// site-wide light tokens. Data hook is mocked — this is a theming test, not a data test.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({ world: null, situations: [], loading: false, error: null, asOf: null, stale: false }),
  useSituationDetail: () => ({ detail: null }),
}));

let SituationHome;

describe('SituationHome — console theme class', () => {
  it('renders the page root with sh-root and gp-console together', async () => {
    SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
    const { container } = render(<MemoryRouter><SituationHome /></MemoryRouter>);
    const root = container.querySelector('.sh-root');
    expect(root).toBeInTheDocument();
    expect(root.classList.contains('gp-console')).toBe(true);
  });
});
