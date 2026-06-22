import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';
import TraceCauseDisplay from './TraceCauseDisplay';
import TopicNav from './TopicNav';
import TodayArchiveSidebar from './TodayArchiveSidebar';
import { useTodayArchive } from '../hooks/useTodayArchive';
import contentService from '../utils/contentService';
import { categorizeTopicsByRegion } from '../utils/countryMapping';
import { useError } from '../contexts/ErrorContext';
import StatusStrip from './atoms/StatusStrip';
import EditorialShell from './atoms/EditorialShell';
import SeverityBadge from './atoms/SeverityBadge';
import SourceRobustness from './atoms/SourceRobustness';
import LedeBand from './atoms/LedeBand';
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import { composeTopicsLede } from '../utils/composeTopicsLede';
import './AIComponents.css';
import './Home.css';

// SVG icons
const SumIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 4h10M3 8h10M3 12h6"/>
  </svg>
);
const PreIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 13l4-4 3 3 5-6"/><path d="M11 6h3v3"/>
  </svg>
);
const TraIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="4" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/><path d="M5.5 8h5"/>
  </svg>
);

function getDayString() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ISO 3166-1 alpha-2 → flag emoji via regional indicator symbols.
function countryToFlag(cc) {
  if (!cc || cc.length !== 2) return '';
  const A = 0x1F1E6;
  const codePoints = cc.toUpperCase().split('').map(c => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

function getTopicId(t, idx) {
  const directId = t?.topicId || t?.topic_id || t?.id;
  if (directId != null) {
    const c = String(directId).trim();
    if (c.length > 0) return c;
  }
  return `${t.title || 'topic'}-${idx}`.replace(/[^a-zA-Z0-9]/g, '-');
}

function Home() {
  const { topics, loading, error, refetch, isStale, updatedAt, hasNewData } = useGeminiTopics();
  const { data: allDisruptions = [] } = useDisruptionsList({ limit: 100 });
  const disruptionByThread = React.useMemo(() => {
    const m = {};
    for (const d of allDisruptions) { if (d.scopeId) m[d.scopeId] = d; }
    return m;
  }, [allDisruptions]);
  const { entries: archiveEntries } = useTodayArchive();
  const { showError } = useError();

  const filteredArchiveEntries = React.useMemo(() => {
    if (!archiveEntries.length || !topics.length) return archiveEntries;
    const activeIds = new Set(topics.map((t) => {
      const id = t?.topicId || t?.topic_id || t?.id;
      return id != null ? String(id).trim() : '';
    }).filter(Boolean));
    return archiveEntries.filter(e => !activeIds.has(e.topicId));
  }, [archiveEntries, topics]);

  const categorizedTopics = React.useMemo(() => categorizeTopicsByRegion(topics), [topics]);

  const lede = React.useMemo(
    () => composeTopicsLede({ topics, disruptions: allDisruptions }),
    [topics, allDisruptions],
  );

  const sortedRegions = React.useMemo(() =>
    Object.entries(categorizedTopics)
      .filter(([, rt]) => rt.length > 0)
      .sort((a, b) => {
        if (a[0] === 'World') return 1;
        if (b[0] === 'World') return -1;
        return b[1].length - a[1].length;
      }),
  [categorizedTopics]);

  const [summaries, setSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [summaryErrors, setSummaryErrors] = useState({});
  const [summaryCollapsed, setSummaryCollapsed] = useState({});

  const [predictions, setPredictions] = useState({});
  const [predictionLoading, setPredictionLoading] = useState({});
  const [predictionErrors, setPredictionErrors] = useState({});
  const [predictionCollapsed, setPredictionCollapsed] = useState({});

  const [traceCauses, setTraceCauses] = useState({});
  const [traceCauseLoading, setTraceCauseLoading] = useState({});
  const [traceCauseErrors, setTraceCauseErrors] = useState({});
  const [traceCauseCollapsed, setTraceCauseCollapsed] = useState({});

  const [sourcesExpanded, setSourcesExpanded] = useState({});
  const [activeTimestamps, setActiveTimestamps] = useState({});

  const summaryAttemptsRef = useRef({});
  const predictionAttemptsRef = useRef({});

  const MAX_RETRIES = 6;
  const RETRY_DELAY_MS = 10000;

  useEffect(() => {
    if (error) showError(error);
  }, [error, showError]);

  useEffect(() => { document.title = 'Global Perspectives™ — AI-Powered News Intelligence'; }, []);

  // ── Summary ──────────────────────────────────────────────
  const scheduleSummaryRetry = (topic, idx, attempt) => {
    setTimeout(() => {
      summaryAttemptsRef.current[getTopicId(topic, idx)] = attempt;
      handleGenerateSummary(topic, idx, attempt);
    }, RETRY_DELAY_MS);
  };

  const handleGenerateSummary = async (t, idx, attempt = 0) => {
    const id = getTopicId(t, idx);
    setActiveTimestamps(prev => ({ ...prev, [`${id}_summary`]: Date.now() }));
    if (summaries[id]) { setSummaryCollapsed(prev => ({ ...prev, [id]: false })); return; }
    if (summaryLoading[id] && attempt === 0) return;
    summaryAttemptsRef.current[id] = attempt;
    setSummaryLoading(prev => ({ ...prev, [id]: true }));
    setSummaryErrors(prev => ({ ...prev, [id]: null }));
    const start = Date.now();
    try {
      const data = await contentService.getTopicSummary(id);
      const content = data?.content || '';
      setSummaries(prev => ({ ...prev, [id]: {
        content, service: 'cache',
        timestamp: data?.generatedAt || new Date().toISOString(),
        generationTime: Date.now() - start,
        wordCount: String(content).split(' ').length,
        metadata: { cached: data?.cached ?? true, remainingTtlSeconds: data?.remainingTtlSeconds ?? null },
      }}));
      setSummaryCollapsed(prev => ({ ...prev, [id]: false }));
      summaryAttemptsRef.current[id] = 0;
      setSummaryLoading(prev => ({ ...prev, [id]: false }));
    } catch (e) {
      const message = e?.message || String(e);
      const shouldRetry = /cache miss|failed to read summary|503/i.test(message);
      const nextAttempt = attempt + 1;
      if (shouldRetry && nextAttempt <= MAX_RETRIES) {
        scheduleSummaryRetry(t, idx, nextAttempt);
      } else {
        setSummaryErrors(prev => ({ ...prev, [id]: message }));
        setSummaryLoading(prev => ({ ...prev, [id]: false }));
        showError(message);
      }
    }
  };

  const handleClearSummary = (t, idx) => {
    const id = getTopicId(t, idx);
    setSummaries(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSummaryErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSummaryCollapsed(prev => ({ ...prev, [id]: true }));
    delete summaryAttemptsRef.current[id];
  };
  const toggleSummaryCollapsed = (t, idx) => {
    const id = getTopicId(t, idx);
    setSummaryCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Prediction ───────────────────────────────────────────
  const schedulePredictionRetry = (topic, idx, attempt) => {
    setTimeout(() => {
      predictionAttemptsRef.current[getTopicId(topic, idx)] = attempt;
      handleGeneratePrediction(topic, idx, attempt);
    }, RETRY_DELAY_MS);
  };

  const handleGeneratePrediction = async (t, idx, attempt = 0) => {
    const id = getTopicId(t, idx);
    setActiveTimestamps(prev => ({ ...prev, [`${id}_prediction`]: Date.now() }));
    if (predictions[id]) { setPredictionCollapsed(prev => ({ ...prev, [id]: false })); return; }
    if (predictionLoading[id] && attempt === 0) return;
    predictionAttemptsRef.current[id] = attempt;
    setPredictionLoading(prev => ({ ...prev, [id]: true }));
    setPredictionErrors(prev => ({ ...prev, [id]: null }));
    const start = Date.now();
    try {
      const data = await contentService.getTopicPrediction(id);
      const content = data?.content || data?.impact_analysis || '';
      setPredictions(prev => ({ ...prev, [id]: {
        content, service: 'cache',
        timestamp: data?.generatedAt || new Date().toISOString(),
        generationTime: Date.now() - start,
        wordCount: String(content).split(' ').length,
        metadata: { cached: data?.cached ?? true, remainingTtlSeconds: data?.remainingTtlSeconds ?? null },
      }}));
      setPredictionCollapsed(prev => ({ ...prev, [id]: false }));
      predictionAttemptsRef.current[id] = 0;
      setPredictionLoading(prev => ({ ...prev, [id]: false }));
    } catch (e) {
      const message = e?.message || String(e);
      const shouldRetry = /cache miss|failed to read summary|503/i.test(message);
      const nextAttempt = attempt + 1;
      if (shouldRetry && nextAttempt <= MAX_RETRIES) {
        schedulePredictionRetry(t, idx, nextAttempt);
      } else {
        setPredictionErrors(prev => ({ ...prev, [id]: message }));
        setPredictionLoading(prev => ({ ...prev, [id]: false }));
        showError(message);
      }
    }
  };

  const handleClearPrediction = (t, idx) => {
    const id = getTopicId(t, idx);
    setPredictions(prev => { const n = { ...prev }; delete n[id]; return n; });
    setPredictionErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    setPredictionCollapsed(prev => ({ ...prev, [id]: true }));
    delete predictionAttemptsRef.current[id];
  };
  const togglePredictionCollapsed = (t, idx) => {
    const id = getTopicId(t, idx);
    setPredictionCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Trace Cause ──────────────────────────────────────────
  const handleGenerateTraceCause = async (t, idx) => {
    const id = getTopicId(t, idx);
    setActiveTimestamps(prev => ({ ...prev, [`${id}_trace`]: Date.now() }));
    if (traceCauses[id]) { setTraceCauseCollapsed(prev => ({ ...prev, [id]: false })); return; }
    if (traceCauseLoading[id]) return;
    setTraceCauseLoading(prev => ({ ...prev, [id]: true }));
    setTraceCauseErrors(prev => ({ ...prev, [id]: null }));
    try {
      const data = await contentService.getTopicTraceCause(id);
      const content = data?.content || '';
      setTraceCauses(prev => ({ ...prev, [id]: {
        content, service: 'cache',
        timestamp: data?.generatedAt || new Date().toISOString(),
        metadata: { cached: data?.cached ?? true },
      }}));
      setTraceCauseCollapsed(prev => ({ ...prev, [id]: false }));
      setTraceCauseLoading(prev => ({ ...prev, [id]: false }));
    } catch (e) {
      const message = e?.message || String(e);
      setTraceCauseErrors(prev => ({ ...prev, [id]: message }));
      setTraceCauseLoading(prev => ({ ...prev, [id]: false }));
      showError(message);
    }
  };

  const handleClearTraceCause = (t, idx) => {
    const id = getTopicId(t, idx);
    setTraceCauses(prev => { const n = { ...prev }; delete n[id]; return n; });
    setTraceCauseErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    setTraceCauseCollapsed(prev => ({ ...prev, [id]: true }));
  };
  const toggleTraceCauseCollapsed = (t, idx) => {
    const id = getTopicId(t, idx);
    setTraceCauseCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSourcesExpanded = (t, idx) => {
    const id = getTopicId(t, idx);
    setSourcesExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Render ───────────────────────────────────────────────
  const totalTopics = topics?.length ?? 0;

  const trendingCount = topics.filter(t => t.x_trending).length;
  const statusStats = [
    totalTopics > 0 && { value: totalTopics, unit: 'topics' },
    trendingCount > 0 && { value: trendingCount, unit: 'trending' },
    archiveEntries?.length > 0 && { value: archiveEntries.length, unit: 'archive' },
  ].filter(Boolean);

  const leftRail = (
    <>
      <TodayArchiveSidebar mode="rail" entries={filteredArchiveEntries} />
      <div className="home-rail-coffee">
        <p>We run ad-free. Help keep it that way.</p>
        <a
          href="https://buymeacoffee.com/BenBen990505"
          target="_blank"
          rel="noopener noreferrer"
          className="home-rail-coffee-btn"
        >
          Buy Me a Coffee ↗
        </a>
      </div>
    </>
  );

  const rightRail = (
    <TopicNav mode="rail" topics={topics} categorizedTopics={categorizedTopics} />
  );

  return (
    <EditorialShell
      strip={<StatusStrip label="LIVE" stats={statusStats} updatedAt={updatedAt} />}
      left={leftRail}
      right={rightRail}
      className="home-shell"
    >
      {/* Today's lede — deterministic orientation band (composeTopicsLede) */}
      {!loading && <LedeBand {...lede} />}

      {/* Masthead */}
      <div className="home-masthead">
        <div className="home-masthead-kicker">{getDayString()}</div>
        <h1>Today's Global Topics</h1>
        <p className="home-masthead-sub">
          Trending topics from around the world, organised by region. Summarise, predict, or trace the cause of any one.
        </p>

        {isStale && (
          <div className="home-alert stale">
            <span>Topics refreshing — showing latest available</span>
            <button onClick={refetch}>Refresh</button>
          </div>
        )}
        {hasNewData && !isStale && (
          <div className="home-alert fresh">
            <span>New topics available</span>
            <button onClick={refetch}>Load</button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="home-loading">
          <span className="home-loading-spin" />
          <span className="home-loading-label">Loading topics</span>
        </div>
      )}

      {/* Regions */}
      {!loading && totalTopics > 0 && sortedRegions.map(([region, regionTopics]) => (
        <section key={region} className="home-region">
          <div className="home-region-hd">
            <h2>{region}</h2>
            <span className="home-region-n">{regionTopics.length} topic{regionTopics.length !== 1 ? 's' : ''}</span>
          </div>

          {regionTopics.map((t) => {
            const globalIdx = topics.indexOf(t);
            const id = getTopicId(t, globalIdx);
            const country = t.primaryCountry || t.regions?.[0] || null;
            const hasSummary = !!summaries[id];
            const hasPredict = !!predictions[id];
            const hasTrace = !!traceCauses[id];
            const googleNewsUrl = `https://www.google.com/search?q=${encodeURIComponent(String(t.title || '').trim())}&tbm=nws&tbs=qdr:d`;

            return (
              <article key={globalIdx} id={`topic-${id}`} className="home-topic">
                <div className="home-topic-kicker">
                  {t.category && <span className="home-topic-cat">{t.category}</span>}
                  {t.x_trending && <span className="home-trend-pill">TRENDING</span>}
                  {t.urgency === 'high' && <span className="home-urgency-pill">URGENT</span>}
                  {t.threadId && disruptionByThread[t.threadId]?.severity && (
                    <Link
                      to={`/weekly/thread/${t.threadId}?tab=economy`}
                      style={{ textDecoration: 'none' }}
                      title="Economic disruption — click for analysis"
                    >
                      <SeverityBadge level={disruptionByThread[t.threadId].severity} size="sm" />
                    </Link>
                  )}
                  {country && (
                    <span> · <Link
                      to={`/weekly/country/${encodeURIComponent(country)}`}
                      className="home-topic-country-link"
                    >{country}</Link></span>
                  )}
                </div>

                <h3>
                  {t.threadId
                    ? <Link to={`/weekly/thread/${t.threadId}`}>{t.title}</Link>
                    : t.title
                  }
                  {t.threadId && (
                    <Link
                      to={disruptionByThread[t.threadId]
                        ? `/weekly/thread/${t.threadId}?tab=economy`
                        : '/weekly'}
                      className="home-thread-badge"
                    >
                      {disruptionByThread[t.threadId] ? 'Economic impact →' : 'Story arc →'}
                    </Link>
                  )}
                </h3>

                {(t.context || t.description) && (
                  <p className="home-topic-context">{t.context || t.description}</p>
                )}

                {Array.isArray(t.sources) && t.sources.length > 0 && (() => {
                  const sourceCount = t.sources.length;
                  const outletCount = new Set(
                    t.sources.map(s => (s.source || s.title || '').toLowerCase()).filter(Boolean)
                  ).size;
                  const countries = Array.from(new Set(
                    t.sources.map(s => s.outletCountry).filter(c => c && c.length === 2 && c !== 'EU')
                  )).slice(0, 6);
                  return (
                    <div className="home-topic-meta">
                      <span><b>{sourceCount}</b> source{sourceCount !== 1 ? 's' : ''}</span>
                      {outletCount > 0 && outletCount !== sourceCount && (
                        <span><b>{outletCount}</b> outlet{outletCount !== 1 ? 's' : ''}</span>
                      )}
                      {countries.length >= 2 && (
                        <span className="home-source-flags" title={`Coverage from ${countries.length} countries`}>
                          {countries.map(cc => (
                            <span key={cc} className="home-flag">{countryToFlag(cc)}</span>
                          ))}
                        </span>
                      )}
                      <SourceRobustness
                        outlets={outletCount || sourceCount}
                        sources={sourceCount}
                        regions={countries.length}
                      />
                    </div>
                  );
                })()}

                <div className="home-topic-actions">
                  <div className="home-ai-row">
                    {/* Summary */}
                    <button
                      className={`home-ai-btn sum${hasSummary || summaryLoading[id] ? ' active' : ''}${summaryLoading[id] ? ' loading' : ''}`}
                      onClick={() => handleGenerateSummary(t, globalIdx)}
                      disabled={summaryLoading[id]}
                    >
                      {summaryLoading[id]
                        ? <span className="home-ai-spinner" />
                        : hasSummary
                          ? <span className="btn-dot" />
                          : <SumIcon />
                      }
                      Summary
                    </button>

                    {/* Predict */}
                    <button
                      className={`home-ai-btn pre${hasPredict || predictionLoading[id] ? ' active' : ''}${predictionLoading[id] ? ' loading' : ''}`}
                      onClick={() => handleGeneratePrediction(t, globalIdx)}
                      disabled={predictionLoading[id]}
                    >
                      {predictionLoading[id]
                        ? <span className="home-ai-spinner" />
                        : hasPredict
                          ? <span className="btn-dot" />
                          : <PreIcon />
                      }
                      Predict
                    </button>

                    {/* Trace Cause */}
                    <button
                      className={`home-ai-btn tra${hasTrace || traceCauseLoading[id] ? ' active' : ''}${traceCauseLoading[id] ? ' loading' : ''}`}
                      onClick={() => handleGenerateTraceCause(t, globalIdx)}
                      disabled={traceCauseLoading[id]}
                    >
                      {traceCauseLoading[id]
                        ? <span className="home-ai-spinner" />
                        : hasTrace
                          ? <span className="btn-dot" />
                          : <TraIcon />
                      }
                      Trace Cause
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {Array.isArray(t.sources) && t.sources.length > 0 && (
                      <button
                        className="home-src-link"
                        onClick={() => toggleSourcesExpanded(t, globalIdx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {sourcesExpanded[id] ? 'Hide sources' : `${t.sources.length} source${t.sources.length !== 1 ? 's' : ''} ↗`}
                      </button>
                    )}
                    {!Array.isArray(t.sources) && (
                      <a className="home-src-link" href={googleNewsUrl} target="_blank" rel="noopener noreferrer">
                        View sources ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Sources panel */}
                {Array.isArray(t.sources) && t.sources.length > 0 && sourcesExpanded[id] && (() => {
                  // Sort: primary tier first, then maximize outlet-country diversity at top.
                  const seenCountries = new Set();
                  const primary = t.sources.filter(s => s.tier !== 'secondary');
                  const secondary = t.sources.filter(s => s.tier === 'secondary');
                  const diversitySort = (arr) => {
                    const firstHits = [], rest = [];
                    for (const s of arr) {
                      const cc = s.outletCountry;
                      if (cc && !seenCountries.has(cc)) { seenCountries.add(cc); firstHits.push(s); }
                      else rest.push(s);
                    }
                    return [...firstHits, ...rest];
                  };
                  const sorted = [...diversitySort(primary), ...diversitySort(secondary)];
                  return (
                    <div className="home-sources-panel">
                      <div className="home-sources-hd" onClick={() => toggleSourcesExpanded(t, globalIdx)}>
                        <span>Article Sources ({t.sources.length})</span>
                        <span className="home-sources-close">✕</span>
                      </div>
                      <div className="home-sources-body">
                        {sorted.map((src, si) => (
                          <div key={si} className={`home-source-item${src.tier === 'secondary' ? ' is-secondary' : ''}`}>
                            <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title || 'Untitled'}</a>
                            <div className="home-source-meta">
                              {src.outletCountry && (
                                <span className="home-source-flag" title={src.outletCountry}>{countryToFlag(src.outletCountry)}</span>
                              )}
                              <span>{src.source}</span>
                              {src.age && <span> · {src.age}</span>}
                              {src.tier === 'secondary' && <span className="home-source-tier"> · related</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* AI results */}
                <div className="home-ai-result">
                  <SummaryDisplay
                    summary={summaries[id]}
                    isLoading={summaryLoading[id]}
                    error={summaryErrors[id]}
                    onRetry={() => handleGenerateSummary(t, globalIdx)}
                    onClear={() => handleClearSummary(t, globalIdx)}
                    isCollapsed={summaryCollapsed[id]}
                    onToggleCollapse={() => toggleSummaryCollapsed(t, globalIdx)}
                    lastActive={activeTimestamps[`${id}_summary`]}
                  />
                  <PredictionDisplay
                    prediction={predictions[id]}
                    isLoading={predictionLoading[id]}
                    error={predictionErrors[id] || null}
                    onRetry={() => handleGeneratePrediction(t, globalIdx)}
                    onClear={() => handleClearPrediction(t, globalIdx)}
                    isCollapsed={predictionCollapsed[id]}
                    onToggleCollapse={() => togglePredictionCollapsed(t, globalIdx)}
                    lastActive={activeTimestamps[`${id}_prediction`]}
                  />
                  <TraceCauseDisplay
                    traceCause={traceCauses[id]}
                    isLoading={traceCauseLoading[id]}
                    error={traceCauseErrors[id]}
                    onRetry={() => handleGenerateTraceCause(t, globalIdx)}
                    onClear={() => handleClearTraceCause(t, globalIdx)}
                    isCollapsed={traceCauseCollapsed[id]}
                    onToggleCollapse={() => toggleTraceCauseCollapsed(t, globalIdx)}
                    lastActive={activeTimestamps[`${id}_trace`]}
                  />
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </EditorialShell>
  );
}

export default Home;
