import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Wrapper } from '@googlemaps/react-wrapper';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { getTopicCountryCodes, getTopicRegion, getRegionFromCountryCode } from '../utils/countryMapping';
import { COUNTRY_COORDINATES, CONTINENT_PATHS } from '../utils/mapConstants';
import { formatDateLabel } from '../utils/dateUtils';
import useIsMobile from '../hooks/useIsMobile';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import StoryEntryCard from './StoryEntryCard';
import ThreadIntelligence from './ThreadIntelligence';
import { CATEGORY_BADGE_COLORS } from './WeeklyPage';
import CompactTimeline from './CompactTimeline';
import './WeeklyPage.css';
import './WeeklyMap.css';

function threadHue(threadId) {
  let hash = 0;
  for (let i = 0; i < threadId.length; i++) {
    hash = (hash << 5) - hash + threadId.charCodeAt(i);
    hash |= 0;
  }
  return ((Math.abs(hash) % 12) * 30);
}

function threadColor(threadId) {
  return `hsl(${threadHue(threadId)}, 65%, 45%)`;
}

const MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde8f0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c0c0c0' }] },
];

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function groupMarkersByCountry(markerItems, currentDate) {
  const grouped = {};
  for (const m of markerItems) {
    if (!grouped[m.code]) grouped[m.code] = { ...m, topics: [], count: 0, hasCurrent: false };
    grouped[m.code].topics.push(m);
    grouped[m.code].count++;
    if (m.date === currentDate) grouped[m.code].hasCurrent = true;
  }
  return grouped;
}

function buildWeeklyMapData(dayMap, dates) {
  const pointMarkers = {};
  const lines = {};
  const threads = {};

  for (const date of dates) {
    const entries = dayMap[date]?.entries || [];
    for (const entry of entries) {
      const codes = getTopicCountryCodes(entry);
      const tid = entry.threadId || entry.topicId || entry.title;
      const color = entry.threadId ? threadColor(entry.threadId) : '#6b7280';

      if (entry.threadId) {
        if (!threads[entry.threadId]) {
          threads[entry.threadId] = {
            threadId: entry.threadId,
            entries: [],
            color,
            latestTitle: entry.title,
            regions: new Set(),
          };
        }
        threads[entry.threadId].entries.push({ ...entry, date });
        for (const r of (entry.regions || [])) threads[entry.threadId].regions.add(r);
      }

      for (const code of codes) {
        const coords = COUNTRY_COORDINATES[code];
        if (!coords) continue;
        const key = `${code}-${tid}-${date}`;
        if (!pointMarkers[key]) {
          pointMarkers[key] = {
            code, lat: coords.lat, lng: coords.lng, name: coords.name,
            threadId: entry.threadId, color, title: entry.title, date,
            sources: entry.sources || [], ai: entry.ai,
          };
        }
      }

      if (entry.threadId && codes.length > 1) {
        for (let i = 0; i < codes.length; i++) {
          for (let j = i + 1; j < codes.length; j++) {
            const from = COUNTRY_COORDINATES[codes[i]];
            const to = COUNTRY_COORDINATES[codes[j]];
            if (from && to) {
              const lineKey = `${entry.threadId}-${codes[i]}-${codes[j]}-${date}`;
              if (!lines[lineKey]) {
                lines[lineKey] = {
                  threadId: entry.threadId,
                  fromCode: codes[i],
                  toCode: codes[j],
                  from: { lat: from.lat, lng: from.lng },
                  to: { lat: to.lat, lng: to.lng },
                  color,
                  date,
                };
              }
            }
          }
        }
      }
    }
  }

  const threadList = Object.values(threads)
    .map(t => {
      const regions = [...t.regions];
      const threadDates = [...new Set(t.entries.map(e => e.date))].sort();
      return { ...t, regions, dates: threadDates, primaryRegion: getTopicRegion({ regions }), articleCount: t.entries.length };
    })
    .sort((a, b) => {
      const aMulti = a.dates.length > 1 ? 1 : 0;
      const bMulti = b.dates.length > 1 ? 1 : 0;
      if (bMulti !== aMulti) return bMulti - aMulti;
      const aLatest = a.dates[a.dates.length - 1];
      const bLatest = b.dates[b.dates.length - 1];
      if (aLatest !== bLatest) return bLatest.localeCompare(aLatest);
      if (a.regions.length !== b.regions.length) return b.regions.length - a.regions.length;
      return b.articleCount - a.articleCount;
    });

  const allRegions = [...new Set(threadList.map(t => t.primaryRegion).filter(Boolean))].sort();

  return { markers: Object.values(pointMarkers), lines: Object.values(lines), threadList, allRegions };
}

