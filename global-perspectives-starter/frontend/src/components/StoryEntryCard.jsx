import { useState } from 'react';
import { CATEGORY_BADGE_COLORS } from './WeeklyPage';

export default function StoryEntryCard({ entry, compact }) {
  const [activeTab, setActiveTab] = useState(null);
  const hasAi = entry.ai?.summary || entry.ai?.trace_cause || entry.ai?.prediction;
  const aiKey = activeTab === 'trace' ? 'trace_cause' : activeTab;

  const category = entry.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];

  return (
    <div className={`story-entry-card ${compact ? 'compact' : ''}`}>
      {category && (
        <span className="story-category-badge" style={{ marginBottom: 4, display: 'inline-block', ...(catColors ? { background: catColors.bg, color: catColors.color } : {}) }}>
          {category}
        </span>
      )}
      <div className="story-entry-title">{entry.title}</div>
      {entry.sources && entry.sources.length > 0 && (
        <div className="story-entry-sources">
          {entry.sources.slice(0, compact ? 5 : 6).map((s, j) => (
            <span key={j} className="story-entry-source-tag">
              {s.url && compact
                ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.source || s.title || 'Source'}</a>
                : (s.source || s.title || 'Source')}
            </span>
          ))}
        </div>
      )}
      {hasAi && (
        <div className="story-entry-toolbar">
          <div className="ai-toolbar">
            {entry.ai?.summary && (
              <button
                className={`ai-btn ai-btn-summary ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab(activeTab === 'summary' ? null : 'summary')}
              >Summarize</button>
            )}
            {entry.ai?.prediction && (
              <button
                className={`ai-btn ai-btn-predict ${activeTab === 'prediction' ? 'active' : ''}`}
                onClick={() => setActiveTab(activeTab === 'prediction' ? null : 'prediction')}
              >Predict</button>
            )}
            {entry.ai?.trace_cause && (
              <button
                className={`ai-btn ai-btn-trace ${activeTab === 'trace' ? 'active' : ''}`}
                onClick={() => setActiveTab(activeTab === 'trace' ? null : 'trace')}
              >Trace Cause</button>
            )}
          </div>
        </div>
      )}
      {activeTab && entry.ai?.[aiKey] && (
        <div className={`story-entry-ai-content ${activeTab}`}>
          <div className="story-entry-section-text">{entry.ai[aiKey]}</div>
        </div>
      )}
    </div>
  );
}
