import React, { useState } from 'react';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';
import graphqlService from '../utils/graphqlService';

function Home() {
  const { topics, loading, error, refetch } = useGeminiTopics();

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
        <h1 className="mb-4">Today's Topics</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Trending topics discovered by Google Gemini 
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
        <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ marginBottom: '1rem' }}>Trending Topics</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {topics.map((t, idx) => (
              <li key={idx} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: '2rem' }}>
                  <strong style={{ fontSize: '1.5rem' }}>{t.title}</strong>
                  {t.category && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      [{t.category}]
                    </span>
                  )}
                </div>
                {t.description && (
                  <div style={{ marginBottom: '0.5rem' }}>{t.description}</div>
                )}
                {/* Regions and Keywords hidden per UI request */}
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
                    <button className="btn btn-summarize" onClick={() => handleGenerateSummary(t, idx)}>
                      Summarize
                    </button>
                    <button className="btn btn-predict" onClick={() => handleGeneratePrediction(t, idx)}>
                      Predict
                    </button>
                  </div>
                </div>

                {/* AI Summary Display */}
                <div style={{ marginTop: '0.5rem' }}>
                  <SummaryDisplay
                    summary={summaries[getTopicId(t, idx)]}
                    isLoading={summaryLoading[getTopicId(t, idx)]}
                    error={summaryErrors[getTopicId(t, idx)]}
                    onRetry={() => handleGenerateSummary(t, idx)}
                    onClear={() => handleClearSummary(t, idx)}
                    isCollapsed={summaryCollapsed[getTopicId(t, idx)]}
                    onToggleCollapse={() => toggleSummaryCollapsed(t, idx)}
                  />
                </div>

                {/* AI Prediction Display */}
                <div style={{ marginTop: '0.5rem' }}>
                  <PredictionDisplay
                    prediction={predictions[getTopicId(t, idx)]}
                    isLoading={predictionLoading[getTopicId(t, idx)]}
                    error={(predictionErrors[getTopicId(t, idx)] || null)}
                    onRetry={() => handleGeneratePrediction(t, idx)}
                    onClear={() => handleClearPrediction(t, idx)}
                    isCollapsed={predictionCollapsed[getTopicId(t, idx)]}
                    onToggleCollapse={() => togglePredictionCollapsed(t, idx)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search UI removed; focusing on AppSync-backed topics display */}
    </div>
  );
}

export default Home;
