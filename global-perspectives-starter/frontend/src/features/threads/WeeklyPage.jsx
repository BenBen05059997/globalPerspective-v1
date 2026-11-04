import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Chip from '@/shared/ui/Chip.jsx';
import Button from '@/shared/ui/Button.jsx';
import { useSearchParams, useNavigationType } from 'react-router';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import EditorialShell from '@/shared/ui/EditorialShell';
import StatusStrip from '@/shared/ui/StatusStrip';
import { useIsPhone } from '@/shared/hooks/useIsPhone';
import { usePeek } from '@/shared/hooks/usePeek';
import { useWeeklyArchive } from '@/features/threads/hooks/useWeeklyArchive';
import { useThreadAnalyses } from '@/features/threads/hooks/useThreadAnalyses';
import { useLastVisit } from '@/features/threads/hooks/useLastVisit';
import {
  CATEGORY_ORDER, DEFAULT_WINDOW, WINDOWS, SORTS, buildThreads, filterThreads, filterStandalone, sortThreads,
  tierCounts, facetCounts,
} from '@/features/threads/lib/storyGroups';
import StoriesHeader from '@/features/threads/components/StoriesHeader.jsx';
import StoriesFilters from '@/features/threads/components/StoriesFilters.jsx';
import StoriesFeed from '@/features/threads/components/StoriesFeed.jsx';
import StoriesBoard from '@/features/threads/components/StoriesBoard.jsx';
import StoriesWeb from '@/features/threads/components/StoriesWeb.jsx';
import StoriesTimeline from '@/features/threads/components/StoriesTimeline.jsx';
import StoriesChanged, { railRising } from '@/features/threads/components/StoriesChanged.jsx';
import '@/features/threads/WeeklyPage.css';
import '@/features/threads/Stories.css';

const WeeklyMap = lazy(() => import('@/features/threads/components/WeeklyMap'));

// Re-exported for callers that used the old export.
export { CATEGORY_ORDER };

const DEFAULT_SORT = 'articles';
const VIEWS = ['list', 'board', 'timeline', 'map', 'web', 'changes'];

