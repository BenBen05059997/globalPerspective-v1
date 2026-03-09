import { useState, useEffect, useRef } from 'react';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';
import TraceCauseDisplay from './TraceCauseDisplay';
import graphqlService from '../utils/graphqlService';
import { useError } from '../contexts/ErrorContext';
import './AIComponents.css';

const CATEGORY_COLORS = {
  conflict:   '#ef4444',
  military:   '#ef4444',
  disaster:   '#f97316',
  politics:   '#3b82f6',
  economy:    '#22c55e',
  technology: '#8b5cf6',
  health:     '#14b8a6',
  other:      '#6b7280',
};

const getFlagEmoji = (code) => {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  const codePoints = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const buildNewsSearchUrl = (title) => {
  if (!title) return '';
  const query = String(title).replace(/\s+/g, ' ').trim();
  return query ? `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&tbs=qdr:d` : '';
};

function processContent(data) {
  return {
    content: data?.content || '',
    service: 'cache',
    timestamp: data?.generatedAt || new Date().toISOString(),
    metadata: { cached: data?.cached ?? true },
  };
}

function TopicCard({ topic, countryCodes, selectedTopicId, onTopicSelect, isArchive }) {
  const { showError } = useError();
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const preAi = isArchive ? topic.ai : null;

  const [summary, setSummary] = useState(preAi?.summary ? processContent({ content: preAi.summary }) : null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);

  const [prediction, setPrediction] = useState(preAi?.prediction ? processContent({ content: preAi.prediction }) : null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState(null);
  const [predictionCollapsed, setPredictionCollapsed] = useState(true);

  const [traceCause, setTraceCause] = useState(preAi?.trace_cause ? processContent({ content: preAi.trace_cause }) : null);
  const [traceCauseLoading, setTraceCauseLoading] = useState(false);
  const [traceCauseError, setTraceCauseError] = useState(null);
  const [traceCauseCollapsed, setTraceCauseCollapsed] = useState(true);

  const isActive = selectedTopicId === topic.topicId || selectedTopicId === topic.id;
  const category = (topic.category || 'other').toLowerCase();
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  const topicId = topic.topicId || topic.id;
  const otherCodes = countryCodes.filter(Boolean);
  const cardRef = useRef(null);
  const autoFetched = useRef(false);

  useEffect(() => {
    if (isActive && !summary && !summaryLoading && !isArchive && !autoFetched.current) {
      autoFetched.current = true;
      handleSummaryFn();
    }
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  const handleSummaryFn = async () => {
    if (summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await graphqlService.getTopicSummary(topicId);
      setSummary(processContent(data));
      setSummaryCollapsed(false);
    } catch (e) {
      const message = e?.message || String(e);
      setSummaryError(message);
      showError(message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSummary = async () => {
    if (isArchive || summary) { setSummaryCollapsed(c => !c); return; }
    await handleSummaryFn();
  };

  const handlePrediction = async () => {
    if (isArchive || prediction) { setPredictionCollapsed(c => !c); return; }
    if (predictionLoading) return;
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const data = await graphqlService.getTopicPrediction(topicId);
      setPrediction(processContent({ content: data?.content || data?.impact_analysis || '', ...data }));
      setPredictionCollapsed(false);
    } catch (e) {
      const message = e?.message || String(e);
      setPredictionError(message);
      showError(message);
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleTraceCause = async () => {
    if (isArchive || traceCause) { setTraceCauseCollapsed(c => !c); return; }
    if (traceCauseLoading) return;
    setTraceCauseLoading(true);
    setTraceCauseError(null);
    try {
      const data = await graphqlService.getTopicTraceCause(topicId);
      setTraceCause(processContent(data));
      setTraceCauseCollapsed(false);
    } catch (e) {
      const message = e?.message || String(e);
      setTraceCauseError(message);
      showError(message);
    } finally {
      setTraceCauseLoading(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`map-topic-card${isActive ? ' active' : ''}${isArchive ? ' archive' : ''}`}
      style={{ borderLeftColor: isArchive ? '#94a3b8' : color }}
      onClick={(e) => {
        if (e.target.closest('button, a, .map-sources-list, .ai-result-card')) return;
        handleSummary();
      }}
    >
      <div className="map-topic-card-header">
        <span className="map-topic-card-title">{topic.title}</span>
        <span className="map-category-badge" style={{ backgroundColor: color }}>
          {category}
        </span>
      </div>

      {otherCodes.length > 0 && (
        <div className="map-topic-affected">
          <span className="map-topic-affected-label">Also affects: </span>
          {otherCodes.map(c => getFlagEmoji(c)).join(' ')}
          {' '}
          <span style={{ color: '#888' }}>{otherCodes.join(', ')}</span>
        </div>
      )}

      {/* AI toolbar — glass pill matching home page */}
      <div className="ai-toolbar map-ai-toolbar-compact">
        <button
          className={`ai-btn ai-btn-summary${summaryLoading ? ' loading' : ''}`}
          onClick={handleSummary}
          disabled={summaryLoading}
        >
          {summaryLoading && <span className="ai-spinner" />}
          Summarize
        </button>
        <button
          className={`ai-btn ai-btn-predict${predictionLoading ? ' loading' : ''}`}
          onClick={handlePrediction}
          disabled={predictionLoading}
        >
          {predictionLoading && <span className="ai-spinner" />}
          Predict
        </button>
        <button
          className={`ai-btn ai-btn-trace${traceCauseLoading ? ' loading' : ''}`}
          onClick={handleTraceCause}
          disabled={traceCauseLoading}
        >
          {traceCauseLoading && <span className="ai-spinner" />}
          Trace
        </button>
        <button
          className={`ai-btn ai-btn-related${isActive ? ' active' : ''}`}
          onClick={() => onTopicSelect(isActive ? null : topic)}
        >
          {isActive ? '★ Related' : '☆ Related'}
        </button>
      </div>

      {/* Footer row: sources + Google News */}
      <div className="map-topic-footer">
        {Array.isArray(topic.sources) && topic.sources.length > 0 ? (
          <button className="map-sources-toggle" onClick={() => setSourcesOpen(o => !o)}>
            {sourcesOpen ? '▲ Hide' : '▼ Sources'} ({topic.sources.length})
          </button>
        ) : (
          <span />
        )}
        <a
          href={buildNewsSearchUrl(topic.title)}
          target="_blank"
          rel="noopener noreferrer"
          className="map-topic-news-link"
        >
          Google News ↗
        </a>
      </div>

      {/* Sources list (expanded) */}
      {sourcesOpen && Array.isArray(topic.sources) && topic.sources.length > 0 && (
        <div className="map-sources-list">
          {topic.sources.map((s, i) => (
            <div key={i} className="map-source-item">
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                className="map-source-link" title={s.title}>
                {s.title || s.source || 'Source'}
              </a>
              {s.age && <span className="map-source-age">{s.age}</span>}
            </div>
          ))}
        </div>
      )}

      {/* AI Results */}
      <SummaryDisplay
        summary={summary}
        isLoading={summaryLoading}
        error={summaryError}
        onRetry={handleSummary}
        onClear={() => { setSummary(null); setSummaryError(null); setSummaryCollapsed(true); }}
        isCollapsed={summaryCollapsed}
        onToggleCollapse={() => setSummaryCollapsed(c => !c)}
      />
      <PredictionDisplay
        prediction={prediction}
        isLoading={predictionLoading}
        error={predictionError}
        onRetry={handlePrediction}
        onClear={() => { setPrediction(null); setPredictionError(null); setPredictionCollapsed(true); }}
        isCollapsed={predictionCollapsed}
        onToggleCollapse={() => setPredictionCollapsed(c => !c)}
      />
      <TraceCauseDisplay
        traceCause={traceCause}
        isLoading={traceCauseLoading}
        error={traceCauseError}
        onRetry={handleTraceCause}
        onClear={() => { setTraceCause(null); setTraceCauseError(null); setTraceCauseCollapsed(true); }}
        isCollapsed={traceCauseCollapsed}
        onToggleCollapse={() => setTraceCauseCollapsed(c => !c)}
      />
    </div>
  );
}

const PANEL_WIDTH_KEY = 'map_side_panel_width';
const PANEL_MIN = 280;
const PANEL_MAX = 640;

export default function MapSidePanel({ isOpen, onClose, country, topics, archiveTopics, countryTopicMap, archiveCountryTopicMap, selectedTopicId, onTopicSelect }) {
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(PANEL_WIDTH_KEY), 10);
    return saved && saved >= PANEL_MIN && saved <= PANEL_MAX ? saved : 380;
  });
  const dragging = useRef(false);

  const onDragStart = (e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!dragging.current) return;
      const newWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, window.innerWidth - ev.clientX));
      setPanelWidth(newWidth);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setPanelWidth(w => { localStorage.setItem(PANEL_WIDTH_KEY, w); return w; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!country) return null;

  const info = countryTopicMap?.[country] || archiveCountryTopicMap?.[country] || {};
  const panelTopics = topics || info.topics || [];
  const panelArchiveTopics = archiveTopics || [];
  const countryName = info.name || country;
  const totalCount = panelTopics.length + panelArchiveTopics.length;

  return (
    <>
      {isOpen && <div className="map-panel-backdrop" onClick={onClose} />}
      <div className={`map-side-panel${isOpen ? ' open' : ''}`} style={{ width: panelWidth }}>
        <div className="map-side-panel-resize-handle" onMouseDown={onDragStart} />
        <div className="map-side-panel-header">
          <span className="map-side-panel-flag">{getFlagEmoji(country)}</span>
          <div className="map-side-panel-title">
            <h3>{countryName}</h3>
            <div className="map-side-panel-subtitle">
              {panelTopics.length > 0
                ? `${panelTopics.length} now${panelArchiveTopics.length > 0 ? ` · ${panelArchiveTopics.length} earlier` : ''}`
                : `${panelArchiveTopics.length} earlier topic${panelArchiveTopics.length !== 1 ? 's' : ''}`
              }
            </div>
          </div>
          <button className="map-side-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="map-side-panel-body">
          {totalCount === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
              No topics found for this country.
            </div>
          ) : (
            <>
              {panelTopics.map((topic, i) => (
                <TopicCard
                  key={topic.topicId || topic.id || i}
                  topic={topic}
                  countryCodes={info.allCodes || []}
                  selectedTopicId={selectedTopicId}
                  onTopicSelect={onTopicSelect}
                />
              ))}
              {panelArchiveTopics.length > 0 && (
                <>
                  <div className="map-archive-divider">
                    <span>Earlier today</span>
                  </div>
                  {panelArchiveTopics.map((topic, i) => (
                    <TopicCard
                      key={`archive-${topic.topicId || i}`}
                      topic={topic}
                      countryCodes={[]}
                      selectedTopicId={selectedTopicId}
                      onTopicSelect={onTopicSelect}
                      isArchive
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
