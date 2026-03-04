import { useState, useEffect, useRef } from 'react';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';
import TraceCauseDisplay from './TraceCauseDisplay';
import graphqlService from '../utils/graphqlService';
import { useLang } from '../contexts/LanguageContext';
import { useError } from '../contexts/ErrorContext';
import { t, tCategory, getLocalizedTitle } from '../utils/i18n';

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
  const { lang } = useLang();
  const { showError } = useError();
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const preAi = isArchive ? (lang === 'ja' ? topic.ai_ja || topic.ai : lang === 'zh' ? topic.ai_zh || topic.ai : topic.ai) : null;

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
      const data = await graphqlService.getTopicSummary(topicId, lang);
      setSummary(processContent(data));
      setSummaryCollapsed(false);
    } catch (e) {
      showError(e?.message || String(e));
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
      const data = await graphqlService.getTopicPrediction(topicId, lang);
      setPrediction(processContent({ content: data?.content || data?.impact_analysis || '', ...data }));
      setPredictionCollapsed(false);
    } catch (e) {
      showError(e?.message || String(e));
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
      const data = await graphqlService.getTopicTraceCause(topicId, lang);
      setTraceCause(processContent(data));
      setTraceCauseCollapsed(false);
    } catch (e) {
      showError(e?.message || String(e));
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
        <span className="map-topic-card-title">{getLocalizedTitle(topic, lang)}</span>
        <span className="map-category-badge" style={{ backgroundColor: color }}>
          {tCategory(category, lang)}
        </span>
      </div>

      {otherCodes.length > 0 && (
        <div className="map-topic-affected">
          <span className="map-topic-affected-label">{t('alsoAffects', lang)}: </span>
          {otherCodes.map(c => getFlagEmoji(c)).join(' ')}
          {' '}
          <span style={{ color: '#888' }}>{otherCodes.join(', ')}</span>
        </div>
      )}

      {/* Sources */}
      {Array.isArray(topic.sources) && topic.sources.length > 0 && (
        <>
          <button className="map-sources-toggle" onClick={() => setSourcesOpen(o => !o)}>
            {sourcesOpen ? `▲ ${t('hideSources', lang)}` : `▼ ${t('sources', lang)}`} ({topic.sources.length})
          </button>
          {sourcesOpen && (
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
        </>
      )}

      {/* AI action buttons */}
      <div className="map-topic-ai-toolbar">
        <button
          className={`map-ai-btn map-ai-btn-summary${summaryLoading ? ' loading' : ''}`}
          onClick={handleSummary}
          disabled={summaryLoading}
        >
          {summaryLoading && <span className="map-ai-spinner" />}
          {t('summarize', lang)}
        </button>
        <button
          className={`map-ai-btn map-ai-btn-predict${predictionLoading ? ' loading' : ''}`}
          onClick={handlePrediction}
          disabled={predictionLoading}
        >
          {predictionLoading && <span className="map-ai-spinner" />}
          {t('predict', lang)}
        </button>
        <button
          className={`map-ai-btn map-ai-btn-trace${traceCauseLoading ? ' loading' : ''}`}
          onClick={handleTraceCause}
          disabled={traceCauseLoading}
        >
          {traceCauseLoading && <span className="map-ai-spinner" />}
          {t('traceCause', lang)}
        </button>
      </div>

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

      {/* Footer actions */}
      <div className="map-topic-actions">
        {!isArchive && (
          <button
            className={`map-topic-story-btn${isActive ? ' active' : ''}`}
            onClick={() => onTopicSelect(isActive ? null : topic)}
          >
            {isActive ? t('clearStory', lang) : `▶ ${t('storyFlow', lang)}`}
          </button>
        )}
        <a
          href={buildNewsSearchUrl(getLocalizedTitle(topic, lang))}
          target="_blank"
          rel="noopener noreferrer"
          className="map-topic-news-link"
        >
          {t('viewGoogleNews', lang)} ↗
        </a>
      </div>
    </div>
  );
}

export default function MapSidePanel({ isOpen, onClose, country, topics, archiveTopics, countryTopicMap, archiveCountryTopicMap, selectedTopicId, onTopicSelect }) {
  const { lang } = useLang();

  if (!country) return null;

  const info = countryTopicMap?.[country] || archiveCountryTopicMap?.[country] || {};
  const panelTopics = topics || info.topics || [];
  const panelArchiveTopics = archiveTopics || [];
  const countryName = info.name || country;
  const totalCount = panelTopics.length + panelArchiveTopics.length;

  return (
    <>
      {isOpen && <div className="map-panel-backdrop" onClick={onClose} />}
      <div className={`map-side-panel${isOpen ? ' open' : ''}`}>
        <div className="map-side-panel-header">
          <span className="map-side-panel-flag">{getFlagEmoji(country)}</span>
          <div className="map-side-panel-title">
            <h3>{countryName}</h3>
            <div className="map-side-panel-subtitle">
              {panelTopics.length > 0
                ? `${panelTopics.length} ${t('now', lang || 'en')}${panelArchiveTopics.length > 0 ? ` · ${panelArchiveTopics.length} ${t('earlier', lang || 'en')}` : ''}`
                : `${panelArchiveTopics.length} ${t('earlierTopics', lang || 'en')}`
              }
            </div>
          </div>
          <button className="map-side-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="map-side-panel-body">
          {totalCount === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
              {t('noTopicsForCountry', lang)}
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
                    <span>{t('earlierToday', lang)}</span>
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
