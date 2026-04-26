import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import IntelligenceLoader from './IntelligenceLoader';
import ShareButtons from './ShareButtons';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { formatDateLabel } from '../utils/dateUtils';
import CompactTimeline from './CompactTimeline';
import { CATEGORY_BADGE_COLORS } from './WeeklyPage';
import CopyBriefing, { formatThreadBriefing } from './CopyBriefing';
import TrialBanner from './TrialBanner';
import { SaveButton } from './SaveButton';
import { useUserProfile } from '../hooks/useUserProfile';
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
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

const RISK_COLOR = (score) => {
  if (score == null) return 'var(--ink)';
  if (score >= 75) return 'var(--risk-h)';
  if (score >= 50) return 'var(--risk-e)';
  return 'var(--risk-l)';
};

export default function ThreadPage() {
  const { threadId } = useParams();
  const [searchParams] = useSearchParams();
  const fromCountry = searchParams.get('from') === 'country' ? searchParams.get('country') : null;
  const { loading: authLoading } = useAuth();
  const { profile } = useUserProfile();
  const { dayMap, sortedDates, loading } = useWeeklyArchive();
  const [contentTab, setContentTab] = useState('timeline');
  const [aiTab, setAiTab] = useState('summary');

  const thread = useMemo(() => {
    if (!dayMap || loading) return null;
    const entries = [];
    const allRegions = new Set();
    const primarySources = new Set();
    const secondarySources = new Set();
    for (const date of sortedDates) {
      for (const entry of (dayMap[date]?.entries || [])) {
        if (entry.threadId === threadId) {
          entries.push({ ...entry, date });
          for (const r of (entry.regions || [])) allRegions.add(r);
          for (const s of (entry.sources || [])) {
            const name = s.source || s.title || 'Source';
            if (s.tier === 'secondary') secondarySources.add(name);
            else primarySources.add(name);
          }
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
      primarySources: [...primarySources],
      secondarySources: [...secondarySources],
      allSources: [...new Set([...primarySources, ...secondarySources])],
      dateRange: { from: dates[0], to: dates[dates.length - 1] },
      dates,
      dayCount: dates.length,
    };
  }, [dayMap, sortedDates, threadId, loading]);

  const { analyses } = useThreadAnalyses(thread ? [threadId] : []);
  const analysis = analyses?.[threadId];
  const category = thread?.entries[0]?.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];

  // Related threads: same category + same region
  const relatedThreads = useMemo(() => {
    if (!dayMap || !thread) return { sameCategory: [], sameRegion: [] };
    const threadMap = {};
    for (const date of sortedDates) {
      for (const e of (dayMap[date]?.entries || [])) {
        if (!e.threadId || e.threadId === threadId) continue;
        if (!threadMap[e.threadId]) {
          threadMap[e.threadId] = {
            threadId: e.threadId,
            title: e.title,
            category: (e.category || 'other').toLowerCase(),
            regions: new Set(),
            count: 0,
          };
        }
        threadMap[e.threadId].count++;
        for (const r of (e.regions || [])) threadMap[e.threadId].regions.add(r);
      }
    }
    const all = Object.values(threadMap).filter(t => t.count >= 2);
    const sameCategory = all
      .filter(t => t.category === category)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const threadRegionSet = new Set(thread.regions);
    const sameRegion = all
      .filter(t => t.category !== category && [...t.regions].some(r => threadRegionSet.has(r)))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    return { sameCategory, sameRegion };
  }, [dayMap, sortedDates, threadId, category, thread]);

  // Source rollup for Sources tab
  const sourceRollup = useMemo(() => {
    if (!thread) return [];
    const map = {};
    for (const entry of thread.entries) {
      for (const s of (entry.sources || [])) {
        const name = s.source || s.title || 'Source';
        if (!map[name]) map[name] = { name, count: 0, tier: s.tier || 'secondary', latest: entry.date };
        map[name].count++;
        if (entry.date > map[name].latest) map[name].latest = entry.date;
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [thread]);

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

  const inflectionEntry = analysis?.inflectionTopicId
    ? thread.entries.find(e => e.topicId === analysis.inflectionTopicId)
    : null;

  // Status strip
  const statusStats = [
    analysis?.riskScore != null && { value: analysis.riskScore, unit: 'risk' },
    { value: thread.entries.length, unit: 'events' },
    { value: thread.allSources.length, unit: 'sources' },
    thread.regions.length > 0 && { value: thread.regions.slice(0, 3).join(' · '), unit: '' },
  ].filter(Boolean);

  const inflectionLabel = inflectionEntry
    ? `⚑ INFLECTION · ${formatDateLabel(inflectionEntry.date).toUpperCase()}`
    : null;

  // AI tabs
  const aiTabs = [
    analysis?.storyArc       && { key: 'summary',    label: 'Summary' },
    analysis?.trajectory     && { key: 'trajectory', label: "What's Next" },
    analysis?.rootCauseChain && { key: 'trace',      label: 'Trace Cause' },
    analysis?.watchQuestions?.length && { key: 'watch', label: 'Watch' },
  ].filter(Boolean);

  const aiContent = {
    summary:    analysis?.storyArc,
    trajectory: analysis?.trajectory,
    trace:      analysis?.rootCauseChain,
    watch:      null,
  };

  // Left rail
  const leftRail = (
    <div className="tp-left">
      <div className="tp-left-crumbs">
        <Link to="/weekly">Threads</Link>
        <span className="tp-crumb-sep">/</span>
        {category && <Link to={`/weekly?category=${category}`}>{category}</Link>}
        {category && <span className="tp-crumb-sep">/</span>}
        <span>{displayTitle.length > 20 ? displayTitle.slice(0, 20) + '…' : displayTitle}</span>
      </div>

      {relatedThreads.sameCategory.length > 0 && (
        <>
          <div className="tp-left-hd">Related threads</div>
          {relatedThreads.sameCategory.map(t => {
            const c = CATEGORY_BADGE_COLORS[t.category];
            return (
              <Link key={t.threadId} to={`/weekly/thread/${t.threadId}`} className="tp-related">
                <div className="tp-related-kicker" style={{ color: c?.color || 'var(--ink-dim)' }}>
                  {[...t.regions].slice(0, 2).join(' · ')} · {t.category?.toUpperCase()}
                </div>
                <div className="tp-related-title">{t.title.length > 65 ? t.title.slice(0, 65) + '…' : t.title}</div>
                <div className="tp-related-meta">{t.count} articles</div>
              </Link>
            );
          })}
        </>
      )}

      {relatedThreads.sameRegion.length > 0 && (
        <>
          <div className="tp-left-hd" style={{ marginTop: 20 }}>Watching · region</div>
          {relatedThreads.sameRegion.map(t => (
            <Link key={t.threadId} to={`/weekly/thread/${t.threadId}`} className="tp-related">
              <div className="tp-related-kicker">
                {[...t.regions].slice(0, 2).join(' · ')} · {t.category?.toUpperCase()}
              </div>
              <div className="tp-related-title">{t.title.length > 65 ? t.title.slice(0, 65) + '…' : t.title}</div>
              <div className="tp-related-meta">{t.count} articles</div>
            </Link>
          ))}
        </>
      )}
    </div>
  );

  // Right AI rail
  const rightRail = aiTabs.length > 0 && (
    <div className="tp-ai-rail">
      <div className="tp-ai-hd">
        <div className="tp-ai-hd-label"><span className="tp-ai-dot" />Arc Intelligence</div>
        <span className="tp-ai-model">Grok · xAI</span>
      </div>
      <div className="tp-ai-tabs">
        {aiTabs.map(tab => (
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
        {aiTab === 'watch' ? (
          analysis?.watchQuestions?.length > 0 ? (
            <ul className="tp-watch-list">
              {analysis.watchQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ) : null
        ) : aiContent[aiTab] ? (
          <p className="tp-ai-text">{aiContent[aiTab]}</p>
        ) : (
          <div className="tp-ai-empty">No analysis available</div>
        )}

        {/* Key actors */}
        {analysis?.keyActors?.length > 0 && (
          <div className="tp-ai-actors">
            <div className="tp-ai-section-lbl">Key Actors</div>
            {analysis.keyActors.map((a, i) => (
              <div key={i} className="tp-actor-row">
                <div className="tp-actor-av">{(a.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div className="tp-actor-body">
                  <div className="tp-actor-name">{a.name}</div>
                  <div className="tp-actor-role">{a.role}</div>
                </div>
                <div className="tp-actor-count">{a.mentionCount}</div>
              </div>
            ))}
          </div>
        )}

        {/* Grounding sources */}
        {analysis?.groundingSources?.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="tp-ai-section-lbl">Live Web Evidence</div>
            {analysis.groundingSources.slice(0, 3).map((s, i) => (
              <div key={i} className="tp-grounding-card">
                <div className="tp-grounding-title">{s.title}</div>
                {s.snippet && <div className="tp-grounding-snippet">{s.snippet.slice(0, 120)}{s.snippet.length > 120 ? '…' : ''}</div>}
                <div className="tp-grounding-meta">{s.source}{s.age ? ` · ${s.age}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="tp-ai-foot">
        <span>AI-generated · analyst context</span>
        {analysis?.generatedAt && <span>{formatTimeAgo(analysis.generatedAt)}</span>}
      </div>
    </div>
  );

  // Content tabs: Timeline | Actors | Sources
  const contentTabs = [
    { key: 'timeline', label: 'Timeline', count: thread.entries.length },
    analysis?.keyActors?.length > 0 && { key: 'actors', label: 'Actors', count: analysis.keyActors.length },
    sourceRollup.length > 0 && { key: 'sources', label: 'Sources', count: sourceRollup.length },
  ].filter(Boolean);

  return (
    <div className="tp-page">

      {/* Topbar */}
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

      <EditorialShell
        strip={
          <StatusStrip
            label={inflectionLabel ? '⚑ INFLECTION' : 'LIVE'}
            stats={statusStats}
            updatedAt={analysis?.generatedAt}
          />
        }
        left={leftRail}
        right={rightRail}
      >
        {/* Thread header */}
        <div className="tp-hd">
          <div className="tp-hd-kicker">
            {catColors && (
              <span className="tp-cat-badge" style={{ background: catColors.bg, color: catColors.color }}>
                {category}
              </span>
            )}
            {thread?.entries[0]?.urgency === 'high' && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#fff', background: 'var(--risk-h)', padding: '1px 6px', borderRadius: 3 }}>URGENT</span>
            )}
            Story Arc · {thread.dayCount} days
          </div>
          <h1 className="tp-hd-h1">{displayTitle}</h1>
          {analysis?.storyArc && (
            <p className="tp-hd-dek">
              {analysis.storyArc.split(/[.!?]/)[0].trim()}.
            </p>
          )}
          <div className="tp-hd-meta">
            <span>{formatDateRange(thread.dateRange.from, thread.dateRange.to)}</span>
            {category && <span>Category <b>{thread.entries[0]?.category}</b></span>}
            {thread.regions.length > 0 && <span>Countries <b>{thread.regions.slice(0, 3).join(', ')}{thread.regions.length > 3 ? ` +${thread.regions.length - 3}` : ''}</b></span>}
            {analysis?.riskScore != null && (
              <span style={{ color: RISK_COLOR(analysis.riskScore) }}>
                Risk <b>{analysis.riskScore}/100</b>
              </span>
            )}
            {analysis?.sentiment != null && (
              <span>Sentiment <b>{analysis.sentiment > 0 ? '+' : ''}{analysis.sentiment.toFixed(1)}</b></span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="tp-stats">
          <div className="tp-stat">
            <div className="tp-stat-k">Thread Risk</div>
            <div className="tp-stat-v" style={{ color: RISK_COLOR(analysis?.riskScore) }}>
              {analysis?.riskScore != null ? analysis.riskScore : '—'}
            </div>
            <div className="tp-stat-d">/100</div>
          </div>
          <div className="tp-stat">
            <div className="tp-stat-k">Events</div>
            <div className="tp-stat-v">{thread.entries.length}</div>
            <div className="tp-stat-d">{inflectionEntry ? '1 inflection' : 'no inflection'}</div>
          </div>
          <div className="tp-stat">
            <div className="tp-stat-k">Sources</div>
            <div className="tp-stat-v">{thread.allSources.length}</div>
            <div className="tp-stat-d">{thread.primarySources.length} primary</div>
          </div>
          <div className="tp-stat">
            <div className="tp-stat-k">Sentiment</div>
            <div className="tp-stat-v" style={{ color: analysis?.sentiment != null && analysis.sentiment < -0.3 ? 'var(--risk-h)' : 'var(--ink)' }}>
              {analysis?.sentiment != null ? (analysis.sentiment > 0 ? '+' : '') + analysis.sentiment.toFixed(1) : '—'}
            </div>
            <div className="tp-stat-d">−1 to +1</div>
          </div>
        </div>

        {/* Content tabs */}
        <div className="tp-content-tabs">
          {contentTabs.map(tab => (
            <button
              key={tab.key}
              className={`tp-content-tab${contentTab === tab.key ? ' on' : ''}`}
              onClick={() => setContentTab(tab.key)}
            >
              {tab.label}
              <span className="tp-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Timeline tab */}
        {contentTab === 'timeline' && (
          analysis && thread.dayCount > 1 ? (
            <CompactTimeline
              entries={thread.entries}
              entryShortTitles={analysis.entryShortTitles}
              dotColor={catColors?.color}
              inflectionTopicId={analysis.inflectionTopicId}
            />
          ) : thread.dayCount > 1 ? (
            <div className="tp-tl">
              {thread.entries.map((entry, i) => (
                <div key={entry.topicId || i} className={`tp-tl-row${entry.topicId === analysis?.inflectionTopicId ? ' inflect' : ''}`}>
                  <div className="tp-tl-date">{formatDateLabel(entry.date)}</div>
                  <div className="tp-tl-rail">
                    <div className={`tp-tl-node${entry.topicId === analysis?.inflectionTopicId ? ' inflect' : ''}`} />
                  </div>
                  <div className="tp-tl-body">
                    <div className="tp-tl-hl">{entry.title}</div>
                    {entry.sources?.length > 0 && (
                      <div className="tp-tl-srcs">
                        {entry.sources.slice(0, 3).map((s, j) => (
                          <span key={j}>
                            <b>{s.source || 'Source'}</b>
                            {s.tier === 'secondary' && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#999', marginLeft: 3 }}>secondary</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null
        )}

        {/* Actors tab */}
        {contentTab === 'actors' && analysis?.keyActors?.length > 0 && (
          <div className="tp-actors-list">
            {analysis.keyActors.map((a, i) => (
              <div key={i} className="tp-actor-card">
                <div className="tp-actor-av">{(a.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div className="tp-actor-body">
                  <div className="tp-actor-name">{a.name}</div>
                  <div className="tp-actor-role">{a.role}</div>
                </div>
                <div className="tp-actor-count">
                  <b>{a.mentionCount}</b>
                  <span>mentions</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sources tab */}
        {contentTab === 'sources' && (
          <div className="tp-sources-list">
            <div className="tp-sources-hd">
              {sourceRollup.length} outlets · {thread.primarySources.length} primary · {thread.secondarySources.length} secondary
            </div>
            {sourceRollup.map((s, i) => (
              <div key={i} className="tp-source-row">
                <div className="tp-source-name">{s.name}</div>
                <div className="tp-source-count">{s.count} item{s.count !== 1 ? 's' : ''}</div>
                <div className={`tp-source-tier${s.tier === 'secondary' ? ' sec' : ''}`}>
                  {s.tier === 'secondary' ? 'Secondary' : 'Primary'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Watch questions (below timeline if no AI rail) */}
        {aiTabs.length === 0 && analysis?.watchQuestions?.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="tp-section-lbl">Questions to Watch</div>
            <ul className="tp-watch-list">
              {analysis.watchQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}
      </EditorialShell>
    </div>
  );
}
