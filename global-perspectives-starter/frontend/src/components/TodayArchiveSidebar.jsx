import React, { useState } from 'react';
import ArchiveTopicModal from './ArchiveTopicModal';
import './TodayArchiveSidebar.css';

const CATEGORY_ORDER = ['conflict', 'politics', 'economy', 'military', 'disaster', 'technology', 'health'];

function TodayArchiveSidebar({ entries }) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!entries || entries.length === 0) return null;

  const grouped = {};
  entries.forEach(entry => {
    const cat = entry.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  });

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const getTimeAgo = (isoString) => {
    if (!isoString) return '';
    const minutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  return (
    <>
      <div className={`archive-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="archive-sidebar-header" onClick={() => setIsCollapsed(!isCollapsed)}>
          <span className="archive-sidebar-title">Today's Archive</span>
          <span className="archive-sidebar-count">{entries.length}</span>
          <span className="archive-sidebar-toggle">
            {isCollapsed ? '\u25B6' : '\u25C0'}
          </span>
        </div>

        {!isCollapsed && (
          <div className="archive-sidebar-list">
            {sortedCategories.map(category => (
              <div key={category}>
                <div className="archive-category-label">{category}</div>
                {grouped[category].map((entry) => (
                  <div
                    key={entry.topicId}
                    className="archive-sidebar-item"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <span className="archive-item-title">{entry.title}</span>
                    <span className="archive-item-time">{getTimeAgo(entry.archivedAt)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEntry && (
        <ArchiveTopicModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
}

export default TodayArchiveSidebar;
