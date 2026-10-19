import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';

const AI_TABS = [
  { key: 'summary', field: 'summary', label: 'Summarize' },
  { key: 'prediction', field: 'prediction', label: 'Predict' },
  { key: 'trace', field: 'trace_cause', label: 'Trace Cause' },
];

export default function StoryEntryCard({ entry, compact }) {
  const [activeTab, setActiveTab] = useState(null);
  const tabs = AI_TABS.filter((t) => entry.ai?.[t.field]);
  const active = tabs.find((t) => t.key === activeTab);

  return (
    <div className={`story-entry-card ${compact ? 'compact' : ''}`}>
      <CategoryTag category={entry.category?.toLowerCase()} className="story-entry-cat" />
      <div className="story-entry-title">{entry.title}</div>
      {entry.sources && entry.sources.length > 0 && (
        <div className="story-entry-sources">
          {entry.sources.slice(0, compact ? 5 : 6).map((s, j) => (
            <span key={j} className="story-entry-source-tag">
              {s.url
                ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.source || s.title || 'Source'}</a>
                : (s.source || s.title || 'Source')}
            </span>
          ))}
        </div>
      )}
      {tabs.length > 0 && (
        <div className="story-entry-toolbar">
          {tabs.map((t) => (
            <Button key={t.key} compact selected={activeTab === t.key} onClick={() => setActiveTab(activeTab === t.key ? null : t.key)}>
              {t.label}
            </Button>
          ))}
        </div>
      )}
      {active && (
        <div className="story-entry-ai-content">
          <div className="story-entry-section-text">{entry.ai[active.field]}</div>
        </div>
      )}
    </div>
  );
}
