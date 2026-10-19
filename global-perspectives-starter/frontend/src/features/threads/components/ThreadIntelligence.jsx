import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { rootCauseText } from '@/shared/lib/rootCause';

const TABS = [
  { key: 'storyArc', label: 'How It Evolved' },
  { key: 'trajectory', label: "What's Next" },
  { key: 'rootCauseChain', label: 'Why It Happened' },
];

export default function ThreadIntelligence({ analysis }) {
  const [activeTab, setActiveTab] = useState(null);

  if (!analysis) return null;

  const textFor = key => (key === 'rootCauseChain' ? rootCauseText(analysis[key]) : analysis[key]);
  const available = TABS.filter(t => textFor(t.key));
  if (available.length === 0) return null;

  return (
    <div className="thread-intelligence">
      {Array.isArray(analysis.watchQuestions) && analysis.watchQuestions.length > 0 && (
        <div className="watch-questions">
          <SectionHeader as="h3" label="Questions to follow" />
          <ul className="watch-questions-list">
            {analysis.watchQuestions.map((q, i) => (
              <li key={i} className="watch-question-item">{q}</li>
            ))}
          </ul>
        </div>
      )}
      <SectionHeader as="h3" label="AI Arc Analysis" />
      <div className="story-entry-toolbar">
        {available.map(tab => (
          <Button key={tab.key} compact selected={activeTab === tab.key} onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}>
            {tab.label}
          </Button>
        ))}
      </div>
      {activeTab && textFor(activeTab) && (
        <div className="story-entry-ai-content">
          <div className="story-entry-section-text story-entry-section-text--lines">{textFor(activeTab)}</div>
        </div>
      )}
    </div>
  );
}
