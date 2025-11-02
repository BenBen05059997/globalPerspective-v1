import React, { useState } from 'react';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';
import graphqlService from '../utils/graphqlService';

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
  const { topics, loading, error, refetch } = useGeminiTopics();
  
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

  const getTopicId = (t, idx) => {
    const directId = t?.topicId || t?.topic_id || t?.id;
    if (directId != null) {
      const candidate = String(directId).trim();
      if (candidate.length > 0) return candidate;
    }
    const slug = `${t.title || 'topic'}-${idx}`.replace(/[^a-zA-Z0-9]/g, '-');
    return slug || `topic-${idx}`;
  };

  const handleGenerateSummary = async (t, idx) => {
    const id = getTopicId(t, idx);
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
    } catch (e) {
      setSummaryErrors(prev => ({ ...prev, [id]: e.message || String(e) }));
    } finally {
      setSummaryLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleClearSummary = (t, idx) => {
    const id = getTopicId(t, idx);
    setSummaries(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSummaryErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSummaryCollapsed(prev => ({ ...prev, [id]: true }));
  };

  const toggleSummaryCollapsed = (t, idx) => {
    const id = getTopicId(t, idx);
    setSummaryCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGeneratePrediction = async (t, idx) => {
    const id = getTopicId(t, idx);
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
    } catch (e) {
      setPredictionErrors(prev => ({ ...prev, [id]: e.message || String(e) }));
    } finally {
      setPredictionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleClearPrediction = (t, idx) => {
    const id = getTopicId(t, idx);
    setPredictions(prev => { const n = { ...prev }; delete n[id]; return n; });
    setPredictionErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    setPredictionCollapsed(prev => ({ ...prev, [id]: true }));
  };

  const togglePredictionCollapsed = (t, idx) => {
    const id = getTopicId(t, idx);
    setPredictionCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };
  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="mb-4">Today's Global Topics</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Trending topics from around the world, organized by region
        </p>
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
                        
                        {/* Sources + AI Actions horizontally aligned */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {(() => {
                            // Use the exact homepage title as the sources query
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
                                style={{ fontSize: '0.9rem' }}
                              >
                                View sources →
                              </a>
                            );
                          })()}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-summarize" onClick={() => handleGenerateSummary(t, globalIdx)}>
                              Summarize
                            </button>
                            <button className="btn btn-predict" onClick={() => handleGeneratePrediction(t, globalIdx)}>
                              Predict
                            </button>
                          </div>
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
