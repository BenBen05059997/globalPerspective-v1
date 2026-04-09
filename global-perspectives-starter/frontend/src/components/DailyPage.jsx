import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { CATEGORY_BADGE_COLORS, RISK_COLORS } from './WeeklyPage';
import ShareButtons from './ShareButtons';
import CopyBriefing, { formatDailyBrief } from './CopyBriefing';
import SideNav from './SideNav';
import IntelligenceLoader from './IntelligenceLoader';
import './WeeklyPage.css';

const TRAJECTORY_BADGES = {
  escalating: { arrow: '\u2197', label: 'Escalating', color: '#ef4444' },
  stable: { arrow: '\u2192', label: 'Stable', color: '#6b7280' },
  'de-escalating': { arrow: '\u2198', label: 'De-escalating', color: '#10b981' },
};

function BoldText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )}</>;
}

function prevDateKey(dk) {
  const d = new Date(dk + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function nextDateKey(dk) {
  const d = new Date(dk + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatTimeAgo(isoString) {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DailyPage() {
  const { dateKey: paramDateKey } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const dateKey = paramDateKey || today;
  const isToday = dateKey === today;

  const { brief, loading, error } = useDailyBrief(dateKey);

  useEffect(() => {
    const title = brief?.displayDate || dateKey;
    document.title = `Daily Brief \u2014 ${title} | Global Perspectives`;
  }, [brief, dateKey]);

  if (authLoading) return <div className="weekly-loading">Loading\u2026</div>;

  if (!isToday && !user && !import.meta.env.DEV) {
    return (
      <div className="thread-preview-gate" style={{ maxWidth: 600, margin: '2rem auto', padding: '2rem' }}>
        <div className="thread-preview-title">Daily Intelligence Brief</div>
        <div className="thread-preview-stats">Past daily briefs require a free account</div>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div className="wlp-cta-btns" style={{ justifyContent: 'center' }}>
            <Link to="/signin" className="wlp-btn-primary">Sign in free \u2192</Link>
            <Link to="/daily" className="wlp-btn-secondary">View today's brief</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <IntelligenceLoader type="typewriter" />;

  if (!brief) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h3>No daily brief available</h3>
        <p style={{ color: '#6b7280' }}>
          {isToday
            ? 'Today\u2019s brief hasn\u2019t been generated yet. It publishes daily \u2014 check back soon.'
            : `No brief found for ${dateKey}.`}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          <Link to={`/daily/${prevDateKey(dateKey)}`} style={{ color: '#3b82f6' }}>\u2190 Previous day</Link>
          {!isToday && <Link to="/daily" style={{ color: '#3b82f6' }}>Today\u2019s brief</Link>}
        </div>
      </div>
    );
  }

  const risk = brief.countryToWatch?.riskLevel ? (RISK_COLORS[brief.countryToWatch.riskLevel] || RISK_COLORS.moderate) : null;
  const trajectory = brief.countryToWatch?.trajectory ? (TRAJECTORY_BADGES[brief.countryToWatch.trajectory] || TRAJECTORY_BADGES.stable) : null;
  const risingTrajectory = brief.risingThread?.trajectory ? (TRAJECTORY_BADGES[brief.risingThread.trajectory] || TRAJECTORY_BADGES.stable) : null;

  const sections = [
    { id: 'daily-headline', label: 'Lead Story' },
    { id: 'daily-overview', label: 'Overview' },
    ...(brief.topStories?.length ? [{ id: 'daily-top-stories', label: 'Top Stories', count: brief.topStories.length }] : []),
    ...(brief.risingThread?.title ? [{ id: 'daily-rising-thread', label: 'Rising Thread' }] : []),
    ...(brief.countryToWatch?.countryName ? [{ id: 'daily-country-watch', label: 'Country Watch' }] : []),
    { id: 'daily-stats', label: 'Stats' },
  ];

  return (
    <div className="thread-page">
      <div className="thread-page-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/" className="thread-page-back">\u2190 Home</Link>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to={`/daily/${prevDateKey(dateKey)}`} className="daily-nav-btn">\u2190</Link>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{brief.displayDate}</span>
            {!isToday && <Link to={`/daily/${nextDateKey(dateKey)}`} className="daily-nav-btn">\u2192</Link>}
            {!isToday && <Link to="/daily" style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}>Today</Link>}
          </div>
        </div>
      </div>
      <div className="page-with-sidenav">
        <div className="page-main-content">
          <div className="thread-page-body">

            <div id="daily-headline">
              <h1 className="thread-page-title">{brief.headline}</h1>
              <div className="cp-subtitle">
                Daily Intelligence Brief \u2014 {brief.displayDate}
                {brief.generatedAt && <> \u00B7 Updated {formatTimeAgo(brief.generatedAt)}</>}
              </div>

              <div className="cp-metrics" style={{ marginTop: 12 }}>
                <div className="cp-metric">
                  <span className="cp-metric-value">{brief.stats?.totalArticles || 0}</span>
                  <span className="cp-metric-label">articles</span>
                </div>
                <div className="cp-metric">
                  <span className="cp-metric-value">{brief.stats?.sourceOutlets || 0}</span>
                  <span className="cp-metric-label">sources</span>
                </div>
                <div className="cp-metric">
                  <span className="cp-metric-value">{brief.stats?.countriesCovered || 0}</span>
                  <span className="cp-metric-label">countries</span>
                </div>
                <div className="cp-metric">
                  <span className="cp-metric-value">{Object.keys(brief.categoryBreakdown || {}).length}</span>
                  <span className="cp-metric-label">categories</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, marginBottom: 16 }}>
                <ShareButtons path={`/daily/${dateKey}`} title={`Daily Intelligence Brief \u2014 ${brief.displayDate}`} />
                <CopyBriefing getText={() => formatDailyBrief(brief)} />
              </div>
            </div>

            {brief.summary && (
              <div id="daily-overview" className="cp-bluf" style={{ marginBottom: 20 }}>
                <div className="cp-section-label">GLOBAL OVERVIEW</div>
                <div className="cp-bluf-text" style={{ lineHeight: 1.7 }}>
                  <BoldText text={brief.summary} />
                </div>
              </div>
            )}

            {brief.topStories?.length > 0 && (
              <div id="daily-top-stories" style={{ marginBottom: 20 }}>
                <div className="cp-section-label">TOP STORIES ({brief.topStories.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {brief.topStories.map((story, i) => {
                    const catColors = CATEGORY_BADGE_COLORS[(story.category || '').toLowerCase()];
                    return (
                      <div key={i} style={{ padding: '12px 16px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                          {catColors && (
                            <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color }}>{story.category}</span>
                          )}
                          {(story.regions || []).slice(0, 3).map((r, j) => (
                            <Link key={j} to={`/weekly/country/${encodeURIComponent(r)}`} className="thread-region-link" style={{ fontSize: '0.75rem' }}>{r}</Link>
                          ))}
                          {story.sourceCount > 0 && (
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{story.sourceCount} sources</span>
                          )}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{story.title}</div>
                        {story.prediction && (
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                            \u2192 {story.prediction}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {brief.risingThread?.title && (
              <div id="daily-rising-thread" style={{ marginBottom: 20 }}>
                <div className="cp-section-label">RISING THREAD</div>
                <Link
                  to={brief.risingThread.threadId ? `/weekly/thread/${brief.risingThread.threadId}` : '/weekly'}
                  style={{ display: 'block', padding: '14px 16px', border: '1px solid #fbbf24', borderRadius: 10, background: '#fefce8', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span className="story-arc-label">Story Arc</span>
                    {risingTrajectory && (
                      <span style={{ fontSize: '0.8rem', color: risingTrajectory.color, fontWeight: 600 }}>
                        {risingTrajectory.arrow} {risingTrajectory.label}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#92400e' }}>
                      {brief.risingThread.articleCount || '?'} articles \u00B7 {brief.risingThread.dayCount || '?'} days
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{brief.risingThread.title}</div>
                  {brief.risingThread.oneLiner && (
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{brief.risingThread.oneLiner}</div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: 6 }}>Read full arc \u2192</div>
                </Link>
              </div>
            )}

            {brief.countryToWatch?.countryName && (
              <div id="daily-country-watch" style={{ marginBottom: 20 }}>
                <div className="cp-section-label">COUNTRY TO WATCH</div>
                <Link
                  to={`/weekly/country/${encodeURIComponent(brief.countryToWatch.countryName)}`}
                  style={{ display: 'block', padding: '14px 16px', border: `1px solid ${risk?.color || '#e5e7eb'}`, borderRadius: 10, textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700 }}>{brief.countryToWatch.countryName}</span>
                    {risk && (
                      <span className="country-risk-badge" style={{ background: risk.bg, color: risk.color }}>
                        {brief.countryToWatch.riskLevel}
                      </span>
                    )}
                    {trajectory && (
                      <span style={{ fontSize: '0.8rem', color: trajectory.color, fontWeight: 600 }}>
                        {trajectory.arrow} {trajectory.label}
                      </span>
                    )}
                  </div>
                  {brief.countryToWatch.headline && (
                    <div style={{ fontSize: '0.9rem', color: '#374151' }}>{brief.countryToWatch.headline}</div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: 6 }}>View full briefing \u2192</div>
                </Link>
              </div>
            )}

            {brief.categoryBreakdown && Object.keys(brief.categoryBreakdown).length > 0 && (
              <div id="daily-stats" style={{ marginBottom: 20 }}>
                <div className="cp-section-label">CATEGORY BREAKDOWN</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(brief.categoryBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const c = CATEGORY_BADGE_COLORS[cat];
                      return (
                        <span key={cat} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 12px', borderRadius: 8,
                          border: '1px solid var(--border-color, #e5e7eb)',
                          fontSize: '0.85rem',
                        }}>
                          {c && <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block' }} />}
                          {cat} <strong>{count}</strong>
                        </span>
                      );
                    })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border-color, #e5e7eb)', marginTop: 16 }}>
              <Link to={`/daily/${prevDateKey(dateKey)}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.9rem' }}>\u2190 Previous day</Link>
              <Link to="/weekly" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.85rem' }}>Weekly Analysis \u2192</Link>
              {!isToday
                ? <Link to={`/daily/${nextDateKey(dateKey)}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.9rem' }}>Next day \u2192</Link>
                : <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Latest</span>
              }
            </div>
          </div>
        </div>
        <SideNav sections={sections} />
      </div>
    </div>
  );
}
