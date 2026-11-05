// Grouped news situations (tracker NEWS_GROUPING): one situation carries the ids and threads of the
// stories it absorbed (`aliases[]`, `threadIds[]`) and lists their other titles (`also_reported_as[]`).
// Old ?focus= and ?story= links still land on it, Alerts shows it once, and the card shows
// "Also reported as" collapsed by default (nothing when empty).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { situationForFocus, situationForThread } from '@/features/map/lib/deepLinks.js';
import { alertStackItems } from '@/features/map/lib/alertStack.js';
import { topicsWithoutSituation } from '@/features/map/lib/storyShading.js';

const base = {
  source: 'news', axis: 'conflict', tier: 'high', state: 'escalating', escalating: true, centroid: { lat: 49, lon: 32 },
  iso3_affected: ['UKR', 'RUS'], opened_at: '2026-11-02T15:00:00.000Z', last_change_at: '2026-11-03T04:13:59.153Z', what_changed: '5 outlets',
};
const GROUPED = {
  ...base, id: 'news#conflict#UKR#russian-military', verb_label: 'Russian strikes kill 26 in Ukraine', threadId: 'thread-a',
  threadIds: ['thread-a', 'thread-b'], aliases: ['news#UKR#thread-b', 'news#humanitarian#UKR#war'],
  also_reported_as: ['At least 26 killed in Russian strikes on aid centre', 'Russia bombs Ukraine aid centre'],
};
const LONE = { ...base, id: 'news#conflict#SDN#khartoum', verb_label: 'Sudan files UN complaints', threadId: null, iso3_affected: ['SDN'], centroid: { lat: 15, lon: 32 } };
const WORLD = {
  schema: 1, generated_at: '2026-11-03T05:13:59.323Z', next_expected_at: '2026-11-03T05:43:59.323Z',
  sources: { gdacs: '2026-11-03T05:05:07.869Z', news: '2026-11-03T04:50:16.515Z' }, stale: false, situations: [GROUPED, LONE],
};

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({ world: WORLD, situations: WORLD.situations, loading: false, error: null, asOf: WORLD.sources.news, stale: false }),
  useSituationDetail: () => ({ detail: null }),
}));
vi.mock('@/shared/hooks/useDailyBrief.js', () => ({ useDailyBrief: () => ({ brief: null, servedDateKey: null, loading: false, error: null }), MAX_LOOKBACK_DAYS: 30 }));
vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({ topics: [], settled: true, loading: false, error: null, isStale: false, updatedAt: '2026-11-03T04:00:00Z', generatedDate: null }),
}));
vi.mock('@/features/threads', () => ({ useWebIndex: () => ({ index: { threads: {}, links: [], shared: [] }, loading: false, failed: false }), deriveFromIndex: () => ({ fedInto: [], fedFrom: [] }) }));
vi.mock('@/features/briefings', () => ({ useWeeklyBrief: () => ({ brief: null }) }));
vi.mock('@/features/countries', () => ({ CountryCardV2: () => <div /> }));
vi.mock('@/features/map/hooks/useStoryCardData.js', () => ({ useStoryCardData: () => ({ loading: false, summary: null, analysis: null, summaryError: false, analysisError: false, fetchError: false }) }));
vi.mock('@/features/map/hooks/usePausedSince.js', () => ({ usePausedSince: () => ({ paused: null }) }));
vi.mock('@/shared/map/RadarMap.jsx', () => ({ default: (p) => <div data-testid="radar" data-focus-id={p.focusId || ''} /> }));

async function renderAt(url) {
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter initialEntries={[url]}><SituationHome /></MemoryRouter>);
}

describe('grouped situations — pure lookups', () => {
  it('?focus=<absorbed id> resolves to the surviving situation', () => {
    expect(situationForFocus(WORLD.situations, 'news#UKR#thread-b').id).toBe(GROUPED.id);
    expect(situationForFocus(WORLD.situations, 'news#humanitarian#UKR#war').id).toBe(GROUPED.id);
  });
  it('?story=<thread of an absorbed member> resolves to the surviving situation', () => {
    expect(situationForThread(WORLD.situations, 'thread-a').id).toBe(GROUPED.id);
    expect(situationForThread(WORLD.situations, 'thread-b').id).toBe(GROUPED.id);
    expect(situationForThread(WORLD.situations, 'thread-none')).toBeNull();
  });
  it('Alerts keeps a separate row for a situation that only shares a thread through threadIds[]', () => {
    const other = { ...LONE, id: 'news#USA#thread-b', threadId: 'thread-b', last_change_at: '2026-11-01T00:00:00.000Z', tier: 'moderate' };
    const { items } = alertStackItems([GROUPED, other, LONE], Date.parse('2026-11-03T06:00:00Z'));
    expect(items.map((s) => s.id).sort()).toEqual([GROUPED.id, LONE.id, other.id].sort());
  });
  it('Intel drops a topic whose thread a grouped situation carries in threadIds[]', () => {
    const topics = [{ topicId: 't1', threadId: 'thread-b', title: 'x' }, { topicId: 't2', threadId: 'thread-z', title: 'y' }];
    expect(topicsWithoutSituation(topics, WORLD.situations).map((t) => t.topicId)).toEqual(['t2']);
  });
});

describe('grouped situations — the console', () => {
  beforeEach(() => {
    localStorage.clear(); vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T06:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('?focus=<old id> opens the merged situation', async () => {
    await renderAt('/?focus=news%23UKR%23thread-b');
    expect(screen.getByRole('heading', { name: 'Russian strikes kill 26 in Ukraine' })).toBeInTheDocument();
    expect(screen.getByTestId('radar')).toHaveAttribute('data-focus-id', GROUPED.id);
  });

  it('?story=<thread of an absorbed member> opens the merged situation', async () => {
    await renderAt('/?story=thread-b');
    expect(screen.getByRole('heading', { name: 'Russian strikes kill 26 in Ukraine' })).toBeInTheDocument();
    expect(screen.getByTestId('radar')).toHaveAttribute('data-focus-id', GROUPED.id);
  });

  it('"Also reported as" is collapsed by default and the button toggles it', async () => {
    await renderAt('/?focus=news%23conflict%23UKR%23russian-military');
    const btn = screen.getByRole('button', { name: /Also reported as/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Russia bombs Ukraine aid centre')).not.toBeVisible();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Russia bombs Ukraine aid centre')).toBeVisible();
    expect(screen.getByText('At least 26 killed in Russian strikes on aid centre')).toBeVisible();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Russia bombs Ukraine aid centre')).not.toBeVisible();
  });

  it('nothing is shown when a situation has no other titles', async () => {
    await renderAt('/?focus=news%23conflict%23SDN%23khartoum');
    expect(screen.getByRole('heading', { name: 'Sudan files UN complaints' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Also reported as/ })).toBeNull();
    expect(screen.queryByText(/Also reported as/)).toBeNull();
  });
});
