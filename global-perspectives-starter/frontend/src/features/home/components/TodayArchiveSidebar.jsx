import React, { useState, useMemo } from 'react';
import ArchiveTopicModal from '@/features/home/components/ArchiveTopicModal';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import Chip from '@/shared/ui/Chip.jsx';
import { crisisDotVar } from '@/shared/lib/crisisHue';
import '@/features/home/components/TodayArchiveSidebar.css';

const CATEGORY_ORDER = ['conflict', 'politics', 'economy', 'military', 'disaster', 'technology', 'health'];

// TodayArchiveSidebar — the /today left rail (inside EditorialShell): topics that already left
// today's list, filterable by category chip and title search; a row opens its saved AI analysis.
function TodayArchiveSidebar({ entries }) {
  const [selectedEntry, setSelectedEntry] = useState(null);
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

  const handleCategoryClick = (cat) => {
    setActiveCategory(prev => prev === cat ? null : cat);
  };

  return (
    <>
      <div className="archive-rail">
        <SectionHeader label="Today's Archive" count={entries.length} />

        <div className="archive-rail-filters">
          <input
            className="archive-rail-search"
            type="text"
            placeholder="Search topics…"
            aria-label="Search archived topics"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {availableCategories.length > 0 && (
            <div className="archive-rail-chips">
              {availableCategories.map(cat => (
                <Chip
                  key={cat}
                  selected={activeCategory === cat}
                  dot={crisisDotVar(cat)}
                  onClick={() => handleCategoryClick(cat)}
                >
                  {cat}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="archive-rail-list">
          {filtered.length === 0 && (
            <div className="archive-rail-empty">No matching topics</div>
          )}
          {sortedCategories.map(category => (
            <div key={category} className="archive-rail-group">
              {!activeCategory && <SectionHeader as="h3" label={category} />}
              <ul className="archive-rail-rows">
                {grouped[category].map((entry) => (
                  <StoryRow
                    key={entry.topicId}
                    title={entry.title}
                    hue={crisisDotVar(category)}
                    chip={<CategoryTag category={category} />}
                    changedAt={entry.archivedAt}
                    onClick={() => setSelectedEntry(entry)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
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
