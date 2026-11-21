import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { ROUTE, storyHref } from '@/shared/lib/links.js';
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
import SourceRobustness from '@/shared/ui/SourceRobustness';
import SubscribeCard from '@/shared/ui/SubscribeCard';
import { useTrackRecord, useCorrectionsFeed } from '@/features/track-record';
import { topicHasNoForecast } from '@/features/home/lib/noForecast';
import { composeTopicsLede, ledeMeta } from '@/features/home/lib/composeTopicsLede';
import { getTopicId } from '@/features/home/lib/topics.js';
import '@/features/home/AIComponents.css';
import '@/features/home/Home.css';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import ReaderPromise from '@/shared/ui/ReaderPromise.jsx';
import PageLine from '@/shared/ui/PageLine.jsx';
import StoryLinkLine from '@/shared/ui/StoryLinkLine.jsx';
import { StoryTopLine, StorySteps, WatchNext, storyName } from '@/shared/ui/StoryCard.jsx';
import JudgmentTip, { NAME_NOTE } from '@/shared/ui/JudgmentTip.jsx';
import { useIsPhone } from '@/shared/hooks/useIsPhone.js';

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

// ISO 3166-1 alpha-2 → flag emoji via regional indicator symbols.
function countryToFlag(cc) {
  if (!cc || cc.length !== 2) return '';
  const A = 0x1F1E6;
  const codePoints = cc.toUpperCase().split('').map(c => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

function Home() {
  const { topics, loading, error, refetch, isStale, updatedAt, hasNewData, stories, roles } = useGeminiTopics();
  const isPhone = useIsPhone();
  const { entries: archiveEntries, error: archiveError, refetch: refetchArchive } = useTodayArchive();

  const filteredArchiveEntries = React.useMemo(() => {
    if (!archiveEntries.length || !topics.length) return archiveEntries;
    const activeIds = new Set(topics.map((t) => {
      const id = t?.topicId || t?.topic_id || t?.id;
      return id != null ? String(id).trim() : '';
    }).filter(Boolean));
    return archiveEntries.filter(e => !activeIds.has(e.topicId));
  }, [archiveEntries, topics]);


  const lede = React.useMemo(
    () => composeTopicsLede({ topics }),
    [topics],
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
      label: `${sourcesN === 1 ? 'source' : 'sources'} in this edition`,
    });
    return cards;
  }, [trackRecord, corrections, correctionsTotal, topics]);

  // The lead story is still picked here (composeTopicsLede, CONTRACT "lead story": not stamped); its card carries the flag.
  const leadIdx = lede.lede ? topics.findIndex((t) => t.title === lede.lede.title) : -1;
  // Edition order with the lead first.
  const ordered = React.useMemo(
    () => (leadIdx > 0 ? [topics[leadIdx], ...topics.filter((_, i) => i !== leadIdx)] : topics),
    [topics, leadIdx],
  );
  const storyOf = React.useCallback((t) => (stories && t?.storyId ? stories[t.storyId] || null : null), [stories]);
  // A card's kind (SPEC R1): the story's stamped `editionRole`; until that stamp ships, its newest step's role; an item with no
  // story card, its own `role`. Never derived from the edition's entries.
  const cardKind = React.useCallback((t) => {
    const st = storyOf(t);
    if (st && 'editionRole' in st) return st.editionRole ?? null;
    return st?.newestStep?.role ?? t.role ?? null;
  }, [storyOf]);
  // One card per story (R1): the story's first item in edition order holds its place; the card shows the item that is the
  // story's newest step (the card title), so its sources and AI buttons are that step's. Items with no kind stay one card each
  // (the "other items" count is of items).
  const cards = React.useMemo(() => {
    const at = new Map();
    const out = [];
    for (const t of ordered) {
      const st = storyOf(t);
      if (!st || !cardKind(t)) { out.push(t); continue; }
      if (!at.has(t.storyId)) { at.set(t.storyId, out.length); out.push(t); continue; }
      if (st.newestStep?.title && t.title === st.newestStep.title) out[at.get(t.storyId)] = t;
    }
    return out;
  }, [ordered, storyOf, cardKind]);
  // The region rail lists the cards, one row per story (R1).
  const categorizedTopics = React.useMemo(() => categorizeTopicsByRegion(cards), [cards]);
  // Groups by the card's kind; null until the builder stamps `latest.roles` (live today: one list in edition order).
  const groups = React.useMemo(() => {
    if (!roles) return null;
    const g = { move: [], start: [], measure: [], none: [] };
    for (const t of cards) (g[cardKind(t)] || g.none).push(t);
    return g;
  }, [roles, cards, cardKind]);

  const [summaries, setSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [summaryErrors, setSummaryErrors] = useState({});
  const [summaryCollapsed, setSummaryCollapsed] = useState({});

  const [predictions, setPredictions] = useState({});
  const [predictionLoading, setPredictionLoading] = useState({});
  const [predictionErrors, setPredictionErrors] = useState({});
  const [predictionCollapsed, setPredictionCollapsed] = useState({});
  const [noForecast, setNoForecast] = useState({});

  const [traceCauses, setTraceCauses] = useState({});
  const [traceCauseLoading, setTraceCauseLoading] = useState({});
  const [traceCauseErrors, setTraceCauseErrors] = useState({});
  const [traceCauseCollapsed, setTraceCauseCollapsed] = useState({});

  const [sourcesExpanded, setSourcesExpanded] = useState({});
  const [activeTimestamps, setActiveTimestamps] = useState({});

  const summaryAttemptsRef = useRef({});
  const predictionAttemptsRef = useRef({});
  // Pending retry timers by 'summary:<id>' / 'prediction:<id>': cleared on Close and on unmount.
  const retryTimersRef = useRef({});
  useEffect(() => () => { Object.values(retryTimersRef.current).forEach(clearTimeout); }, []);
  const cancelRetry = (key) => { clearTimeout(retryTimersRef.current[key]); delete retryTimersRef.current[key]; };

  const MAX_RETRIES = 6;
  const RETRY_DELAY_MS = 10000;

  // A failed topics load is shown in place (the "Couldn't load today's topics" panel below) and
  // reported to the passive client-error sink; there is no modal and no reader-facing error text.
  useEffect(() => {
    if (error) reportFetchError('today-topics', new Error(error));
  }, [error]);

  // The archive rail fails in place too (see leftRail) and goes to the sink.
  useEffect(() => {
    if (archiveError) reportFetchError('today-archive', new Error(archiveError));
  }, [archiveError]);

  useEffect(() => { document.title = 'Global Perspectives™ — AI-Powered News Intelligence'; }, []);

  // ── Summary ──────────────────────────────────────────────
  const scheduleSummaryRetry = (topic, idx, attempt) => {
    retryTimersRef.current[`summary:${getTopicId(topic, idx)}`] = setTimeout(() => {
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
      if (!content.trim()) throw new Error('Summary came back empty');
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
    cancelRetry(`summary:${id}`);
    setSummaryLoading(prev => ({ ...prev, [id]: false }));
  };
  const toggleSummaryCollapsed = (t, idx) => {
    const id = getTopicId(t, idx);
    setSummaryCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Prediction ───────────────────────────────────────────
  const schedulePredictionRetry = (topic, idx, attempt) => {
    retryTimersRef.current[`prediction:${getTopicId(topic, idx)}`] = setTimeout(() => {
      predictionAttemptsRef.current[getTopicId(topic, idx)] = attempt;
      handleGeneratePrediction(topic, idx, attempt);
    }, RETRY_DELAY_MS);
  };

  const handleGeneratePrediction = async (t, idx, attempt = 0) => {
    const id = getTopicId(t, idx);
    setActiveTimestamps(prev => ({ ...prev, [`${id}_prediction`]: Date.now() }));
    if (predictions[id]) { setPredictionCollapsed(prev => ({ ...prev, [id]: false })); return; }
    if (noForecast[id]) return;
    if (predictionLoading[id] && attempt === 0) return;
    predictionAttemptsRef.current[id] = attempt;
    setPredictionLoading(prev => ({ ...prev, [id]: true }));
    setPredictionErrors(prev => ({ ...prev, [id]: null }));
    const start = Date.now();
    try {
      // A topic the latest run wrote without a forecast never gets one: say so now, no request and no retry loop.
      if (await topicHasNoForecast(id)) {
        setNoForecast(prev => ({ ...prev, [id]: true }));
        setPredictionLoading(prev => ({ ...prev, [id]: false }));
        return;
      }
      const data = await contentService.getTopicPrediction(id);
      const content = data?.content || data?.impact_analysis || '';
      if (!content.trim()) throw new Error('Prediction came back empty');
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
    cancelRetry(`prediction:${id}`);
    setPredictionLoading(prev => ({ ...prev, [id]: false }));
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
      if (!content.trim()) throw new Error('Trace cause came back empty');
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
    cards.length > 0 && { value: cards.length, unit: cards.length === 1 ? 'story' : 'stories' }, // one per card (R1)
    trendingCount > 0 && { value: trendingCount, unit: 'trending on X' },
    filteredArchiveEntries.length > 0 && { value: filteredArchiveEntries.length, unit: 'earlier today' },
  ].filter(Boolean);

  const leftRail = (
    <>
      <TodayArchiveSidebar entries={filteredArchiveEntries} />
      {archiveError && archiveEntries.length === 0 && (
        <div className="home-unavailable home-unavailable--rail" role="status" data-testid="today-archive-unavailable">
          <p>Couldn't load today's archive.</p>
          <Button compact onClick={refetchArchive}>Retry</Button>
        </div>
      )}
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
    <TopicNav topics={cards} categorizedTopics={categorizedTopics} kindOf={cardKind} />
  );

  // One story card (SPEC §0). The story facts are the builder's stamp (`stories[storyId]`); without it the card shows
  // this item as before, with no since line, no steps and no watch box.
  const renderCard = (t) => {
    const globalIdx = topics.indexOf(t);
    const id = getTopicId(t, globalIdx);
    const sid = t.storyId || t.threadId || null;
    const story = storyOf(t);
    const kind = cardKind(t);
    const country = t.primaryCountry || t.regions?.[0] || null;
    const isLead = globalIdx === leadIdx || (!!t.storyId && t.storyId === topics[leadIdx]?.storyId);
    const hasSummary = !!summaries[id];
    const hasPredict = !!predictions[id];
    const hasTrace = !!traceCauses[id];
    const googleNewsUrl = `https://www.google.com/search?q=${encodeURIComponent(String(t.title || '').trim())}&tbm=nws&tbs=qdr:d`;
    const headline = story?.title || t.title;
    const name = storyName(story?.name, headline);
    const context = (t.context || t.description) ? <p className="home-topic-context">{t.context || t.description}</p> : null;

    return (
      <article key={globalIdx} id={`topic-${id}`} className={`home-topic${isLead ? ' is-lead' : ''}`}>
        <StoryTopLine role={kind} story={story} interactive />

        <div className="home-topic-kicker">
          <CategoryTag category={t.category} />
          {t.x_trending && <span className="home-flag-tag home-flag-tag--trend">Trending on X</span>}
          {t.urgency === 'high' && !isLead && <span className="home-flag-tag">Urgent</span>}
          {country && (
            <EntityLink kind="country" id={country} className="home-topic-country-link gp-hit">{country}</EntityLink>
          )}
          {isLead && <span className="home-lead-flag">Lead story{t.urgency === 'high' ? ' · urgent' : ''}</span>}
        </div>

        <h3>
          {sid ? <EntityLink kind="story" id={sid} topic={t}>{name || headline}</EntityLink> : (name || headline)}
          {name ? <span className="gp-sname__tag"><JudgmentTip text={NAME_NOTE} /></span> : null}
        </h3>

        {!isPhone && context}

        <StorySteps role={kind} story={story} newest={name ? { date: story?.newestStep?.date, title: headline } : null} />
        {sid && story ? <StoryLinkLine id={sid} /> : null}
        <WatchNext questions={story?.watch} />
        {/* Phone: the item's own description moves under the box, so What we watch next is in the first screen (SPEC §0 order). */}
        {isPhone && context}

        <div className="home-topic-meta">
          {Array.isArray(t.sources) && t.sources.length > 0 ? (() => {
            const sourceCount = t.sources.length;
            const outletCount = new Set(
              t.sources.map(s => (s.source || s.title || '').toLowerCase()).filter(Boolean)
            ).size;
            const countries = Array.from(new Set(
              t.sources.map(s => s.outletCountry).filter(c => c && c.length === 2 && c !== 'EU')
            )).slice(0, 6);
            return (
              <>
                <button
                  type="button"
                  className="home-src-link"
                  aria-expanded={!!sourcesExpanded[id]}
                  onClick={() => toggleSourcesExpanded(t, globalIdx)}
                >
                  {sourcesExpanded[id] ? 'Hide sources' : `${sourceCount} source${sourceCount !== 1 ? 's' : ''} for this step ↗`}
                </button>
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
              </>
            );
          })() : (
            <a className="home-src-link" href={googleNewsUrl} target="_blank" rel="noopener noreferrer">
              View sources ↗
            </a>
          )}
        </div>

        <div className="home-topic-actions">
          <div className="home-ai-row">
            {[
              { label: 'Summary', has: hasSummary, loading: !!summaryLoading[id], run: handleGenerateSummary, icon: <SumIcon /> },
              { label: 'Likely outcomes', has: hasPredict, loading: !!predictionLoading[id], run: handleGeneratePrediction, icon: <PreIcon /> },
              { label: 'Why it happened', has: hasTrace, loading: !!traceCauseLoading[id], run: handleGenerateTraceCause, icon: <TraIcon /> },
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
          </div>
          {sid && (
            <Button variant="primary" to={storyHref(sid)} className="home-open-story">Open the story →</Button>
          )}
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
          {noForecast[id] && (
            <div className="ai-result-card" role="status" data-testid="no-forecast">
              <div className="ai-unavailable-row">
                <span className="ai-unavailable-text">
                  No new forecast was drawn for this story in the latest run. A forecast is drawn at most once a week per story
                  {sid && <>; its earlier forecast, if any, is on <EntityLink kind="story" id={sid} topic={t}>the story page</EntityLink></>}.
                </span>
                <span className="ai-result-actions">
                  <Button compact onClick={() => setNoForecast(prev => ({ ...prev, [id]: false }))}>Close</Button>
                </span>
              </div>
            </div>
          )}
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
  };

  // The old tagline and the two figure boxes: same words, moved below the first group (3-centre §3), then the subscribe card.
  const taglineAndFigures = (
    <div className="home-later">
      <p className="home-masthead-sub">
        AI-driven global intelligence that shows its work — every forecast{' '}
        <Link to={ROUTE.trackRecord}>publicly scored</Link>, every revised conclusion{' '}
        <Link to={ROUTE.trackRecord}>logged</Link>. Summarise, predict, or trace the cause of any story below.
      </p>
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
      <SubscribeCard variant="home" />
    </div>
  );

  const ready = !loading && totalTopics > 0;
  // A story moved or began (stamped counts). With neither, only the "{k} more in this edition" group shows (SPEC §3).
  const anyKind = !!roles && (Number(roles.move) || 0) + (Number(roles.start) || 0) + (Number(roles.measure) || 0) > 0;
  const moreCount = Number(roles?.none) || 0;
  const measureCount = Number(roles?.measure) || 0;
  // Measured cards under their own heading (R3); items with no kind last, under "{k} other items in this edition".
  const measureGroup = groups?.measure.length ? (
    <>
      {measureCount ? <h2 className="home-kind-hd home-kind-hd--more">{measureCount} measured {measureCount === 1 ? 'change' : 'changes'}</h2> : null}
      {groups.measure.map(renderCard)}
    </>
  ) : null;
  const noneGroup = groups?.none.length ? (
    <>
      {moreCount ? <h2 className="home-kind-hd home-kind-hd--more">{otherItems(moreCount)} in this edition</h2> : null}
      {groups.none.map(renderCard)}
    </>
  ) : null;
  const kicker = editionLine(updatedAt, isPhone);

  return (
    <EditorialShell
      strip={<StatusStrip label="LIVE" stats={statusStats} updatedAt={updatedAt} />}
      left={leftRail}
      right={rightRail}
      className="home-shell"
    >
      <div className="home-masthead">
        {kicker && <div className="home-masthead-kicker">{kicker}</div>}
        {/* The promise sentence (decision 0064) is this page's title; Today repeats the Map's first line. */}
        <ReaderPromise as="h1" className="home-promise" />
        <PageLine>
          {isPhone
            ? 'The latest edition’s news, inside the story it starts or moves.'
            : 'Today holds the news of the latest edition, each item shown inside the story it starts or moves.'}
        </PageLine>
        {ready && roles && <p className="home-count" data-testid="today-count">{countLine(roles, lede.countryCount)}</p>}
        {/* With the stamped count line this tally would be a second, page-made count of stories (R1); it shows only without it. */}
        {ready && !roles && !lede.empty && <p className="home-count-meta">{ledeMeta(lede).join(' · ')}</p>}
        <p className="home-leaveout">News that starts or moves no story is left out. A measured change is an official figure or a major study.</p>

        {isStale && (
          <div className="home-alert stale">
            <span>Stories refreshing — showing latest available</span>
            <Button compact onClick={refetch}>Refresh</Button>
          </div>
        )}
        {hasNewData && !isStale && (
          <div className="home-alert fresh">
            <span>New stories available</span>
            <Button compact onClick={refetch}>Load</Button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <BootLoader variant="inline" label="Loading stories" text="Loading stories" />}

      {/* Honest empty state: the topics call failed and there is nothing cached to show */}
      {!loading && error && totalTopics === 0 && (
        <div className="home-unavailable" role="status" data-testid="today-unavailable">
          <p>Couldn't load today's stories.</p>
          <Button onClick={refetch}>Retry</Button>
        </div>
      )}

      {/* Honest empty state: the call worked and the latest run holds no topics */}
      {!loading && !error && totalTopics === 0 && (
        <div className="home-unavailable" role="status" data-testid="today-empty">
          <p>No stories are published yet.</p>
          <Button onClick={refetch}>Refresh</Button>
        </div>
      )}

      {/* By kind (SPEC §3) once the builder stamps `role`; until then one list in edition order, lead first. */}
      {ready && groups && (
        <div className="home-kinds">
          {anyKind && (
            <section className="home-kind" aria-labelledby="today-moved">
              <div className="home-kind-hdrow">
                <h2 id="today-moved" className="home-kind-hd">{movedHeading(Number(roles.move) || 0, isPhone)}</h2>
                {isPhone && Number(roles.start) > 0 && <a className="home-jump" href="#today-began">{newStoriesLink(Number(roles.start))}</a>}
              </div>
              {groups.move.map(renderCard)}
              {!isPhone && measureGroup}
              {!isPhone && noneGroup}
              {!isPhone && taglineAndFigures}
            </section>
          )}
          {anyKind && (
            <section className="home-kind" aria-labelledby="today-began">
              <h2 id="today-began" className="home-kind-hd">{beganHeading(Number(roles.start) || 0)}</h2>
              {groups.start.map(renderCard)}
            </section>
          )}
          {(isPhone || !anyKind) && (groups.measure.length + groups.none.length > 0) && (
            <section className="home-kind">
              {measureGroup}
              {noneGroup}
            </section>
          )}
          {(isPhone || !anyKind) && taglineAndFigures}
        </div>
      )}
      {ready && !groups && (
        <>
          <section className="home-kind">{cards.map(renderCard)}</section>
          {taglineAndFigures}
        </>
      )}
      {!ready && taglineAndFigures}
    </EditorialShell>
  );
}

// "{WEEKDAY, MONTH D, YYYY} · EDITION {hh:mm} UTC" from the edition's own time; nothing when the time is missing. Phone: the
// short form ("Thu, Nov 19, 2026 · …") so it stays on one line.
function editionLine(updatedAt, short = false) {
  const d = updatedAt ? new Date(updatedAt) : null;
  if (!d || !Number.isFinite(d.getTime())) return null;
  const day = d.toLocaleDateString('en-US', { weekday: short ? 'short' : 'long', month: short ? 'short' : 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const time = d.toISOString().slice(11, 16);
  return `${day} · Edition ${time} UTC`;
}

const storiesWord = (n) => (n === 1 ? 'story' : 'stories');

// The count line (SPEC §3 line 4) from the builder's `latest.roles` (stories by card kind; `none` items), never counted here. It ends with the
// page's live countries count (as live; not a stamp).
function countLine(roles, countries = 0) {
  const m = Number(roles.move) || 0;
  const s = Number(roles.start) || 0;
  const x = Number(roles.measure) || 0;
  const k = Number(roles.none) || 0;
  const tail = countries ? ` ${countries} ${countries === 1 ? 'country' : 'countries'} involved.` : '';
  if (!m && !s && !x) return `No story moved or began in this edition.${tail}`;
  const moved = m ? `${m} ${storiesWord(m)} moved` : 'no story we follow moved';
  const began = s ? `${s} new ${storiesWord(s)} began` : 'no new story began';
  const measured = x ? `${x} measured ${x === 1 ? 'change' : 'changes'}` : 'no measured change';
  const more = k ? `, ${otherItems(k)}` : '';
  return `Today ${moved}, ${began}, ${measured}${more}.${tail}`;
}
const otherItems = (k) => `${k} other ${k === 1 ? 'item' : 'items'}`;
function movedHeading(n, phone) {
  if (!n) return 'No story we follow took a new step today.';
  return phone ? `${n} ${storiesWord(n)} took a new step` : `${n} ${storiesWord(n)} we follow took a new step`;
}
function beganHeading(n) {
  return n ? `${n} new ${storiesWord(n)} began` : 'No new story began today.';
}
function newStoriesLink(n) {
  return `${n} new ${storiesWord(n)} ↓`;
}

export default Home;
