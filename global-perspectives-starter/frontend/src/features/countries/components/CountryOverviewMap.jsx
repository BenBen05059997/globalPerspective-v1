import { useRef, useEffect } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { COUNTRY_COORDINATES } from '@/features/threads/lib/mapConstants';
import { regionToCountryCode } from '@/shared/lib/countryMapping';

// The Google map is painted from the site's role tokens (read from :root at call time, so the
// map follows tokens.css instead of carrying its own palette). Dark base: water on --bg, land on
// --panel-2, borders on a hairline tone.
const rootVar = (name, fallbackName = 'text-dim') => {
  const cs = getComputedStyle(document.documentElement);
  return (cs.getPropertyValue('--' + name) || cs.getPropertyValue('--' + fallbackName)).trim();
};

function mapStyles() {
  return [
    { elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: rootVar('bg') }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: rootVar('panel-3') }] },
    { featureType: 'road', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: rootVar('text-dim') }] },
  ];
}

// Risk = ring weight on one neutral marker (the list legend draws the same), never a colour or
// brightness scale (DS1). Marker size = coverage. `tier` is the list's score-first countryTier.
const RING = {
  low: { color: 'bg', weight: 1, z: 40 },
  moderate: { color: 'text-body', weight: 1, z: 50 },
  elevated: { color: 'text-head', weight: 2, z: 80 },
  high: { color: 'text-head', weight: 3.5, z: 100 },
};
const TIER_WORD = { low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High' };

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function resolveCoords(name) {
  const code = regionToCountryCode(name);
  if (!code || !COUNTRY_COORDINATES[code]) return null;
  const c = COUNTRY_COORDINATES[code];
  return { lat: c.lat, lng: c.lng };
}

function InnerMap({ countries, onCountryClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20, lng: 10 },
        zoom: 2,
        minZoom: 2,
        maxZoom: 8,
        restriction: {
          latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
          strictBounds: true,
        },
        styles: mapStyles(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
      });
      infoRef.current = new window.google.maps.InfoWindow({ disableAutoPan: false, maxWidth: 320 });
      // Hide close button and fix overflow
      const style = document.createElement('style');
      style.textContent = `
        .gm-style-iw button.gm-ui-hover-effect { display: none !important; }
        .gm-style .gm-style-iw-c button[aria-label="Close"] { display: none !important; }
        .gm-style-iw-d { overflow: visible !important; }
        .gm-style .gm-style-iw-c { background: var(--panel-2) !important; color: var(--text-head); border: 1px solid var(--hairline-strong); }
        .gm-style .gm-style-iw-tc::after { background: var(--panel-2) !important; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !countries.length) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    for (const c of countries) {
      const pos = resolveCoords(c.name);
      if (!pos) continue;

      const ring = RING[c.tier] || RING.low;
      const scale = Math.min(6 + Math.log2(c.articles || 1) * 1.5, 13);
      const tierText = c.tier ? ` · ${TIER_WORD[c.tier]} risk` : '';
      // Styled by .clp-tip* in CountryListPage.css (the InfoWindow renders in the page DOM).
      const tooltipHtml = `<div class="clp-tip">
        <div class="clp-tip-name">${escapeHtml(c.name)}</div>
        <div class="clp-tip-meta">${c.articles} articles${tierText}</div>
        ${c.headline ? `<div class="clp-tip-head">${escapeHtml(c.headline)}</div>` : ''}
        <div class="clp-tip-hint">Click for full briefing</div>
      </div>`;

      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: `${c.name} — ${c.articles} articles${c.tier ? `, ${TIER_WORD[c.tier].toLowerCase()} risk` : ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: rootVar('text-muted'),
          fillOpacity: 0.85,
          strokeColor: rootVar(ring.color),
          strokeWeight: ring.weight,
        },
        zIndex: ring.z,
      });

      marker.addListener('mouseover', () => {
        infoRef.current.setContent(tooltipHtml);
        infoRef.current.open(map, marker);
      });
      marker.addListener('mouseout', () => {
        infoRef.current.close();
      });
      marker.addListener('click', () => {
        infoRef.current.close();
        if (onCountryClick) onCountryClick(c.name);
      });

      markersRef.current.push(marker);
    }
  }, [countries, onCountryClick]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

export default function CountryOverviewMap({ countries, onCountryClick }) {
  const apiKey = window.GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="clp-map-empty">
        Map unavailable
      </div>
    );
  }

  const render = (status) => {
    if (status === 'LOADING') return <div className="clp-map-empty" aria-hidden="true" />;
    if (status === 'FAILURE') return null;
    return <InnerMap countries={countries} onCountryClick={onCountryClick} />;
  };

  return <Wrapper apiKey={apiKey} render={render} />;
}
