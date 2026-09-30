// Boot screen on the map home: each sensor ticks only from its real signal. jsdom has no WebGL, so
// the console opens on RadarMap, whose first real d3 draw is the Map sensor's signal.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SituationHome from '@/features/map/SituationHome.jsx';

const h = vi.hoisted(() => ({
  world: { world: null, situations: [], loading: true, error: null, asOf: null, stale: false, retry: vi.fn() },
  topics: { topics: [], loading: false, error: null, settled: false, isStale: false, updatedAt: null, generatedDate: null, refetch: vi.fn() },
  report: vi.fn(),
}));

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => h.world,
  useSituationDetail: () => ({ detail: null }),
}));
vi.mock('@/features/daily/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: null, servedDateKey: null, loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));
vi.mock('@/shared/data/useGeminiTopics.js', () => ({ useGeminiTopics: () => h.topics }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: (...a) => h.report(...a), installErrorSink: () => {} }));

const stateOf = (label) => screen.getByText(label).nextSibling;
const mount = () => render(<MemoryRouter><SituationHome /></MemoryRouter>);

beforeEach(() => {
  cleanup();
  h.report.mockClear(); h.world.retry.mockClear(); h.topics.refetch.mockClear();
  h.world = { ...h.world, world: null, loading: true, error: null };
  h.topics = { ...h.topics, topics: [], error: null, settled: false };
});

describe('SituationHome boot sensors', () => {
  it('ticks each sensor from its own real signal, independently', () => {
    mount();
    expect(stateOf('News desk')).toHaveTextContent('CONNECTING');      // topics not settled
    expect(stateOf('Disaster alerts')).toHaveTextContent('CONNECTING'); // world still loading
    expect(stateOf('Map')).toHaveTextContent('✓ READY');                // radar really drew
    expect(document.querySelector('.gp-boot--ready')).toBeNull();       // not all ready: no crossfade
  });

  it('fills + crossfades once news, GDACS and the map are all really in', () => {
    h.topics = { ...h.topics, settled: true, topics: [{ title: 't' }] };
    h.world = { ...h.world, loading: false, world: { situations: [], sources: { gdacs: '2026-10-01T00:00:00Z' }, generated_at: '2026-10-01T00:00:00Z' } };
    mount();
    expect(document.querySelector('.gp-boot--ready')).toBeTruthy();
  });

  it('failed world load: honest line naming the sensor, reported to the sink, RETRY re-runs only that load', () => {
    h.topics = { ...h.topics, settled: true, topics: [{ title: 't' }] };
    h.world = { ...h.world, loading: false, error: new Error('worldData 500') };
    mount();
    expect(stateOf('Disaster alerts')).toHaveTextContent('NOT LOADED');
    expect(screen.getByText("Disaster alerts didn't load. News desk and Map are ready.")).toBeInTheDocument();
    expect(h.report).toHaveBeenCalledWith('boot-sensor-disaster', expect.any(Error));
    fireEvent.click(screen.getByRole('button', { name: 'RETRY' }));
    expect(h.world.retry).toHaveBeenCalledTimes(1);
    expect(h.topics.refetch).not.toHaveBeenCalled();
  });

  it('OPEN ANYWAY lets the console open with the data that did load', () => {
    h.topics = { ...h.topics, settled: true, topics: [{ title: 't' }] };
    h.world = { ...h.world, loading: false, error: new Error('worldData 500') };
    mount();
    expect(document.querySelector('.gp-boot--ready')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'OPEN ANYWAY' }));
    expect(document.querySelector('.gp-boot--ready')).toBeTruthy();
  });
});
