import { useState, useMemo } from 'react';
import { formatDateLabel } from '../utils/dateUtils';

const CAT_COLORS = {
  conflict:  '#ef4444',
  politics:  '#3b82f6',
  economy:   '#10b981',
  diplomacy: '#8b5cf6',
  security:  '#f97316',
  society:   '#ec4899',
  military:  '#dc2626',
  technology:'#6366f1',
  health:    '#14b8a6',
};

function matchScore(eventText, articleTitle) {
  const eWords = new Set(eventText.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const aWords = new Set(articleTitle.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  let overlap = 0;
  for (const w of eWords) if (aWords.has(w)) overlap++;
  return overlap;
}

export default function BackgroundTimeline({ events, entries, onEventClick }) {
  const [expandedDates, setExpandedDates] = useState(new Set());

  if (!events || events.length === 0) return null;

  // Number events per category
  const catCounts = {};
  const numbered = events.map(e => {
    const cat = e.category || 'other';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    return { ...e, catIndex: catCounts[cat] };
  });

  // Group by date
  const dayGroups = useMemo(() => {
    const groups = {};
    for (const e of numbered) {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [numbered]);

  // Index coverage entries by date for linking
  const entriesByDate = useMemo(() => {
    if (!entries) return {};
    const map = {};
    for (const e of entries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [entries]);

  // Find best matching article for a timeline event
  function findLinkedArticles(event, date) {
    const dayArticles = entriesByDate[date] || [];
    if (!dayArticles.length) return [];

    // If topicId matches exactly, put it first
    if (event.topicId) {
      const exact = dayArticles.find(a => a.topicId === event.topicId);
      if (exact) {
        const rest = dayArticles.filter(a => a.topicId !== event.topicId && matchScore(event.event, a.title) >= 2);
        return [exact, ...rest.slice(0, 2)];
      }
    }

    // Fuzzy match by keyword overlap
    return dayArticles
      .map(a => ({ ...a, score: matchScore(event.event, a.title) }))
      .filter(a => a.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function toggleDate(date) {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  return (
    <div className="bgt">
      <div className="cp-section-label">DETAILED BACKGROUND</div>

      <div className="bgt-days">
        {dayGroups.map(([date, dayEvents]) => {
          const isExpanded = expandedDates.has(date);
          const primary = dayEvents[0];
          const rest = dayEvents.slice(1);
          const primaryColor = CAT_COLORS[primary.category] || '#6b7280';
          const linkedArticles = isExpanded ? findLinkedArticles(primary, date) : [];

          return (
            <div key={date} className="bgt-day">
              <div className="bgt-day-header">
                <span className="bgt-day-date">{formatDateLabel(date)}</span>
                <span className="bgt-day-count">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="bgt-day-body">
                <div className="bgt-day-line" />

                {/* Primary event */}
                <div
                  className={`bgt-event ${primary.topicId ? 'clickable' : ''}`}
                  onClick={() => primary.topicId && onEventClick?.(primary.topicId, date)}
                >
                  <div className="bgt-event-dot" style={{ background: primaryColor }} />
                  <div className="bgt-event-content">
                    <span className="bgt-event-cat" style={{ color: primaryColor }}>
                      {primary.category} #{primary.catIndex}
                    </span>
                    <div className="bgt-event-text">{primary.event}</div>
                    {primary.topicId && <span className="bgt-event-link">View article →</span>}
                  </div>
                </div>

                {/* Linked articles (shown when expanded) */}
                {isExpanded && linkedArticles.length > 0 && (
                  <div className="bgt-linked">
                    <div className="bgt-linked-label">Related articles</div>
                    {linkedArticles.map((a, i) => (
                      <div
                        key={a.topicId || i}
                        className="bgt-linked-item"
                        onClick={() => onEventClick?.(a.topicId, date)}
                      >
                        <span className="bgt-linked-title">{a.title}</span>
                        {a.sources?.length > 0 && (
                          <span className="bgt-linked-source">{a.sources[0].source || a.sources[0].title}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Expand toggle */}
                {(rest.length > 0 || (entriesByDate[date]?.length > 0 && !isExpanded)) && !isExpanded && (
                  <button className="bgt-expand" onClick={() => toggleDate(date)}>
                    {rest.length > 0 ? `+${rest.length} more event${rest.length !== 1 ? 's' : ''}` : 'Show related articles'}
                  </button>
                )}

                {/* Expanded events */}
                {isExpanded && rest.map((e, i) => {
                  const color = CAT_COLORS[e.category] || '#6b7280';
                  return (
                    <div
                      key={i}
                      className={`bgt-event ${e.topicId ? 'clickable' : ''}`}
                      onClick={() => e.topicId && onEventClick?.(e.topicId, date)}
                    >
                      <div className="bgt-event-dot" style={{ background: color }} />
                      <div className="bgt-event-content">
                        <span className="bgt-event-cat" style={{ color }}>
                          {e.category} #{e.catIndex}
                        </span>
                        <div className="bgt-event-text">{e.event}</div>
                        {e.topicId && <span className="bgt-event-link">View article →</span>}
                      </div>
                    </div>
                  );
                })}

                {isExpanded && (
                  <button className="bgt-expand" onClick={() => toggleDate(date)}>
                    Show less
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Category legend */}
      <div className="bgt-legend">
        {Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => (
            <span key={cat} className="bgt-legend-item">
              <span className="bgt-legend-dot" style={{ background: CAT_COLORS[cat] || '#6b7280' }} />
              {cat} ({count})
            </span>
          ))}
      </div>
    </div>
  );
}
