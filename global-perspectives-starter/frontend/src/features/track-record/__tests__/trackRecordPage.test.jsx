// TrackRecordPage wording (F4, review R2): "Not yet checked" instead of "Awaiting their
// deadline" (the backend counts every unresolved trigger, including ones whose deadline already
// passed), and an "early read — too few to judge" verdict instead of an accuracy label like
// "strong" while the resolved sample is thin (the pilot run: ~122, all from one week).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let trackRecordValue;
vi.mock('@/features/track-record/hooks/useTrackRecord', () => ({
  useTrackRecord: () => trackRecordValue,
}));
vi.mock('@/features/track-record/hooks/useCorrectionsFeed', () => ({
  useCorrectionsFeed: () => ({ notes: [], total: 0, gated: false, loading: false }),
}));
vi.mock('@/features/account/components/FollowButton', () => ({
  FollowButton: () => null,
}));

import TrackRecordPage from '@/features/track-record/TrackRecordPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <TrackRecordPage />
    </MemoryRouter>
  );
}

function baseData(overrides = {}) {
  return {
    totalPredictionsLogged: 500,
    totalDatedTriggers: 1000,
    resolvedTriggers: 122,
    pendingTriggers: 20607,
    firedTriggers: 40,
    brierScore: 0.15,
    calibration: [],
    recent: [],
    eraCutFrom: '2026-07-04',
    legacyPredictionsExcluded: 0,
    ...overrides,
  };
}

describe('TrackRecordPage — pending triggers label', () => {
  it('says "Not yet checked", not "Awaiting their deadline"', () => {
    trackRecordValue = { data: baseData(), loading: false, error: null };
    renderPage();
    expect(screen.getByText('Not yet checked')).toBeInTheDocument();
    expect(screen.queryByText(/Awaiting their deadline/i)).not.toBeInTheDocument();
  });
});

describe('TrackRecordPage — Brier verdict', () => {
  it('shows "early read — too few to judge" when the resolved sample is thin (122, one week)', () => {
    trackRecordValue = { data: baseData({ resolvedTriggers: 122, brierScore: 0.15 }), loading: false, error: null };
    renderPage();
    expect(screen.getByText('early read — too few to judge')).toBeInTheDocument();
    expect(screen.queryByText(/^strong$/)).not.toBeInTheDocument();
  });

  it('shows a real accuracy verdict once the resolved sample is large enough', () => {
    trackRecordValue = { data: baseData({ resolvedTriggers: 5000, brierScore: 0.15 }), loading: false, error: null };
    renderPage();
    expect(screen.getByText('strong')).toBeInTheDocument();
    expect(screen.queryByText(/early read/)).not.toBeInTheDocument();
  });
});
