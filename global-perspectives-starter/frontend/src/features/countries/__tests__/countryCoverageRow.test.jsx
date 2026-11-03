// The country page coverage list: each item's row is a real button (focusable, Enter/Space work natively)
// that toggles the item's sources and AI read-outs and reports it with aria-expanded.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const entry = {
  topicId: 't1', threadId: null, title: 'Talks resume in Geneva', category: 'politics', regions: ['Iran'],
  sources: [{ source: 'Reuters', url: 'https://example.com/a' }],
};
vi.mock('@/features/threads', () => ({
  useWeeklyArchive: () => ({ dayMap: { '2026-10-18': { entries: [entry] } }, sortedDates: ['2026-10-18'], loading: false }),
  useThreadAnalyses: () => ({ analyses: {} }),
  useWebIndex: () => ({ index: null }),
  deriveFromIndex: () => ({ fedInto: [] }),
}));
vi.mock('@/features/countries/hooks/useCountryStories', () => ({ useCountryStories: () => ({ deadlines: [], topicIdToThreadId: new Map() }) }));
vi.mock('@/features/countries/hooks/useCountryFacts', () => ({ useCountryFacts: () => ({ facts: null }) }));
vi.mock('@/features/threads/components/WeeklyMap', () => ({ default: () => null }));
vi.mock('@/features/countries/hooks/useCountryIntelligence', () => ({ useCountryIntelligence: () => ({ intelligence: {} }) }));
vi.mock('@/features/countries/hooks/useCountryHistory', () => ({ useCountryHistory: () => ({ snapshots: [], driftNotes: [] }) }));
vi.mock('@/features/countries/components/CountryCardV2', () => ({ default: () => null }));
vi.mock('@/shared/ui/SaveButton', () => ({ SaveButton: () => <span>save</span> }));
vi.mock('@/shared/ui/FollowButton', () => ({ FollowButton: () => <span>follow</span> }));
vi.mock('@/shared/ui/ShareButtons', () => ({ default: () => null }));

import CountryPage from '@/features/countries/CountryPage';

function openCoverage() {
  render(
    <MemoryRouter initialEntries={['/weekly/country/Iran']}>
      <Routes><Route path="/weekly/country/:countryName" element={<CountryPage />} /></Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: /Coverage/ }));
  fireEvent.click(screen.getByRole('button', { name: /Related coverage/ }));
}

describe('country page coverage rows', () => {
  it('each row is a button named by its title that toggles the item and reports aria-expanded', () => {
    openCoverage();
    const row = screen.getByRole('button', { name: /Talks resume in Geneva/ });
    expect(row.tagName).toBe('BUTTON');
    expect(row).toHaveAttribute('type', 'button');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Reuters' })).toBeNull();

    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Reuters' })).toHaveAttribute('href', 'https://example.com/a');

    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Reuters' })).toBeNull();
  });

  it('the row is in the tab order (a native button, no tabindex override) and takes focus', () => {
    openCoverage();
    const row = screen.getByRole('button', { name: /Talks resume in Geneva/ });
    expect(row).not.toHaveAttribute('tabindex');
    row.focus();
    expect(row).toHaveFocus();
  });
});
