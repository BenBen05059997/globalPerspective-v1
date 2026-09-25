// The country page's views are Situation / Story Arcs / Coverage. The country-scoped
// "Causal Web" tab was removed (2026-09-25): the web is story-based now, and a country
// systems view belongs in the Analysis Studio as an on-demand lens.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import archiveFixture from '@fixtures/archive.json';
import threadAnalysesFixture from '@fixtures/thread_analyses.json';
import countryIntelFixture from '@fixtures/country_intelligence.json';

const rawDayMap = archiveFixture.data;
const rawDates = Object.keys(rawDayMap).sort((a, b) => a.localeCompare(b));
const dayMap = {};
{
  const today = new Date();
  rawDates.forEach((d, i) => {
    const shifted = new Date(today);
    shifted.setDate(today.getDate() - (rawDates.length - 1 - i));
    dayMap[shifted.toISOString().slice(0, 10)] = rawDayMap[d];
  });
}
const sortedDates = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));

vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap, sortedDates, loading: false, error: null, tier: 'enterprise', fetchedAt: Date.now(), dataUpdatedAt: Date.now(), refetch: vi.fn() }),
}));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({
  useThreadAnalyses: () => ({ analyses: threadAnalysesFixture.data, loading: false, error: null }),
}));
vi.mock('@/features/countries/hooks/useCountryIntelligence', () => ({
  useCountryIntelligence: () => ({ intelligence: countryIntelFixture.data, loading: false, error: null }),
}));
vi.mock('@/features/countries/hooks/useCountryHistory', () => ({
  useCountryHistory: () => ({ snapshots: [], driftNotes: [], driftNotesTotal: 0, driftNotesGated: false, loading: false, error: null }),
}));
vi.mock('@/features/economy/hooks/useMarketsCountry', () => ({
  useMarketsCountry: () => ({ data: null, loading: false, error: null }),
}));
vi.mock('@/features/economy/hooks/useDisruptionsList', () => ({
  useDisruptionsList: () => ({ data: [], loading: false, error: null }),
}));
vi.mock('@/shared/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock('@/shared/ui/IntelligenceLoader', () => ({ default: () => <div data-testid="loader" /> }));
vi.mock('@/features/threads/components/WeeklyMap', () => ({ default: () => <div data-testid="weekly-map" /> }));

describe('CountryPage — views', () => {
  it('offers Situation, Story Arcs and Coverage, and no country Causal Web', async () => {
    const CountryPage = (await import('@/features/countries/CountryPage')).default;
    render(
      <MemoryRouter initialEntries={['/weekly/country/United%20States']}>
        <Routes><Route path="/weekly/country/:countryName" element={<CountryPage />} /></Routes>
      </MemoryRouter>,
    );
    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs.some(t => t.startsWith('Situation'))).toBe(true);
    expect(tabs.some(t => t.startsWith('Story Arcs'))).toBe(true);
    expect(tabs.some(t => t.startsWith('Coverage'))).toBe(true);
    expect(screen.queryByText(/Causal Web/i)).toBeNull();

    for (const name of [/Story Arcs/, /Coverage/, /Situation/]) {
      const tab = screen.getByRole('tab', { name });
      fireEvent.click(tab);
      expect(tab.getAttribute('aria-selected')).toBe('true');
    }
  });
});
