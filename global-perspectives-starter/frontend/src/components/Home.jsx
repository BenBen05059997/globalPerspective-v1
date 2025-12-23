import React, { useState, useRef } from 'react';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import SummaryDisplay from './SummaryDisplay';

import PredictionDisplay from './PredictionDisplay';
import TraceCauseDisplay from './TraceCauseDisplay';
import { useTraceCause } from '../hooks/useTraceCause';
import graphqlService from '../utils/graphqlService';
import './AIComponents.css'; // Import new premium styles

// Regional categorization function
function categorizeByRegion(topics) {
  const regions = {
    'Asia': [],
    'Africa': [],
    'North America': [],
    'Europe': [],
    'Middle East': [],
    'South America': [],
    'World': []
  };

  topics.forEach(topic => {
    const topicRegions = Array.isArray(topic.regions) ? topic.regions.map(r => r.toLowerCase()) : [];

    // Categorize by region (case-insensitive)
    if (topicRegions.some(r => r.includes('china') || r.includes('japan') || r.includes('korea') || r.includes('india') || r.includes('singapore') || r.includes('thailand') || r.includes('vietnam') || r.includes('malaysia') || r.includes('indonesia') || r.includes('philippines') || r.includes('pakistan') || r.includes('bangladesh') || r.includes('sri lanka') || r.includes('nepal') || r.includes('bhutan') || r.includes('myanmar') || r.includes('cambodia') || r.includes('laos'))) {
      regions['Asia'].push(topic);
    } else if (topicRegions.some(r => r.includes('nigeria') || r.includes('south africa') || r.includes('egypt') || r.includes('kenya') || r.includes('ethiopia') || r.includes('ghana') || r.includes('morocco') || r.includes('tanzania') || r.includes('uganda') || r.includes('algeria') || r.includes('sudan') || r.includes('libya') || r.includes('tunisia') || r.includes('angola') || r.includes('mozambique') || r.includes('zambia'))) {
      regions['Africa'].push(topic);
    } else if (topicRegions.some(r => r.includes('usa') || r.includes('united states') || r.includes('canada') || r.includes('mexico') || r.includes('guatemala') || r.includes('costa rica') || r.includes('panama') || r.includes('cuba') || r.includes('jamaica') || r.includes('haiti') || r.includes('dominican republic'))) {
      regions['North America'].push(topic);
    } else if (topicRegions.some(r => r.includes('uk') || r.includes('britain') || r.includes('france') || r.includes('germany') || r.includes('italy') || r.includes('spain') || r.includes('netherlands') || r.includes('sweden') || r.includes('norway') || r.includes('denmark') || r.includes('finland') || r.includes('poland') || r.includes('czech') || r.includes('austria') || r.includes('switzerland') || r.includes('belgium') || r.includes('portugal') || r.includes('greece'))) {
      regions['Europe'].push(topic);
    } else if (topicRegions.some(r => r.includes('israel') || r.includes('palestine') || r.includes('saudi arabia') || r.includes('iran') || r.includes('iraq') || r.includes('syria') || r.includes('lebanon') || r.includes('jordan') || r.includes('uae') || r.includes('qatar') || r.includes('kuwait') || r.includes('bahrain') || r.includes('oman') || r.includes('yemen') || r.includes('turkey'))) {
      regions['Middle East'].push(topic);
    } else if (topicRegions.some(r => r.includes('brazil') || r.includes('argentina') || r.includes('chile') || r.includes('peru') || r.includes('colombia') || r.includes('venezuela') || r.includes('ecuador') || r.includes('bolivia') || r.includes('paraguay') || r.includes('uruguay') || r.includes('guyana') || r.includes('suriname'))) {
      regions['South America'].push(topic);
    } else {
      // World category - either affects multiple regions or unclear categorization
      regions['World'].push(topic);
    }
  });

  return regions;
}

function Home() {
  const { topics, loading, error, refetch, isStale, updatedAt, hasNewData } = useGeminiTopics();

  // Organize topics by region
  const categorizedTopics = React.useMemo(() => {
    return categorizeByRegion(topics);
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
      <div className="text-center mb-8">
        <h1 className="mb-4">Today's Global Topics</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Trending topics from around the world, organized by region
        </p>
        {updatedAt && (
          <p
            style={{
              fontSize: '0.9rem',
              color: isStale ? '#ff9800' : '#666',
              marginTop: '0.5rem',
            }}
          >
            {isStale && '⚠️ '}
            Updated {getTimeAgo(updatedAt)}
            {isStale && ' (refreshing...)'}
          </p>
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

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
          <div style={{ marginTop: '1rem' }}>
            <button onClick={refetch} className="btn btn-primary">Retry</button>
          </div>
        </div>
      )}

      {!loading && topics && topics.length > 0 && (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {Object.entries(categorizedTopics).map(([region, regionTopics]) => (
            regionTopics.length > 0 && (
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
                    return (
                      <li key={globalIdx} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong style={{ fontSize: '1.25rem' }}>{t.title}</strong>
                          {t.category && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              [{t.category}]
                            </span>
                          )}
                        </div>

                        {/* Premium AI Toolbar */}
                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div className="ai-toolbar">
                            {/* Summarize Button */}
                            <button
                              className={`ai-btn ai-btn-summary ${summaryLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                              onClick={() => handleGenerateSummary(t, globalIdx)}
                              disabled={summaryLoading[getTopicId(t, globalIdx)]}
                            >
                              {summaryLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner"></span>}
                              Summarize
                            </button>

                            {/* Predict Button */}
                            <button
                              className={`ai-btn ai-btn-predict ${predictionLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                              onClick={() => handleGeneratePrediction(t, globalIdx)}
                              disabled={predictionLoading[getTopicId(t, globalIdx)]}
                            >
                              {predictionLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner"></span>}
                              Predict
                            </button>

                            {/* Trace Cause Button */}
                            <button
                              className={`ai-btn ai-btn-trace ${traceCauseLoading[getTopicId(t, globalIdx)] ? 'loading' : ''}`}
                              onClick={() => handleGenerateTraceCause(t, globalIdx)}
                              disabled={traceCauseLoading[getTopicId(t, globalIdx)]}
                            >
                              {traceCauseLoading[getTopicId(t, globalIdx)] && <span className="ai-spinner"></span>}
                              Trace Cause
                            </button>
                          </div>

                          {(() => {
                            // Source link moved to right side for balance
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
                                View Sources ↗
                              </a>
                            );
                          })()}
                        </div>

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
            )
          ))}
        </div>
      )}

      {/* Search UI removed; focusing on AppSync-backed topics display */}
    </div>
  );
}

export default Home;
