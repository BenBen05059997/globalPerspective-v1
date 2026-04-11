import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import IntelligenceLoader from './IntelligenceLoader';
import ShareButtons from './ShareButtons';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { formatDateLabel } from '../utils/dateUtils';
import CompactTimeline from './CompactTimeline';
import WeeklyMap from './WeeklyMap';
import StoryEntryCard from './StoryEntryCard';
import { CATEGORY_BADGE_COLORS } from './WeeklyPage';
import SideNav from './SideNav';
import CopyBriefing, { formatThreadBriefing } from './CopyBriefing';
import TrialBanner from './TrialBanner';
import { useUserProfile } from '../hooks/useUserProfile';
import './WeeklyPage.css';

function humanizeThreadId(id) {
  return (id || '')
    .replace(/^thread-/, '')
    .replace(/-[a-f0-9]{4,}$/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Story Arc';
}

const MOCK_TIMELINE = [
  'Breaking coverage from multiple international sources…',
  'Developing situation draws regional attention and analysis…',
  'Latest updates trace the evolving narrative across borders…',
];

const PREVIEW_FEATURES = [
  { icon: '🧵', label: 'Story Arcs', desc: 'Follow how each story develops across multiple days' },
  { icon: '🤖', label: 'AI Analysis', desc: 'Trajectory, root causes, and key questions to watch' },
  { icon: '🗺️', label: 'Country Replay', desc: 'Animate news coverage day-by-day on a world map' },
];

function formatTimeAgo(isoString) {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ThreadAnalysisSection({ tab, analysis, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cp-deep-section">
      <button className={`cp-deep-toggle ${open ? 'active' : ''}`} onClick={() => setOpen(!open)}>
        <div>
          <span>{tab.label}</span>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>{tab.hint}</span>
        </div>
        <span className={`cp-deep-chevron ${open ? 'open' : ''}`}>&#9662;</span>
      </button>
      {open && (
        <div className={`story-entry-ai-content ${tab.cssClass}`}>
          <div className="story-entry-section-text">{analysis[tab.key]}</div>
        </div>
      )}
    </div>
  );
}

export default function ThreadPage() {
  const { threadId } = useParams();
  const [searchParams] = useSearchParams();
  const fromCountry = searchParams.get('from') === 'country' ? searchParams.get('country') : null;
  const { loading: authLoading } = useAuth();
  const { profile } = useUserProfile();
  const { dayMap, sortedDates, loading } = useWeeklyArchive();

  const thread = useMemo(() => {
    if (!dayMap || loading) return null;
    const entries = [];
    const allRegions = new Set();
    const allSources = new Set();
    for (const date of sortedDates) {
      for (const entry of (dayMap[date]?.entries || [])) {
        if (entry.threadId === threadId) {
          entries.push({ ...entry, date });
          for (const r of (entry.regions || [])) allRegions.add(r);
          for (const s of (entry.sources || [])) allSources.add(s.source || s.title || 'Source');
        }
      }
    }
    if (!entries.length) return null;
    const dates = [...new Set(entries.map(e => e.date))].sort();
    return {
      threadId,
      latestTitle: entries[0].title,
      entries,
      articleCount: entries.length,
      regions: [...allRegions],
      sources: [...allSources],
      dateRange: { from: dates[0], to: dates[dates.length - 1] },
      dates,
      dayCount: dates.length,
    };
  }, [dayMap, sortedDates, threadId, loading]);

  const { analyses } = useThreadAnalyses(thread ? [threadId] : []);
  const analysis = analyses?.[threadId];
  const category = thread?.entries[0]?.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];

  const displayTitle = analysis?.threadTitle || thread?.latestTitle || humanizeThreadId(threadId);
  useEffect(() => {
    document.title = `${displayTitle} — Story Arc | Global Perspectives`;
  }, [displayTitle]);

  if (authLoading) return <div className="weekly-loading">Loading…</div>;

  if (loading) return <IntelligenceLoader type="typewriter" />;

  if (!thread) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h3>Story arc not found</h3>
        <p style={{ color: '#6b7280' }}>This thread may have expired or the link may be incorrect.</p>
        <Link to="/weekly" style={{ color: '#3b82f6' }}>← Back to Weekly Analysis</Link>
      </div>
    );
  }

  const hasWatchQuestions = analysis?.watchQuestions?.length > 0;
  const hasArc = !!analysis?.storyArc;
  const hasTrajectory = !!analysis?.trajectory;
  const hasRootCause = !!analysis?.rootCauseChain;

  return (
    <div className="thread-page">
      <div className="thread-page-topbar">
        {fromCountry ? (
          <Link to={`/weekly/country/${encodeURIComponent(fromCountry)}`} className="thread-page-back">← {fromCountry} Briefing</Link>
        ) : (
          <Link to="/weekly" className="thread-page-back">← Weekly Analysis</Link>
        )}
      </div>
      <div className="page-with-sidenav">
        <div className="page-main-content">
          <div className="thread-page-body">
            {profile?.isTrial && <TrialBanner daysLeft={profile.trialDaysLeft} />}
            {/* ── Header ── */}
            <div id="tp-section-overview">
              {catColors && (
                <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color, marginBottom: 8, display: 'inline-block' }}>
                  {category}
                </span>
              )}
              <h1 className="thread-page-title">{analysis?.threadTitle || thread.latestTitle}</h1>
              <div className="cp-subtitle">
                Story arc intelligence — {formatDateLabel(thread.dateRange.from)}{thread.dateRange.from !== thread.dateRange.to && ` to ${formatDateLabel(thread.dateRange.to)}`}
                {analysis?.generatedAt && <> · Updated {formatTimeAgo(analysis.generatedAt)}</>}
              </div>

              {/* Metrics strip */}
              <div className="cp-metrics" style={{ marginTop: 12 }}>
                <div className="cp-metric">
                  <span className="cp-metric-value">{thread.articleCount}</span>
                  <span className="cp-metric-label">articles</span>
                </div>
                <div className="cp-metric">
                  <span className="cp-metric-value">{thread.dayCount}</span>
                  <span className="cp-metric-label">days</span>
                </div>
                <div className="cp-metric">
                  <span className="cp-metric-value">{thread.regions.length}</span>
                  <span className="cp-metric-label">regions</span>
                </div>
                <div className="cp-metric">
                  <span className="cp-metric-value">{thread.sources.length}</span>
                  <span className="cp-metric-label">sources</span>
                </div>
              </div>

              {/* Region links */}
              {thread.regions.length > 0 && (
                <div className="thread-page-regions">
                  {thread.regions.slice(0, 6).map(r => (
                    <Link key={r} to={`/weekly/country/${encodeURIComponent(r)}`} className="thread-region-link">{r}</Link>
                  ))}
                  {thread.regions.length > 6 && <span className="thread-region-more">+{thread.regions.length - 6}</span>}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <ShareButtons threadId={thread.threadId} title={analysis?.threadTitle || thread.latestTitle} preview={{ t: analysis?.threadTitle || thread.latestTitle, n: thread.articleCount, d: thread.dayCount, r: thread.regions, c: thread.entries[0]?.category?.toLowerCase() }} />
              <CopyBriefing getText={() => formatThreadBriefing(thread, analysis)} />
            </div>

            {/* ── Watch Questions ── */}
            {hasWatchQuestions && (
              <div id="tp-section-watch" className="cp-watch" style={{ marginBottom: 16 }}>
                <div className="cp-section-label">QUESTIONS TO FOLLOW ({analysis.watchQuestions.length})</div>
                <div className="cp-watch-chips">
                  {analysis.watchQuestions.map((q, i) => (
                    <div key={i} className="cp-watch-chip">❓ {q}</div>
                  ))}
                </div>
              </div>
            )}

            {/* ── AI Analysis sections (auto-open first) ── */}
            {(hasArc || hasTrajectory || hasRootCause) && (
              <div id="tp-section-analysis">
                <div className="cp-section-label">AI ARC ANALYSIS — click a section to read</div>
                <div className="cp-deep" style={{ marginBottom: 16 }}>
                  {[
                    { key: 'storyArc', label: 'How It Evolved', cssClass: 'summary', hint: 'The narrative arc across all days' },
                    { key: 'trajectory', label: "What's Next", cssClass: 'prediction', hint: 'Where this story is heading' },
                    { key: 'rootCauseChain', label: 'Why It Happened', cssClass: 'trace', hint: 'Root causes and contributing factors' },
                  ].filter(t => analysis?.[t.key]).map((tab, i) => (
                    <ThreadAnalysisSection key={tab.key} tab={tab} analysis={analysis} defaultOpen={i === 0} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Map ── */}
            {thread.regions.length > 0 && (
              <div id="tp-section-map" className="thread-page-map">
                <div className="cp-section-label">GEOGRAPHIC SPREAD <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— countries involved in this story arc</span></div>
                <WeeklyMap embedded defaultThread={thread.threadId} hidePanel />
              </div>
            )}

            {/* ── Timeline ── */}
            <div id="tp-section-timeline">
              <div className="cp-section-label">STORY TIMELINE ({thread.entries.length} entries)</div>
              {analysis && thread.dayCount > 1 ? (
                <CompactTimeline entries={thread.entries} entryShortTitles={analysis.entryShortTitles} dotColor={catColors?.bg} />
              ) : thread.dayCount > 1 ? (
                <div className="story-timeline">
                  {thread.entries.map((entry, i) => (
                    <div key={entry.topicId || i} className="story-timeline-entry">
                      <div className="story-entry-dot" />
                      <div className="story-entry-content">
                        <div className="story-entry-date">{formatDateLabel(entry.date)}</div>
                        <StoryEntryCard entry={entry} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="story-single-entry">
                  <StoryEntryCard entry={thread.entries[0]} />
                </div>
              )}
            </div>
          </div>
        </div>
        <SideNav sections={[
          { id: 'tp-section-overview', label: 'Overview' },
          ...(hasWatchQuestions ? [{ id: 'tp-section-watch', label: 'Watch', count: analysis.watchQuestions.length }] : []),
          ...(hasArc || hasTrajectory || hasRootCause ? [{ id: 'tp-section-analysis', label: 'AI Analysis' }] : []),
          ...(thread.regions.length > 0 ? [{ id: 'tp-section-map', label: 'Map' }] : []),
          { id: 'tp-section-timeline', label: 'Timeline', count: thread.entries.length },
        ]} />
      </div>
    </div>
  );
}
