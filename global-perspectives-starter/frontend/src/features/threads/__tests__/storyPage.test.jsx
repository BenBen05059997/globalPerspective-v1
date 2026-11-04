// The story page: failures vs "not found" (S4), no sign-in dependency (S5), URL-driven Read in full and tab (S6),
// source counts from the rows (S11), one linked-story count (S12).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link, useLocation } from 'react-router';

const H = vi.hoisted(() => ({ thread: null, analysis: null, links: null, weekly: null }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
const api = vi.hoisted(() => ({ fetchNarrativeThread: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchStoryView: vi.fn(), fetchManifest: vi.fn() }));
const sa = vi.hoisted(() => ({ fetchStoryAnalysis: vi.fn() }));

vi.mock('@/features/threads/hooks/useNarrativeThread', () => ({ useNarrativeThread: () => H.thread }));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({ useWeeklyArchive: () => H.weekly }));
vi.mock('@/features/threads/hooks/useStoryAnalysis', () => ({ useStoryAnalysis: () => H.analysis }));
vi.mock('@/features/threads/hooks/useThreadForecast', () => ({ useThreadForecast: () => ({ snapshot: null }) }));
vi.mock('@/features/threads/hooks/useStoryLinks', () => ({ useStoryLinks: () => H.links }));
vi.mock('@/features/threads/components/StoryMode', () => ({
  default: ({ thread, links, onReadFull }) => (
    <div data-testid="story-mode">{thread.threadId}|{links ? 'links' : 'nolinks'}<button onClick={onReadFull}>Read in full</button></div>
  ),
}));
vi.mock('@/features/threads/components/PhoneStoryMode', () => ({ default: () => <div data-testid="story-mode" /> }));
vi.mock('@/shared/ui/boot/BootLoader.jsx', () => ({ default: () => <div data-testid="loader" /> }));
// No AuthProvider and no AuthContext mock: the page's own render and data paths must not wait on sign-in.
// (The Save button is a signed-in feature of its own and needs the provider, so it is stubbed.)
vi.mock('@/shared/ui/SaveButton', () => ({ SaveButton: () => null }));

const entry = (o = {}) => ({ topicId: 't1', title: 'Headline', date: '2026-09-20', category: 'conflict', regions: ['Iran'], sources: [{ source: 'Reuters', tier: 'primary' }], ...o });
const baseThread = { entries: [entry()], loading: false, error: null, refetch: vi.fn() };
const baseAnalysis = { analysis: { threadTitle: 'A story', storyArc: 'An arc.' }, loading: false, error: null, refetch: vi.fn() };
const baseLinks = { fedInto: [], fedFrom: [], loading: false, note: null, state: 'linked', shared: [], hiddenOlder: 0, provenance: null };

function Where() { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; }
async function renderPage(url) {
  const ThreadPage = (await import('@/features/threads/ThreadPage')).default;
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Link to="/weekly/thread/b">go-b</Link>
      <Link to="/weekly/thread/b?tab=sources">go-b-sources</Link>
      <Where />
      <Routes><Route path="/weekly/thread/:threadId" element={<ThreadPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  H.thread = { ...baseThread };
  H.analysis = { ...baseAnalysis };
  H.links = { ...baseLinks };
  H.weekly = { dayMap: {}, sortedDates: [] };
});

describe('ThreadPage failures (S4)', () => {
  it('a failed read says it could not load, not "not found", and offers a retry', async () => {
    H.thread = { entries: null, loading: false, error: 'boom', refetch: vi.fn() };
    H.analysis = { analysis: null, loading: false, error: null, refetch: vi.fn() };
    await renderPage('/weekly/thread/a');
    expect(screen.getByText('This story could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('Story arc not found')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(H.thread.refetch).toHaveBeenCalled();
  });
  it('a failed read with an analysis in hand does not claim "aged out"', async () => {
    H.thread = { entries: null, loading: false, error: 'boom', refetch: vi.fn() };
    await renderPage('/weekly/thread/a');
    expect(screen.getByText('This story could not be loaded')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/aged out/);
  });
  it('a successful empty answer is "not found"', async () => {
    H.thread = { entries: null, loading: false, error: null, refetch: vi.fn() };
    H.analysis = { analysis: null, loading: false, error: null, refetch: vi.fn() };
    await renderPage('/weekly/thread/a');
    expect(screen.getByText('Story arc not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Stories/ })).toBeInTheDocument();
  });
});

describe('ThreadPage in the URL (S5, S6)', () => {
  it('renders without any sign-in provider, and story mode gets the page\'s one links result', async () => {
    await renderPage('/weekly/thread/a');
    expect(screen.getByTestId('story-mode')).toHaveTextContent('a|links');
  });
  it('Read in full writes ?tab= to the URL; a tab click and "Story mode" change it; other params are kept', async () => {
    await renderPage('/weekly/thread/a?from=country&country=Iran');
    fireEvent.click(screen.getByRole('button', { name: 'Read in full' }));
    expect(screen.getByTestId('where').textContent).toBe('/weekly/thread/a?from=country&country=Iran&tab=overview');
    fireEvent.click(screen.getByRole('tab', { name: /Timeline/ }));
    expect(screen.getByTestId('where').textContent).toBe('/weekly/thread/a?from=country&country=Iran&tab=timeline');
    fireEvent.click(screen.getByRole('button', { name: /Story mode/ }));
    expect(screen.getByTestId('where').textContent).toBe('/weekly/thread/a?from=country&country=Iran');
    expect(screen.getByTestId('story-mode')).toBeInTheDocument();
  });
  it('another story\'s link decides Read in full and the tab on its own', async () => {
    await renderPage('/weekly/thread/a?tab=timeline');
    expect(screen.queryByTestId('story-mode')).toBeNull();
    expect(screen.getByRole('tab', { name: /Timeline/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByText('go-b'));
    expect(screen.getByTestId('story-mode')).toBeInTheDocument();
    fireEvent.click(screen.getByText('go-b-sources'));
    expect(screen.queryByTestId('story-mode')).toBeNull();
    expect(screen.getByRole('tab', { name: /Sources/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('story title', () => {
  it('is the story view\'s title in the heading and tab title, not the analysis title or an entry headline', async () => {
    H.thread = { ...baseThread, title: 'Record title', entries: [entry({ topicId: 'a', title: 'Older headline', date: '2026-09-18' }), entry({ topicId: 'b', title: 'Newest headline', date: '2026-09-20' })] };
    H.analysis = { ...baseAnalysis, analysis: { threadTitle: 'Analysis title', storyArc: 'An arc.' } };
    await renderPage('/weekly/thread/a?tab=overview');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Record title');
    expect(document.title).toContain('Record title');
    expect(screen.queryByText('Analysis title')).toBeNull();
  });
  it('a story with no view uses the weekly list\'s title (the record\'s when it has one)', async () => {
    const day = (titles) => ({ entries: titles.map((title, i) => ({ topicId: `t${i}`, threadId: 'a', title, category: 'conflict', regions: ['Iran'], sources: [] })) });
    H.weekly = { dayMap: { '2026-09-20': day(['Action headline']) }, titles: { a: 'Weekly record title' }, sortedDates: ['2026-09-20'] };
    H.thread = { ...baseThread, title: null };
    await renderPage('/weekly/thread/a?tab=overview');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Weekly record title');
  });
  it('with no title anywhere the heading is the humanised id, as before', async () => {
    H.thread = { ...baseThread, title: null };
    await renderPage('/weekly/thread/a?tab=overview');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A');
  });
});

describe('Sources tab counts (S11)', () => {
  it('header counts are computed from the rows shown', async () => {
    H.thread = { ...baseThread, entries: [
      entry({ sources: [{ source: 'AP', tier: 'primary' }, { source: 'AP', tier: 'secondary' }, { source: 'Blog', tier: 'secondary' }, { source: 'NoTier' }] }),
      entry({ topicId: 't2', date: '2026-09-21', sources: [{ source: 'Blog', tier: 'secondary' }] }),
    ] };
    await renderPage('/weekly/thread/a?tab=sources');
    expect(screen.getByText('3 outlets · 2 primary · 1 secondary')).toBeInTheDocument();
    expect(screen.getAllByText('Primary')).toHaveLength(2);
    expect(screen.getAllByText('Secondary')).toHaveLength(1);
  });
});

describe('linked-story count (S12)', () => {
  it('Read in full counts distinct stories, like story mode', async () => {
    const row = (o) => ({ targetThreadId: 'B', targetTitle: 'Story B', confidence: 'strong', country: 'Iran', freshness: 'fresh', ...o });
    H.links = { ...baseLinks, fedInto: [row(), row({ country: 'Israel' }), row({ targetThreadId: 'C', targetTitle: 'Story C' })] };
    await renderPage('/weekly/thread/a?tab=overview');
    expect(screen.getByRole('button', { name: /News this story is judged to feed into/ })).toHaveTextContent('2 stories');
  });
});

describe('hooks (S4)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@/features/threads/hooks/useNarrativeThread');
    vi.doUnmock('@/features/threads/hooks/useStoryAnalysis');
    sessionStorage.clear();
    sink.reportFetchError.mockClear();
  });
  it('useNarrativeThread: a failed action is reported and exposed, an empty answer is not cached', async () => {
    vi.doMock('@/shared/api/restProxy', () => api);
    vi.doMock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchStoryView: rv.fetchStoryView, fetchManifest: rv.fetchManifest }) }));
    vi.doMock('@/shared/api/errorSink', () => sink);
    vi.doMock('@/shared/api/errorSink.js', () => sink);
    rv.fetchStoryView.mockResolvedValue(null);
    rv.fetchManifest.mockResolvedValue({ builtAt: new Date().toISOString() });
    const { useNarrativeThread } = await import('@/features/threads/hooks/useNarrativeThread.js');
    api.fetchNarrativeThread.mockRejectedValueOnce(new Error('down'));
    const a = renderHook(() => useNarrativeThread('t9'));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(a.result.current.error).toBe('down');
    expect(a.result.current.entries).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledWith('narrative-thread', expect.any(Error));
    a.unmount();
    api.fetchNarrativeThread.mockResolvedValue({ data: [] });
    const b = renderHook(() => useNarrativeThread('t10'));
    await waitFor(() => expect(b.result.current.loading).toBe(false));
    expect(b.result.current.error).toBeNull();
    expect(b.result.current.entries).toBeNull();
    expect(sessionStorage.getItem('gp_narrative_thread_v3_t10')).toBeNull();
  });
  it('useStoryAnalysis: a failed read is reported and exposed', async () => {
    vi.doMock('@/shared/api/storyAnalysis.js', () => sa);
    vi.doMock('@/shared/api/errorSink.js', () => sink);
    sa.fetchStoryAnalysis.mockRejectedValue(new Error('nope'));
    const { useStoryAnalysis } = await import('@/features/threads/hooks/useStoryAnalysis.js');
    const r = renderHook(() => useStoryAnalysis('t9'));
    await waitFor(() => expect(r.result.current.loading).toBe(false));
    expect(r.result.current.error).toBe('nope');
    expect(r.result.current.analysis).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledWith('story-analysis', expect.any(Error));
  });
});
