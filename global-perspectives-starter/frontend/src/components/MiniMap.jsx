import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTopicCountryCodes } from '../utils/countryMapping';
import { COUNTRY_COORDINATES, CONTINENT_PATHS } from '../utils/mapConstants';

function resolveCoords(regions) {
  const points = [];
  const seen = new Set();
  for (const region of regions) {
    const codes = getTopicCountryCodes({ regions: [region] });
    for (const code of codes) {
      if (seen.has(code) || !COUNTRY_COORDINATES[code]) continue;
      seen.add(code);
      const c = COUNTRY_COORDINATES[code];
      points.push({ code, lat: c.lat, lng: c.lng, name: c.name });
    }
  }
  return points;
}

function toSvg(lat, lng, vw, vh, bounds) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * vw;
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * vh;
  return { x, y };
}

export default function MiniMap({ regions, color = '#3b82f6', static: isStatic = false }) {
  const navigate = useNavigate();

  const { points, bounds } = useMemo(() => {
    const pts = resolveCoords(regions || []);
    if (pts.length === 0) return { points: [], bounds: null };

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const p of pts) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    const isSingle = pts.length === 1;
    const latPad = Math.max((maxLat - minLat) * 0.4, isSingle ? 30 : 15);
    const lngPad = Math.max((maxLng - minLng) * 0.4, isSingle ? 45 : 25);

    return {
      points: pts,
      bounds: {
        minLat: Math.max(-85, minLat - latPad),
        maxLat: Math.min(85, maxLat + latPad),
        minLng: Math.max(-180, minLng - lngPad),
        maxLng: Math.min(180, maxLng + lngPad),
      },
    };
  }, [regions]);

  if (!bounds || points.length === 0) return null;

  const vw = 320;
  const vh = 160;

  const connections = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      connections.push({ from: points[i], to: points[j] });
    }
  }

  return (
    <div
      className={`mini-map-container${isStatic ? ' static' : ''}`}
      onClick={isStatic ? undefined : () => navigate('/map')}
      role={isStatic ? undefined : 'button'}
      tabIndex={isStatic ? undefined : 0}
      onKeyDown={isStatic ? undefined : e => e.key === 'Enter' && navigate('/map')}
      style={isStatic ? { cursor: 'default' } : undefined}
    >
      <svg width="100%" viewBox={`0 0 ${vw} ${vh}`} style={{ display: 'block' }}>
        <rect width={vw} height={vh} fill="#eef2f7" rx="6" />

        {CONTINENT_PATHS.map((cp, i) => (
          <path key={i} d={cp.d} fill="#dce4ec" stroke="#c5cdd5" strokeWidth="0.5"
            transform={`translate(${-((bounds.minLng + 180) / 360) * 1000 * (vw / ((bounds.maxLng - bounds.minLng) / 360 * 1000))}, ${-((90 - bounds.maxLat) / 180) * 500 * (vh / ((bounds.maxLat - bounds.minLat) / 180 * 500))}) scale(${vw / ((bounds.maxLng - bounds.minLng) / 360 * 1000)}, ${vh / ((bounds.maxLat - bounds.minLat) / 180 * 500)})`}
          />
        ))}

        {connections.map((conn, i) => {
          const from = toSvg(conn.from.lat, conn.from.lng, vw, vh, bounds);
          const to = toSvg(conn.to.lat, conn.to.lng, vw, vh, bounds);
          return (
            <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color} strokeWidth="1" strokeOpacity="0.3" />
          );
        })}

        {points.map((p) => {
          const { x, y } = toSvg(p.lat, p.lng, vw, vh, bounds);
          return (
            <g key={p.code}>
              <circle cx={x} cy={y} r={5} fill={color} stroke="#fff" strokeWidth="1.5" opacity="0.85" />
              <text x={x} y={y - 8} textAnchor="middle" fill="#374151" fontSize="8" fontWeight="600">
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>
      {!isStatic && (
        <div className="mini-map-footer">
          Open full map →
        </div>
      )}
    </div>
  );
}
