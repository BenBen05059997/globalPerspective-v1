import { useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import ShareButtons from './ShareButtons';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { formatDateLabel } from '../utils/dateUtils';
import ThreadIntelligence from './ThreadIntelligence';
import CompactTimeline from './CompactTimeline';
import WeeklyMap from './WeeklyMap';
import StoryEntryCard from './StoryEntryCard';
import { CATEGORY_BADGE_COLORS } from './WeeklyPage';
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

function ThreadPreviewGate({ threadId, searchParams, ctaTitle, ctaPrimary, ctaSecondary }) {
  const previewTitle = searchParams.get('t') || humanizeThreadId(threadId);
  const articles = parseInt(searchParams.get('n')) || null;
  const days = parseInt(searchParams.get('d')) || null;
  const regions = searchParams.get('r')?.split(',').filter(Boolean) || [];
  const category = searchParams.get('c') || null;
  const catColors = category ? CATEGORY_BADGE_COLORS[category] : null;

  return (
    <div className="thread-preview-gate">
      <div className="thread-preview-header">
        {catColors && (
          <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color }}>{category}</span>
        )}
        <div className="thread-preview-title">{previewTitle}</div>
        {(articles || days) && (
          <div className="thread-preview-stats">
            {articles && <>{articles} article{articles !== 1 ? 's' : ''}</>}
            {articles && days && ' · '}
            {days && <>{days} day{days !== 1 ? 's' : ''}</>}
          </div>
        )}
        {regions.length > 0 && (
          <div className="thread-preview-regions">
            {regions.map(r => <span key={r} className="story-card-region-tag">{r}</span>)}
          </div>
        )}
      </div>

      <div className="wlp-preview-wrap">
        <div className="wlp-preview-blur">
          <div className="story-timeline">
            {MOCK_TIMELINE.map((text, i) => (
              <div key={i} className="story-timeline-entry">
                <div className="story-entry-dot" />
                <div className="story-entry-content">
                  <div className="story-entry-date">Day {i + 1}</div>
                  <div className="story-entry-card">
                    <div className="story-entry-title">{text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="wlp-overlay">
          <div className="wlp-cta">
            <div className="wlp-cta-title">{ctaTitle}</div>
            <div className="wlp-cta-desc">See how this story evolved with AI narrative analysis, trajectory predictions, and root cause tracing</div>
            <div className="wlp-features" style={{ marginBottom: 16 }}>
              {PREVIEW_FEATURES.map(f => (
                <div key={f.label} className="wlp-feature-card">
                  <span className="wlp-feature-icon">{f.icon}</span>
                  <span className="wlp-feature-label">{f.label}</span>
                  <span className="wlp-feature-desc">{f.desc}</span>
                </div>
              ))}
            </div>
            <div className="wlp-cta-btns">
              {ctaPrimary}
              {ctaSecondary}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThreadPage() {
  const { threadId } = useParams();
  const [searchParams] = useSearchParams();
  const fromCountry = searchParams.get('from') === 'country' ? searchParams.get('country') : null;
  const { user, loading: authLoading } = useAuth();
  const { dayMap, sortedDates, loading, error } = useWeeklyArchive();

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

  if (authLoading) return <div className="weekly-loading">Loading…</div>;

  if (!user) {
    return (
      <ThreadPreviewGate
        threadId={threadId}
        searchParams={searchParams}
        ctaTitle="Sign in to read this story arc"
        ctaPrimary={<Link to="/signin" className="wlp-btn-primary">Sign in free →</Link>}
        ctaSecondary={<Link to="/pricing" className="wlp-btn-secondary">See Member plans</Link>}
      />
    );
  }

  if (loading) return <div className="weekly-loading">Loading story arc…</div>;

  if (error && error.includes('401')) {
    return (
      <ThreadPreviewGate
        threadId={threadId}
        searchParams={searchParams}
        ctaTitle="Upgrade to unlock this story arc"
        ctaPrimary={<Link to="/pricing" className="wlp-btn-primary">Get Member access →</Link>}
        ctaSecondary={<Link to="/" className="wlp-btn-secondary">Back to free content</Link>}
      />
    );
  }

  if (!thread) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h3>Story arc not found</h3>
        <p style={{ color: '#6b7280' }}>This thread may have expired or the link may be incorrect.</p>
        <Link to="/weekly" style={{ color: '#3b82f6' }}>← Back to Weekly Analysis</Link>
      </div>
    );
  }

  return (
    <div className="thread-page">
      <div className="thread-page-topbar">
        {fromCountry ? (
          <Link to={`/weekly/country/${encodeURIComponent(fromCountry)}`} className="thread-page-back">← {fromCountry} Briefing</Link>
        ) : (
          <Link to="/weekly" className="thread-page-back">← Weekly Analysis</Link>
        )}
      </div>
      <div className="thread-page-body">
        {catColors && (
          <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color, marginBottom: 8, display: 'inline-block' }}>
            {category}
          </span>
        )}
        <h1 className="thread-page-title">{analysis?.threadTitle || thread.latestTitle}</h1>
        <div className="thread-page-meta">
          <span>{formatDateLabel(thread.dateRange.from)}{thread.dateRange.from !== thread.dateRange.to && ` — ${formatDateLabel(thread.dateRange.to)}`}</span>
          <span className="story-card-detail-sep" />
          <span>{thread.articleCount} article{thread.articleCount !== 1 ? 's' : ''} · {thread.dayCount} day{thread.dayCount !== 1 ? 's' : ''}</span>
          <span className="story-card-detail-sep" />
          <span>{thread.regions.slice(0, 4).join(', ')}</span>
        </div>
        <ShareButtons threadId={thread.threadId} title={analysis?.threadTitle || thread.latestTitle} preview={{ t: analysis?.threadTitle || thread.latestTitle, n: thread.articleCount, d: thread.dayCount, r: thread.regions, c: thread.entries[0]?.category?.toLowerCase() }} />
        <ThreadIntelligence analysis={analysis} />
        {thread.regions.length > 0 && (
          <div className="thread-page-map">
            <WeeklyMap embedded defaultThread={thread.threadId} hidePanel />
          </div>
        )}
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
  );
}
