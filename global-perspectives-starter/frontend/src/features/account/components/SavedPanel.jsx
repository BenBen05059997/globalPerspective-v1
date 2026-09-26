import { useState } from 'react';
import { Link } from 'react-router-dom';
import { threadPath } from '@/shared/lib/threadPath';

// Saved list (A3 · K1 "SAVED"). Extracted from Account.jsx so both the account shell and the
// Desk panel (A4) can render it without a circular import between the two.
const TYPE_COLORS = {
  thread:  { border: '#3b82f6', badge: '#dbeafe', badgeText: '#1e40af' },
  country: { border: '#10b981', badge: '#d1fae5', badgeText: '#065f46' },
  daily:   { border: '#8b5cf6', badge: '#ede9fe', badgeText: '#5b21b6' },
  pair:    { border: '#f59e0b', badge: '#fef3c7', badgeText: '#92400e' },
};

const TYPE_LABELS = {
  thread: 'Thread',
  country: 'Country',
  daily: 'Daily',
  pair: 'Pair',
};

function getItemHref(item) {
  if (item.itemType === 'thread')  return threadPath(item.itemId);
  if (item.itemType === 'country') return `/weekly/country/${encodeURIComponent(item.itemId)}`;
  if (item.itemType === 'daily')   return `/daily/${item.itemId}`;
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
  const colors = TYPE_COLORS[item.itemType] || TYPE_COLORS.thread;
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
        <span
          className="saved-card-type"
          style={{ background: colors.badge, color: colors.badgeText }}
        >
          {TYPE_LABELS[item.itemType] || item.itemType}
        </span>
        <span className="saved-card-time">{formatRelativeTime(item.savedAt)}</span>
      </div>
      <div className="saved-card-title">{title}</div>
      {meta && <div className="saved-card-meta">{meta}</div>}
      <button
        className="saved-card-unsave"
        onClick={handleUnsave}
        title="Remove from saved"
        aria-label="Remove from saved"
      >
        <HeartFilledIcon />
      </button>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className={cardClass}
        style={{ borderLeftColor: colors.border }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className={cardClass} style={{ borderLeftColor: colors.border }}>
      {inner}
    </div>
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
          <button
            className={`saved-filter-chip${filter === 'all' ? ' saved-filter-chip--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All {savedItems.length}
          </button>
          {availableTypes.map(type => (
            <button
              key={type}
              className={`saved-filter-chip${filter === type ? ' saved-filter-chip--active' : ''}`}
              onClick={() => setFilter(type)}
            >
              {TYPE_LABELS[type] || type} {typeCounts[type]}
            </button>
          ))}
        </div>
      )}

      <div className="saved-grid">
        {savedLoading ? (
          <div style={{ gridColumn: '1/-1', padding: '2rem 0', color: 'var(--c-text-dim, #7d8b96)', fontSize: '0.875rem' }}>
            Loading saved items…
          </div>
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
