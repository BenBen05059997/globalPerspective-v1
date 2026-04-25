import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { useTodayArchive } from '../hooks/useTodayArchive';
import { getTopicCountryCodes } from '../utils/countryMapping';
import { COUNTRY_COORDINATES } from '../utils/mapConstants';
import MapSidePanel from './MapSidePanel';
import TodayArchiveSidebar from './TodayArchiveSidebar';
import './WorldMap.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  conflict:   '#ef4444',
  military:   '#ef4444',
  disaster:   '#f97316',
  politics:   '#3b82f6',
  economy:    '#22c55e',
  technology: '#8b5cf6',
  health:     '#14b8a6',
  climate:    '#10b981',
  science:    '#e879f9',
  business:   '#0ea5e9',
  society:    '#f59e0b',
  energy:     '#ca8a04',
  other:      '#6b7280',
};

const CATEGORY_DISPLAY_ORDER = ['conflict', 'military', 'disaster', 'climate', 'energy', 'politics', 'economy', 'business', 'technology', 'science', 'health', 'society', 'other'];

const getFlagEmoji = (code) => {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  const codePoints = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const getCategoryColor = (category) => CATEGORY_COLORS[(category || '').toLowerCase()] || CATEGORY_COLORS.other;

function getMutedColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gr = 0x94, gg = 0xa3, gb = 0xb8;
  const mr = Math.round(r * 0.35 + gr * 0.65);
  const mg = Math.round(g * 0.35 + gg * 0.65);
  const mb = Math.round(b * 0.35 + gb * 0.65);
  return `#${mr.toString(16).padStart(2,'0')}${mg.toString(16).padStart(2,'0')}${mb.toString(16).padStart(2,'0')}`;
}

// ─── Data Model ────────────────────────────────────────────────────────────────

function buildMapData(topics) {
  const countryTopicMap = {};
  const connectionMap = {}; // key: "A-B" → { from, to, topics[], categories[] }

  topics.forEach(topic => {
    let codes = getTopicCountryCodes(topic);

    // South Sudan disambiguation
    const titleLower = String(topic?.title || '').toLowerCase();
    if (titleLower.includes('south sudan')) {
      codes = codes.filter(c => c !== 'SD');
      if (!codes.includes('SS')) codes.push('SS');
    }

    codes.forEach(code => {
      if (!COUNTRY_COORDINATES[code]) return;
      if (!countryTopicMap[code]) {
        countryTopicMap[code] = {
          ...COUNTRY_COORDINATES[code],
          code,
          topics: [],
        };
      }
      countryTopicMap[code].topics.push(topic);
    });

    // Build pairwise connections
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        const a = codes[i];
        const b = codes[j];
        if (!COUNTRY_COORDINATES[a] || !COUNTRY_COORDINATES[b]) continue;
        const key = [a, b].sort().join('-');
        if (!connectionMap[key]) {
          connectionMap[key] = { from: a, to: b, topics: [], categories: [] };
        }
        connectionMap[key].topics.push(topic);
        const cat = (topic.category || 'other').toLowerCase();
        if (!connectionMap[key].categories.includes(cat)) {
          connectionMap[key].categories.push(cat);
        }
      }
    }
  });

  const connections = Object.values(connectionMap);
  return { countryTopicMap, connections };
}

