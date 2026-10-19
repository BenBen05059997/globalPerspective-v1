import { useState } from 'react';
import { Link } from 'react-router';
import { threadPath } from '@/shared/lib/threadPath';
import { briefingHref } from '@/shared/lib/links.js';
import StoryLink from '@/shared/ui/StoryLink.jsx';
import Card from '@/shared/ui/Card.jsx';
import Chip from '@/shared/ui/Chip.jsx';
import '@/features/account/components/SavedPanel.css';

// Saved list (A3 · K1 "SAVED"). Extracted from Account.jsx so both the account shell and the
// Desk panel (A4) can render it without a circular import between the two. Every item type is
// drawn the same neutral way; the type is the word on the tag, not a colour.

const TYPE_LABELS = {
  thread: 'Thread',
  country: 'Country',
  daily: 'Daily',
  weekly: 'Weekly',
  pair: 'Pair',
};

function getItemHref(item) {
  if (item.itemType === 'thread')  return threadPath(item.itemId);
  if (item.itemType === 'country') return `/weekly/country/${encodeURIComponent(item.itemId)}`;
  if (item.itemType === 'daily')   return briefingHref({ mode: 'read', date: item.itemId });
  if (item.itemType === 'weekly')  return briefingHref({ mode: 'weekly', week: item.itemId });
  return null;
}

function getItemTitle(item) {
  return item.metadata?.title || item.metadata?.name || item.metadata?.headline || item.itemId;
}

function getItemMeta(item) {
  const parts = [];
  if (item.metadata?.category) parts.push(item.metadata.category);
  if (item.metadata?.date)     parts.push(item.metadata.date);
  return parts.join(' · ');
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5)   return `${w}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function HeartFilledIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  );
}

function SavedCard({ item, onUnsave }) {
  const [collapsing, setCollapsing] = useState(false);
  const href = getItemHref(item);
  const title = getItemTitle(item);
  const meta = getItemMeta(item);

  function handleUnsave(e) {
    e.preventDefault();
    e.stopPropagation();
    setCollapsing(true);
    setTimeout(() => onUnsave(item.itemType, item.itemId), 250);
  }

  const cardClass = `saved-card${collapsing ? ' saved-card--collapsing' : ''}`;

  const inner = (
    <>
      <div className="saved-card-top">
        <span className="saved-card-type">{TYPE_LABELS[item.itemType] || item.itemType}</span>
        <span className="saved-card-time">{formatRelativeTime(item.savedAt)}</span>
      </div>
      <div className="saved-card-title">{title}</div>
      {meta && <div className="saved-card-meta">{meta}</div>}
      <button
        type="button"
        className="saved-card-unsave"
        onClick={handleUnsave}
        title="Remove from saved"
        aria-label="Remove from saved"
      >
        <HeartFilledIcon />
      </button>
    </>
  );

  if (href && item.itemType === 'thread') {
    return (
      <Card
        as={StoryLink}
        level={2}
        pad="sm"
        to={href}
        topic={title && title !== item.itemId ? { title, category: item.metadata?.category } : null}
        className={cardClass}
      >
        {inner}
      </Card>
    );
  }
  if (href) {
    return (
      <Card as={Link} level={2} pad="sm" to={href} className={cardClass}>
        {inner}
      </Card>
    );
  }
  return (
    <Card level={2} pad="sm" className={cardClass}>
      {inner}
    </Card>
  );
}

export function SavedPanel({ savedItems, savedLoading, onUnsave }) {
  const [filter, setFilter] = useState('all');

  const typeCounts = savedItems.reduce((acc, item) => {
    acc[item.itemType] = (acc[item.itemType] || 0) + 1;
    return acc;
  }, {});

  const availableTypes = Object.keys(typeCounts);
  const filtered = filter === 'all'
    ? savedItems
    : savedItems.filter(item => item.itemType === filter);

  const emptyHint = filter === 'all'
    ? 'Tap the heart on any thread, country, or daily brief to save it here.'
    : `No saved ${TYPE_LABELS[filter]?.toLowerCase() || filter}s yet.`;

  return (
    <div>
      {/* F2.21: the filter chips (including "All") used to disappear once savedItems.length hit
          1 or 0 — including while a non-"all" filter was still active, e.g. after unsaving items
          down to a count where the filtered view shows nothing and there is no visible way back
          to "All". Keep the row (at least the "All" chip) whenever a filter is active, regardless
          of how many items are left. */}
      {(savedItems.length > 1 || filter !== 'all') && (
        <div className="saved-filters">
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')} count={savedItems.length}>All</Chip>
          {availableTypes.map(type => (
            <Chip key={type} selected={filter === type} onClick={() => setFilter(type)} count={typeCounts[type]}>
              {TYPE_LABELS[type] || type}
            </Chip>
          ))}
        </div>
      )}

      <div className="saved-grid">
        {savedLoading ? (
          <div className="saved-loading">Loading saved items…</div>
        ) : filtered.length === 0 ? (
          <div className="saved-empty">
            <div className="saved-empty-icon">🤍</div>
            <div className="saved-empty-title">Nothing saved yet</div>
            <div className="saved-empty-hint">{emptyHint}</div>
          </div>
        ) : (
          filtered.map(item => (
            <SavedCard
              key={`${item.itemType}:${item.itemId}`}
              item={item}
              onUnsave={onUnsave}
            />
          ))
        )}
      </div>
    </div>
  );
}
