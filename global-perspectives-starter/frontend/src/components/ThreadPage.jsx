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
import CopyBriefing, { formatThreadBriefing } from './CopyBriefing';
import TrialBanner from './TrialBanner';
import { SaveButton } from './SaveButton';
import { useUserProfile } from '../hooks/useUserProfile';
import './ThreadPage.css';

function humanizeThreadId(id) {
  return (id || '')
    .replace(/^thread-/, '')
    .replace(/-[a-f0-9]{4,}$/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Story Arc';
}

function formatTimeAgo(isoString) {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDateRange(from, to) {
  if (!from) return '';
  const a = formatDateLabel(from);
  if (!to || from === to) return a;
  return `${a} — ${formatDateLabel(to)}`;
}

const AI_TABS = [
  { key: 'storyArc',        label: 'How It Evolved', hint: 'narrative arc across all days' },
  { key: 'trajectory',      label: "What's Next",     hint: 'where this story is heading' },
  { key: 'rootCauseChain',  label: 'Why It Happened', hint: 'root causes & contributing factors' },
];

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

  const availableTabs = AI_TABS.filter(t => analysis?.[t.key]);
  const [aiTab, setAiTab] = useState(null);
  useEffect(() => {
    if (availableTabs.length > 0 && !aiTab) setAiTab(availableTabs[0].key);
  }, [availableTabs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayTitle = analysis?.threadTitle || thread?.latestTitle || humanizeThreadId(threadId);
  useEffect(() => {
    document.title = `${displayTitle} — Story Arc | Global Perspectives`;
  }, [displayTitle]);

  if (authLoading) return null;
  if (loading) return <IntelligenceLoader type="typewriter" />;

  if (!thread) {
    return (
      <div className="tp-page" style={{ paddingTop: 60, textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, marginBottom: 12 }}>Story arc not found</h3>
        <p style={{ color: 'var(--ink-mid)', marginBottom: 24 }}>This thread may have expired or the link may be incorrect.</p>
        <Link to="/weekly" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>← Back to Threads</Link>
      </div>
    );
  }

  const hasWatchQuestions = analysis?.watchQuestions?.length > 0;
  const activeTabData = availableTabs.find(t => t.key === aiTab);
  const activeTabContent = analysis?.[aiTab];

  return (
    <div className="tp-page">

      {/* Topbar breadcrumbs */}
      <div className="tp-topbar">
        <Link to="/">Home</Link>
        <span className="tp-topbar-sep">/</span>
        {fromCountry ? (
          <>
            <Link to={`/weekly/country/${encodeURIComponent(fromCountry)}`}>{fromCountry}</Link>
            <span className="tp-topbar-sep">/</span>
          </>
        ) : (
          <>
            <Link to="/weekly">Threads</Link>
            <span className="tp-topbar-sep">/</span>
          </>
        )}
        <span className="tp-topbar-current">{displayTitle.length > 48 ? displayTitle.slice(0, 48) + '…' : displayTitle}</span>
        <div className="tp-topbar-right">
          <ShareButtons threadId={thread.threadId} title={displayTitle} preview={{ t: displayTitle, n: thread.articleCount, d: thread.dayCount, r: thread.regions, c: category }} />
          <CopyBriefing getText={() => formatThreadBriefing(thread, analysis)} />
          <SaveButton itemType="thread" itemId={threadId} metadata={{ title: displayTitle, category }} />
        </div>
      </div>

      {profile?.isTrial && <TrialBanner daysLeft={profile.trialDaysLeft} />}

      {/* Thread header */}
      <div className="tp-hd">
        <div className="tp-hd-kicker">
          {catColors && (
            <span className="tp-cat-badge" style={{ background: catColors.bg, color: catColors.color }}>
              {category}
            </span>
          )}
          {thread?.entries[0]?.urgency === 'high' && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#fff', background: 'var(--risk-h)', padding: '1px 6px', borderRadius: 3 }}>BREAKING</span>
          )}
          Story Arc
        </div>
        <h1 className="tp-hd-h1">{displayTitle}</h1>
        {analysis?.storyArc && (
          <p className="tp-hd-dek">
            {analysis.storyArc.split(/[.!?]/)[0].trim()}.
          </p>
        )}
        <div className="tp-hd-meta">
          <span>{formatDateRange(thread.dateRange.from, thread.dateRange.to)}</span>
          {analysis?.generatedAt && <span>Updated <b>{formatTimeAgo(analysis.generatedAt)}</b></span>}
          {category && <span>Category <b>{thread.entries[0]?.category}</b></span>}
          {thread.regions.length > 0 && <span>Regions <b>{thread.regions.length}</b></span>}
        </div>
      </div>

      {/* Stats row */}
      <div className="tp-stats">
        <div className="tp-stat">
          <div className="tp-stat-k">Articles</div>
          <div className="tp-stat-v">{thread.articleCount}</div>
          <div className="tp-stat-d">across this arc</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-k">Days tracked</div>
          <div className="tp-stat-v">{thread.dayCount}</div>
          <div className="tp-stat-d">{formatDateRange(thread.dateRange.from, thread.dateRange.to)}</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-k">Regions</div>
          <div className="tp-stat-v">{thread.regions.length}</div>
          <div className="tp-stat-d">countries involved</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-k">Sources</div>
          <div className="tp-stat-v">{thread.sources.length}</div>
          <div className="tp-stat-d">outlets cited</div>
        </div>
      </div>

      {/* Region chips */}
      {thread.regions.length > 0 && (
        <div className="tp-regions">
          {thread.regions.slice(0, 8).map(r => (
            <Link key={r} to={`/weekly/country/${encodeURIComponent(r)}`} className="tp-region-chip">{r}</Link>
          ))}
          {thread.regions.length > 8 && (
            <span className="tp-region-chip" style={{ cursor: 'default' }}>+{thread.regions.length - 8} more</span>
          )}
        </div>
      )}

      {/* Body: main + AI rail */}
      <div className="tp-body">

        {/* Main content column */}
        <div className="tp-main">

          {/* Watch questions */}
          {hasWatchQuestions && (
            <>
              <div className="tp-section-lbl">
                Questions to Watch
                <span className="count">{analysis.watchQuestions.length}</span>
              </div>
              <div className="tp-watch">
                {analysis.watchQuestions.map((q, i) => (
                  <div key={i} className="tp-watch-item">{q}</div>
                ))}
              </div>
            </>
          )}

          {/* Live web evidence */}
          {analysis?.groundingSources?.length > 0 && (
            <>
              <div className="tp-section-lbl">
                Live Web Evidence
                <span className="count">{analysis.groundingSources.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {analysis.groundingSources.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, lineHeight: 1.5, padding: '8px 10px', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{s.title}</div>
                    {s.snippet && <div style={{ color: 'var(--ink-dim)', fontSize: 12 }}>{s.snippet}</div>}
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#999', marginTop: 4 }}>
                      {s.source}{s.age ? ` · ${s.age}` : ''}{s.type === 'web' ? ' · background' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Timeline */}
          <div className="tp-section-lbl">
            Story Timeline
            <span className="count">{thread.entries.length} entries</span>
          </div>

          {analysis && thread.dayCount > 1 ? (
            <CompactTimeline
              entries={thread.entries}
              entryShortTitles={analysis.entryShortTitles}
              dotColor={catColors?.color}
            />
          ) : thread.dayCount > 1 ? (
            <div className="tp-tl">
              {thread.entries.map((entry, i) => (
                <div key={entry.topicId || i} className="tp-tl-row">
                  <div className="tp-tl-date">{formatDateLabel(entry.date)}</div>
                  <div className="tp-tl-rail">
                    <div className={`tp-tl-node${i === 0 ? ' inflect' : ''}`} />
                  </div>
                  <div className="tp-tl-body">
                    <div className="tp-tl-hl">{entry.title}</div>
                    {entry.context && <div className="tp-tl-dek">{entry.context}</div>}
                    {entry.sources?.length > 0 && (
                      <div className="tp-tl-srcs">
                        {entry.sources.slice(0, 3).map((s, j) => (
                          <span key={j}>
                            <b>{s.source || 'Source'}</b>
                            {s.tier === 'secondary' && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#999', marginLeft: 3 }}>bg</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StoryEntryCard entry={thread.entries[0]} />
          )}

          {/* Map */}
          {thread.regions.length > 0 && (
            <>
              <div className="tp-section-lbl">Geographic Spread</div>
              <div className="tp-map-wrap">
                <WeeklyMap embedded defaultThread={thread.threadId} hidePanel />
              </div>
            </>
          )}
        </div>

        {/* Right AI rail */}
        {availableTabs.length > 0 && (
          <aside className="tp-ai">
            <div className="tp-ai-hd">
              <div className="tp-ai-hd-label">
                <span className="tp-ai-dot" />
                Arc Intelligence
              </div>
              <span className="tp-ai-model">Grok · xAI</span>
            </div>

            <div className="tp-ai-tabs">
              {availableTabs.map(tab => (
                <button
                  key={tab.key}
                  className={`tp-ai-tab${aiTab === tab.key ? ' on' : ''}`}
                  onClick={() => setAiTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="tp-ai-body">
              {activeTabContent ? (
                <>
                  {activeTabData && (
                    <div className="tp-ai-section-lbl">{activeTabData.hint}</div>
                  )}
                  <p className="tp-ai-text">{activeTabContent}</p>
                </>
              ) : (
                <div className="tp-ai-empty">No analysis available</div>
              )}
            </div>

            <div className="tp-ai-foot">
              <span>AI-generated · analyst context</span>
              {analysis?.generatedAt && <span>{formatTimeAgo(analysis.generatedAt)}</span>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
