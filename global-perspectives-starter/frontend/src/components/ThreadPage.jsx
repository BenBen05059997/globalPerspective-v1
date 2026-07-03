import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { threadPath } from '../utils/threadPath';
import IntelligenceLoader from './IntelligenceLoader';
import ShareButtons from './ShareButtons';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useNarrativeThread } from '../hooks/useNarrativeThread';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { formatDateLabel } from '../utils/dateUtils';
import CompactTimeline from './CompactTimeline';
import { CATEGORY_BADGE_COLORS, riskScoreToVar as RISK_COLOR } from '../tokens';
import { tierFromScore, tierLabel } from '../utils/riskTiers';
import CopyBriefing, { formatThreadBriefing } from './CopyBriefing';
import { SaveButton } from './SaveButton';
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
import SourceRobustness from './atoms/SourceRobustness';
import MechanismCard from './atoms/MechanismCard';
import { useEconomicImpact } from '../hooks/useEconomicImpact';
import './ThreadPage.css';

function humanizeThreadId(id) {
  return (id || '')
    .replace(/^thread-/, '')
    .replace(/-[a-f0-9]{4,}$/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Story Arc';
}

// Living-analysis drift note helpers (Phase 3): tidy the "event [n]" artifact + format the date.
const DRIFT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function driftDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${DRIFT_MONTHS[+m[2] - 1]} ${+m[3]}` : s;
}
function driftClean(s) {
  return String(s || '').replace(/\bevent\s*\[\d+\]/gi, 'the cited event').replace(/\s*\[\d+\]/g, '').trim();
}

// Collapsible block for the Arc-Intelligence rail (progressive disclosure — the synthesis
// column was a wall of text; secondary sections now collapse). Self-contained state.
function RailBlock({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`tp-ai-block${open ? '' : ' collapsed'}`}>
      <button type="button" className="tp-ai-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="tp-ai-section-lbl">{label}</span>
        <span className={`tp-ai-chev${open ? ' open' : ''}`} aria-hidden="true">▾</span>
      </button>
      {open && <div className="tp-ai-block-body">{children}</div>}
    </div>
  );
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


export default function ThreadPage() {
  const { threadId } = useParams();
  const [searchParams] = useSearchParams();
  const fromCountry = searchParams.get('from') === 'country' ? searchParams.get('country') : null;
  const { loading: authLoading } = useAuth();
  // Source of truth: durable by-ID timeline (90-day server-side reconstruction),
  // so deep-links resolve long after a story's articles age out of the 30-day
  // rolling archive. The weekly archive (below) is used only for the
  // related-threads sidebar — it's a best-effort enhancement, not load-bearing.
  const { entries: narrativeEntries, loading: threadLoading } = useNarrativeThread(threadId);
  const { dayMap, sortedDates } = useWeeklyArchive();
  // Honor deep-linked tabs (threadPath's ?tab= contract — e.g. ?tab=economy from
  // disruption links on Economy/Daily/Country/Map). Unknown values → timeline.
  const requestedTab = searchParams.get('tab');
  const [contentTab, setContentTab] = useState(() =>
    ['timeline', 'actors', 'sources', 'economy'].includes(requestedTab) ? requestedTab : 'timeline');

  const thread = useMemo(() => {
    if (!narrativeEntries || !narrativeEntries.length) return null;
    // Newest-first, matching the prior archive-derived ordering (entries[0] = latest).
    const entries = [...narrativeEntries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const allRegions = new Set();
    const primarySources = new Set();
    const secondarySources = new Set();
    for (const entry of entries) {
      for (const r of (entry.regions || [])) allRegions.add(r);
      for (const s of (entry.sources || [])) {
        const name = s.source || s.title || 'Source';
        if (s.tier === 'secondary') secondarySources.add(name);
        else primarySources.add(name);
      }
    }
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
  }, [narrativeEntries, threadId]);

  const { analyses, loading: analysisLoading } = useThreadAnalyses([threadId]);
  const analysis = analyses?.[threadId];
  const { data: economicImpact, loading: economicLoading } = useEconomicImpact(threadId);
  const hasEconomy = economicImpact && economicImpact.hasImpact !== false;
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

  // Deep-linked tabs depend on async data (economy/actors/sources only exist for
  // some threads). Once the relevant fetch settles, fall back to the timeline if
  // the requested tab never materialized — never an empty content area.
  useEffect(() => {
    if (contentTab === 'economy' && !economicLoading && !hasEconomy) setContentTab('timeline');
    if (contentTab === 'actors' && !analysisLoading && !(analysis?.keyActors?.length > 0)) setContentTab('timeline');
    if (contentTab === 'sources' && !threadLoading && sourceRollup.length === 0) setContentTab('timeline');
  }, [contentTab, economicLoading, hasEconomy, analysisLoading, analysis, threadLoading, sourceRollup]);

  const displayTitle = analysis?.threadTitle || thread?.latestTitle || humanizeThreadId(threadId);
  useEffect(() => {
    document.title = `${displayTitle} — Story Arc | Global Perspectives`;
  }, [displayTitle]);

  if (authLoading) return null;
  if (threadLoading) return <IntelligenceLoader type="typewriter" />;

  if (!thread) {
    // Beyond the 90-day durable window the timeline can't be rebuilt. Wait for the
    // analysis + economic records before deciding, so we never flash a dead-end
    // while those by-ID fetches are still in flight.
    if (analysisLoading || economicLoading) return <IntelligenceLoader type="typewriter" />;
    // We may still hold the analysis and/or economic-impact record (keyed by the
    // same threadId). Show a focused fallback instead of a dead end.
    const fallbackEconomy = economicImpact && economicImpact.hasImpact !== false;
    if (analysis || fallbackEconomy) {
      const fallbackTitle = analysis?.threadTitle || economicImpact?.headline || humanizeThreadId(threadId);
      return (
        <div className="container" style={{ paddingTop: 48, paddingBottom: 60, maxWidth: 760 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.08em', marginBottom: 14 }}>
            <Link to="/economy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← Back to Economy</Link>
            <span style={{ margin: '0 10px', color: 'var(--line-2)' }}>·</span>
            <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← Home</Link>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 12px' }}>{fallbackTitle}</h1>
          <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.5, margin: '0 0 24px' }}>
            Full timeline isn&apos;t available for this story (it&apos;s aged out of the 90-day window),
            but here&apos;s the analysis we have.
          </p>

          {fallbackEconomy && (
            <div style={{ marginBottom: 24 }}>
              <MechanismCard impact={economicImpact} />
            </div>
          )}

          {analysis && (analysis.storyArc || analysis.trajectory) && (
            <div style={{ marginTop: 4 }}>
              {analysis.storyArc && (
                <>
                  <div className="tp-section-lbl" style={{ marginBottom: 8 }}>Story arc</div>
                  <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, margin: '0 0 20px' }}>{analysis.storyArc}</p>
                </>
              )}
              {analysis.trajectory && (
                <>
                  <div className="tp-section-lbl" style={{ marginBottom: 8 }}>What&apos;s next</div>
                  <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{analysis.trajectory}</p>
                </>
              )}
            </div>
          )}
        </div>
      );
    }
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
    analysis?.riskScore != null && { value: tierLabel(tierFromScore(analysis.riskScore)), unit: 'risk' },
    { value: thread.entries.length, unit: 'events' },
    { value: thread.allSources.length, unit: 'sources' },
    thread.regions.length > 0 && { value: thread.regions.slice(0, 3).join(' · '), unit: '' },
  ].filter(Boolean);

  const inflectionLabel = inflectionEntry
    ? `⚑ INFLECTION · ${formatDateLabel(inflectionEntry.date).toUpperCase()}`
    : null;

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
              <Link key={t.threadId} to={threadPath(t.threadId)} className="tp-related">
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
            <Link key={t.threadId} to={threadPath(t.threadId)} className="tp-related">
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

  // Right AI rail — a single stacked "Arc Intelligence" synthesis column.
  // No longer a competing tab widget: the AI narrative reads top-to-bottom here,
  // while the center tab bar (Timeline/Actors/Sources/Economy) owns the evidence —
  // so actors + economy live in the center, not duplicated in the rail.
  const hasAiRail = analysis && (
    analysis.storyArc || analysis.trajectory || analysis.rootCauseChain ||
    analysis.watchQuestions?.length || analysis.groundingSources?.length
  );
  const rightRail = hasAiRail && (
    <div className="tp-ai-rail">
      <div className="tp-ai-hd">
        <div className="tp-ai-hd-label"><span className="tp-ai-dot" />Arc Intelligence</div>
        <span className="tp-ai-model">AI analysis</span>
      </div>
      <div className="tp-ai-body">
        {analysis?.driftNote?.whyChanged && (
          <div className="tp-ai-block tp-ai-drift">
            <div className="tp-ai-section-lbl">
              What changed{analysis.driftNote.since ? ` · since ${driftDay(analysis.driftNote.since)}` : ''}
            </div>
            {analysis.driftNote.triggerEvent?.title && (
              <div className="tp-ai-drift-because">↳ Because: <b>{analysis.driftNote.triggerEvent.title}</b></div>
            )}
            <p className="tp-ai-text">{driftClean(analysis.driftNote.whyChanged)}</p>
          </div>
        )}
        {analysis?.storyArc && (
          <div className="tp-ai-block">
            <div className="tp-ai-section-lbl">Summary</div>
            <p className="tp-ai-text">{analysis.storyArc}</p>
          </div>
        )}
        {analysis?.trajectory && (
          <RailBlock label="What's Next" defaultOpen>
            <p className="tp-ai-text">{analysis.trajectory}</p>
          </RailBlock>
        )}
        {analysis?.rootCauseChain && (
          <RailBlock label="Trace Cause">
            <p className="tp-ai-text">{analysis.rootCauseChain}</p>
          </RailBlock>
        )}
        {analysis?.watchQuestions?.length > 0 && (
          <RailBlock label="Watch">
            <ul className="tp-watch-list">
              {analysis.watchQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </RailBlock>
        )}

        {/* Grounding sources */}
        {analysis?.groundingSources?.length > 0 && (
          <RailBlock label="Live Web Evidence">
            {analysis.groundingSources.slice(0, 3).map((s, i) => (
              <div key={i} className="tp-grounding-card">
                <div className="tp-grounding-title">{s.title}</div>
                {s.snippet && <div className="tp-grounding-snippet">{s.snippet.slice(0, 120)}{s.snippet.length > 120 ? '…' : ''}</div>}
                <div className="tp-grounding-meta">{s.source}{s.age ? ` · ${s.age}` : ''}</div>
              </div>
            ))}
          </RailBlock>
        )}
      </div>
      <div className="tp-ai-foot">
        <span>AI-generated · analyst context</span>
        {analysis?.generatedAt && <span>{formatTimeAgo(analysis.generatedAt)}</span>}
      </div>
    </div>
  );

  // Content tabs: Timeline | Actors | Sources | Economy
  const contentTabs = [
    { key: 'timeline', label: 'Timeline', count: thread.entries.length },
    analysis?.keyActors?.length > 0 && { key: 'actors', label: 'Actors', count: analysis.keyActors.length },
    sourceRollup.length > 0 && { key: 'sources', label: 'Sources', count: sourceRollup.length },
    hasEconomy && { key: 'economy', label: 'Economy', count: economicImpact.instruments?.length || 0, severity: economicImpact.severity },
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
            <SourceRobustness outlets={thread.allSources.length} regions={thread.regions?.length} size="md" />
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
              <span>
                Risk <b style={{ color: RISK_COLOR(analysis.riskScore) }}>{tierLabel(tierFromScore(analysis.riskScore))}</b>
                <span className="tp-hd-fine"> {analysis.riskScore}</span>
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
            <div className="tp-stat-v tier" style={{ color: RISK_COLOR(analysis?.riskScore) }}>
              {analysis?.riskScore != null ? tierLabel(tierFromScore(analysis.riskScore)) : '—'}
            </div>
            <div className="tp-stat-d">{analysis?.riskScore != null ? `${analysis.riskScore} / 100` : '/100'}</div>
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
        <div className="tp-content-tabs" role="tablist" aria-label="Thread evidence views">
          {contentTabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={contentTab === tab.key}
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

        {/* Economy tab */}
        {contentTab === 'economy' && hasEconomy && (
          <>
            <MechanismCard impact={economicImpact} />
            {/* Up-link to the weekly markets wrap — deep-link to this story's first instrument */}
            {(() => {
              const firstInstrument = economicImpact.instruments?.[0]?.instrumentId;
              const to = firstInstrument ? `/weekly-markets#${firstInstrument}` : '/weekly-markets';
              return (
                <Link
                  to={to}
                  style={{ display: 'inline-block', marginTop: 16, fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textDecoration: 'none', color: 'var(--accent)' }}
                >
                  This story moved markets this week →
                </Link>
              );
            })()}
          </>
        )}

        {/* Watch questions fallback — only when the AI rail isn't shown (e.g. thread
            has key actors but no narrative/grounding), so the watch list still lands. */}
        {!hasAiRail && analysis?.watchQuestions?.length > 0 && (
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