// /weekly — Stories (A: intel-feed list, B: status board, C: 30-day timeline, the Map view, the story Web).
// The Countries tab is a link to /weekly/countries (old ?section=countries links redirect in app/LegacyRedirects.jsx).
// URL: ?view=list|board|timeline|map|web|changes, ?category=<topic> (ThreadPage breadcrumb), and the filters:
// ?q= ?crisis=a,b ?tiers=a,b ?region= ?window=1d|3d|7d ?sort=recent|rising (defaults are left out).
// Phone: READ / MAP / TIMELINE tabs, READ default. The changed-since-last-visit section lives inside
// READ and only exists once a previous-visit baseline does; `?view=changes` (the old CHANGES tab)
// opens READ scrolled to it, or plain READ without a baseline.
export default function WeeklyPage() {
  const isPhone = useIsPhone();
  const peek = usePeek();
  const [welcome, setWelcome] = useState(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gp_just_signed_in')) {
      sessionStorage.removeItem('gp_just_signed_in');
      return true;
    }
    return false;
  });
  const [ready, setReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view = VIEWS.includes(viewParam) ? viewParam : 'list';
  // ?category= is case-insensitive; a name that is not a topic is said so (below), never read as "all stories".
  const categoryParam = (searchParams.get('category') || '').trim();
  const categoryKey = categoryParam.toLowerCase();
  const category = CATEGORY_ORDER.includes(categoryKey) ? categoryKey : null;
  const unknownCategory = categoryParam && !category ? categoryParam : null;
  // Filters, sort and search live in the URL too, so the page follows Back/Forward. A view change pushes a history
  // entry (Back returns to the previous view); everything else replaces (no entry per keystroke or click).
  // The search text is typed state (a router-controlled input drops keystrokes typed before the URL update lands);
  // the URL gets a copy with replace, and Back/Forward (POP) put the URL's text back.
  const urlQ = searchParams.get('q') || '';
  const navType = useNavigationType();
  const [q, setQText] = useState(urlQ);
  useEffect(() => { if (navType === 'POP') setQText(urlQ); }, [urlQ, navType]);
  const crisisRaw = searchParams.get('crisis') || '';
  const tiersRaw = searchParams.get('tiers') || '';
  const crisis = useMemo(() => crisisRaw.split(',').filter(Boolean), [crisisRaw]);
  const tiers = useMemo(() => tiersRaw.split(',').filter(Boolean), [tiersRaw]);
  const region = searchParams.get('region') || null;
  const windowParam = searchParams.get('window');
  const windowValue = WINDOWS.some((w) => w.value === windowParam) ? windowParam : DEFAULT_WINDOW;
  const sortParam = searchParams.get('sort');
  const sort = SORTS.some((o) => o.value === sortParam) ? sortParam : DEFAULT_SORT;
  const patchParams = (fn, push = false) => setSearchParams((prev) => { const n = new URLSearchParams(prev); fn(n); return n; }, { replace: !push });
  const setParam = (key, value, fallback = '') => patchParams((n) => {
    const v = Array.isArray(value) ? value.join(',') : value;
    if (!v || v === fallback) n.delete(key); else n.set(key, v);
  });
  const setView = (v) => patchParams((n) => { if (v === 'list') n.delete('view'); else n.set('view', v); }, true);
  const clearCategory = () => patchParams((n) => n.delete('category'));
  const setQ = (v) => { setQText(v); setParam('q', v); };
  const setCrisis = (v) => setParam('crisis', v);
  const setTiers = (v) => setParam('tiers', v);
  const setRegion = (v) => setParam('region', v);
  const setWindow = (v) => setParam('window', v, DEFAULT_WINDOW);
  const setSort = (v) => setParam('sort', v, DEFAULT_SORT);

  useEffect(() => setReady(true), []);
  useEffect(() => { document.title = 'Story Intelligence — Global Perspectives'; }, []);

  const { dayMap, titles, sortedDates: allDates, loading, error, dataUpdatedAt, refetch } = useWeeklyArchive();
  const baseline = useLastVisit();
  // One "now" per loaded archive: ages are stable while the page is open.
  const now = useMemo(() => Date.now(), [dayMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const { threads, standalone } = useMemo(() => buildThreads(dayMap, allDates, now, titles), [dayMap, allDates, now, titles]);
  const qualifyingThreadIds = useMemo(() => threads.filter((t) => t.articleCount >= 2).map((t) => t.threadId), [threads]);
  const { analyses, failed: scoresFailed } = useThreadAnalyses(qualifyingThreadIds, { light: true });

  const filters = useMemo(() => ({ q, crisis, tiers, region, category, window: windowValue }), [q, crisis, tiers, region, category, windowValue]);
  const listed = useMemo(
    () => sortThreads(filterThreads(threads, filters, analyses, now), sort, now),
    [threads, filters, analyses, now, sort],
  );
  const listedStandalone = useMemo(() => filterStandalone(standalone, filters, now), [standalone, filters, now]);

  // Counts shown next to each filter option: each facet counted with every other active filter applied (not its own).
  const facets = useMemo(() => facetCounts(threads, filters, analyses, now), [threads, filters, analyses, now]);
  const counts = useMemo(
    () => ({ total: facets.total, crisis: facets.crisis, tier: scoresFailed ? {} : facets.tier }), // no scores read: no tier counts (not "all unscored")
    [facets, scoresFailed],
  );
  const regions = facets.regions;
  // The header and the strip count what the filters leave (the facet counts on the left leave out their own filter).
  const headerCounts = useMemo(() => (scoresFailed ? { total: listed.length } : tierCounts(listed, analyses)), [listed, analyses, scoresFailed]);

  // `?view=changes` on a phone: once the list has rendered, scroll to the changed section (it only exists with a baseline).
  const scrollToChanged = isPhone && view === 'changes' && Number.isFinite(baseline) && ready && !loading;
  useEffect(() => {
    if (scrollToChanged) document.getElementById('sf-changed')?.scrollIntoView?.({ block: 'start' });
  }, [scrollToChanged]);

  const header = (
    <StoriesHeader
      view={view}
      setView={setView}
      isPhone={isPhone}
      counts={!loading ? headerCounts : null}
      windowPhrase={WINDOWS.find((w) => w.value === windowValue)?.phrase}
      scoresUnavailable={scoresFailed}
    />
  );

  const totalEvents = listed.reduce((sum, t) => sum + t.articleCount, 0) + listedStandalone.length;
  const strip = (
    <StatusStrip
      label="LIVE"
      stats={[
        { value: listed.length, unit: 'arcs' },
        { value: totalEvents, unit: 'events' },
        { value: allDates.length, unit: 'days with stories' },
      ]}
      updatedAt={dataUpdatedAt}
    />
  );

  if (view === 'map') {
    return (
      <div className="wp-section-wrap">
        {threads.length ? strip : null}
        {header}
        <Suspense fallback={<BootLoader variant="inline" className="gp-boot--tight" label="Loading map" text="Loading map" />}>
          <WeeklyMap embedded />
        </Suspense>
      </div>
    );
  }

  if (!ready || loading) return <BootLoader variant="inline" label="Loading stories" text="Loading stories" />;

  if (threads.length === 0 && standalone.length === 0) {
    // A failed load (already reported by the hook) says so and offers a retry; an answered-but-empty archive says that.
    return (
      <div className="wp-section-wrap">
        {header}
        <div className="weekly-empty-state" role={error ? 'alert' : undefined}>
          <h3>{error ? 'Stories are unavailable right now' : 'No stories in the archive'}</h3>
          <p>{error ? 'The story archive could not be loaded.' : 'The archive has no stories for the last 30 days.'}</p>
          {error ? <Button onClick={refetch}>Try again</Button> : null}
        </div>
      </div>
    );
  }

  const filterProps = {
    q, setQ, crisis, setCrisis, tiers, setTiers, windowValue, setWindow, region, setRegion, sort, setSort,
    category, clearCategory, counts, regions,
  };
  const clearFilters = () => {
    setQText('');
    patchParams((n) => ['q', 'crisis', 'tiers', 'region', 'window', 'sort', 'category'].forEach((k) => n.delete(k)));
  };
  const activeFilters = (q.trim() ? 1 : 0) + crisis.length + tiers.length + (region ? 1 : 0) + (windowValue !== DEFAULT_WINDOW ? 1 : 0)
    + (sort !== DEFAULT_SORT ? 1 : 0) + (category ? 1 : 0);

  const hasBaseline = Number.isFinite(baseline);
  const showRising = !isPhone;
  const railHasContent = hasBaseline || railRising(threads, now).length > 0;
  const changed = (
    <StoriesChanged threads={threads} analyses={analyses} baseline={baseline} now={now} peek={peek} showRising={showRising} />
  );

  const banners = (
    <>
      {welcome ? (
        <div className="sf-welcome">
          <span>Welcome to Story Intelligence! You have full access. Explore stories, country briefings, and AI analysis below.</span>
          <Button variant="icon" label="Dismiss" onClick={() => setWelcome(false)}>✕</Button>
        </div>
      ) : null}
    </>
  );

  const nothingListed = listed.length === 0 && listedStandalone.length === 0;
  const body = unknownCategory
    ? (
      <div className="weekly-empty-state" data-testid="unknown-category">
        <p>There is no topic called “{unknownCategory}”.</p>
        <Button onClick={clearCategory}>Show all stories</Button>
      </div>
    )
    : nothingListed && view !== 'web'
    ? (
      <div className="weekly-empty-state" data-testid="no-match">
        <p>No stories match your current filters.</p>
        <Button onClick={clearFilters}>Clear filters</Button>
      </div>
    )
    : view === 'timeline'
    ? <StoriesTimeline threads={listed} analyses={analyses} windowValue={windowValue} now={now} />
    : view === 'board'
    ? <StoriesBoard threads={listed} analyses={analyses} now={now} peek={peek} />
    : view === 'web'
    ? <StoriesWeb threads={listed} now={now} peek={peek} isPhone={isPhone} />
    : <StoriesFeed threads={listed} standalone={listedStandalone} analyses={analyses} now={now} peek={peek} />;

  if (isPhone) {
    return (
      <EditorialShell strip={strip} className="wp-shell">
        {header}
        {banners}
        {view === 'timeline' || view === 'board' || view === 'web' ? null : changed}
        <div className="sf-phonebar">
          <input
            type="search"
            className="sf-search"
            placeholder="Search stories…"
            aria-label="Search stories"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Chip
            selected={filtersOpen}
            aria-expanded={filtersOpen}
            aria-controls="sf-phone-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            Filters{activeFilters ? ` · ${activeFilters}` : ''}
          </Chip>
        </div>
        {filtersOpen ? (
          <div id="sf-phone-filters" className="sf-panel">
            <StoriesFilters {...filterProps} showSearch={false} />
          </div>
        ) : null}
        {body}
      </EditorialShell>
    );
  }

  return (
    <EditorialShell strip={strip} left={<StoriesFilters {...filterProps} />} right={railHasContent && view !== 'web' ? changed : null} className="wp-shell">
      {header}
      {banners}
      {body}
    </EditorialShell>
  );
}
