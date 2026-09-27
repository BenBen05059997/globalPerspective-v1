// TrackRecordPage — S6 rewrite. The 122-trigger July pilot (all confirmed at a single
// 2026-07-24T22:22:14.709Z timestamp, verified live) is archived and excluded from every
// headline number; accuracy is locked until 150 POST-pilot resolved (never "awaiting" for a
// pending trigger whose deadline has passed).
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
// RadarMap draws to an SVG via d3 against real DOM sizing; jsdom has none, so the map pane is
// stubbed for this page-level test (ForecastBoard's own map plumbing is covered by
// forecastPlaces.test.js instead).
vi.mock('@/features/map/components/RadarMap.jsx', () => ({ default: () => <div data-testid="radar-map-stub" /> }));

import TrackRecordPage from '@/features/track-record/TrackRecordPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <TrackRecordPage />
    </MemoryRouter>
  );
}

const PILOT_AT = '2026-07-24T22:22:14.709Z';

function pilotItem(overrides = {}) {
  return {
    title: 'NATO summit in Ankara', trigger: 'a trigger', deadline: '2026-07-10',
    verdict: 'fired', probability: 0.6, confirmedAt: PILOT_AT, citation: null,
    ...overrides,
  };
}

function baseData(overrides = {}) {
  return {
    totalPredictionsLogged: 3450,
    totalDatedTriggers: 20744,
    pendingTriggers: 20607,
    firedTriggers: 30,
    brierScore: 0.154,
    calibration: [],
    recent: Array.from({ length: 30 }, () => pilotItem()),
    eraCutFrom: '2026-07-04',
    legacyPredictionsExcluded: 2418,
    ...overrides,
  };
}

describe('TrackRecordPage — pending triggers label', () => {
  it('says "Not yet checked", not "Awaiting their deadline"', () => {
    trackRecordValue = { data: baseData(), loading: false, error: null };
    renderPage();
    expect(screen.getByText('Not yet checked')).toBeInTheDocument();
    expect(screen.queryByText(/Awaiting their deadline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^awaiting$/i)).not.toBeInTheDocument();
  });
});

describe('TrackRecordPage — today\'s real state: all 122 resolved are the archived pilot', () => {
  it('locks accuracy (0 post-pilot resolved, all 30 returned are pilot)', () => {
    trackRecordValue = { data: baseData(), loading: false, error: null };
    renderPage();
    expect(screen.getByText(/0 resolved of 150 needed/)).toBeInTheDocument();
    expect(screen.queryByText(/^strong$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^weak$/)).not.toBeInTheDocument();
  });

  it('labels the pilot explicitly as archived and flawed, never in the headline', () => {
    trackRecordValue = { data: baseData(), loading: false, error: null };
    renderPage();
    expect(screen.getAllByText(/July pilot \(archived; method flawed\)/).length).toBeGreaterThan(0);
  });

  it('shows stage 0 wording naming the real last-resolved date', () => {
    trackRecordValue = { data: baseData(), loading: false, error: null };
    renderPage();
    expect(screen.getAllByText(/Jul 24 2026/).length).toBeGreaterThan(0);
  });
});

describe('TrackRecordPage — once post-pilot resolutions exist', () => {
  it('unlocks accuracy and shows a real verdict once 150+ post-pilot resolved', () => {
    const postPilot = Array.from({ length: 150 }, (_, i) => pilotItem({
      confirmedAt: '2026-09-20T00:00:00.000Z', probability: 0.6, verdict: i % 10 === 0 ? 'not_fired' : 'fired',
    }));
    trackRecordValue = { data: baseData({ recent: postPilot }), loading: false, error: null };
    renderPage();
    expect(screen.queryByText(/resolved of 150 needed/)).not.toBeInTheDocument();
    expect(screen.getByText(/150 resolved questions \(post-pilot\)/)).toBeInTheDocument();
  });
});
