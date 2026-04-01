import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Wrapper } from '@googlemaps/react-wrapper';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useCountryIntelligence } from '../hooks/useCountryIntelligence';
import { COUNTRY_COORDINATES } from '../utils/mapConstants';
import { RISK_COLORS } from './WeeklyPage';
import './IntelligenceMap.css';

// Build name → code and name → lat/lng lookups from COUNTRY_COORDINATES
const NAME_TO_CODE = {};
const NAME_TO_LATLNG = {};
for (const [code, val] of Object.entries(COUNTRY_COORDINATES)) {
  const key = val.name.toLowerCase();
  NAME_TO_CODE[key] = code;
  NAME_TO_LATLNG[key] = { lat: val.lat, lng: val.lng };
}
// Aliases for common region/variant names used in archive data
const ALIASES = { 'uk': 'GB', 'taiwan': null };
for (const [alias, code] of Object.entries(ALIASES)) {
  if (code && COUNTRY_COORDINATES[code]) {
    NAME_TO_CODE[alias] = code;
    NAME_TO_LATLNG[alias] = { lat: COUNTRY_COORDINATES[code].lat, lng: COUNTRY_COORDINATES[code].lng };
  }
}
NAME_TO_LATLNG['taiwan'] = { lat: 23.698, lng: 120.960 };
NAME_TO_CODE['taiwan'] = 'TW';

function getCoords(name) {
  return NAME_TO_LATLNG[name.toLowerCase()] || null;
}

function countryFlag(name) {
  const code = NAME_TO_CODE[name.toLowerCase()];
  if (!code || code.length !== 2) return '🌍';
  return String.fromCodePoint(
    0x1F1E6 + code.charCodeAt(0) - 65,
    0x1F1E6 + code.charCodeAt(1) - 65,
  );
}

const RISK_DOT = {
  low: '#10b981',
  moderate: '#eab308',
  elevated: '#f97316',
  high: '#ef4444',
  critical: '#ef4444',
};

const MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8dbe8' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0f0f0' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#b8b8b8' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#aaaaaa' }] },
];

// ─────────────────────────────────────────────────────────────────
// Expanded briefing card
// ─────────────────────────────────────────────────────────────────

