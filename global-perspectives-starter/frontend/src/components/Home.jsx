import React, { useState, useRef, useEffect } from 'react';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import SummaryDisplay from './SummaryDisplay';

import PredictionDisplay from './PredictionDisplay';
import TraceCauseDisplay from './TraceCauseDisplay';
import TopicNav from './TopicNav';
import TodayArchiveSidebar from './TodayArchiveSidebar';
import { useTraceCause } from '../hooks/useTraceCause';
import { useTodayArchive } from '../hooks/useTodayArchive';
import graphqlService from '../utils/graphqlService';
import { categorizeTopicsByRegion } from '../utils/countryMapping';
import { useError } from '../contexts/ErrorContext';
import './AIComponents.css'; // Import new premium styles

function Home() {
  const { topics, loading, error, refetch, isStale, updatedAt, generatedDate, hasNewData } = useGeminiTopics();
  const { entries: archiveEntries } = useTodayArchive();
  const { showError } = useError();

  // Filter archive to only show topics NOT currently on the main page
  const filteredArchiveEntries = React.useMemo(() => {
    if (!archiveEntries.length || !topics.length) return archiveEntries;
    const activeIds = new Set(topics.map((t) => {
      const id = t?.topicId || t?.topic_id || t?.id;
      return id != null ? String(id).trim() : '';
    }).filter(Boolean));
    return archiveEntries.filter(e => !activeIds.has(e.topicId));
  }, [archiveEntries, topics]);

  // Organize topics by region
  const categorizedTopics = React.useMemo(() => {
    return categorizeTopicsByRegion(topics);
  }, [topics]);

  // Local state maps keyed by topicId
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

  const [mobileDropdownOpen, setMobileDropdownOpen] = useState({});

  const [sourcesExpanded, setSourcesExpanded] = useState({});

  // Stores the last time a user clicked a button for a specific topic+feature
  // Keys: topicId_feature (e.g. "123_summary")
  const [activeTimestamps, setActiveTimestamps] = useState({});

  const summaryAttemptsRef = useRef({});
  const predictionAttemptsRef = useRef({});
  const traceCauseAttemptsRef = useRef({});

  // Initialize custom hook for API calls
  const { generateTraceCause } = useTraceCause();

  const MAX_RETRIES = 6;
  const RETRY_DELAY_MS = 10000;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.ai-toolbar-mobile')) {
        setMobileDropdownOpen({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Show error modal when topics fetch fails
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  const getTopicId = (t, idx) => {
    const directId = t?.topicId || t?.topic_id || t?.id;
    if (directId != null) {
      const candidate = String(directId).trim();
      if (candidate.length > 0) return candidate;
    }
    const slug = `${t.title || 'topic'}-${idx}`.replace(/[^a-zA-Z0-9]/g, '-');
    return slug || `topic-${idx}`;
  };

  const scheduleSummaryRetry = (topic, idx, attempt) => {
    setTimeout(() => {
      summaryAttemptsRef.current[getTopicId(topic, idx)] = attempt;
      handleGenerateSummary(topic, idx, attempt);
    }, RETRY_DELAY_MS);
  };

  const handleGenerateSummary = async (t, idx, attempt = 0) => {
    const id = getTopicId(t, idx);
    // Update active timestamp to force scroll
    setActiveTimestamps(prev => ({ ...prev, [`${id}_summary`]: Date.now() }));

    if (summaries[id]) {
      setSummaryCollapsed(prev => ({ ...prev, [id]: false }));
      return;
    }
    if (summaryLoading[id] && attempt === 0) {
      return;
    }
    summaryAttemptsRef.current[id] = attempt;
    setSummaryLoading(prev => ({ ...prev, [id]: true }));
    setSummaryErrors(prev => ({ ...prev, [id]: null }));
    const start = Date.now();
    try {
      const data = await graphqlService.getTopicSummary(id);
      const content = data?.content || '';
      const genTime = Date.now() - start;
      const processed = {
        content,
        service: 'cache',
        timestamp: data?.generatedAt || new Date().toISOString(),
        generationTime: genTime,
        wordCount: String(content || '').split(' ').length,
        metadata: {
          cached: data?.cached ?? true,
          remainingTtlSeconds: data?.remainingTtlSeconds ?? null,
        },
      };
      setSummaries(prev => ({ ...prev, [id]: processed }));
      setSummaryCollapsed(prev => ({ ...prev, [id]: false }));
      summaryAttemptsRef.current[id] = 0;
      setSummaryLoading(prev => ({ ...prev, [id]: false }));
    } catch (e) {
      const message = e?.message || String(e);
      const shouldRetry = /cache miss|failed to read summary|503/i.test(message);
      const nextAttempt = attempt + 1;
      if (shouldRetry && nextAttempt <= MAX_RETRIES) {
        console.info(`[SummaryRetry] ${id} attempt ${nextAttempt}/${MAX_RETRIES}`);
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

  const schedulePredictionRetry = (topic, idx, attempt) => {
    setTimeout(() => {
      predictionAttemptsRef.current[getTopicId(topic, idx)] = attempt;
      handleGeneratePrediction(topic, idx, attempt);
    }, RETRY_DELAY_MS);
  };

  const handleGeneratePrediction = async (t, idx, attempt = 0) => {
    const id = getTopicId(t, idx);
    // Update active timestamp to force scroll
    setActiveTimestamps(prev => ({ ...prev, [`${id}_prediction`]: Date.now() }));

    if (predictions[id]) {
      setPredictionCollapsed(prev => ({ ...prev, [id]: false }));
      return;
    }
    if (predictionLoading[id] && attempt === 0) {
      return;
    }
    predictionAttemptsRef.current[id] = attempt;
    setPredictionLoading(prev => ({ ...prev, [id]: true }));
    setPredictionErrors(prev => ({ ...prev, [id]: null }));
    const start = Date.now();
    try {
      const data = await graphqlService.getTopicPrediction(id);
      const content = data?.content || data?.impact_analysis || '';
      const genTime = Date.now() - start;
      const processed = {
        content,
        service: 'cache',
        timestamp: data?.generatedAt || new Date().toISOString(),
        generationTime: genTime,
        wordCount: String(content || '').split(' ').length,
        metadata: {
          cached: data?.cached ?? true,
          remainingTtlSeconds: data?.remainingTtlSeconds ?? null,
        },
      };
      setPredictions(prev => ({ ...prev, [id]: processed }));
      setPredictionCollapsed(prev => ({ ...prev, [id]: false }));
      predictionAttemptsRef.current[id] = 0;
      setPredictionLoading(prev => ({ ...prev, [id]: false }));
    } catch (e) {
      const message = e?.message || String(e);
      const shouldRetry = /cache miss|failed to read summary|503/i.test(message);
      const nextAttempt = attempt + 1;
      if (shouldRetry && nextAttempt <= MAX_RETRIES) {
        console.info(`[PredictionRetry] ${id} attempt ${nextAttempt}/${MAX_RETRIES}`);
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

  const handleGenerateTraceCause = async (t, idx) => {
    const id = getTopicId(t, idx);
    // Update active timestamp to force scroll
    setActiveTimestamps(prev => ({ ...prev, [`${id}_trace`]: Date.now() }));

    if (traceCauses[id]) {
      setTraceCauseCollapsed(prev => ({ ...prev, [id]: false }));
      return;
    }
    if (traceCauseLoading[id]) return;

    setTraceCauseLoading(prev => ({ ...prev, [id]: true }));
    setTraceCauseErrors(prev => ({ ...prev, [id]: null }));

    try {
      // Use direct service call or hook generator.
      // Since Home.jsx manages its own state maps, we'll call the service directly or reuse the hook's logic if possible.
      // But to fit the existing pattern of Home.jsx (manual state maps), let's call graphqlService directly
      const data = await graphqlService.getTopicTraceCause(id); // Use the method we added earlier
      const content = data?.content || '';

      const processed = {
        content,
        service: 'cache',
        timestamp: data?.generatedAt || new Date().toISOString(),
        metadata: {
          cached: data?.cached ?? true,
        },
      };

      setTraceCauses(prev => ({ ...prev, [id]: processed }));
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

  const toggleMobileDropdown = (t, idx) => {
    const id = getTopicId(t, idx);
    setMobileDropdownOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSourcesExpanded = (t, idx) => {
    const id = getTopicId(t, idx);
    setSourcesExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMobileAction = (action, t, idx) => {
    // Close dropdown first
    const id = getTopicId(t, idx);
    setMobileDropdownOpen(prev => ({ ...prev, [id]: false }));

    // Execute the action
    switch(action) {
      case 'summary':
        handleGenerateSummary(t, idx);
        break;
      case 'prediction':
        handleGeneratePrediction(t, idx);
        break;
      case 'traceCause':
        handleGenerateTraceCause(t, idx);
        break;
    }
  };

  const getTimeAgo = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };
  return (
    <div>
      {/* Floating Topic Navigation */}
      <TopicNav topics={topics} categorizedTopics={categorizedTopics} />
      <TodayArchiveSidebar entries={filteredArchiveEntries} />

      <div className="text-center mb-8">
        <h1 className="mb-4">Today's Global Topics</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Trending topics from around the world, organized by region
        </p>
        {(generatedDate || updatedAt) && !isStale && (
          <p
            style={{
              fontSize: '0.9rem',
              color: '#666',
              marginTop: '0.5rem',
            }}
          >
            {generatedDate ? `Topics from ${generatedDate}` : `Updated ${getTimeAgo(updatedAt)}`}
            {updatedAt && generatedDate && ` (${getTimeAgo(updatedAt)})`}
          </p>
        )}
        {isStale && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#ff9800',
              color: 'white',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️ Topics are being refreshed. Showing latest available data.</span>
            <button
              onClick={refetch}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: 'white',
                color: '#ff9800',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Refresh
            </button>
          </div>
        )}
        {hasNewData && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#4caf50',
              color: 'white',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>🆕 New topics available</span>
            <button
              onClick={refetch}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: 'white',
                color: '#4caf50',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Support Banner */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto 1.5rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#fafafa',
        border: '1px solid #e5e5e5',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontSize: '0.9rem',
        color: '#555',
      }}>
        <span>We run ad-free. Help us keep it that way</span>
        <a
          href="https://buymeacoffee.com/BenBen990505"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.75rem',
            backgroundColor: '#FFDD00',
            color: '#000',
            fontWeight: '600',
            fontSize: '0.85rem',
            borderRadius: '6px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Buy Me a Coffee
        </a>
      </div>

      {/* Topics list via AppSync */}
      {loading && (
        <div className="card text-center">
          <div style={{
            display: 'inline-block', width: 20, height: 20,
            border: '2px solid var(--border-color)',
            borderTop: '2px solid var(--text-primary)',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            marginBottom: '1rem'
          }} />
          <p style={{ margin: 0 }}>Loading Gemini topics...</p>
        </div>
      )}

      {!loading && topics && topics.length > 0 && (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {Object.entries(categorizedTopics)
            .filter(([, regionTopics]) => regionTopics.length > 0)
            .sort((a, b) => {
              if (a[0] === 'World') return 1;
              if (b[0] === 'World') return -1;
              return b[1].length - a[1].length;
            })
            .map(([region, regionTopics]) => (
              <div key={region} className="card" style={{ marginBottom: '2rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  borderBottom: '2px solid var(--border-color)',
                  paddingBottom: '0.5rem'
                }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                    {region}
                  </h2>
                  <span style={{
                    marginLeft: '1rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 'normal'
                  }}>
                    {regionTopics.length} topic{regionTopics.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {regionTopics.map((t, idx) => {
                    const globalIdx = topics.indexOf(t);
                    const topicId = getTopicId(t, globalIdx);
                    return (
                      <li key={globalIdx} id={`topic-${topicId}`} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong style={{ fontSize: '1.25rem' }}>{t.title}</strong>
                          {t.category && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              [{t.category}]
                            </span>
                          )}
                        </div>

                        {/* Desktop Layout - Only visible on desktop */}
                        <div className="topic-actions-desktop">
                          <div className="ai-toolbar">
                            <button
                              className={`ai-btn ai-btn-summary ${summaryLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                              onClick={() => handleGenerateSummary(t, globalIdx)}
                              disabled={summaryLoading[getTopicId(t, globalIdx)]}
                            >
                              {summaryLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner"></span>}
                              Summarize
                            </button>

                            <button
                              className={`ai-btn ai-btn-predict ${predictionLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                              onClick={() => handleGeneratePrediction(t, globalIdx)}
                              disabled={predictionLoading[getTopicId(t, globalIdx)]}
                            >
                              {predictionLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner"></span>}
                              Predict
                            </button>

                            <button
                              className={`ai-btn ai-btn-trace ${traceCauseLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                              onClick={() => handleGenerateTraceCause(t, globalIdx)}
                              disabled={traceCauseLoading[getTopicId(t, globalIdx)]}
                            >
                              {traceCauseLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner"></span>}
                              Trace Cause
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {/* Sources Toggle Button - on same line, left of View Google News */}
                            {Array.isArray(t.sources) && t.sources.length > 0 && (
                              <button
                                onClick={() => toggleSourcesExpanded(t, globalIdx)}
                                style={{
                                  background: 'none',
                                  border: '1px solid #e0e0e0',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: '500',
                                  color: '#1a73e8',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <span>Sources ({t.sources.length})</span>
                                <span style={{ fontSize: '0.7rem' }}>{sourcesExpanded[getTopicId(t, globalIdx)] ? '▲' : '▼'}</span>
                              </button>
                            )}

                            {(() => {
                              const fullTitle = String(t.title || '').replace(/\s+/g, ' ').trim();
                              const sourceUrl = fullTitle
                                ? `https://www.google.com/search?q=${encodeURIComponent(fullTitle)}&tbm=nws&tbs=qdr:d`
                                : '';

                              return (
                                <a
                                  href={sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-link"
                                  style={{ fontSize: '0.85rem', color: '#000000', textDecoration: 'none', fontWeight: '500' }}
                                >
                                  View Google News ↗
                                </a>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Helper text - below the toolbar row */}
                        <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
                            Note: Very recent news may take time to appear in search results
                          </div>
                        </div>

                        {/* Mobile Layout - Only visible on mobile */}
                        <div className="topic-actions-mobile">
                          <div className="ai-toolbar-mobile">
                            <button
                              className="ai-dropdown-trigger"
                              onClick={() => toggleMobileDropdown(t, globalIdx)}
                            >
                              Actions
                              <span className={`ai-chevron ${mobileDropdownOpen[getTopicId(t, globalIdx)] ? 'open' : ''}`}>▼</span>
                            </button>

                            {mobileDropdownOpen[getTopicId(t, globalIdx)] && (
                              <div className="ai-dropdown-menu">
                                <button
                                  className={`ai-dropdown-item ${summaryLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                                  onClick={() => handleMobileAction('summary', t, globalIdx)}
                                  disabled={summaryLoading[getTopicId(t, globalIdx)]}
                                >
                                  {summaryLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner-small"></span>}
                                  Summarize
                                  {summaries[getTopicId(t, globalIdx)] && <span className="ai-checkmark">✓</span>}
                                </button>
                                <button
                                  className={`ai-dropdown-item ${predictionLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                                  onClick={() => handleMobileAction('prediction', t, globalIdx)}
                                  disabled={predictionLoading[getTopicId(t, globalIdx)]}
                                >
                                  {predictionLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner-small"></span>}
                                  Predict
                                  {predictions[getTopicId(t, globalIdx)] && <span className="ai-checkmark">✓</span>}
                                </button>
                                <button
                                  className={`ai-dropdown-item ${traceCauseLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                                  onClick={() => handleMobileAction('traceCause', t, globalIdx)}
                                  disabled={traceCauseLoading[getTopicId(t, globalIdx)]}
                                >
                                  {traceCauseLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner-small"></span>}
                                  Trace Cause
                                  {traceCauses[getTopicId(t, globalIdx)] && <span className="ai-checkmark">✓</span>}
                                </button>
                              </div>
                            )}
                          </div>

                          {(() => {
                            const fullTitle = String(t.title || '').replace(/\s+/g, ' ').trim();
                            const sourceUrl = fullTitle
                              ? `https://www.google.com/search?q=${encodeURIComponent(fullTitle)}&tbm=nws&tbs=qdr:d`
                              : '';

                            return (
                              <div>
                                <a
                                  href={sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-link"
                                  style={{ fontSize: '0.85rem', color: '#000000', textDecoration: 'none', fontWeight: '500' }}
                                >
                                  View Google News ↗
                                </a>

                                {/* Sources Toggle Button */}
                                {Array.isArray(t.sources) && t.sources.length > 0 && (
                                  <button
                                    onClick={() => toggleSourcesExpanded(t, globalIdx)}
                                    style={{
                                      background: 'none',
                                      border: '1px solid #e0e0e0',
                                      borderRadius: '4px',
                                      padding: '0.25rem 0.5rem',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      fontWeight: '500',
                                      color: '#1a73e8',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      transition: 'all 0.2s',
                                      marginTop: '0.5rem',
                                      width: '100%',
                                      justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                  >
                                    <span>Sources ({t.sources.length})</span>
                                    <span style={{ fontSize: '0.7rem' }}>{sourcesExpanded[getTopicId(t, globalIdx)] ? '▲' : '▼'}</span>
                                  </button>
                                )}

                                {/* Helper text */}
                                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                  Note: Very recent news may take time to appear in search results
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Sources Display */}
                        {Array.isArray(t.sources) && t.sources.length > 0 && sourcesExpanded[getTopicId(t, globalIdx)] && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <div className="ai-result-card">
                              <div className="ai-result-header" onClick={() => toggleSourcesExpanded(t, globalIdx)} style={{ cursor: 'pointer' }}>
                                <div className="ai-result-title" style={{ color: '#1a73e8' }}>
                                  📰 Article Sources
                                </div>
                                <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                                  Hide
                                </div>
                              </div>

                              <div className="ai-result-content">
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                  {t.sources.map((source, srcIdx) => (
                                    <div
                                      key={srcIdx}
                                      style={{
                                        marginBottom: srcIdx < t.sources.length - 1 ? '16px' : '0',
                                        paddingBottom: srcIdx < t.sources.length - 1 ? '16px' : '0',
                                        borderBottom: srcIdx < t.sources.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none'
                                      }}
                                    >
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: '0.95rem',
                                          color: '#1a73e8',
                                          textDecoration: 'none',
                                          display: 'block',
                                          lineHeight: '1.5',
                                          fontWeight: '500',
                                          marginBottom: '4px'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                      >
                                        {source.title || 'Untitled'}
                                      </a>
                                      <div style={{
                                        fontSize: '0.8rem',
                                        color: '#6b7280',
                                        lineHeight: '1.4'
                                      }}>
                                        {source.source} {source.age ? `• ${source.age}` : ''}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>Real-time News Sources</span>
                                  <div className="ai-result-actions">
                                    <div className="ai-action-icon" onClick={() => toggleSourcesExpanded(t, globalIdx)} title="Close">✕</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* AI Summary Display */}
                        <div style={{ marginTop: '0.5rem' }}>
                          <SummaryDisplay
                            summary={summaries[getTopicId(t, globalIdx)]}
                            isLoading={summaryLoading[getTopicId(t, globalIdx)]}
                            error={summaryErrors[getTopicId(t, globalIdx)]}
                            onRetry={() => handleGenerateSummary(t, globalIdx)}
                            onClear={() => handleClearSummary(t, globalIdx)}
                            isCollapsed={summaryCollapsed[getTopicId(t, globalIdx)]}
                            onToggleCollapse={() => toggleSummaryCollapsed(t, globalIdx)}
                            lastActive={activeTimestamps[`${getTopicId(t, globalIdx)}_summary`]}
                          />
                        </div>

                        {/* AI Prediction Display */}
                        <div style={{ marginTop: '0.5rem' }}>
                          <PredictionDisplay
                            prediction={predictions[getTopicId(t, globalIdx)]}
                            isLoading={predictionLoading[getTopicId(t, globalIdx)]}
                            error={(predictionErrors[getTopicId(t, globalIdx)] || null)}
                            onRetry={() => handleGeneratePrediction(t, globalIdx)}
                            onClear={() => handleClearPrediction(t, globalIdx)}
                            isCollapsed={predictionCollapsed[getTopicId(t, globalIdx)]}
                            onToggleCollapse={() => togglePredictionCollapsed(t, globalIdx)}
                            lastActive={activeTimestamps[`${getTopicId(t, globalIdx)}_prediction`]}
                          />
                        </div>

                        {/* AI Trace Cause Display */}
                        <div style={{ marginTop: '0.5rem' }}>
                          <TraceCauseDisplay
                            traceCause={traceCauses[getTopicId(t, globalIdx)]}
                            isLoading={traceCauseLoading[getTopicId(t, globalIdx)]}
                            error={traceCauseErrors[getTopicId(t, globalIdx)]}
                            onRetry={() => handleGenerateTraceCause(t, globalIdx)}
                            onClear={() => handleClearTraceCause(t, globalIdx)}
                            isCollapsed={traceCauseCollapsed[getTopicId(t, globalIdx)]}
                            onToggleCollapse={() => toggleTraceCauseCollapsed(t, globalIdx)}
                            lastActive={activeTimestamps[`${getTopicId(t, globalIdx)}_trace`]}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
          ))}
        </div>
      )}

      {/* Search UI removed; focusing on AppSync-backed topics display */}
    </div>
  );
}

export default Home;
