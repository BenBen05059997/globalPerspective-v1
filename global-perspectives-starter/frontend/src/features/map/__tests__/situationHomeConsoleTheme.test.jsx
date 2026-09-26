// M1 (console tokens): asserts the /map page root carries the `gp-console` scoped-theme
// class, so it renders under the new DS1 tokens (tokens.css `.gp-console`) rather than the
// site-wide light tokens. Data hooks are mocked — this is a theming test, not a data test.
//
// F2.20 (map-console review R1): this test used to (a) dynamic-`import()` SituationHome inside
// the `it()` body instead of a static top-level import, and (b) not mock useDailyBrief /
// useGeminiTopics — both of which real-network-fetch from inside the component under test, making
// the test flaky (slow/failing under the default 5s timeout depending on network conditions).
// Every other SituationHome test in this folder already mocks both; this one now matches them.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SituationHome from '@/features/map/SituationHome.jsx';

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({ world: null, situations: [], loading: false, error: null, asOf: null, stale: false }),
  useSituationDetail: () => ({ detail: null }),
}));

vi.mock('@/features/daily/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: null, servedDateKey: null, loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));

vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({ topics: [], loading: false, error: null, isStale: false, updatedAt: null, generatedDate: null }),
}));

describe('SituationHome — console theme class', () => {
  it('renders the page root with sh-root and gp-console together', () => {
    const { container } = render(<MemoryRouter><SituationHome /></MemoryRouter>);
    const root = container.querySelector('.sh-root');
    expect(root).toBeInTheDocument();
    expect(root.classList.contains('gp-console')).toBe(true);
  });
});