function IntelCard({ countryName, intel, chipX, chipY, mapW, mapH, onClose }) {
  const risk = intel?.riskLevel ? (RISK_COLORS[intel.riskLevel] || RISK_COLORS.moderate) : null;
  const dotColor = RISK_DOT[intel?.riskLevel] || '#6b7280';
  const flag = countryFlag(countryName);

  const CARD_W = 320;
  const CARD_H = 430;
  const PAD = 12;

  let left = chipX + 24;
  let top = chipY - 24;
  if (chipX > mapW / 2) left = chipX - CARD_W - 24;
  left = Math.max(PAD, Math.min(left, mapW - CARD_W - PAD));
  if (chipY > mapH * 0.6) top = chipY - CARD_H + 24;
  top = Math.max(PAD, Math.min(top, mapH - CARD_H - PAD));

  const originX = chipX - left;
  const originY = chipY - top;

  return (
    <div
      className="imap-card"
      style={{ left, top, transformOrigin: `${originX}px ${originY}px` }}
      onClick={e => e.stopPropagation()}
    >
      <div className="imap-card-header">
        <div className="imap-card-title">
          <span className="imap-card-flag">{flag}</span>
          <span>{countryName}</span>
        </div>
        <button className="imap-card-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {risk && (
        <div className="imap-card-risk" style={{ background: risk.bg, color: risk.color }}>
          <span className="imap-card-risk-dot" style={{ background: dotColor }} />
          {(intel.riskLevel || 'moderate').toUpperCase()} RISK
        </div>
      )}

      {intel ? (
        <div className="imap-card-body">
          {intel.headline && <p className="imap-card-headline">{intel.headline}</p>}

          {intel.bluf && (
            <div className="imap-card-section">
              <div className="imap-card-label">Bottom Line</div>
              <p className="imap-card-bluf">{intel.bluf}</p>
            </div>
          )}

          {intel.keyDevelopments?.length > 0 && (
            <div className="imap-card-section">
              <div className="imap-card-label">Key Developments</div>
              <ul className="imap-card-list">
                {intel.keyDevelopments.slice(0, 3).map((d, i) => (
                  <li key={i}>
                    <span className="imap-card-date">{d.date?.slice(5)}</span>
                    {d.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {intel.riskSignals?.length > 0 && (
            <div className="imap-card-section">
              <div className="imap-card-label">Watch</div>
              <ul className="imap-card-list">
                {intel.riskSignals.slice(0, 2).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <Link
            to={`/weekly/country/${encodeURIComponent(countryName)}`}
            className="imap-card-cta"
          >
            Full briefing →
          </Link>
        </div>
      ) : (
        <div className="imap-card-body">
          <p className="imap-card-gate-msg">
            Country intelligence briefings are available for members.
          </p>
          <Link to="/pricing" className="imap-card-cta">Upgrade to access →</Link>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Map canvas — Google Map + chip overlay + card
// ─────────────────────────────────────────────────────────────────

function MapCanvas({ top10, intelligence, activeCountry, onChipClick }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const [chipPositions, setChipPositions] = useState({});
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });

  const updatePositions = useCallback(() => {
    const map = mapRef.current;
    const el = mapDivRef.current;
    if (!map || !el) return;
    const proj = map.getProjection();
    const bounds = map.getBounds();
    if (!proj || !bounds) return;

    const scale = Math.pow(2, map.getZoom());
    const ne = proj.fromLatLngToPoint(bounds.getNorthEast());
    const sw = proj.fromLatLngToPoint(bounds.getSouthWest());
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setMapSize({ w, h });

    const next = {};
    for (const c of top10) {
      const ll = getCoords(c.name);
      if (!ll) continue;
      const pt = proj.fromLatLngToPoint(new window.google.maps.LatLng(ll.lat, ll.lng));
      const x = (pt.x - sw.x) * scale;
      const y = (pt.y - ne.y) * scale;
      if (x > -80 && x < w + 80 && y > -40 && y < h + 40) {
        next[c.name] = { x, y };
      }
    }
    setChipPositions(next);
  }, [top10]);

  useEffect(() => {
    if (!mapDivRef.current || !window.google?.maps) return;
    const map = new window.google.maps.Map(mapDivRef.current, {
      center: { lat: 22, lng: 15 },
      zoom: 2,
      minZoom: 2,
      maxZoom: 5,
      styles: MAP_STYLES,
      disableDefaultUI: true,
      gestureHandling: 'cooperative',
    });
    mapRef.current = map;
    map.addListener('idle', updatePositions);
    map.addListener('bounds_changed', updatePositions);
    return () => window.google.maps.event.clearInstanceListeners(map);
  }, [updatePositions]);

  useEffect(() => { updatePositions(); }, [updatePositions]);

  const activePos = activeCountry ? chipPositions[activeCountry] : null;

  return (
    <div
      className="imap-canvas-root"
      onClick={() => onChipClick(null)}
    >
      <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

      {/* Chip overlay */}
      <div className="imap-chip-layer">
        {top10.map(c => {
          const pos = chipPositions[c.name];
          if (!pos) return null;
          const intel = intelligence[c.name];
          const risk = intel?.riskLevel;
          const isActive = activeCountry === c.name;
          const isDimmed = activeCountry && !isActive;
          return (
            <button
              key={c.name}
              className={`imap-chip${isActive ? ' active' : ''}${isDimmed ? ' dimmed' : ''}`}
              style={{ '--cx': `${pos.x}px`, '--cy': `${pos.y}px` }}
              onClick={e => { e.stopPropagation(); onChipClick(c.name); }}
            >
              <span className="imap-chip-dot" style={{ background: RISK_DOT[risk] || '#6b7280' }} />
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Expanded card */}
      {activeCountry && activePos && mapSize.w > 0 && (
        <IntelCard
          key={activeCountry}
          countryName={activeCountry}
          intel={intelligence[activeCountry] || null}
          chipX={activePos.x}
          chipY={activePos.y}
          mapW={mapSize.w}
          mapH={mapSize.h}
          onClose={() => onChipClick(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────

export default function IntelligenceMap() {
  const googleApiKey = window.GOOGLE_MAPS_API_KEY || '';
  const { dayMap, sortedDates, loading } = useWeeklyArchive();
  const [activeCountry, setActiveCountry] = useState(null);

  const top10 = useMemo(() => {
    if (!dayMap) return [];
    const counts = {};
    for (const date of (sortedDates || [])) {
      for (const entry of (dayMap[date]?.entries || [])) {
        for (const region of (entry.regions || [])) {
          if (getCoords(region)) {
            counts[region] = (counts[region] || 0) + 1;
          }
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, articles]) => ({ name, articles }));
  }, [dayMap, sortedDates]);

  const countryNames = useMemo(() => top10.map(c => c.name), [top10]);
  const { intelligence } = useCountryIntelligence(countryNames);

  const handleChipClick = useCallback((name) => {
    setActiveCountry(name);
  }, []);

  const renderFallback = (status) => {
    if (status === 'FAILURE') {
      return (
        <div className="imap-fallback">
          <div>🗺️</div>
          <p>Map unavailable — Google Maps API key not configured.</p>
        </div>
      );
    }
    return <div className="imap-map-loading">Loading map…</div>;
  };

  return (
    <div className="imap-root">
      <div className="imap-header">
        <div>
          <div className="imap-header-title">🌍 Intelligence Map</div>
          <div className="imap-header-sub">
            Top countries by story activity · Click a chip to expand briefing
          </div>
        </div>
        {top10.length > 0 && (
          <div className="imap-legend">
            {Object.entries(RISK_DOT).slice(0, 4).map(([level, color]) => (
              <span key={level} className="imap-legend-item">
                <span className="imap-legend-dot" style={{ background: color }} />
                {level}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="imap-map-wrap">
        {loading && top10.length === 0 ? (
          <div className="imap-map-loading">Loading country data…</div>
        ) : googleApiKey ? (
          <Wrapper apiKey={googleApiKey} render={renderFallback}>
            <MapCanvas
              top10={top10}
              intelligence={intelligence}
              activeCountry={activeCountry}
              onChipClick={handleChipClick}
            />
          </Wrapper>
        ) : (
          <div className="imap-fallback">
            <div>🗺️</div>
            <p>Map requires Google Maps API key.</p>
          </div>
        )}
      </div>
    </div>
  );
}