function getDominantCategory(topics) {
  const counts = {};
  topics.forEach(t => {
    const cat = (t.category || 'other').toLowerCase();
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
}

// ─── Google MapComponent ───────────────────────────────────────────────────────

function MapComponent({ countryTopicMap, connections, archiveCountryTopicMap, archiveConnections, onCountryClick, onConnectionClick, selectedTopic }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const archiveMarkersRef = useRef([]);
  const archivePolylinesRef = useRef([]);
  const highlightCirclesRef = useRef([]);
  const infoWindowRef = useRef(null);

  // Init map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20, lng: 10 },
        zoom: 2,
        styles: [
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde8f0' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
          { featureType: 'road', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c0c0c0' }] },
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();

      // Click on map background closes info window (story flow stays active)
      mapInstanceRef.current.addListener('click', () => {
        if (infoWindowRef.current) infoWindowRef.current.close();
      });
    }
  }, [onConnectionClick]);

  // Draw markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !countryTopicMap) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    Object.values(countryTopicMap).forEach(country => {
      const { lat, lng, name, code, topics } = country;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const dominant = getDominantCategory(topics);
      const color = getCategoryColor(dominant);
      const count = topics.length;
      const size = count >= 4 ? 16 : count >= 2 ? 12 : 9;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: `${name}: ${count} topic${count !== 1 ? 's' : ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: size,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        label: {
          text: String(count),
          color: '#fff',
          fontWeight: 'bold',
          fontSize: count >= 10 ? '10px' : '11px',
        },
        zIndex: count * 10,
      });
      marker._baseScale = size;
      marker._fillColor = color;
      marker._count = count;

      marker.addListener('click', (e) => {
        e.stop?.();

        const topicListHtml = topics.map((t, idx) => {
          const cat = (t.category || 'other').toLowerCase();
          const catColor = getCategoryColor(cat);
          const otherCodes = getTopicCountryCodes(t).filter(c => c !== code);
          const othersText = otherCodes.length
            ? `<div style="font-size:11px;color:#888;margin-top:2px;">Also affects: ${otherCodes.map(getFlagEmoji).join(' ')}</div>`
            : '';
          return `
            <div id="iw-topic-${code}-${idx}" style="padding:8px 6px;border-bottom:1px solid #f0f0f0;cursor:pointer;border-radius:4px;transition:background 0.15s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
              <span style="display:inline-block;background:${catColor};color:#fff;font-size:10px;padding:1px 6px;border-radius:999px;margin-right:4px;">${cat}</span>
              <span style="font-size:13px;font-weight:500;">${t.title}</span>
              ${othersText}
            </div>`;
        }).join('');

        infoWindowRef.current.setContent(`
          <div style="max-width:300px;font-family:sans-serif;">
            <div style="font-size:15px;font-weight:700;margin-bottom:8px;">
              ${getFlagEmoji(code)} ${name} — ${count} topic${count !== 1 ? 's' : ''}
            </div>
            ${topicListHtml}
          </div>
        `);
        infoWindowRef.current.open(map, marker);

        setTimeout(() => {
          topics.forEach((t, idx) => {
            const el = document.getElementById(`iw-topic-${code}-${idx}`);
            if (el) el.addEventListener('click', () => {
              infoWindowRef.current.close();
              onCountryClick(code, t);
            });
          });
        }, 80);
      });

      markersRef.current.push(marker);
    });
  }, [countryTopicMap, onCountryClick]);

  // Draw connection lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !connections) return;

    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    connections.forEach(conn => {
      const fromCoords = COUNTRY_COORDINATES[conn.from];
      const toCoords = COUNTRY_COORDINATES[conn.to];
      if (!fromCoords || !toCoords) return;

      const dominantCat = conn.categories[0] || 'other';
      const color = getCategoryColor(dominantCat);
      const weight = Math.min(1 + conn.topics.length, 4);

      const polyline = new window.google.maps.Polyline({
        path: [
          { lat: fromCoords.lat, lng: fromCoords.lng },
          { lat: toCoords.lat, lng: toCoords.lng },
        ],
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.45,
        strokeWeight: weight,
        map,
      });

      polyline.addListener('click', (e) => {
        e.stop?.();
        if (conn.topics.length === 1) {
          onConnectionClick(conn.topics[0]);
        } else {
          // Show mini info window listing topics on this line
          const html = conn.topics.map(t => `<div style="padding:3px 0;font-size:13px;">${t.title}</div>`).join('');
          infoWindowRef.current.setContent(`
            <div style="max-width:260px;font-family:sans-serif;">
              <div style="font-weight:600;margin-bottom:6px;">${getFlagEmoji(conn.from)} ↔ ${getFlagEmoji(conn.to)}</div>
              ${html}
            </div>
          `);
          infoWindowRef.current.setPosition(e.latLng);
          infoWindowRef.current.open(map);
        }
      });

      polyline._connData = conn;
      polylinesRef.current.push(polyline);
    });
  }, [connections, onConnectionClick]);

  // Draw archive-only markers (muted, smaller, no label)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !archiveCountryTopicMap) return;

    archiveMarkersRef.current.forEach(m => m.setMap(null));
    archiveMarkersRef.current = [];

    Object.values(archiveCountryTopicMap).forEach(country => {
      const { lat, lng, name, code, topics } = country;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const dominant = getDominantCategory(topics);
      const mutedColor = getMutedColor(getCategoryColor(dominant));

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: `${name}: ${topics.length} earlier topic${topics.length !== 1 ? 's' : ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: mutedColor,
          fillOpacity: 0.6,
          strokeColor: '#ccc',
          strokeWeight: 1,
        },
        zIndex: 1,
      });

      marker.addListener('click', (e) => {
        e.stop?.();
        onCountryClick(code);
      });

      archiveMarkersRef.current.push(marker);
    });
  }, [archiveCountryTopicMap, onCountryClick]);

  // Draw archive connections (dashed, muted)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !archiveConnections) return;

    archivePolylinesRef.current.forEach(p => p.setMap(null));
    archivePolylinesRef.current = [];

    archiveConnections.forEach(conn => {
      const fromCoords = COUNTRY_COORDINATES[conn.from];
      const toCoords = COUNTRY_COORDINATES[conn.to];
      if (!fromCoords || !toCoords) return;

      const dominantCat = conn.categories[0] || 'other';
      const mutedColor = getMutedColor(getCategoryColor(dominantCat));

      const polyline = new window.google.maps.Polyline({
        path: [
          { lat: fromCoords.lat, lng: fromCoords.lng },
          { lat: toCoords.lat, lng: toCoords.lng },
        ],
        geodesic: true,
        strokeColor: mutedColor,
        strokeOpacity: 0,
        strokeWeight: 2,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.5, scale: 2, strokeColor: mutedColor },
          offset: '0',
          repeat: '12px',
        }],
        map,
        zIndex: 0,
      });

      archivePolylinesRef.current.push(polyline);
    });
  }, [archiveConnections]);

  // Story flow: yellow highlight on affected countries
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous highlight circles
    highlightCirclesRef.current.forEach(c => c.setMap(null));
    highlightCirclesRef.current = [];

    if (!selectedTopic) {
      // Reset polylines to normal
      polylinesRef.current.forEach(p => {
        p.setOptions({ strokeOpacity: 0.45, strokeWeight: Math.min(1 + p._connData.topics.length, 4) });
      });
      return;
    }

    const selectedId = selectedTopic.topicId || selectedTopic.id;
    const affectedCodes = new Set(getTopicCountryCodes(selectedTopic));

    // Slightly emphasize selected polylines, keep others normal
    polylinesRef.current.forEach(p => {
      const conn = p._connData;
      const isSelected = conn.topics.some(t => (t.topicId || t.id) === selectedId);
      p.setOptions({
        strokeOpacity: isSelected ? 0.85 : 0.45,
        strokeWeight: isSelected ? 4 : Math.min(1 + conn.topics.length, 4),
      });
    });

    // Add yellow highlight markers (fixed pixel size, zoom-independent)
    affectedCodes.forEach(code => {
      const coords = COUNTRY_COORDINATES[code];
      if (!coords) return;
      const marker = new window.google.maps.Marker({
        position: { lat: coords.lat, lng: coords.lng },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 30,
          fillColor: '#facc15',
          fillOpacity: 0.22,
          strokeColor: '#eab308',
          strokeOpacity: 0.5,
          strokeWeight: 2,
        },
        clickable: false,
        zIndex: 1,
      });
      highlightCirclesRef.current.push(marker);
    });
  }, [selectedTopic, countryTopicMap]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ─── Fallback Map ──────────────────────────────────────────────────────────────

