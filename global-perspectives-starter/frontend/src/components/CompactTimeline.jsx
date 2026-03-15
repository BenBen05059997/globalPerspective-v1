import { useState } from 'react';
import { formatDateLabel } from '../utils/dateUtils';
import StoryEntryCard from './StoryEntryCard';

export default function CompactTimeline({ entries, entryShortTitles }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const shortTitleMap = {};
  if (Array.isArray(entryShortTitles)) {
    for (const item of entryShortTitles) {
      shortTitleMap[item.topicId] = item.shortTitle;
    }
  }

  return (
    <div className="compact-timeline">
      <div className="compact-timeline-header-label">Daily coverage</div>
      {entries.map((entry, i) => {
        const shortTitle = shortTitleMap[entry.topicId] || entry.title;
        const sourceCount = (entry.sources || []).length;
        const isExpanded = expandedIdx === i;
        const isLast = i === entries.length - 1;

        return (
          <div key={entry.topicId || i} className={`compact-timeline-entry ${isLast ? 'last' : ''}`}>
            <div className="compact-timeline-dot" />
            <div className="compact-timeline-content">
              <div
                className="compact-timeline-header"
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
              >
                <span className="compact-timeline-date">{formatDateLabel(entry.date)}</span>
                <span className="compact-timeline-title">{shortTitle}</span>
                <span className="compact-timeline-meta">{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
                <span className={`story-card-chevron ${isExpanded ? 'open' : ''}`}>&#9662;</span>
              </div>
              {isExpanded && (
                <div className="compact-timeline-expanded">
                  <StoryEntryCard entry={entry} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
