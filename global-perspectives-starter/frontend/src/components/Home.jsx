import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { useTodayArchive } from '../hooks/useTodayArchive';
import { useError } from '../contexts/ErrorContext';
import { categorizeTopicsByRegion } from '../utils/countryMapping';
import graphqlService from '../utils/graphqlService';
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
import IntelligenceLoader from './IntelligenceLoader';
import { SaveButton } from './SaveButton';
import './Home.css';

const SumIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M3 8h10M3 12h6"/></svg>;
const PreIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 13l4-4 3 3 5-6"/><path d="M11 6h3v3"/></svg>;
const TraIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="4" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/><path d="M5.5 8h5"/></svg>;

function timeAgo(iso) {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getDayString() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getTopicId(t, idx) {
  const direct = t?.topicId || t?.topic_id || t?.id;
  if (direct != null && String(direct).trim()) return String(direct).trim();
  return `${t.title || 'topic'}-${idx}`.replace(/[^a-zA-Z0-9]/g, '-');
}

function splitToBullets(text, max = 4) {
  if (!text) return [];
  const trimmed = String(text).trim();
  // Already bulleted (• or - prefix or numbered)?
  if (/^\s*[•\-\*]|^\s*\d+[.)]/m.test(trimmed)) {
    return trimmed.split(/\n+/)
      .map(s => s.replace(/^\s*[•\-\*\d.)]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, max);
  }
  // Split on sentence boundaries
  const sentences = trimmed.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(s => s.length > 20);
  return (sentences && sentences.length > 0 ? sentences : [trimmed]).slice(0, max);
}

function readTime(text) {
  if (!text) return 0;
  return Math.max(15, Math.round(text.split(/\s+/).length / 4)); // ~250 wpm in seconds
}

const AI_LABELS = { sum: 'AI Key Takeaways', pre: 'AI Prediction', tra: 'AI Trace Cause' };

