import { useState } from 'react';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import StoryEntryCard from '@/features/threads/components/StoryEntryCard';
import EntryRole from '@/shared/ui/EntryRole.jsx';

export default function CompactTimeline({ entries, entryShortTitles, onEntryFocus }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const shortTitleMap = {};
  if (Array.isArray(entryShortTitles)) {
    for (const item of entryShortTitles) {
      shortTitleMap[item.topicId] = item.shortTitle;
    }
  }

  return (
    <div className="compact-timeline">
      <SectionHeader as="h3" label="Daily coverage" />
      {entries.map((entry, i) => {
        const shortTitle = shortTitleMap[entry.topicId] || entry.title;
        const sourceCount = (entry.sources || []).length;
        const isExpanded = expandedIdx === i;
        const isLast = i === entries.length - 1;

        return (
          <div key={entry.topicId || i} className={`compact-timeline-entry ${isLast ? 'last' : ''}`}>
            <div className="compact-timeline-dot" />
            <div className="compact-timeline-content">
              <button
                type="button"
                className="compact-timeline-header"
                aria-expanded={isExpanded}
                onClick={() => { setExpandedIdx(isExpanded ? null : i); onEntryFocus?.(entry); }}
              >
                <span className="compact-timeline-date">{formatDateLabel(entry.date)}</span>
                <span className="compact-timeline-title">{shortTitle}</span>
                <span className="compact-timeline-meta">{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
                <span className={`story-card-chevron ${isExpanded ? 'open' : ''}`} aria-hidden="true">▾</span>
              </button>
              {/* under the one-line row, not inside it (a long label would push the headline out of the row on a phone); an open row's card shows it */}
              {!isExpanded && <EntryRole role={entry.role} />}
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
