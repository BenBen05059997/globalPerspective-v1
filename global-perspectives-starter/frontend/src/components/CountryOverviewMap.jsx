import { useRef, useEffect } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { COUNTRY_COORDINATES } from '../utils/mapConstants';
import { regionToCountryCode } from '../utils/countryMapping';

const MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde8f0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c0c0c0' }] },
];

const RISK_MAP_COLORS = {
  high:     '#ef4444',
  elevated: '#f97316',
  moderate: '#eab308',
  low:      '#22c55e',
};

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
        styles: MAP_STYLES,
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

      const color = RISK_MAP_COLORS[c.riskLevel] || '#9ca3af';
      const scale = Math.min(6 + Math.log2(c.articles || 1) * 1.5, 13);

      const riskLabel = c.riskLevel ? `<span style="color:${color};font-weight:700;">● ${c.riskLevel}</span>` : '';
      const headline = c.headline ? `<div style="font-size:11px;color:#374151;margin:0 0 8px;line-height:1.4;">${c.headline}</div>` : '';
      const tooltipHtml = `<div style="font-family:system-ui,sans-serif;padding:0;min-width:200px;">
        <div style="font-size:13px;font-weight:700;margin:0 0 6px;">${c.name}</div>
        <div style="font-size:11px;color:#6b7280;margin:0 0 8px;">${c.articles} articles ${riskLabel}</div>
        ${headline}
        <div style="font-size:10px;color:#9ca3af;margin:0 0 4px;">Click for full briefing</div>
      </div>`;

      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: `${c.name} — ${c.articles} articles${c.riskLevel ? `, ${c.riskLevel} risk` : ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale,
          fillColor: color,
          fillOpacity: 0.85,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        zIndex: c.riskLevel === 'high' ? 100 : c.riskLevel === 'elevated' ? 80 : 50,
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
      <div style={{ width: '100%', height: '100%', background: '#dde8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
        Map unavailable
      </div>
    );
  }

  const render = (status) => {
    if (status === 'LOADING') return <div style={{ width: '100%', height: '100%', background: '#dde8f0' }} />;
    if (status === 'FAILURE') return null;
    return <InnerMap countries={countries} onCountryClick={onCountryClick} />;
  };

  return <Wrapper apiKey={apiKey} render={render} />;
}