function FallbackMapComponent({ countryTopicMap, connections, archiveCountryTopicMap, archiveConnections, onCountryClick }) {
  const [hoveredCode, setHoveredCode] = useState(null);

  const countries = Object.values(countryTopicMap || {});
  const archiveCountries = Object.values(archiveCountryTopicMap || {});
  const totalConnections = (connections || []).length;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#dde8f0' }}>
      <svg width="100%" height="100%" viewBox="0 0 1000 500" style={{ position: 'absolute', inset: 0 }}>
        <rect width="1000" height="500" fill="#dde8f0" />
        <path d="M100 100 L300 80 L320 200 L250 250 L150 220 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M200 280 L280 270 L300 400 L220 420 L180 350 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M450 80 L550 70 L580 150 L500 180 L430 140 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M480 200 L580 190 L600 350 L520 380 L460 320 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M600 50 L850 40 L880 200 L750 220 L620 180 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M750 350 L850 340 L870 400 L780 410 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />

        {/* Archive connection lines (dashed, muted) */}
        {(archiveConnections || []).slice(0, 50).map((conn, i) => {
          const from = COUNTRY_COORDINATES[conn.from];
          const to = COUNTRY_COORDINATES[conn.to];
          if (!from || !to) return null;
          const x1 = ((from.lng + 180) / 360) * 1000;
          const y1 = ((90 - from.lat) / 180) * 500;
          const x2 = ((to.lng + 180) / 360) * 1000;
          const y2 = ((90 - to.lat) / 180) * 500;
          const mutedColor = getMutedColor(getCategoryColor(conn.categories[0] || 'other'));
          return (
            <line key={`arc-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={mutedColor} strokeWidth="1" strokeOpacity="0.35" strokeDasharray="6 4" />
          );
        })}

        {/* Connection lines */}
        {(connections || []).slice(0, 50).map((conn, i) => {
          const from = COUNTRY_COORDINATES[conn.from];
          const to = COUNTRY_COORDINATES[conn.to];
          if (!from || !to) return null;
          const x1 = ((from.lng + 180) / 360) * 1000;
          const y1 = ((90 - from.lat) / 180) * 500;
          const x2 = ((to.lng + 180) / 360) * 1000;
          const y2 = ((90 - to.lat) / 180) * 500;
          const color = getCategoryColor(conn.categories[0] || 'other');
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth="1" strokeOpacity="0.4" />
          );
        })}

        {/* Country markers */}
        {countries.map(country => {
          const x = ((country.lng + 180) / 360) * 1000;
          const y = ((90 - country.lat) / 180) * 500;
          const dominant = getDominantCategory(country.topics);
          const color = getCategoryColor(dominant);
          const r = Math.min(4 + country.topics.length * 2, 12);
          return (
            <g key={country.code}>
              <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" strokeWidth="1.5"
                style={{ cursor: 'pointer', opacity: hoveredCode === country.code ? 0.75 : 1 }}
                onMouseEnter={() => setHoveredCode(country.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={() => onCountryClick(country.code)}
              />
              <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold"
                style={{ pointerEvents: 'none' }}>
                {country.topics.length}
              </text>
              {hoveredCode === country.code && (
                <text x={x} y={y - r - 4} textAnchor="middle" fill="#333" fontSize="11" fontWeight="600"
                  style={{ pointerEvents: 'none' }}>
                  {country.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Archive-only country markers (muted, smaller) */}
        {archiveCountries.map(country => {
          const x = ((country.lng + 180) / 360) * 1000;
          const y = ((90 - country.lat) / 180) * 500;
          const dominant = getDominantCategory(country.topics);
          const mutedColor = getMutedColor(getCategoryColor(dominant));
          return (
            <circle key={`arc-${country.code}`} cx={x} cy={y} r={4}
              fill={mutedColor} stroke="#ccc" strokeWidth="1" opacity="0.6"
              style={{ cursor: 'pointer' }}
              onClick={() => onCountryClick(country.code)}
            />
          );
        })}
      </svg>

      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(255,255,255,0.9)',
        padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#555' }}>
        📍 Simplified map · {countries.length} countries · {totalConnections} connections · Click markers for details
      </div>
    </div>
  );
}

// ─── Main WorldMap Component ───────────────────────────────────────────────────

export default function WorldMap() {
  const { topics, loading, error, refetch } = useGeminiTopics();
  const { entries: archiveEntries } = useTodayArchive();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelCountry, setPanelCountry] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [activeCategories, setActiveCategories] = useState(new Set());

  const { countryTopicMap: rawCountryTopicMap, connections: rawConnections } = buildMapData(topics || []);

  // Gather categories present in today's topics (for chips)
  const presentCategories = useMemo(() => [...new Set(
    (topics || []).map(t => (t.category || 'other').toLowerCase())
  )].sort((a, b) => CATEGORY_DISPLAY_ORDER.indexOf(a) - CATEGORY_DISPLAY_ORDER.indexOf(b)), [topics]);

  // Apply category filter — empty activeCategories means "show all"
  const { countryTopicMap, connections } = useMemo(() => {
    if (activeCategories.size === 0) {
      return { countryTopicMap: rawCountryTopicMap, connections: rawConnections };
    }
    // Filter connections
    const filteredConns = rawConnections.filter(conn =>
      conn.categories.some(c => activeCategories.has(c))
    );
    // Rebuild filtered country topic map
    const filteredCtm = {};
    Object.entries(rawCountryTopicMap).forEach(([code, country]) => {
      const filteredTopics = country.topics.filter(t =>
        activeCategories.has((t.category || 'other').toLowerCase())
      );
      if (filteredTopics.length > 0) {
        filteredCtm[code] = { ...country, topics: filteredTopics };
      }
    });
    return { countryTopicMap: filteredCtm, connections: filteredConns };
  }, [rawCountryTopicMap, rawConnections, activeCategories]);

  const toggleCategory = useCallback((cat) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
    setSelectedTopic(null); // clear story flow when filter changes
  }, []);

  // Filter archive: exclude topic IDs already in current topics
  const filteredArchive = useMemo(() => {
    if (!archiveEntries.length) return [];
    const activeIds = new Set(
      (topics || []).map(t => String(t?.topicId || t?.topic_id || t?.id || '').trim()).filter(Boolean)
    );
    return archiveEntries.filter(e => !activeIds.has(String(e.topicId)));
  }, [archiveEntries, topics]);

  const { countryTopicMap: archiveCountryTopicMap, connections: archiveConnections } = buildMapData(filteredArchive);

  // Archive-only countries: in archive but NOT in current (to avoid marker overlap)
  const archiveOnlyCountryTopicMap = useMemo(() => {
    const result = {};
    for (const code of Object.keys(archiveCountryTopicMap)) {
      if (!countryTopicMap[code]) result[code] = archiveCountryTopicMap[code];
    }
    return result;
  }, [archiveCountryTopicMap, countryTopicMap]);

  const handleCountryClick = useCallback((code, topic) => {
    setPanelCountry(code);
    setPanelOpen(true);
    if (topic) {
      setSelectedTopic(topic);
    }
  }, []);

  const handleConnectionClick = useCallback((topic) => {
    setSelectedTopic(topic);
  }, []);

  const handleTopicSelect = useCallback((topic) => {
    setSelectedTopic(topic);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    setSelectedTopic(null);
  }, []);

  // Escape key clears story flow
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setSelectedTopic(null); setPanelOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totalCountries = Object.keys(countryTopicMap).length;
  const totalConnections = connections.length;

  const apiKey = typeof window !== 'undefined' && window.GOOGLE_MAPS_API_KEY
    ? window.GOOGLE_MAPS_API_KEY
    : '';

  const render = (status) => {
    if (status === 'FAILURE' || !apiKey) {
      return (
        <FallbackMapComponent
          countryTopicMap={countryTopicMap}
          connections={connections}
          archiveCountryTopicMap={archiveOnlyCountryTopicMap}
          archiveConnections={archiveConnections}
          onCountryClick={handleCountryClick}
        />
      );
    }
    if (status === 'LOADING') {
      return (
        <div className="map-loading-overlay">
          <div className="map-spinner" />
        </div>
      );
    }
    return (
      <MapComponent
        countryTopicMap={countryTopicMap}
        connections={connections}
        archiveCountryTopicMap={archiveOnlyCountryTopicMap}
        archiveConnections={archiveConnections}
        onCountryClick={handleCountryClick}
        onConnectionClick={handleConnectionClick}
        selectedTopic={selectedTopic}
      />
    );
  };

  if (loading) {
    return (
      <div className="wm-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="map-spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            Loading topics…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wm-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, margin: '0 0 10px', color: 'var(--risk-h)' }}>Map loading failed</h3>
          <p style={{ color: 'var(--ink-mid)', margin: '0 0 20px', fontSize: 14 }}>{error}</p>
          <button onClick={refetch} style={{ padding: '8px 18px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 12 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wm-page">

      {/* Page header */}
      <div className="wm-hd">
        <div className="wm-hd-left">
          <div className="wm-kicker">Live Intelligence Map</div>
          <h1 className="wm-h1">Today's Topics</h1>
        </div>
        <div className="wm-hd-meta">
          <span className="dot" />
          <span>Topics <b>{(topics || []).length}</b></span>
          <span>Countries <b>{totalCountries + Object.keys(archiveOnlyCountryTopicMap).length}</b></span>
          <span>Connections <b>{totalConnections}</b></span>
          {filteredArchive.length > 0 && <span>Earlier <b>{filteredArchive.length}</b></span>}
        </div>
      </div>

      {/* Body: left rail + map canvas */}
      <div className="wm-body">

        {/* Left filter rail */}
        <aside className="wm-rail">

          {presentCategories.length > 0 && (
            <div className="wm-rail-section">
              <div className="wm-rail-lbl">Categories</div>
              {presentCategories.map(cat => {
                const isOn = activeCategories.has(cat);
                const color = getCategoryColor(cat);
                const count = (topics || []).filter(t => (t.category || 'other').toLowerCase() === cat).length;
                return (
                  <div key={cat} className={`wm-rail-chk${isOn ? ' on' : ''}`} onClick={() => toggleCategory(cat)}>
                    <span className="wm-rail-chk-box" />
                    <span className="wm-rail-pill" style={{ background: color }} />
                    <span style={{ textTransform: 'capitalize', flex: 1 }}>{cat}</span>
                    <span className="wm-rail-c">{count}</span>
                  </div>
                );
              })}
              {activeCategories.size > 0 && (
                <button className="wm-rail-reset" onClick={() => { setActiveCategories(new Set()); setSelectedTopic(null); }}>
                  ✕ Reset filter
                </button>
              )}
            </div>
          )}

          <div className="wm-rail-section">
            <div className="wm-rail-lbl">Legend</div>
            {presentCategories.map(cat => (
              <div key={cat} className="wm-legend-row">
                <span className="wm-legend-dot" style={{ background: getCategoryColor(cat) }} />
                <span style={{ textTransform: 'capitalize', fontSize: 12.5, color: 'var(--ink-mid)' }}>{cat}</span>
              </div>
            ))}
            {filteredArchive.length > 0 && (
              <div className="wm-legend-archive">
                <span className="wm-legend-dot" style={{ background: '#94a3b8', opacity: 0.6 }} />
                <span style={{ fontSize: 12.5 }}>Earlier topics</span>
                <span className="wm-legend-dash" />
              </div>
            )}
          </div>

          <div className="wm-rail-section">
            <div className="wm-rail-lbl">Info</div>
            <p style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.5, margin: 0 }}>
              Lines connect countries sharing the same story. Click a country marker or line to explore.
            </p>
          </div>
        </aside>

        {/* Map area */}
        <div className="wm-map-area">
          <div className="wm-canvas">

            {/* Story flow banner */}
            {selectedTopic && (
              <div className="wm-story-banner">
                <button className="wm-story-banner-back" onClick={() => setSelectedTopic(null)}>← Clear</button>
                <span className="wm-story-banner-title">{selectedTopic.title}</span>
              </div>
            )}

            {/* Stats overlay */}
            <div className="wm-stats-overlay">
              <div className="wm-stat-row">Now <b>{(topics || []).length}</b></div>
              {filteredArchive.length > 0 && <div className="wm-stat-row">Earlier <b>{filteredArchive.length}</b></div>}
              <div className="wm-stat-row">Countries <b>{totalCountries}</b></div>
            </div>

            {/* Map */}
            <div className="map-shell">
              {apiKey ? (
                <Wrapper apiKey={apiKey} render={render} />
              ) : (
                <FallbackMapComponent
                  countryTopicMap={countryTopicMap}
                  connections={connections}
                  archiveCountryTopicMap={archiveOnlyCountryTopicMap}
                  archiveConnections={archiveConnections}
                  onCountryClick={handleCountryClick}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <MapSidePanel
        isOpen={panelOpen}
        onClose={handleClosePanel}
        country={panelCountry}
        topics={panelCountry ? (countryTopicMap[panelCountry]?.topics || []) : []}
        archiveTopics={panelCountry ? (archiveCountryTopicMap[panelCountry]?.topics || []) : []}
        countryTopicMap={countryTopicMap}
        archiveCountryTopicMap={archiveCountryTopicMap}
        selectedTopicId={selectedTopic ? (selectedTopic.topicId || selectedTopic.id) : null}
        onTopicSelect={handleTopicSelect}
      />
    </div>
  );
}
