// CountryPage resolves the URL name through the one country table: an alias, an ISO3 code or a place inside
// one country redirects (replace) to the canonical display-name URL, and the coverage of every alias is read
// under that one name (the alias COUNTRY# records are being merged away, so nothing may depend on them).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';

const intelNames = vi.hoisted(() => ({ list: [] }));
const e = (regions, i) => ({ topicId: `t${i}`, threadId: null, title: `Story ${i}`, category: 'politics', regions });
const entries = [e(['USA'], 1), e(['United States'], 2), e(['US', 'Iran'], 3), e(['Strait of Hormuz'], 4), e(['Strait of Hormuz'], 5)];
vi.mock('@/features/threads', () => ({
  useWeeklyArchive: () => ({ dayMap: { '2026-10-18': { entries } }, sortedDates: ['2026-10-18'], loading: false }),
  useThreadAnalyses: () => ({ analyses: {} }),
  useWebIndex: () => ({ index: null }),
  deriveFromIndex: () => ({ fedInto: [] }),
}));
vi.mock('@/features/countries/hooks/useCountryStories', () => ({ useCountryStories: () => ({ deadlines: [], topicIdToThreadId: new Map() }) }));
vi.mock('@/features/countries/hooks/useCountryFacts', () => ({ useCountryFacts: () => ({ facts: null }) }));
vi.mock('@/features/threads/components/WeeklyMap', () => ({ default: () => null }));
vi.mock('@/features/countries/hooks/useCountryIntelligence', () => ({
  useCountryIntelligence: (names) => { intelNames.list.push(...names); return { intelligence: {} }; },
}));
vi.mock('@/features/countries/hooks/useCountryHistory', () => ({ useCountryHistory: () => ({ snapshots: [], driftNotes: [] }) }));
vi.mock('@/features/countries/components/CountryCardV2', () => ({ default: () => null }));
vi.mock('@/shared/ui/SaveButton', () => ({ SaveButton: () => <span>save</span> }));
vi.mock('@/shared/ui/FollowButton', () => ({ FollowButton: () => <span>follow</span> }));
vi.mock('@/shared/ui/ShareButtons', () => ({ default: () => null }));

import CountryPage from '@/features/countries/CountryPage';

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}
const at = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/weekly/country/:countryName" element={<><CountryPage /><Where /></>} /></Routes>
  </MemoryRouter>,
);

describe('country page: one name per country', () => {
  it.each([
    ['/weekly/country/USA', '/weekly/country/United%20States'],
    ['/weekly/country/Democratic%20Republic%20of%20the%20Congo', '/weekly/country/DR%20Congo'],
    ['/weekly/country/United%20Arab%20Emirates', '/weekly/country/UAE'],
    ['/weekly/country/ARE', '/weekly/country/UAE'],
  ])('%s redirects to %s', (from, to) => {
    at(from);
    expect(screen.getByTestId('where').textContent).toBe(to);
  });

  it('reads every alias\'s coverage under the canonical name, with the real ISO3 and a map link', () => {
    intelNames.list = [];
    at('/weekly/country/United%20States');
    expect(screen.getByText('Articles', { selector: '.cpg-stat-k' }).nextSibling.textContent).toBe('3');
    expect(intelNames.list).not.toContain('USA');
    expect(document.querySelector('.cpg-hd-kicker .iso').textContent).toBe('USA');
    expect(screen.getByRole('link', { name: 'Show on map' }).getAttribute('href')).toBe('/?country=USA');
  });

  it('a name that is not a country keeps its coverage but gets no map, follow or save', () => {
    at('/weekly/country/Strait%20of%20Hormuz');
    expect(screen.getByTestId('where').textContent).toBe('/weekly/country/Strait%20of%20Hormuz');
    expect(screen.queryByRole('link', { name: 'Show on map' })).not.toBeInTheDocument();
    expect(screen.queryByText('follow')).not.toBeInTheDocument();
    expect(screen.queryByText('save')).not.toBeInTheDocument();
  });
});