const WeeklyGoogleMap = forwardRef(function WeeklyGoogleMap({ markers, lines, highlightThread, storyPlay, countryPlay, onThreadSelect, countryThreadIds, disableInfoWindow, onCountryClick, activeCountry }, ref) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const gMarkersRef = useRef([]);
  const gPolylinesRef = useRef([]);
  const infoWindowRef = useRef(null);

  useImperativeHandle(ref, () => ({
    fitBounds(coords) {
      const map = mapInstanceRef.current;
      if (!map || !coords.length) return;
      if (coords.length === 1) {
        map.setCenter(coords[0]);
        map.setZoom(5);
        return;
      }
      const bounds = new window.google.maps.LatLngBounds();
      for (const c of coords) bounds.extend(c);
      map.fitBounds(bounds, 60);
      // Clamp so fitBounds doesn't zoom out past minZoom
      window.google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() < 2) map.setZoom(2);
      });
    },
    resetView() {
      const map = mapInstanceRef.current;
      if (map) { map.setCenter({ lat: 20, lng: 10 }); map.setZoom(2); }
    },
  }));

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20, lng: 10 },
        zoom: 2,
        minZoom: 2,
        maxZoom: 12,
        restriction: {
          latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
          strictBounds: true,
        },
        styles: MAP_STYLES,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    gMarkersRef.current.forEach(m => m.setMap(null));
    gPolylinesRef.current.forEach(p => p.setMap(null));
    gMarkersRef.current = [];
    gPolylinesRef.current = [];

    const currentDate = storyPlay?.currentDate || countryPlay?.currentDate;
    const grouped = groupMarkersByCountry(markers, currentDate);

    for (const item of lines) {
      const isHighlighted = (!highlightThread || item.threadId === highlightThread) &&
        (!countryThreadIds || countryThreadIds.has(item.threadId));
      if (countryThreadIds && !isHighlighted) continue;
      const isCurrent = !currentDate || item.date === currentDate;
      const polyline = new window.google.maps.Polyline({
        path: [item.from, item.to],
        strokeColor: item.color,
        strokeOpacity: currentDate ? (isCurrent ? 0.7 : 0.2) : (activeCountry ? 0.3 : (isHighlighted ? 0.5 : 0.15)),
        strokeWeight: currentDate ? (isCurrent ? 3 : 1) : (activeCountry ? 1.5 : (isHighlighted ? 2 : 1)),
        map,
      });
      gPolylinesRef.current.push(polyline);
    }

    for (const country of Object.values(grouped)) {
      const isHighlighted = (!highlightThread || country.topics.some(t => t.threadId === highlightThread)) &&
        (!countryThreadIds || country.topics.some(t => countryThreadIds.has(t.threadId)));
      if (countryThreadIds && !isHighlighted) continue;
      const isSelected = activeCountry && country.name === activeCountry;
      const count = country.count;
      const size = count >= 4 ? 14 : count >= 2 ? 10 : 7;
      const primaryColor = country.topics[0].color;
      const hasCurrent = country.hasCurrent || !currentDate;

      // When a country is active: selected = bright + large, connected = same color but dimmed + smaller
      const effectiveColor = primaryColor;
      const effectiveScale = activeCountry ? (isSelected ? size + 4 : size) : (currentDate ? (hasCurrent ? size + 2 : size - 1) : size);
      const effectiveOpacity = activeCountry ? (isSelected ? 1.0 : 0.35) : (currentDate ? (hasCurrent ? 1.0 : 0.25) : (isHighlighted ? 0.9 : 0.3));

      const marker = new window.google.maps.Marker({
        position: { lat: country.lat, lng: country.lng },
        map,
        title: `${country.name}: ${count} topic${count !== 1 ? 's' : ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: effectiveScale,
          fillColor: effectiveColor,
          fillOpacity: effectiveOpacity,
          strokeColor: isSelected ? '#fff' : (currentDate && hasCurrent ? primaryColor : '#fff'),
          strokeWeight: isSelected ? 3 : (currentDate && hasCurrent ? 3 : 1.5),
        },
        label: count > 1 && (isSelected || (!activeCountry && hasCurrent)) ? {
          text: String(count),
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '10px',
        } : undefined,
        zIndex: isSelected ? 300 : (hasCurrent ? 200 : (isHighlighted ? count * 10 + 100 : count * 10)),
      });

      marker.addListener('click', () => {
        if (disableInfoWindow && onCountryClick) {
          onCountryClick(country.name);
          return;
        }

        const threadIds = [...new Set(country.topics.map(t => t.threadId).filter(Boolean))];

        if (threadIds.length === 1 && onThreadSelect) {
          onThreadSelect(threadIds[0]);
          infoWindowRef.current.close();
          return;
        }

        const topicHtml = country.topics.map(t => `
          <div style="padding:6px 0;border-bottom:1px solid #f0f0f0;${t.threadId ? 'cursor:pointer;' : ''}" ${t.threadId ? `data-thread-id="${escapeHtml(t.threadId)}"` : ''}>
            <div style="font-size:12px;font-weight:600;${t.threadId ? 'color:#2563eb;' : ''}">${escapeHtml(t.title)}</div>
            <div style="font-size:10px;color:#888;margin-top:2px;">${escapeHtml(t.date)} · ${(t.sources || []).slice(0, 3).map(s => escapeHtml(s.source || s.title || '')).join(', ')}</div>
          </div>
        `).join('');
        infoWindowRef.current.setContent(`
          <div class="wmap-info-window" style="max-width:300px;font-family:sans-serif;">
            <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${escapeHtml(country.name)}</div>
            ${topicHtml}
          </div>
        `);
        infoWindowRef.current.open(map, marker);

        if (onThreadSelect && threadIds.length > 0) {
          window.google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
            document.querySelectorAll('.wmap-info-window [data-thread-id]').forEach(el => {
              el.addEventListener('click', () => {
                const tid = el.getAttribute('data-thread-id');
                if (tid) {
                  onThreadSelect(tid);
                  infoWindowRef.current.close();
                }
              });
            });
          });
        }
      });

      gMarkersRef.current.push(marker);
    }
  }, [markers, lines, highlightThread, storyPlay, countryPlay, countryThreadIds, disableInfoWindow, onCountryClick, activeCountry]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
});

function WeeklyFallbackMap({ markers, lines, storyPlay, countryPlay, countryThreadIds }) {
  const currentDate = storyPlay?.currentDate || countryPlay?.currentDate;
  const grouped = groupMarkersByCountry(markers, currentDate);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#dde8f0' }}>
      <svg width="100%" height="100%" viewBox="0 0 1000 500" style={{ position: 'absolute', inset: 0 }}>
        <rect width="1000" height="500" fill="#dde8f0" />
        {CONTINENT_PATHS.map((cp, i) => (
          <path key={i} d={cp.d} fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        ))}
        {lines.map((item, i) => {
          const x1 = ((item.from.lng + 180) / 360) * 1000;
          const y1 = ((90 - item.from.lat) / 180) * 500;
          const x2 = ((item.to.lng + 180) / 360) * 1000;
          const y2 = ((90 - item.to.lat) / 180) * 500;
          const isCurrent = !currentDate || item.date === currentDate;
          const isHighlighted = !countryThreadIds || countryThreadIds.has(item.threadId);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={item.color} strokeWidth={isCurrent ? 2 : 1} strokeOpacity={isCurrent && isHighlighted ? 0.6 : 0.15} />
          );
        })}
        {Object.values(grouped).map(country => {
          const x = ((country.lng + 180) / 360) * 1000;
          const y = ((90 - country.lat) / 180) * 500;
          const r = Math.min(4 + country.count * 2, 12);
          const isCurrent = !currentDate || country.hasCurrent;
          const isHighlighted = !countryThreadIds || country.topics.some(t => countryThreadIds.has(t.threadId));
          return (
            <g key={country.code}>
              <circle cx={x} cy={y} r={isCurrent ? r + 2 : r} fill={country.color}
                stroke={isCurrent ? country.color : '#fff'} strokeWidth={isCurrent ? 2 : 1.5} opacity={isCurrent && isHighlighted ? 1 : 0.25} />
              {country.count > 1 && isCurrent && isHighlighted && (
                <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">
                  {country.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ThreadDetailView({ thread, onBack, onPlay, storyPlay, analysis, onEntryFocus }) {
  const isPlaying = storyPlay?.threadId === thread.threadId;
  const canPlay = thread.dates && thread.dates.length > 1;
  const displayTitle = analysis?.threadTitle || thread.latestTitle;
  const entriesByDate = useMemo(() => {
    const grouped = {};
    for (const e of thread.entries) {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    }
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [thread.entries]);

  return (
    <div className="wmap-thread-detail">
      <button className="wmap-detail-back" onClick={onBack}>← All threads</button>
      <div className="wmap-detail-header">
        <div className="wmap-detail-title">{displayTitle}</div>
      </div>
      <div className="wmap-detail-meta">
        {thread.entries[0]?.category && (() => {
          const cat = thread.entries[0].category.toLowerCase();
          const c = CATEGORY_BADGE_COLORS[cat];
          return <span className="story-category-badge" style={{ marginRight: 8, ...(c ? { background: c.bg, color: c.color } : {}) }}>{cat}</span>;
        })()}
        {thread.articleCount} article{thread.articleCount !== 1 ? 's' : ''} · {thread.dates.length} day{thread.dates.length !== 1 ? 's' : ''} · {thread.regions.slice(0, 3).join(', ')}
      </div>
      <ThreadIntelligence analysis={analysis} />
      {canPlay && (
        <button
          className={`wmap-detail-play ${isPlaying ? 'playing' : ''}`}
          onClick={() => onPlay(isPlaying ? null : thread.threadId)}
        >
          {isPlaying ? '■ Stop Playback' : '▶ Play Evolution'}
        </button>
      )}
      {analysis ? (
        <CompactTimeline entries={thread.entries} entryShortTitles={analysis.entryShortTitles} onEntryFocus={onEntryFocus} />
      ) : (
        <div className="wmap-detail-entries">
          {entriesByDate.map(([date, entries]) => (
            <div key={date} className="wmap-detail-day">
              <div className="wmap-detail-date">{formatDateLabel(date)}</div>
              {entries.map((entry, i) => (
                <StoryEntryCard key={entry.topicId || i} entry={entry} compact />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WmapCountryChips({ countryOptions, activeCountry, onChange, max = 6 }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? countryOptions : countryOptions.slice(0, max);
  const overflow = countryOptions.length - max;
  return (
    <div className="wmap-country-chips">
      {visible.map(({ country }) => (
        <button
          key={country}
          className={`wmap-country-chip ${activeCountry === country ? 'active' : ''}`}
          onClick={() => onChange(activeCountry === country ? null : country)}
        >
          {country}
        </button>
      ))}
      {!showAll && overflow > 0 && (
        <button className="wmap-country-chip overflow" onClick={() => setShowAll(true)}>
          +{overflow}
        </button>
      )}
      {showAll && overflow > 0 && (
        <button className="wmap-country-chip overflow" onClick={() => setShowAll(false)}>
          Less
        </button>
      )}
    </div>
  );
}

function ThreadListPanel({ threadList, highlightThread, onThreadClick, onPlayThread, storyPlay, open, onClose, allRegions, mapRegion, onRegionChange, allThreads, threadAnalyses, onEntryFocus, activeCountry, countryOptions, onCountryChange, countryPlay, countryDates, onStartCountryPlay, onStopCountryPlay, onPauseCountryPlay, onStepCountryPlay }) {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const activeThread = highlightThread
    ? (allThreads || threadList).find(t => t.threadId === highlightThread)
    : null;

  const visibleThreads = useMemo(() => {
    let threads = threadList;
    if (activeCountry) threads = threads.filter(t => (t.regions || []).includes(activeCountry));
    if (countryPlay) threads = threads.filter(t => t.entries.some(e => e.date === countryPlay.currentDate));
    if (!search.trim()) return threads;
    const q = search.trim().toLowerCase();
    return threads.filter(t =>
      t.latestTitle.toLowerCase().includes(q) ||
      t.regions.some(r => r.toLowerCase().includes(q))
    );
  }, [threadList, search, activeCountry, countryPlay]);

  return (
    <div className={`wmap-thread-panel ${open ? '' : 'collapsed'}`}>
      {activeThread ? (
        <>
          <div className="wmap-panel-header">
            <span className="wmap-panel-header-left">Story Detail</span>
            <button className="wmap-panel-close" onClick={onClose}>✕</button>
          </div>
          <ThreadDetailView
            thread={activeThread}
            onBack={() => onThreadClick(null)}
            onPlay={onPlayThread}
            storyPlay={storyPlay}
            analysis={threadAnalyses?.[activeThread.threadId]}
            onEntryFocus={onEntryFocus}
          />
        </>
      ) : (
        <>
          <div className="wmap-panel-header">
            <span className="wmap-panel-header-left">
              {threadList.length} Thread{threadList.length !== 1 ? 's' : ''}
            </span>
            <button className="wmap-panel-close" onClick={onClose}>✕</button>
          </div>
          {allRegions.length > 1 && (
            <div className="wmap-panel-filter">
              <select
                className="wmap-region-filter"
                value={mapRegion || ''}
                onChange={e => onRegionChange(e.target.value || null)}
              >
                <option value="">All regions</option>
                {allRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          {countryOptions.length > 0 && (
            <div className="wmap-panel-filter">
              <WmapCountryChips
                countryOptions={countryOptions}
                activeCountry={activeCountry}
                onChange={onCountryChange}
                max={6}
              />
              {!activeCountry && (
                <div className="wmap-country-hint">Select a country to filter threads and replay its news day by day</div>
              )}
            </div>
          )}
          {activeCountry && countryDates.length > 0 && (
            <div className="wmap-country-replay">
              {countryPlay ? (
                <>
                  <div className="wmap-country-replay-header">
                    <span className="wmap-country-replay-country">{countryPlay.country}</span>
                    <span className="wmap-country-replay-date">{formatDateLabel(countryPlay.currentDate)}</span>
                    <span className="wmap-country-replay-progress-text">Day {countryPlay.dateIdx + 1} of {countryDates.length}</span>
                  </div>
                  <div className="wmap-country-replay-bar">
                    <div className="wmap-country-replay-fill" style={{ width: `${((countryPlay.dateIdx + 1) / countryDates.length) * 100}%` }} />
                  </div>
                  <div className="wmap-country-replay-controls">
                    <button className="wmap-replay-btn" onClick={() => onStepCountryPlay(-1)} disabled={countryPlay.dateIdx === 0}>&#9664;</button>
                    <button className="wmap-replay-btn pause" onClick={onPauseCountryPlay}>
                      {countryPlay.paused || countryPlay.dateIdx >= countryDates.length - 1 ? '▶' : '❚❚'}
                    </button>
                    <button className="wmap-replay-btn" onClick={() => onStepCountryPlay(1)} disabled={countryPlay.dateIdx >= countryDates.length - 1}>&#9654;</button>
                    <button className="wmap-replay-btn stop" onClick={onStopCountryPlay}>✕</button>
                  </div>
                </>
              ) : (
                <button className="wmap-country-replay-start" onClick={onStartCountryPlay}>
                  ▶ Replay {activeCountry} — {countryDates.length} day{countryDates.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}
          {threadList.length > 5 && (
            <div className="wmap-panel-search">
              <input
                type="text"
                className="wmap-search-input"
                placeholder="Search threads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          <div className="wmap-thread-list">
            {visibleThreads.length === 0 && (
              <div className="wmap-thread-empty">{search ? 'No matching threads' : 'No threads in this region'}</div>
            )}
            {(() => {
              const ORDER = ['politics', 'economy', 'conflict', 'technology', 'environment', 'health', 'society', 'culture', 'science', 'other'];
              const groupMap = {};
              for (const t of visibleThreads) {
                const cat = t.entries[0]?.category?.toLowerCase() || 'other';
                const key = ORDER.includes(cat) ? cat : 'other';
                if (!groupMap[key]) groupMap[key] = [];
                groupMap[key].push(t);
              }
              const groups = ORDER.filter(k => groupMap[k]).map(k => ({ category: k, threads: groupMap[k] }));
              return groups.map(({ category, threads }) => {
                const isCollapsed = collapsedCategories.has(category);
                const c = CATEGORY_BADGE_COLORS[category];
                const toggleCollapse = () => setCollapsedCategories(prev => {
                  const next = new Set(prev);
                  next.has(category) ? next.delete(category) : next.add(category);
                  return next;
                });
                const showAll = expandedGroups.has(category);
                const visibleInGroup = showAll ? threads : threads.slice(0, 5);
                const hiddenCount = threads.length - visibleInGroup.length;
                return (
                  <div key={category} className="wmap-category-group">
                    <button
                      className="wmap-category-group-header"
                      onClick={toggleCollapse}
                      style={c ? { borderLeftColor: c.bg } : {}}
                    >
                      <span className="wmap-category-group-name" style={c ? { color: c.color } : {}}>{category}</span>
                      <span className="wmap-category-group-count">{threads.length}</span>
                      <span className={`wmap-category-group-chevron ${isCollapsed ? 'collapsed' : ''}`}>›</span>
                    </button>
                    {!isCollapsed && (
                      <>
                        {visibleInGroup.map(t => {
                          const isPlaying = storyPlay?.threadId === t.threadId;
                          const canPlay = t.dates && t.dates.length > 1;
                          return (
                            <div key={t.threadId} className="wmap-thread-item">
                              <div className="wmap-thread-info" onClick={() => onThreadClick(t.threadId)}>
                                <div className="wmap-thread-title">{t.latestTitle}</div>
                                <div className="wmap-thread-meta">
                                  {t.articleCount} article{t.articleCount !== 1 ? 's' : ''} · {t.dates.length}d · {t.regions.slice(0, 3).join(', ')}
                                </div>
                                {canPlay && (
                                  <div className="wmap-thread-badges">
                                    <span className="wmap-thread-badge multi-day">{t.dates.length} days</span>
                                  </div>
                                )}
                              </div>
                              {canPlay && (
                                <button
                                  className={`wmap-thread-play ${isPlaying ? 'playing' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); onPlayThread(isPlaying ? null : t.threadId); }}
                                  title={isPlaying ? 'Stop playback' : 'Play story evolution'}
                                >
                                  {isPlaying ? '■' : '▶'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {hiddenCount > 0 && (
                          <button
                            className="wmap-category-show-more"
                            onClick={() => setExpandedGroups(prev => { const n = new Set(prev); n.add(category); return n; })}
                          >
                            Show {hiddenCount} more
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}

function StoryPlaybackOverlay({ storyPlay, thread, markers, onStop, onPause, onStep }) {
  const countryByDate = useMemo(() => {
    if (!thread?.dates) return {};
    const byDate = {};
    const seen = new Set();
    for (const date of thread.dates) {
      const newCountries = [];
      for (const m of markers) {
        if (m.date !== date) continue;
        if (!seen.has(m.code)) {
          seen.add(m.code);
          newCountries.push(m.name);
        }
      }
      byDate[date] = newCountries;
    }
    return byDate;
  }, [markers, thread?.dates]);

  const dateIdx = storyPlay?.dateIdx ?? 0;

  const allCountriesSoFar = useMemo(() => {
    if (!thread?.dates) return [];
    const names = new Set();
    for (let i = 0; i <= dateIdx; i++) {
      for (const m of markers) {
        if (m.date === thread.dates[i]) names.add(m.name);
      }
    }
    return [...names];
  }, [markers, thread?.dates, dateIdx]);

  if (!storyPlay || !thread) return null;
  const { currentDate, paused } = storyPlay;
  const progress = ((dateIdx + 1) / thread.dates.length) * 100;
  const isFirst = dateIdx === 0;
  const isLast = dateIdx >= thread.dates.length - 1;

  const newToday = countryByDate[currentDate] || [];
  const articlesOnDate = thread.entries.filter(e => e.date === currentDate).length;

  return (
    <div className="wmap-playback-overlay">
      <div className="wmap-playback-title">{thread.latestTitle}</div>
      <div className="wmap-playback-date">{formatDateLabel(currentDate)}</div>
      <div className="wmap-playback-progress">
        <div className="wmap-playback-bar" style={{ width: `${progress}%`, background: thread.color }} />
      </div>
      <div className="wmap-playback-step">
        Day {dateIdx + 1} of {thread.dates.length} · {articlesOnDate} article{articlesOnDate !== 1 ? 's' : ''}
      </div>
      <div className="wmap-playback-controls">
        <button className="wmap-playback-btn" onClick={() => onStep(-1)} disabled={isFirst} title="Previous day">&#9664;</button>
        <button className="wmap-playback-btn pause" onClick={onPause} title={paused ? 'Resume' : 'Pause'}>
          {paused || isLast ? '▶' : '❚❚'}
        </button>
        <button className="wmap-playback-btn" onClick={() => onStep(1)} disabled={isLast} title="Next day">&#9654;</button>
        <button className="wmap-playback-btn stop" onClick={onStop} title="Stop">✕</button>
      </div>
      {newToday.length > 0 && (
        <div className="wmap-playback-new">
          <span className="wmap-playback-label">New today</span>
          <div className="wmap-playback-countries">
            {newToday.map(c => (
              <span key={c} className="wmap-playback-country new">{c}</span>
            ))}
          </div>
        </div>
      )}
      {allCountriesSoFar.length > 0 && (
        <div className="wmap-playback-involved">
          <span className="wmap-playback-label">{allCountriesSoFar.length} countries involved</span>
          <div className="wmap-playback-countries">
            {allCountriesSoFar.map(c => (
              <span key={c} className={`wmap-playback-country ${newToday.includes(c) ? 'new' : ''}`}>{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MapLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`wmap-legend ${open ? 'open' : ''}`}>
      <button className="wmap-legend-toggle" onClick={() => setOpen(!open)}>
        {open ? '✕' : '?'} {!open && 'Legend'}
      </button>
      {open && (
        <div className="wmap-legend-body">
          <div className="wmap-legend-item">
            <svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="#6b7280" /></svg>
            <span>Country in a story</span>
          </div>
          <div className="wmap-legend-item">
            <svg width="16" height="16"><circle cx="8" cy="8" r="7" fill="#6b7280" /><text x="8" y="11" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">3</text></svg>
            <span>Multiple topics (count shown)</span>
          </div>
          <div className="wmap-legend-item">
            <svg width="24" height="16"><line x1="0" y1="8" x2="24" y2="8" stroke="#6b7280" strokeWidth="2" strokeOpacity="0.5" /></svg>
            <span>Countries linked in same story</span>
          </div>
          <div className="wmap-legend-item">
            <svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="#6b7280" opacity="0.9" stroke="#6b7280" strokeWidth="2" /></svg>
            <span>Highlighted / current day</span>
          </div>
          <div className="wmap-legend-item">
            <svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="#6b7280" opacity="0.3" /></svg>
            <span>Dimmed (other threads / past days)</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WeeklyMap({ embedded = false, hidePanel: hidePanelProp = false, defaultCountry = null, defaultThread = null, onCountryClick = null }) {
  const isEmbedded = embedded;
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dayMap, sortedDates, loading } = useWeeklyArchive();
  const [highlightThread, setHighlightThread] = useState(() => {
    if (isEmbedded) return null;
    return searchParams.get('thread') || null;
  });
  const [panelOpen, setPanelOpen] = useState(!isMobile && !hidePanelProp);
  const [mapRegion, setMapRegion] = useState(() => {
    if (isEmbedded) return null;
    return searchParams.get('region') || null;
  });
  const [storyPlay, setStoryPlay] = useState(null);
  const [countryPlay, setCountryPlay] = useState(null);
  const [activeCountry, setActiveCountry] = useState(null);
  const playRef = useRef(null);
  const googleMapRef = useRef(null);

  const chronoDates = useMemo(() => [...sortedDates].reverse(), [sortedDates]);

  useEffect(() => {
    if (isEmbedded) return;
    const params = {};
    if (highlightThread) params.thread = highlightThread;
    if (mapRegion) params.region = mapRegion;
    setSearchParams(params, { replace: true });
  }, [highlightThread, mapRegion, isEmbedded, setSearchParams]);

  const { markers: allMarkers, lines: allLines, threadList: allThreads, allRegions } = useMemo(() => {
    if (chronoDates.length === 0) return { markers: [], lines: [], threadList: [], allRegions: [] };
    return buildWeeklyMapData(dayMap, chronoDates);
  }, [dayMap, chronoDates]);

  const qualifyingThreadIds = useMemo(
    () => allThreads.filter(t => t.entries.length >= 2).map(t => t.threadId),
    [allThreads],
  );
  const { analyses: threadAnalyses } = useThreadAnalyses(qualifyingThreadIds);

  const countryThreadIds = useMemo(() => {
    if (!activeCountry) return null;
    return new Set(allThreads.filter(t => (t.regions || []).includes(activeCountry)).map(t => t.threadId));
  }, [activeCountry, allThreads]);

  const countryDates = useMemo(() => {
    if (!countryThreadIds) return [];
    const dates = new Set();
    for (const m of allMarkers) {
      if (countryThreadIds.has(m.threadId)) dates.add(m.date);
    }
    return [...dates].sort();
  }, [countryThreadIds, allMarkers]);

  const countryOptions = useMemo(() => {
    const counts = {};
    for (const t of allThreads) {
      for (const r of (t.regions || [])) {
        counts[r] = (counts[r] || 0) + t.articleCount;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));
  }, [allThreads]);

  const { markers: filteredMarkers, lines: filteredLines, threadList } = useMemo(() => {
    if (!mapRegion) return { markers: allMarkers, lines: allLines, threadList: allThreads };
    const inRegion = (code) => getRegionFromCountryCode(code) === mapRegion;
    return {
      markers: allMarkers.filter(m => inRegion(m.code)),
      lines: allLines.filter(l => inRegion(l.fromCode) || inRegion(l.toCode)),
      threadList: allThreads.filter(t => t.primaryRegion === mapRegion),
    };
  }, [allMarkers, allLines, allThreads, mapRegion]);

  const { markers, lines } = useMemo(() => {
    if (storyPlay) {
      const { threadId, currentDate } = storyPlay;
      return {
        markers: filteredMarkers.filter(m => m.threadId === threadId && m.date <= currentDate),
        lines: filteredLines.filter(l => l.threadId === threadId && l.date <= currentDate),
      };
    }
    if (countryPlay) {
      const { currentDate } = countryPlay;
      return {
        markers: filteredMarkers.filter(m => countryThreadIds?.has(m.threadId) && m.date <= currentDate),
        lines: filteredLines.filter(l => countryThreadIds?.has(l.threadId) && l.date <= currentDate),
      };
    }
    return { markers: filteredMarkers, lines: filteredLines };
  }, [filteredMarkers, filteredLines, storyPlay, countryPlay, countryThreadIds]);

  const playingThread = useMemo(() => {
    if (!storyPlay) return null;
    return allThreads.find(t => t.threadId === storyPlay.threadId) || null;
  }, [allThreads, storyPlay]);

  useEffect(() => {
    if (storyPlay && !threadList.some(t => t.threadId === storyPlay.threadId)) {
      setStoryPlay(null);
    }
  }, [threadList, storyPlay]);

  useEffect(() => {
    setCountryPlay(null);
  }, [activeCountry]);

  useEffect(() => {
    if (!storyPlay || !playingThread || storyPlay.paused) return;
    const { dateIdx } = storyPlay;
    if (dateIdx >= playingThread.dates.length - 1) return;
    playRef.current = setTimeout(() => {
      const nextIdx = dateIdx + 1;
      setStoryPlay(prev => ({
        ...prev,
        dateIdx: nextIdx,
        currentDate: playingThread.dates[nextIdx],
      }));
    }, 1500);
    return () => clearTimeout(playRef.current);
  }, [storyPlay, playingThread]);

  useEffect(() => {
    if (!countryPlay || countryPlay.paused) return;
    if (countryPlay.dateIdx >= countryDates.length - 1) {
      setCountryPlay(prev => prev ? { ...prev, paused: true } : null);
      return;
    }
    const timer = setTimeout(() => {
      setCountryPlay(prev => {
        if (!prev) return null;
        const nextIdx = prev.dateIdx + 1;
        return { ...prev, dateIdx: nextIdx, currentDate: countryDates[nextIdx] };
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [countryPlay, countryDates]);

  // Sync defaultCountry prop → activeCountry state
  useEffect(() => {
    if (defaultCountry) setActiveCountry(defaultCountry);
  }, [defaultCountry]);

  // Auto-zoom when country is set and markers are ready
  useEffect(() => {
    if (!defaultCountry || !countryThreadIds || !allMarkers.length) return;
    const relevant = allMarkers.filter(m => countryThreadIds.has(m.threadId));
    if (relevant.length === 0) return;
    const unique = [...new Map(relevant.map(m => [`${m.lat},${m.lng}`, { lat: m.lat, lng: m.lng }])).values()];
    function tryZoom() {
      if (googleMapRef.current) {
        googleMapRef.current.fitBounds(unique);
      } else {
        setTimeout(tryZoom, 200);
      }
    }
    tryZoom();
  }, [defaultCountry, countryThreadIds, allMarkers]);

  const zoomToThread = useCallback((threadId) => {
    if (!googleMapRef.current || !threadId) {
      googleMapRef.current?.resetView?.();
      return;
    }
    const threadMarkers = allMarkers.filter(m => m.threadId === threadId);
    if (threadMarkers.length === 0) return;
    const coords = threadMarkers.map(m => ({ lat: m.lat, lng: m.lng }));
    const unique = [];
    const seen = new Set();
    for (const c of coords) {
      const key = `${c.lat},${c.lng}`;
      if (!seen.has(key)) { seen.add(key); unique.push(c); }
    }
    googleMapRef.current.fitBounds(unique);
  }, [allMarkers]);

  // Sync defaultThread prop → highlightThread + zoom
  useEffect(() => {
    if (!defaultThread) return;
    setHighlightThread(defaultThread);
    function tryZoom() {
      if (googleMapRef.current) {
        zoomToThread(defaultThread);
      } else {
        setTimeout(tryZoom, 200);
      }
    }
    tryZoom();
  }, [defaultThread, zoomToThread]);

  function handleEntryFocus(entry) {
    const thread = allThreads.find(t => t.threadId === highlightThread);
    if (!thread) return;
    const dateIdx = thread.dates.indexOf(entry.date);
    if (dateIdx === -1) return;
    setStoryPlay({ threadId: thread.threadId, dateIdx, currentDate: entry.date, paused: true });
    const entryMarkers = allMarkers.filter(m => m.threadId === thread.threadId && m.date === entry.date);
    if (entryMarkers.length > 0 && googleMapRef.current) {
      googleMapRef.current.fitBounds(entryMarkers.map(m => ({ lat: m.lat, lng: m.lng })));
    }
  }

  function handleStartCountryPlay() {
    if (!activeCountry || countryDates.length === 0) return;
    setStoryPlay(null);
    setHighlightThread(null);
    setCountryPlay({ country: activeCountry, dateIdx: 0, currentDate: countryDates[0], paused: false });
    const countryMarkers = allMarkers.filter(m => countryThreadIds?.has(m.threadId));
    if (countryMarkers.length > 0 && googleMapRef.current) {
      const unique = [...new Map(countryMarkers.map(m => [`${m.lat},${m.lng}`, { lat: m.lat, lng: m.lng }])).values()];
      googleMapRef.current.fitBounds(unique);
    }
  }

  function handleStopCountryPlay() {
    setCountryPlay(null);
  }

  function handlePauseCountryPlay() {
    if (!countryPlay) return;
    const isLast = countryPlay.dateIdx >= countryDates.length - 1;
    if (isLast) {
      setCountryPlay(prev => prev ? { ...prev, dateIdx: 0, currentDate: countryDates[0], paused: false } : null);
    } else {
      setCountryPlay(prev => prev ? { ...prev, paused: !prev.paused } : null);
    }
  }

  function handleStepCountryPlay(dir) {
    setCountryPlay(prev => {
      if (!prev) return null;
      const nextIdx = prev.dateIdx + dir;
      if (nextIdx < 0 || nextIdx >= countryDates.length) return prev;
      return { ...prev, dateIdx: nextIdx, currentDate: countryDates[nextIdx], paused: true };
    });
  }

  function handleMarkerThreadSelect(threadId) {
    setHighlightThread(threadId);
    setPanelOpen(true);
    if (storyPlay) setStoryPlay(null);
    if (countryPlay) setCountryPlay(null);
  }

  function handleThreadClick(threadId) {
    setHighlightThread(threadId);
    if (storyPlay) setStoryPlay(null);
    if (countryPlay) setCountryPlay(null);
    zoomToThread(threadId);
  }

  function handlePlayThread(threadId) {
    if (!threadId) {
      setStoryPlay(null);
      return;
    }
    const thread = allThreads.find(t => t.threadId === threadId);
    if (!thread || thread.dates.length < 2) return;
    setHighlightThread(threadId);
    zoomToThread(threadId);
    if (storyPlay && storyPlay.threadId === threadId) {
      const { dateIdx, paused } = storyPlay;
      if (dateIdx >= thread.dates.length - 1) {
        setStoryPlay({ threadId, dateIdx: 0, currentDate: thread.dates[0], paused: false });
      } else {
        setStoryPlay(prev => ({ ...prev, paused: !paused }));
      }
      return;
    }
    setStoryPlay({ threadId, dateIdx: 0, currentDate: thread.dates[0], paused: false });
  }

  const googleApiKey = window.GOOGLE_MAPS_API_KEY || '';

  const dateRangeLabel = chronoDates.length > 0
    ? `${formatDateLabel(chronoDates[0])} — ${formatDateLabel(chronoDates[chronoDates.length - 1])}`
    : '';

  const render = (status) => {
    if (status === 'FAILURE' || !googleApiKey) {
      return <WeeklyFallbackMap markers={markers} lines={lines} storyPlay={storyPlay} countryPlay={countryPlay} countryThreadIds={countryThreadIds} />;
    }
    if (status === 'LOADING') {
      return <div className="wmap-loading">Loading map...</div>;
    }
    return (
      <WeeklyGoogleMap
        ref={googleMapRef}
        markers={markers}
        lines={lines}
        highlightThread={highlightThread}
        storyPlay={storyPlay}
        countryPlay={countryPlay}
        onThreadSelect={handleMarkerThreadSelect}
        countryThreadIds={countryThreadIds}
        disableInfoWindow={!!onCountryClick}
        onCountryClick={onCountryClick}
        activeCountry={activeCountry}
      />
    );
  };

  return (
    <div className={`wmap-page ${isEmbedded ? 'embedded' : ''}`}>
      {!isEmbedded && (
        <div className="wmap-header">
          <div className="wmap-header-left">
            <Link to="/weekly" className="wmap-back-link">← Weekly</Link>
            <h1>Evolution Map</h1>
            {dateRangeLabel && <span className="wmap-date-range">{dateRangeLabel}</span>}
          </div>
          <div className="wmap-header-right">
            {chronoDates.length > 0 && (
              <span className="wmap-stat">
                {filteredMarkers.length} markers · {threadList.length} threads
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="wmap-loading-full">Loading archive data...</div>
      ) : (
        <div className="wmap-container">
          {!hidePanelProp && (
            <ThreadListPanel
              threadList={threadList}
              allThreads={allThreads}
              highlightThread={highlightThread}
              onThreadClick={handleThreadClick}
              onPlayThread={handlePlayThread}
              storyPlay={storyPlay}
              open={panelOpen}
              onClose={() => setPanelOpen(false)}
              allRegions={allRegions}
              mapRegion={mapRegion}
              onRegionChange={(r) => { setMapRegion(r); setHighlightThread(null); }}
              threadAnalyses={threadAnalyses}
              onEntryFocus={handleEntryFocus}
              activeCountry={activeCountry}
              countryOptions={countryOptions}
              onCountryChange={setActiveCountry}
              countryPlay={countryPlay}
              countryDates={countryDates}
              onStartCountryPlay={handleStartCountryPlay}
              onStopCountryPlay={handleStopCountryPlay}
              onPauseCountryPlay={handlePauseCountryPlay}
              onStepCountryPlay={handleStepCountryPlay}
            />
          )}

          {!hidePanelProp && isMobile && panelOpen && (
            <div className="wmap-backdrop" onClick={() => setPanelOpen(false)} />
          )}

          <div className="wmap-map-area">
            {!hidePanelProp && !panelOpen && (
              <button className="wmap-panel-toggle" onClick={() => setPanelOpen(true)}>
                &#x203A; Threads
              </button>
            )}

            {googleApiKey ? (
              <Wrapper apiKey={googleApiKey} render={render} />
            ) : (
              <WeeklyFallbackMap markers={markers} lines={lines} storyPlay={storyPlay} countryPlay={countryPlay} countryThreadIds={countryThreadIds} />
            )}

            {!hidePanelProp && <MapLegend />}
          </div>
        </div>
      )}
    </div>
  );
}