function Home() {
  const { topics, loading, error, refetch, isStale, updatedAt, hasNewData } = useGeminiTopics();
  const { entries: archiveEntries } = useTodayArchive();
  const { showError } = useError();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null); // for right rail scroll-spy
  const [aiState, setAiState] = useState({}); // { [topicId]: { kind: 'sum'|'pre'|'tra', content, loading, error } }

  useEffect(() => { if (error) showError(error); }, [error, showError]);
  useEffect(() => { document.title = "Today's Global Topics — Global Perspectives"; }, []);

  // Filter archive by search + category for left rail
  const filteredArchive = useMemo(() => {
    let list = archiveEntries || [];
    if (activeCategory) list = list.filter(e => (e.category || '').toLowerCase() === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => (e.title || '').toLowerCase().includes(q));
    }
    return list;
  }, [archiveEntries, search, activeCategory]);

  // Group archive by category for left rail
  const archiveByCategory = useMemo(() => {
    const m = {};
    for (const e of filteredArchive) {
      const cat = (e.category || 'other').toLowerCase();
      if (!m[cat]) m[cat] = [];
      m[cat].push(e);
    }
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [filteredArchive]);

  // All categories for filter chips (from full archive, not filtered)
  const allCategories = useMemo(() => {
    const m = {};
    for (const e of archiveEntries || []) {
      const cat = (e.category || 'other').toLowerCase();
      m[cat] = (m[cat] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [archiveEntries]);

  // Topics grouped by region for center feed
  const categorizedTopics = useMemo(() => categorizeTopicsByRegion(topics), [topics]);
  const sortedRegions = useMemo(() =>
    Object.entries(categorizedTopics)
      .filter(([, rt]) => rt.length > 0)
      .sort((a, b) => {
        if (a[0] === 'World') return 1;
        if (b[0] === 'World') return -1;
        return b[1].length - a[1].length;
      }),
  [categorizedTopics]);

  // ── AI fetch (Summary / Predict / Trace Cause) ──────────────
  const fetchAi = useCallback(async (topic, idx, kind) => {
    const id = getTopicId(topic, idx);
    const stateKey = `${id}_${kind}`;

    // Toggle: if already open, close.
    if (aiState[stateKey]?.content) {
      setAiState(prev => { const n = { ...prev }; delete n[stateKey]; return n; });
      return;
    }

    setAiState(prev => ({ ...prev, [stateKey]: { kind, loading: true } }));

    try {
      const fetcher = kind === 'sum' ? graphqlService.getTopicSummary
                    : kind === 'pre' ? graphqlService.getTopicPrediction
                    : graphqlService.getTopicTraceCause;
      const data = await fetcher(id);
      const content = data?.content || data?.impact_analysis || '';
      setAiState(prev => ({ ...prev, [stateKey]: { kind, content, generatedAt: data?.generatedAt } }));
    } catch (e) {
      const message = e?.message || String(e);
      setAiState(prev => ({ ...prev, [stateKey]: { kind, error: message } }));
      showError(message);
    }
  }, [aiState, showError]);

  const closeAi = (id, kind) => {
    setAiState(prev => { const n = { ...prev }; delete n[`${id}_${kind}`]; return n; });
  };

  // ── Right rail scroll-spy ───────────────────────────────────
  useEffect(() => {
    if (loading || sortedRegions.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveRegion(e.target.dataset.region);
            break;
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    document.querySelectorAll('.hb-region').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, sortedRegions]);

  const totalTopics = topics?.length ?? 0;

  // ── Loading state ───────────────────────────────────────────
  if (loading && totalTopics === 0) {
    return <IntelligenceLoader type="typewriter" />;
  }

  // ── Status strip stats ──────────────────────────────────────
  const trendingCount = topics.filter(t => t.x_trending).length;
  const statusStats = [
    totalTopics > 0 && { value: totalTopics, unit: 'topics' },
    trendingCount > 0 && { value: trendingCount, unit: 'trending' },
    archiveEntries?.length > 0 && { value: archiveEntries.length, unit: 'archive' },
  ].filter(Boolean);

  // ── Left rail: archive list grouped by category ─────────────
  const leftRail = (
    <div className="hb-left">
      <div className="hb-rl-head">
        <span className="hb-rl-title">Today's Archive</span>
        <span className="hb-rl-count">{archiveEntries?.length ?? 0}</span>
      </div>

      <div className="hb-rl-search">
        <input
          type="text"
          placeholder="Search topics…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {allCategories.length > 1 && (
        <div className="hb-rl-cats">
          <span
            className={`hb-cat${!activeCategory ? ' on' : ''}`}
            onClick={() => setActiveCategory(null)}
          >All</span>
          {allCategories.map(([cat, count]) => (
            <span
              key={cat}
              className={`hb-cat${activeCategory === cat ? ' on' : ''}`}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              title={`${count} topics`}
            >{cat}</span>
          ))}
        </div>
      )}

      <div className="hb-rl-items">
        {archiveByCategory.length === 0 && (
          <div className="hb-rl-empty">No topics match</div>
        )}
        {archiveByCategory.map(([cat, items]) => (
          <div key={cat} className="hb-rl-group">
            <div className="hb-rl-lbl">{cat}</div>
            {items.slice(0, 12).map((e, i) => (
              <Link
                key={`${e.topicId}-${i}`}
                to={e.threadId ? `/weekly/thread/${e.threadId}` : `#topic-${e.topicId}`}
                className="hb-rl-item"
              >
                <div className="hb-rl-item-t">{e.title}</div>
                <div className="hb-rl-item-m">
                  {e.regions?.[0] || 'Global'}
                  {e.threadId && <span className="hb-rl-arc"> · arc</span>}
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Right rail: regional jump-nav ───────────────────────────
  const rightRail = (
    <div className="hb-right">
      <div className="hb-rr-head">
        <span className="hb-rr-title">Topics</span>
        <span className="hb-rr-count">{totalTopics}</span>
      </div>

      {sortedRegions.map(([region, regionTopics]) => (
        <div key={region} className="hb-rr-region">
          <div className="hb-rr-lbl">
            {region} <span className="hb-rr-n">{regionTopics.length}</span>
          </div>
          {regionTopics.slice(0, 5).map((t, i) => {
            const id = getTopicId(t, topics.indexOf(t));
            const isActive = activeRegion === region;
            return (
              <a
                key={`${id}-${i}`}
                href={`#topic-${id}`}
                className={`hb-rr-item${isActive ? ' active' : ''}`}
              >
                <div className="hb-rr-item-t">{t.title}</div>
                <div className="hb-rr-item-m">
                  <span>{t.category}</span>
                  {t.x_trending && <span className="hb-rr-trend">trending</span>}
                </div>
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <EditorialShell
      strip={<StatusStrip label="LIVE" stats={statusStats} updatedAt={updatedAt} />}
      left={leftRail}
      right={rightRail}
      className="hb-shell"
    >
      {/* Masthead */}
      <div className="hb-masthead">
        <div className="hb-mh-kicker">{getDayString()}</div>
        <h1 className="hb-mh-h1">Today's Global Topics</h1>
        <p className="hb-mh-sub">
          Trending stories from around the world, organised by region. Summarise, predict, or trace the cause of any one.
        </p>

        {(isStale || hasNewData) && (
          <div className={`hb-mh-alert${hasNewData ? ' fresh' : ''}`}>
            <span>{hasNewData ? 'New topics available' : 'Topics refreshing — showing latest available'}</span>
            <button onClick={refetch}>{hasNewData ? 'Load' : 'Refresh'}</button>
          </div>
        )}
      </div>

      {/* Region sections */}
      {sortedRegions.map(([region, regionTopics]) => (
        <section key={region} className="hb-region" data-region={region}>
          <div className="hb-region-hd">
            <h2>{region}</h2>
            <span className="hb-region-n">{regionTopics.length} topic{regionTopics.length !== 1 ? 's' : ''}</span>
          </div>

          {regionTopics.map(t => {
            const globalIdx = topics.indexOf(t);
            const id = getTopicId(t, globalIdx);
            const country = t.primaryCountry || t.regions?.[0];
            const sourceCount = Array.isArray(t.sources) ? t.sources.length : 0;
            const outletCount = sourceCount > 0
              ? new Set(t.sources.map(s => (s.source || s.title || '').toLowerCase()).filter(Boolean)).size
              : 0;
            const firstSourceUrl = t.sources?.[0]?.url;

            return (
              <article key={id} id={`topic-${id}`} className="hb-topic">
                <div className="hb-topic-kicker">
                  {t.category && <span className="hb-topic-cat">{t.category}</span>}
                  {t.x_trending && <span className="hb-trend-badge">TRENDING</span>}
                  {t.urgency === 'high' && <span className="hb-urg-badge">URGENT</span>}
                  {country && <span className="hb-topic-country"> · {country}</span>}
                </div>

                <h3 className="hb-topic-h3">
                  {t.threadId
                    ? <Link to={`/weekly/thread/${t.threadId}`}>{t.title}</Link>
                    : <span>{t.title}</span>
                  }
                </h3>

                {(t.context || t.description) && (
                  <p className="hb-topic-ctx">{t.context || t.description}</p>
                )}

                <div className="hb-topic-meta">
                  {sourceCount > 0 && (
                    <span><b>{sourceCount}</b> source{sourceCount !== 1 ? 's' : ''}</span>
                  )}
                  {outletCount > 0 && (
                    <span><b>{outletCount}</b> outlet{outletCount !== 1 ? 's' : ''}</span>
                  )}
                  {t.threadId && (
                    <Link to={`/weekly/thread/${t.threadId}`} className="hb-topic-arc">→ story arc</Link>
                  )}
                </div>

                <div className="hb-topic-actions">
                  {['sum', 'pre', 'tra'].map(kind => {
                    const stateKey = `${id}_${kind}`;
                    const s = aiState[stateKey];
                    const open = !!(s?.content || s?.loading || s?.error);
                    const Icon = kind === 'sum' ? SumIcon : kind === 'pre' ? PreIcon : TraIcon;
                    const label = kind === 'sum' ? 'Summary' : kind === 'pre' ? 'Predict' : 'Trace Cause';
                    return (
                      <button
                        key={kind}
                        className={`hb-ai-btn ${kind}${open ? ' active' : ''}`}
                        onClick={() => fetchAi(t, globalIdx, kind)}
                        disabled={s?.loading}
                      >
                        {s?.loading ? <span className="hb-ai-spin" /> : <Icon />}
                        {label}
                      </button>
                    );
                  })}

                  <div className="hb-topic-actions-right">
                    <SaveButton itemType="topic" itemId={id} metadata={{ title: t.title, category: t.category }} />
                    {firstSourceUrl && (
                      <a className="hb-src-link" href={firstSourceUrl} target="_blank" rel="noopener noreferrer">
                        {sourceCount} source{sourceCount !== 1 ? 's' : ''} ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* AI result panels */}
                {['sum', 'pre', 'tra'].map(kind => {
                  const s = aiState[`${id}_${kind}`];
                  if (!s) return null;
                  const bullets = s.content ? splitToBullets(s.content) : [];
                  const rt = readTime(s.content || '');
                  return (
                    <div key={kind} className={`hb-ai-result ${kind}`}>
                      <div className="hb-ai-rh">
                        <div className="hb-ai-rt">{AI_LABELS[kind]}</div>
                        <div className="hb-ai-rx">
                          {s.loading && <span>Generating…</span>}
                          {s.error && <span style={{ color: 'var(--risk-h)' }}>Error</span>}
                          {!s.loading && !s.error && rt > 0 && <span>~{rt}s read</span>}
                          <span className="hb-ai-close" onClick={() => closeAi(id, kind)}>✕</span>
                        </div>
                      </div>
                      <div className="hb-ai-rb">
                        {s.loading && <div className="hb-ai-loading">Loading analysis…</div>}
                        {s.error && (
                          <div className="hb-ai-error">
                            {s.error}
                            <button onClick={() => fetchAi(t, globalIdx, kind)}>Retry</button>
                          </div>
                        )}
                        {bullets.length > 0 && (
                          <ul>
                            {bullets.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </article>
            );
          })}
        </section>
      ))}

      {!loading && totalTopics === 0 && (
        <div className="hb-empty">
          <h3>No topics available yet</h3>
          <p>The pipeline runs hourly. Check back soon.</p>
        </div>
      )}
    </EditorialShell>
  );
}

export default Home;
