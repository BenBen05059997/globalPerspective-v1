import React, { useState, useMemo } from 'react';
import ArchiveTopicModal from './ArchiveTopicModal';
import './TodayArchiveSidebar.css';

const CATEGORY_ORDER = ['conflict', 'politics', 'economy', 'military', 'disaster', 'technology', 'health'];

function TodayArchiveSidebar({ entries }) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const availableCategories = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const cats = new Set(entries.map(e => e.category || 'other'));
    return CATEGORY_ORDER.filter(c => cats.has(c));
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    let result = entries;
    if (activeCategory) {
      result = result.filter(e => (e.category || 'other') === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(e => e.title?.toLowerCase().includes(q));
    }
    return result;
  }, [entries, activeCategory, search]);

  if (!entries || entries.length === 0) return null;

  const grouped = {};
  filtered.forEach(entry => {
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
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(prev => prev === cat ? null : cat);
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
          <>
            <div className="archive-sidebar-filters">
              <input
                className="archive-search-input"
                type="text"
                placeholder="Search topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="archive-category-chips">
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    className={`archive-chip ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="archive-sidebar-list">
              {filtered.length === 0 && (
                <div className="archive-no-results">No matching topics</div>
              )}
              {sortedCategories.map(category => (
                <div key={category}>
                  {!activeCategory && (
                    <div className="archive-category-label">{category}</div>
                  )}
                  {grouped[category].map((entry) => (
                    <div
                      key={entry.topicId}
                      className="archive-sidebar-item"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <span className="archive-item-title">{entry.title}</span>
                      <span className="archive-item-time">Showed {getTimeAgo(entry.archivedAt)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
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
