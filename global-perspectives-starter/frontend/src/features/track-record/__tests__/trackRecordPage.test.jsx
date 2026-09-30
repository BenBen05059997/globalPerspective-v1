// TrackRecordPage — Batch 4 M4. States, as far as live data reaches:
//   no questions block -> Stage 0; a commitment + open week -> Stage 1 with every "not ready yet" line;
//   150 resolved -> the score, with words gated by the interval. The archived July pilot stays labelled.
import { createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let trackRecordValue;
vi.mock('@/features/track-record/hooks/useTrackRecord', () => ({ useTrackRecord: () => trackRecordValue }));
vi.mock('@/features/track-record/hooks/useCorrectionsFeed', () => ({ useCorrectionsFeed: () => ({ notes: [], total: 0, gated: false, loading: false }) }));
vi.mock('@/features/account/components/FollowButton', () => ({ FollowButton: () => null }));
vi.mock('@/features/map/components/RadarMap.jsx', () => ({ default: () => <div data-testid="radar-map-stub" /> }));

import TrackRecordPage from '@/features/track-record/TrackRecordPage';
import TrackRecordText from '@/features/track-record/TrackRecordText';

const PILOT_AT = '2026-07-24T22:22:14.709Z';
const pilotItem = (o = {}) => ({ title: 'NATO summit in Ankara', trigger: 'a trigger', deadline: '2026-07-10', verdict: 'fired', probability: 0.6, confirmedAt: PILOT_AT, citation: null, ...o });
const legacy = (o = {}) => ({
  totalPredictionsLogged: 3478, totalDatedTriggers: 20925, resolvedTriggers: 122, pendingTriggers: 20788, firedTriggers: 30,
  brierScore: 0.154, calibration: [], recent: Array.from({ length: 30 }, () => pilotItem()), eraCutFrom: '2026-07-04', legacyPredictionsExcluded: 2418, ...o,
});
const zero = { locked: 0, yes: 0, no: 0, void: 0, awaiting: 0, pastDeadlineUnchecked: 0, resolved: 0 };
const questions = (o = {}) => ({
  schema: 1, method: { K: 22 }, firstIssuedAt: '2026-10-01T05:00:00Z', firstCommit: { weekId: '2026-W41', committedAt: '2026-10-01T10:30:00Z' },
  issued: 30, sampledTotal: 0, warmUp: 4, counts: zero, scoring: null, sampled: [],
  weeks: [{ weekId: '2026-W41', weekStart: '2026-10-05', commit: { hash: 'abcdef0123456789abcdef', committedAt: '2026-10-01T10:30:00Z' }, reveal: null, drawn: false, picked: null, due: 0, settled: 0 }],
  settleHealth: {}, ...o,
});
const renderPage = (Page = TrackRecordPage) => render(<MemoryRouter>{createElement(Page)}</MemoryRouter>);

describe('today: the questions block exists but nothing is issued or committed', () => {
  it('Stage 0, "have not started yet", accuracy locked with no invented date, pilot labelled archived', () => {
    trackRecordValue = { data: legacy({ questions: questions({ issued: 0, firstIssuedAt: null, firstCommit: null, weeks: [], warmUp: 0 }) }), loading: false, error: null };
    renderPage();
    expect(screen.getByText(/Stage 0/)).toBeInTheDocument();
    expect(screen.getByText(/Per-question forecasts have not started yet/)).toBeInTheDocument();
    expect(screen.getByText(/0 resolved of 150 needed/)).toBeInTheDocument();
    const acc = document.querySelector('[data-notready="accuracy"]').textContent;
    expect(acc).toMatch(/not ready yet/);
    expect(acc).not.toMatch(/Expected/);
    expect(screen.getAllByText(/July pilot \(archived; method flawed\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/No questions are locked yet\./)).toBeInTheDocument();
    expect(screen.getByText(/No settling weeks yet/)).toBeInTheDocument();
  });

  it('never shows a score word or a Brier number', () => {
    trackRecordValue = { data: legacy({ questions: questions({ issued: 0, firstCommit: null, weeks: [] }) }), loading: false, error: null };
    renderPage();
    expect(screen.queryByText(/^strong$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.154/)).not.toBeInTheDocument();
  });
});

describe('Stage 1: a committed week, nothing drawn yet', () => {
  it('shows the locked-week line, the estimate range labelled as an estimate, and the draw row', () => {
    trackRecordValue = { data: legacy({ questions: questions() }), loading: false, error: null };
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    renderPage();
    vi.useRealTimers();
    expect(screen.getByText(/Stage 1/)).toBeInTheDocument();
    expect(screen.getByText(/locked but not drawn/)).toBeInTheDocument();
    expect(document.querySelector('[data-notready="accuracy"]').textContent).toMatch(/Expected between .* and .* \(estimate/);
    expect(document.querySelector('[data-notready="calibration"]').textContent).toMatch(/not ready yet/);
    expect(screen.getByText(/No week has been drawn yet, so there is nothing to verify/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Verify this draw/ })).not.toBeInTheDocument();
  });
});

describe('a drawn week with open, past-deadline and resolved questions', () => {
  const sampled = [
    { qid: 'a', weekId: '2026-W41', question: 'Country A ratifies the treaty', deadline: '2026-10-20', p: 62, resolutionSource: 'Reuters or AP wire report', state: 'yes', storyTitle: 'Treaty', verdict: { url: 'https://ex.com/a', quote: 'Lawmakers voted' } },
    { qid: 'b', weekId: '2026-W41', question: 'Country B holds the election', deadline: '2026-10-22', p: 30, state: 'past_deadline_unchecked', storyTitle: 'Vote' },
    { qid: 'c', weekId: '2026-W41', question: 'Country C signs a pact', deadline: '2026-12-01', p: 45, state: 'awaiting', storyTitle: 'Pact' },
  ];
  it('shows counts that add up, "past deadline, not checked" as its own tile, and the verify control', () => {
    trackRecordValue = { data: legacy({ questions: questions({
      sampledTotal: 3, counts: { locked: 3, yes: 1, no: 0, void: 0, awaiting: 1, pastDeadlineUnchecked: 1, resolved: 1 }, sampled,
      weeks: [{ weekId: '2026-W41', weekStart: '2026-10-05', commit: { hash: 'ab'.repeat(32), committedAt: '2026-10-01T10:30:00Z' }, reveal: { seedHex: 'cd'.repeat(32), revealedAt: '2026-10-12T10:30:00Z' }, drawn: true, eligible: 9, clusters: 3, picked: 3, due: 2, settled: 1, draw: { K: 22, pool: [], picked: [] } }],
    }) }), loading: false, error: null };
    renderPage();
    expect(screen.getByText('Past deadline, not checked')).toBeInTheDocument();
    expect(screen.queryByText(/^awaiting$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify this draw/ })).toBeInTheDocument();
    expect(screen.getByText(/Only 3 stories had an eligible question/)).toBeInTheDocument();
    expect(screen.getByText(/1 resolved of 150 needed/)).toBeInTheDocument();
  });
  it('the text page carries the same facts', () => {
    trackRecordValue = { data: legacy({ questions: questions({ sampledTotal: 3, counts: { locked: 3, yes: 1, no: 0, void: 0, awaiting: 1, pastDeadlineUnchecked: 1, resolved: 1 }, sampled }) }), loading: false, error: null };
    renderPage(TrackRecordText);
    expect(screen.getByText(/3 questions locked in weekly samples/)).toBeInTheDocument();
    expect(screen.getByText(/1 awaiting their deadline; 1 past deadline, not checked/)).toBeInTheDocument();
    expect(screen.getByText(/Country A ratifies the treaty/)).toBeInTheDocument();
    expect(screen.getByText(/62% when locked/)).toBeInTheDocument();
  });
});

describe('150 resolved: the score, with wording gated by the interval', () => {
  const scoring = (ci) => ({ n: 150, brier: 0.19, baseRate: 0.4, brierRef: 0.24, skill: 0.21, ci, voidRate: 0.1, reliability: [] });
  const withScore = (ci) => ({ data: legacy({ questions: questions({ counts: { ...zero, locked: 160, yes: 60, no: 90, resolved: 150 }, scoring: scoring(ci) }) }), loading: false, error: null });
  it('"better than a base-rate guess" only if the interval excludes 0', () => {
    trackRecordValue = withScore({ lo: 0.05, hi: 0.35 });
    renderPage();
    expect(screen.getByText('better than a base-rate guess')).toBeInTheDocument();
    expect(screen.queryByText(/resolved of 150 needed/)).not.toBeInTheDocument();
  });
  it('"not distinguishable" when the interval includes 0', () => {
    trackRecordValue = withScore({ lo: -0.09, hi: 0.35 });
    renderPage();
    expect(screen.getByText('not distinguishable from a base-rate guess')).toBeInTheDocument();
    expect(screen.queryByText(/^strong$/)).not.toBeInTheDocument();
  });
});

describe('an old cached or fallback response with no questions block', () => {
  it('renders Stage 0 and the pilot, never crashes', () => {
    trackRecordValue = { data: legacy(), loading: false, error: null };
    renderPage();
    expect(screen.getByText(/Stage 0/)).toBeInTheDocument();
    expect(screen.getAllByText(/Jul 24 2026/).length).toBeGreaterThan(0);
  });
});
