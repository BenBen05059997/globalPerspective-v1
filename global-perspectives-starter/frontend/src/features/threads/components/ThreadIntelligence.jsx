import { useState } from 'react';

const TABS = [
  { key: 'storyArc', label: 'How It Evolved', cssClass: 'summary' },
  { key: 'trajectory', label: "What's Next", cssClass: 'prediction' },
  { key: 'rootCauseChain', label: 'Why It Happened', cssClass: 'trace' },
];

export default function ThreadIntelligence({ analysis }) {
  const [activeTab, setActiveTab] = useState(null);

  if (!analysis) return null;

  const available = TABS.filter(t => analysis[t.key]);
  if (available.length === 0) return null;

  const activeCss = TABS.find(t => t.key === activeTab)?.cssClass || '';

  return (
    <div className="thread-intelligence">
      {Array.isArray(analysis.watchQuestions) && analysis.watchQuestions.length > 0 && (
        <div className="watch-questions">
          <div className="watch-questions-label">Questions to follow</div>
          <ul className="watch-questions-list">
            {analysis.watchQuestions.map((q, i) => (
              <li key={i} className="watch-question-item">{q}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="thread-intelligence-label">AI Arc Analysis</div>
      <div className="story-entry-toolbar">
        <div className="ai-toolbar">
          {available.map(tab => (
            <button
              key={tab.key}
              className={`ai-btn ai-btn-${tab.cssClass} ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab && analysis[activeTab] && (
        <div className={`story-entry-ai-content ${activeCss}`}>
          <div className="story-entry-section-text">{analysis[activeTab]}</div>
        </div>
      )}
    </div>
  );
}
