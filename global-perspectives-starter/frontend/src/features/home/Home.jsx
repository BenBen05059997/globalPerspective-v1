import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { ROUTE, storyHref, studioHref } from '@/shared/lib/links.js';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import { useGeminiTopics } from '@/shared/data/useGeminiTopics';
import SummaryDisplay from '@/features/home/components/SummaryDisplay';
import PredictionDisplay from '@/features/home/components/PredictionDisplay';
import TraceCauseDisplay from '@/features/home/components/TraceCauseDisplay';
import TopicNav from '@/features/home/components/TopicNav';
import TodayArchiveSidebar from '@/features/home/components/TodayArchiveSidebar';
import { useTodayArchive } from '@/features/home/hooks/useTodayArchive';
import contentService from '@/shared/data/contentService';
import { categorizeTopicsByRegion } from '@/shared/lib/countryMapping';
import { reportFetchError } from '@/shared/api/errorSink';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import StatusStrip from '@/shared/ui/StatusStrip';
import EditorialShell from '@/shared/ui/EditorialShell';
import SeverityBadge from '@/shared/ui/SeverityBadge';
import SourceRobustness from '@/shared/ui/SourceRobustness';
import LedeBand from '@/features/home/components/LedeBand';
import { BreakingStrip } from '@/features/breaking';
import SubscribeCard from '@/shared/ui/SubscribeCard';
import { useDisruptionsList } from '@/shared/hooks/useDisruptionsList';
import { ECONOMY_PARKED } from '@/shared/lib/economyFlag';
import { useTrackRecord, useCorrectionsFeed } from '@/features/track-record';
import { composeTopicsLede } from '@/features/home/lib/composeTopicsLede';
import '@/features/home/AIComponents.css';
import '@/features/home/Home.css';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';

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
const AnaIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="4.5"/><path d="M10.3 10.3L13.5 13.5"/>
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
  const { data: allDisruptions = [] } = useDisruptionsList({ limit: 100 }, { enabled: !ECONOMY_PARKED });
  const disruptionByThread = React.useMemo(() => {
    const m = {};
    for (const d of allDisruptions) { if (d.scopeId) m[d.scopeId] = d; }
    return m;
  }, [allDisruptions]);
  const { entries: archiveEntries } = useTodayArchive();

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

  // Trust strip — the "why this is different" proof, built ONLY from real returned
  // data (each card omitted when its number is absent; never a placeholder — see
  // the no-misinformation-fallback rule). Sits above SubscribeCard as its motivation.
  const { data: trackRecord } = useTrackRecord();
  // The ledger itself is member-gated (anon sees the newest 5), but the COUNT is public —
  // use the server's honest `total`, never notes.length, or Home undersells its own number.
  const { notes: corrections, total: correctionsTotal } = useCorrectionsFeed(100);
  const trustStats = React.useMemo(() => {
    const cards = [];
    const forecastsN = Number(trackRecord?.totalDatedTriggers) || 0;
    const correctionsN = Number(correctionsTotal) || (Array.isArray(corrections) ? corrections.length : 0);
    const sourcesN = topics.reduce(
      (sum, t) => sum + (Array.isArray(t.sources) ? t.sources.length : 0), 0);
    if (forecastsN > 0) cards.push({
      to: ROUTE.trackRecord, n: forecastsN,
      label: 'dated, falsifiable forecast triggers — scored in public as each deadline passes',
    });
    if (correctionsN > 0) cards.push({
      to: ROUTE.trackRecord, n: correctionsN,
      label: 'revised conclusions logged, each with the event that changed our read',
      // Contextual perk tease (P6a). Copy promises only what is live: members read the full correction
      // history; the country change-alert emails are OFF (drift cron disabled), so they are not named.
      // The hint sentence is its own link to /membership
      // (Stage-0 item (e) — it previously inherited the card's /track-record destination
      // since it rendered inside the same <Link>, which was wrong: it's advertising the
      // membership perk, not the corrections ledger).
      hint: 'Members see the full history of every revised conclusion',
      hintTo: '/membership',
    });
    if (sourcesN > 0 && topics.length > 0) cards.push({
      to: null, n: sourcesN,
      label: `sources across ${topics.length} stories tracked today`,
    });
    return cards;
  }, [trackRecord, corrections, correctionsTotal, topics]);

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

  // A failed topics load is shown in place (the "Couldn't load today's topics" panel below) and
  // reported to the passive client-error sink; there is no modal and no reader-facing error text.
  useEffect(() => {
    if (error) reportFetchError('today-topics', new Error(error));
  }, [error]);

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
        <Button
          href="https://buymeacoffee.com/BenBen990505"
          target="_blank"
          rel="noopener noreferrer"
          compact
          className="home-rail-coffee-btn"
        >
          Buy Me a Coffee ↗
        </Button>
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
      {/* Breaking strip — only renders when a confirmed alert is <24h old */}
      <BreakingStrip />

      {/* Today's lede — deterministic orientation band (composeTopicsLede) */}
      {!loading && <LedeBand {...lede} />}

      {/* Masthead */}
      <div className="home-masthead">
        <div className="home-masthead-kicker">{getDayString()}</div>
        <h1>Today's Global Topics</h1>
        <p className="home-masthead-sub">
          AI-driven global intelligence that shows its work — every forecast{' '}
          <Link to={ROUTE.trackRecord}>publicly scored</Link>, every revised conclusion{' '}
          <Link to={ROUTE.trackRecord}>logged</Link>. Summarise, predict, or trace the cause of any story below.
        </p>

        {isStale && (
          <div className="home-alert stale">
            <span>Topics refreshing — showing latest available</span>
            <Button compact onClick={refetch}>Refresh</Button>
          </div>
        )}
        {hasNewData && !isStale && (
          <div className="home-alert fresh">
            <span>New topics available</span>
            <Button compact onClick={refetch}>Load</Button>
          </div>
        )}
      </div>

      {/* Trust strip — real-data proof of the accountability model; honest-empty */}
      {!loading && trustStats.length > 0 && (
        <div className="home-trust-strip">
          {trustStats.map((c, i) => {
            const body = (
              <>
                <span className="home-trust-n">{c.n.toLocaleString()}</span>
                <span className="home-trust-label">{c.label}</span>
              </>
            );
            return (
              <Card key={i} className={`home-trust-card${c.to ? ' is-link' : ''}`}>
                {c.to
                  ? <Link to={c.to} className="home-trust-card-link">{body}</Link>
                  : body}
                {/* Own destination, not nested inside the card's <Link> (invalid HTML +
                    Stage-0 item (e): the perk hint must go to /membership, not the card's own
                    /track-record target). */}
                {c.hint && (
                  <Link to={c.hintTo || '/membership'} className="home-trust-hint">{c.hint}</Link>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Weekly Brief email subscribe */}
      <SubscribeCard variant="home" />

      {/* Loading */}
      {loading && <BootLoader variant="inline" label="Loading topics" text="Loading topics" />}

      {/* Honest empty state: the topics call failed and there is nothing cached to show */}
      {!loading && error && totalTopics === 0 && (
        <div className="home-unavailable" role="status" data-testid="today-unavailable">
          <p>Couldn't load today's topics.</p>
          <Button onClick={refetch}>Retry</Button>
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
                  <CategoryTag category={t.category} />
                  {t.x_trending && <span className="home-flag-tag home-flag-tag--trend">Trending</span>}
                  {t.urgency === 'high' && <span className="home-flag-tag">Urgent</span>}
                  {!ECONOMY_PARKED && t.threadId && disruptionByThread[t.threadId]?.severity && (
                    <Link
                      to={storyHref(t.threadId, { tab: 'economy' })}
                      className="home-topic-sev"
                      title="Economic disruption — click for analysis"
                    >
                      <SeverityBadge level={disruptionByThread[t.threadId].severity} size="sm" />
                    </Link>
                  )}
                  {country && (
                    <EntityLink kind="country" id={country} className="home-topic-country-link">{country}</EntityLink>
                  )}
                </div>

                <h3>
                  {t.threadId
                    ? <EntityLink kind="story" id={t.threadId} topic={t}>{t.title}</EntityLink>
                    : t.title
                  }
                  {t.threadId && (
                    <Link
                      to={storyHref(t.threadId, !ECONOMY_PARKED && disruptionByThread[t.threadId] ? { tab: 'economy' } : undefined)}
                      className="home-thread-badge"
                    >
                      {!ECONOMY_PARKED && disruptionByThread[t.threadId] ? 'Economic impact →' : 'Story arc →'}
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
                    {[
                      { label: 'Summary', has: hasSummary, loading: !!summaryLoading[id], run: handleGenerateSummary, icon: <SumIcon /> },
                      { label: 'Predict', has: hasPredict, loading: !!predictionLoading[id], run: handleGeneratePrediction, icon: <PreIcon /> },
                      { label: 'Trace Cause', has: hasTrace, loading: !!traceCauseLoading[id], run: handleGenerateTraceCause, icon: <TraIcon /> },
                    ].map(({ label, has, loading: busy, run, icon }) => (
                      <Button
                        key={label}
                        compact
                        className="home-ai-btn"
                        selected={has || busy}
                        aria-busy={busy}
                        onClick={() => run(t, globalIdx)}
                        disabled={busy}
                      >
                        {has ? <span className="btn-dot" aria-hidden="true" /> : icon}
                        {label}
                      </Button>
                    ))}

                    {/* Analyze (Analysis Studio) */}
                    <Button compact className="home-ai-btn" to={studioHref(id)}>
                      <AnaIcon />
                      Analyze
                    </Button>
                  </div>

                  <div className="home-topic-src">
                    {Array.isArray(t.sources) && t.sources.length > 0 && (
                      <button
                        type="button"
                        className="home-src-link"
                        aria-expanded={!!sourcesExpanded[id]}
                        onClick={() => toggleSourcesExpanded(t, globalIdx)}
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
                      <SectionHeader as="h4" className="home-sources-hd" label="Article Sources" count={t.sources.length}>
                        <Button variant="icon" compact label="Hide sources" onClick={() => toggleSourcesExpanded(t, globalIdx)}>✕</Button>
                      </SectionHeader>
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
