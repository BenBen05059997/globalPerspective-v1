import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import IntelligenceLoader from './IntelligenceLoader';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { getTopicRegion } from '../utils/countryMapping';
import { formatDateLabel } from '../utils/dateUtils';
import TrendBadge, { getTrend } from './TrendBadge';
import WeeklyLockedPreview from './WeeklyLockedPreview';
import SideNav from './SideNav';
import TrialBanner from './TrialBanner';
import { useUserProfile } from '../hooks/useUserProfile';
import './WeeklyPage.css';
import './AIComponents.css';

const WeeklyMap = lazy(() => import('./WeeklyMap'));

const REGION_COLORS = {
  Asia:          { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  Europe:        { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
  'Middle East': { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  Africa:        { bg: '#d1fae5', border: '#34d399', text: '#065f46' },
  Americas:      { bg: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
  Oceania:       { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
  World:         { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
};

export const CATEGORY_BADGE_COLORS = {
  conflict:   { bg: '#fee2e2', color: '#b91c1c' },
  military:   { bg: '#fee2e2', color: '#b91c1c' },
  disaster:   { bg: '#ffedd5', color: '#c2410c' },
  politics:   { bg: '#dbeafe', color: '#1d4ed8' },
  economy:    { bg: '#d1fae5', color: '#065f46' },
  technology: { bg: '#ede9fe', color: '#5b21b6' },
  health:     { bg: '#ccfbf1', color: '#0f766e' },
};

export const CATEGORY_ORDER = ['politics', 'economy', 'conflict', 'technology', 'environment', 'health', 'society', 'culture', 'science', 'other'];

export const RISK_COLORS = {
  low:      { bg: '#d1fae5', color: '#065f46' },
  moderate: { bg: '#fef9c3', color: '#854d0e' },
  elevated: { bg: '#ffedd5', color: '#9a3412' },
  high:     { bg: '#fee2e2', color: '#991b1b' },
};

function getActivityStatus(lastDateStr) {
  const diffDays = Math.floor(
    (Date.now() - new Date(lastDateStr + 'T00:00:00').getTime()) / 86400000
  );
  if (diffDays <= 2) return { label: 'Active', color: '#10b981' };
  if (diffDays <= 7) return { label: 'Ongoing', color: '#f59e0b' };
  return { label: 'Quieting', color: '#9ca3af' };
}

function regionTagStyle(region) {
  const c = REGION_COLORS[region] || REGION_COLORS.World;
  return { background: c.bg, borderColor: c.border, color: c.text };
}

function filterDatesByRange(sortedDates, range) {
  if (range === 'all') return sortedDates;
  const days = range === '3d' ? 3 : range === '7d' ? 7 : 30;
  return sortedDates.slice(0, days);
}

function groupByThread(dayMap, sortedDates) {
  const threadMap = {};
  const standalone = [];

  for (const date of sortedDates) {
    const entries = dayMap[date]?.entries || [];
    for (const entry of entries) {
      const enriched = { ...entry, date };
      if (entry.threadId) {
        if (!threadMap[entry.threadId]) {
          threadMap[entry.threadId] = { entries: [], allSources: new Set(), allRegions: new Set() };
        }
        threadMap[entry.threadId].entries.push(enriched);
        for (const s of (entry.sources || [])) {
          threadMap[entry.threadId].allSources.add(s.source || s.title || 'Unknown');
        }
        for (const r of (entry.regions || [])) {
          threadMap[entry.threadId].allRegions.add(r);
        }
      } else {
        standalone.push(enriched);
      }
    }
  }

  const threads = Object.entries(threadMap).map(([threadId, data]) => {
    data.entries.sort((a, b) => b.date.localeCompare(a.date));
    const regions = [...data.allRegions];
    const primaryRegion = getTopicRegion({ regions });
    const trend = getTrend(data.entries);
    return {
      threadId,
      latestTitle: data.entries[0].title,
      entries: data.entries,
      articleCount: data.entries.length,
      dayCount: new Set(data.entries.map(e => e.date)).size,
      sources: [...data.allSources].slice(0, 8),
      regions,
      primaryRegion,
      trend,
      dateRange: {
        from: data.entries[data.entries.length - 1].date,
        to: data.entries[0].date,
      },
    };
  });

  threads.sort((a, b) => b.articleCount - a.articleCount);

  for (const entry of standalone) {
    entry.primaryRegion = getTopicRegion(entry);
  }

  return { threads, standalone };
}

// ─── Arc Dots ─────────────────────────────────────────────────────────────────

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ArcDots({ entries }) {
  const uniqueDates = [...new Set(entries.map(e => e.date))].sort();
  if (uniqueDates.length < 2) return null;
  const startMs = new Date(uniqueDates[0]).getTime();
  const endMs = new Date(uniqueDates[uniqueDates.length - 1]).getTime();
  const totalDays = Math.round((endMs - startMs) / 86400000) + 1;
  const dateSet = new Set(uniqueDates);
  const showGaps = totalDays <= 14;
  const dots = showGaps
    ? Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
        return { date: d, active: dateSet.has(d) };
      })
    : uniqueDates.map(d => ({ date: d, active: true }));
  return (
    <div className="arc-dots">
      <span className="arc-dot-date-label">{fmtShort(uniqueDates[0])}</span>
      {dots.map((dot, i) => (
        <div key={dot.date} className="arc-dot-item">
          <div className={`arc-dot ${dot.active ? 'active' : 'gap'}`} title={dot.active ? dot.date : ''} />
          {i < dots.length - 1 && <div className="arc-dot-connector" />}
        </div>
      ))}
      <span className="arc-dot-date-label">{fmtShort(uniqueDates[uniqueDates.length - 1])}</span>
    </div>
  );
}

// ─── Arc Intro ────────────────────────────────────────────────────────────────

function ArcIntro({ onDismiss }) {
  return (
    <div className="arc-intro">
      <div className="arc-intro-content">
        <span className="arc-intro-icon">◎</span>
        <span>
          <strong>What are Story Arcs?</strong> Each entry below groups related articles from multiple days, showing how a global topic is evolving. The dot trail shows which days coverage appeared.
        </span>
      </div>
      <button className="arc-intro-dismiss" onClick={onDismiss}>Got it</button>
    </div>
  );
}

// ─── Featured Section (Rising arcs) ──────────────────────────────────────────

function FeaturedSection({ threads }) {
  const featured = useMemo(() => threads
    .filter(t => (t.trend === 'rising' || t.trend === 'new') && t.articleCount >= 2)
    .sort((a, b) => {
      if (a.trend === 'rising' && b.trend !== 'rising') return -1;
      if (b.trend === 'rising' && a.trend !== 'rising') return 1;
      return b.articleCount - a.articleCount;
    })
    .slice(0, 3),
  [threads]);

  if (featured.length === 0) return null;

  return (
    <div className="featured-section">
      <div className="featured-section-header">
        <span className="featured-section-label">Rising This Week</span>
        <span className="featured-section-hint">Story arcs gaining momentum — click to read</span>
      </div>
      <div className="featured-cards">
        {featured.map(thread => {
          const fCategory = thread.entries[0]?.category?.toLowerCase();
          const fCatColors = CATEGORY_BADGE_COLORS[fCategory];
          const fActivity = getActivityStatus(thread.dateRange.to);
          const hook = (() => {
            const s = thread.entries[0]?.ai?.summary;
            if (!s) return null;
            const sentence = s.split(/(?<=[.!?])\s/)[0] || s;
            return sentence.length > 110 ? sentence.slice(0, 107) + '…' : sentence;
          })();
          return (
            <Link key={thread.threadId} to={`/weekly/thread/${thread.threadId}`} className="featured-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="featured-card-top">
                <span className="story-arc-label">Story Arc</span>
                {fCatColors && (
                  <span className="story-category-badge" style={{ background: fCatColors.bg, color: fCatColors.color }}>
                    {fCategory}
                  </span>
                )}
                <TrendBadge entries={thread.entries} />
                <span className="story-activity-dot" style={{ color: fActivity.color }}>● {fActivity.label}</span>
                <span className="featured-card-stats">
                  {thread.articleCount} articles · {thread.dayCount} day{thread.dayCount !== 1 ? 's' : ''}
                </span>
              </div>
              <ArcDots entries={thread.entries} />
              <div className="featured-card-title">{thread.latestTitle}</div>
              {thread.regions.length > 0 && (
                <div className="featured-card-regions">
                  {thread.regions.slice(0, 3).map((r, i) => (
                    <span key={i} className="story-card-region-tag" style={regionTagStyle(r)}>{r}</span>
                  ))}
                </div>
              )}
              {hook && <div className="featured-card-hook">{hook}</div>}
              <div className="featured-card-cta">Read full arc →</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({ thread, analysis }) {
  const isMulti = thread.articleCount > 1;
  const displayTitle = analysis?.threadTitle || thread.latestTitle;
  const category = thread.entries[0]?.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];
  const activity = getActivityStatus(thread.dateRange.to);
  const watchCount = analysis?.watchQuestions?.length || 0;
  const hook = (() => {
    const s = thread.entries[0]?.ai?.summary;
    if (!s) return null;
    const sentence = s.split(/(?<=[.!?])\s/)[0] || s;
    return sentence.length > 140 ? sentence.slice(0, 137) + '…' : sentence;
  })();

  return (
    <Link to={`/weekly/thread/${thread.threadId}`} className="story-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div className="story-card-main">
        <div className="story-card-content">
          <div className="story-card-title">{displayTitle}</div>
          <div className="story-card-meta-row">
            {analysis && <span className="story-ai-badge">AI</span>}
            {isMulti && <span className="story-arc-label">Story Arc</span>}
            {catColors && (
              <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color }}>
                {category}
              </span>
            )}
            <span className="story-arc-stats">
              {thread.articleCount} article{thread.articleCount !== 1 ? 's' : ''}
              {isMulti ? ` · ${thread.dayCount} day${thread.dayCount !== 1 ? 's' : ''}` : ''}
            </span>
            <TrendBadge entries={thread.entries} />
            <span className="story-activity-dot" style={{ color: activity.color }}>
              ● {activity.label}
            </span>
            {thread.regions.slice(0, 3).map((r, i) => (
              <span key={i} className="story-card-region-tag" style={regionTagStyle(r)}>{r}</span>
            ))}
            {thread.regions.length > 3 && (
              <span className="story-card-region-tag more">+{thread.regions.length - 3}</span>
            )}
          </div>
          {isMulti && <ArcDots entries={thread.entries} />}
          {hook && <div className="story-card-hook">{hook}</div>}
          {watchCount > 0 && (
            <div className="story-card-watch-hint">
              {watchCount} question{watchCount !== 1 ? 's' : ''} to watch
            </div>
          )}
        </div>
        <span className="story-expand-btn">Read arc →</span>
      </div>
    </Link>
  );
}

// ─── Standalone Section ───────────────────────────────────────────────────────

function StandaloneSection({ entries }) {
  const [expanded, setExpanded] = useState(false);
  if (!entries.length) return null;

  const byDate = {};
  for (const entry of entries) {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="standalone-section">
      <div className="standalone-header" onClick={() => setExpanded(!expanded)}>
        <div className="standalone-header-left">
          <span className="standalone-label">Single Mentions</span>
          <span className="standalone-count">{entries.length}</span>
          <span className="standalone-hint">Appeared once — not yet part of a multi-day arc</span>
        </div>
        <div className={`story-card-chevron ${expanded ? 'open' : ''}`}>&#9662;</div>
      </div>
      {expanded && (
        <div className="standalone-body">
          {dates.map(date => (
            <div key={date} className="standalone-day">
              <div className="standalone-day-label">{formatDateLabel(date)}</div>
              {byDate[date].map((entry, i) => (
                <div key={entry.topicId || i} className="standalone-entry">
                  <span className="standalone-entry-title">{entry.title}</span>
                  {entry.regions && entry.regions.length > 0 && (
                    <span className="standalone-entry-regions">
                      {entry.regions.slice(0, 2).map((r, j) => (
                        <span key={j} className="story-card-region-tag" style={regionTagStyle(r)}>{r}</span>
                      ))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Country Chips ────────────────────────────────────────────────────────────

function CountryChips({ countryOptions, activeCountry, onChange, max = 8 }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? countryOptions : countryOptions.slice(0, max);
  const overflow = countryOptions.length - max;
  return (
    <div className="filter-country-chips">
      {visible.map(({ country }) => (
        <button
          key={country}
          className={`filter-country-chip ${activeCountry === country ? 'active' : ''}`}
          onClick={() => onChange(activeCountry === country ? null : country)}
        >
          {country}
        </button>
      ))}
      {!showAll && overflow > 0 && (
        <button className="filter-country-chip overflow" onClick={() => setShowAll(true)}>
          +{overflow} more
        </button>
      )}
      {showAll && overflow > 0 && (
        <button className="filter-country-chip overflow" onClick={() => setShowAll(false)}>
          Show less
        </button>
      )}
    </div>
  );
}

// ─── Filter Controls ──────────────────────────────────────────────────────────

function FilterControls({ regionGroups, activeRegion, setActiveRegion, timeRange, setTimeRange, sortBy, setSortBy, availableDays, searchQuery, setSearchQuery, countryOptions, activeCountry, setActiveCountry }) {
  return (
    <div className="filter-controls">
      <div className="filter-top-row">
        <input
          type="text"
          className="filter-search"
          placeholder="Search arcs…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="filter-period-wrapper">
          <span className="filter-period-label">Show</span>
          <div className="filter-period-group">
            {[
              { value: '3d', label: '3 days' },
              { value: '7d', label: '7 days' },
              ...(availableDays > 7 ? [{ value: 'all', label: `All ${availableDays} days` }] : []),
            ].map(opt => (
              <button
                key={opt.value}
                className={`filter-period-btn ${timeRange === opt.value ? 'active' : ''}`}
                onClick={() => setTimeRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <select className="filter-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="articles">Most covered</option>
          <option value="recent">Most recent</option>
          <option value="rising">Rising first</option>
        </select>
        {countryOptions.length > 0 && (
          <CountryChips
            countryOptions={countryOptions}
            activeCountry={activeCountry}
            onChange={setActiveCountry}
            max={8}
          />
        )}
      </div>
      {regionGroups.length > 1 && (
        <div className="filter-region-row">
          <button
            className={`filter-region-chip ${!activeRegion ? 'active' : ''}`}
            onClick={() => setActiveRegion(null)}
          >
            All
          </button>
          {regionGroups.map(g => (
            <button
              key={g.region}
              className={`filter-region-chip ${activeRegion === g.region ? 'active' : ''}`}
              onClick={() => setActiveRegion(activeRegion === g.region ? null : g.region)}
            >
              {g.region}
              <span className="filter-region-count">{g.threads.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weekly Page ──────────────────────────────────────────────────────────────

export default function WeeklyPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useUserProfile();
  const [welcome, setWelcome] = useState(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gp_just_signed_in')) {
      sessionStorage.removeItem('gp_just_signed_in');
      return true;
    }
    return false;
  });
  const [viewMode, setViewMode] = useState('list');
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeCountry, setActiveCountry] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('articles');
  const [searchQuery, setSearchQuery] = useState('');
  const [showIntro, setShowIntro] = useState(
    () => !localStorage.getItem('gp_arc_intro_dismissed')
  );
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  function dismissIntro() {
    localStorage.setItem('gp_arc_intro_dismissed', '1');
    setShowIntro(false);
  }

  useEffect(() => setActiveCountry(null), [activeRegion]);

  const { dayMap, sortedDates: allDates, loading, error } = useWeeklyArchive();

  const sortedDates = useMemo(
    () => filterDatesByRange(allDates, timeRange),
    [allDates, timeRange],
  );

  const { threads, standalone } = useMemo(
    () => groupByThread(dayMap, sortedDates),
    [dayMap, sortedDates],
  );

  const qualifyingThreadIds = useMemo(
    () => threads.filter(t => t.articleCount >= 2).map(t => t.threadId),
    [threads],
  );
  const { analyses: threadAnalyses } = useThreadAnalyses(qualifyingThreadIds);

  const sortedThreads = useMemo(() => {
    const copy = [...threads];
    if (sortBy === 'recent') {
      copy.sort((a, b) => b.dateRange.to.localeCompare(a.dateRange.to));
    } else if (sortBy === 'rising') {
      const order = { rising: 0, new: 1, stable: 2, fading: 3 };
      copy.sort((a, b) => (order[a.trend] ?? 4) - (order[b.trend] ?? 4) || b.articleCount - a.articleCount);
    }
    return copy;
  }, [threads, sortBy]);

  // Region groups for filter chips
  const regionGroups = useMemo(() => {
    const groups = {};
    for (const t of sortedThreads) {
      const r = t.primaryRegion || 'World';
      if (!groups[r]) groups[r] = { threads: [], standaloneEntries: [] };
      groups[r].threads.push(t);
    }
    for (const e of standalone) {
      const r = e.primaryRegion || 'World';
      if (!groups[r]) groups[r] = { threads: [], standaloneEntries: [] };
      groups[r].standaloneEntries.push(e);
    }
    return Object.entries(groups)
      .map(([region, data]) => ({
        region,
        threads: data.threads,
        standaloneEntries: data.standaloneEntries,
        totalCount: data.threads.reduce((s, t) => s + t.articleCount, 0) + data.standaloneEntries.length,
      }))
      .sort((a, b) => {
        if (a.region === 'World') return 1;
        if (b.region === 'World') return -1;
        return b.totalCount - a.totalCount;
      });
  }, [sortedThreads, standalone]);

  const countryOptions = useMemo(() => {
    const counts = {};
    for (const t of sortedThreads) {
      for (const r of (t.regions || [])) {
        counts[r] = (counts[r] || 0) + t.articleCount;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));
  }, [sortedThreads]);

  // Flat filtered feed
  const { flatThreads, flatStandalone } = useMemo(() => {
    let filteredThreads = activeRegion
      ? sortedThreads.filter(t => (t.primaryRegion || 'World') === activeRegion)
      : sortedThreads;
    let filteredStandalone = activeRegion
      ? standalone.filter(e => (e.primaryRegion || 'World') === activeRegion)
      : standalone;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filteredThreads = filteredThreads.filter(t =>
        t.latestTitle.toLowerCase().includes(q) ||
        t.entries.some(e => e.title.toLowerCase().includes(q)) ||
        t.regions.some(r => r.toLowerCase().includes(q)) ||
        t.sources.some(s => s.toLowerCase().includes(q))
      );
      filteredStandalone = filteredStandalone.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.regions || []).some(r => r.toLowerCase().includes(q))
      );
    }
    if (activeCountry) {
      filteredThreads = filteredThreads.filter(t => (t.regions || []).includes(activeCountry));
      filteredStandalone = filteredStandalone.filter(e => (e.regions || []).includes(activeCountry));
    }
    return { flatThreads: filteredThreads, flatStandalone: filteredStandalone };
  }, [sortedThreads, standalone, activeRegion, searchQuery, activeCountry]);

  useEffect(() => { document.title = 'Story Intelligence — Global Perspectives'; }, []);

  if (authLoading) return <div className="weekly-loading">Loading…</div>;

  if (!user && !import.meta.env.DEV) return <WeeklyLockedPreview />;
  const isUnauthorized = error && error.includes('401');
  if (isUnauthorized) {
    return (
      <div className="weekly-gate">
        <div className="weekly-gate-icon">🔒</div>
        <h2>Member access required</h2>
        <p>Weekly narrative analysis is available on the Member plan ($15/mo). Upgrade to track how stories evolve across days.</p>
        <Link to="/pricing" className="weekly-gate-submit" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
          See plans →
        </Link>
      </div>
    );
  }

  const totalArticles = threads.reduce((sum, t) => sum + t.articleCount, 0) + standalone.length;

  return (
    <div className={`weekly-page ${viewMode === 'map' ? 'map-mode' : ''}`}>
      <div className="weekly-header">
        <div className="weekly-header-left">
          <h1>Story Intelligence</h1>
          {!loading && sortedDates.length > 0 && (
            <div className="weekly-subtitle">
              {sortedDates.length}-day archive · {totalArticles} articles · {threads.length} arc{threads.length !== 1 ? 's' : ''} tracked
            </div>
          )}
        </div>
        <div className="weekly-header-right">
          {!loading && threads.length > 0 && (
            <>
              <div className="weekly-view-toggle">
                <button className={`weekly-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>List</button>
                <button className={`weekly-toggle-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>Map</button>
              </div>
            </>
          )}
        </div>
      </div>

      {profile?.isTrial && <TrialBanner daysLeft={profile.trialDaysLeft} />}

      {welcome && (
        <div className="welcome-banner">
          <span>Welcome to Story Intelligence! You have full access to all features. Explore story arcs, country briefings, and AI analysis below.</span>
          <button className="welcome-dismiss" onClick={() => setWelcome(false)}>✕</button>
        </div>
      )}

      {error && !isUnauthorized && (
        <div className="weekly-error">{error}</div>
      )}

      {viewMode === 'map' ? (
        <Suspense fallback={<div className="weekly-loading">Loading map...</div>}>
          <WeeklyMap embedded />
        </Suspense>
      ) : loading ? (
        <IntelligenceLoader type="typewriter" />
      ) : threads.length === 0 && standalone.length === 0 ? (
        <div className="weekly-empty-state">
          <h3>No archive data yet</h3>
          <p>Data is accumulating. Check back in a few hours as the pipeline runs.</p>
        </div>
      ) : (
        <div className="page-with-sidenav">
        <div className="page-main-content">
          {showIntro && <ArcIntro onDismiss={dismissIntro} />}
          <div id="wp-section-featured"><FeaturedSection threads={threads} threadAnalyses={threadAnalyses} /></div>
          <div id="wp-section-filters"><FilterControls
            regionGroups={regionGroups}
            activeRegion={activeRegion}
            setActiveRegion={setActiveRegion}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            sortBy={sortBy}
            setSortBy={setSortBy}
            availableDays={allDates.length}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            countryOptions={countryOptions}
            activeCountry={activeCountry}
            setActiveCountry={setActiveCountry}
          /></div>
          <div id="wp-section-arcs" className="weekly-feed">
            {flatThreads.length === 0 && flatStandalone.length === 0 && (
              <div className="weekly-empty-state">
                <p>No stories match your current filters.</p>
              </div>
            )}
            {(() => {
              const ORDER = ['politics', 'economy', 'conflict', 'technology', 'environment', 'health', 'society', 'culture', 'science', 'other'];
              const groupMap = {};
              for (const t of flatThreads) {
                const cat = t.entries[0]?.category?.toLowerCase() || 'other';
                const key = ORDER.includes(cat) ? cat : 'other';
                if (!groupMap[key]) groupMap[key] = [];
                groupMap[key].push(t);
              }
              const groups = ORDER.filter(k => groupMap[k]).map(k => ({ category: k, threads: groupMap[k] }));
              return groups.map(({ category, threads }) => {
                const isCollapsed = collapsedCategories.has(category);
                const c = CATEGORY_BADGE_COLORS[category];
                const toggleCollapse = () => setCollapsedCategories(prev => {
                  const next = new Set(prev);
                  next.has(category) ? next.delete(category) : next.add(category);
                  return next;
                });
                const showAll = expandedGroups.has(category);
                const visibleThreads = showAll ? threads : threads.slice(0, 5);
                const hiddenCount = threads.length - visibleThreads.length;
                return (
                  <div key={category} className="weekly-category-group">
                    <button
                      className="weekly-category-group-header"
                      onClick={toggleCollapse}
                      style={c ? { borderLeftColor: c.bg } : {}}
                    >
                      <span className="weekly-category-group-name" style={c ? { color: c.color } : {}}>{category}</span>
                      <span className="weekly-category-group-count">{threads.length}</span>
                      <span className={`weekly-category-group-chevron ${isCollapsed ? 'collapsed' : ''}`}>›</span>
                    </button>
                    {!isCollapsed && (
                      <>
                        {visibleThreads.map(thread => (
                          <StoryCard key={thread.threadId} thread={thread} analysis={threadAnalyses?.[thread.threadId]} />
                        ))}
                        {hiddenCount > 0 && (
                          <button
                            className="weekly-category-show-more"
                            onClick={() => setExpandedGroups(prev => { const n = new Set(prev); n.add(category); return n; })}
                          >
                            Show {hiddenCount} more
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              });
            })()}
            {flatStandalone.length > 0 && (
              <div id="wp-section-singles"><StandaloneSection entries={flatStandalone} /></div>
            )}
          </div>
        </div>
        <SideNav sections={[
          { id: 'wp-section-featured', label: 'Rising' },
          { id: 'wp-section-filters', label: 'Filters' },
          { id: 'wp-section-arcs', label: 'Story Arcs', count: flatThreads.length },
          ...(flatStandalone.length > 0 ? [{ id: 'wp-section-singles', label: 'Singles', count: flatStandalone.length }] : []),
        ]} />
        </div>
      )}
    </div>
  );
}
