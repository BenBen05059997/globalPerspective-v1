import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wrapper } from '@googlemaps/react-wrapper';
import IntelligenceLoader from './IntelligenceLoader';
import ShareButtons from './ShareButtons';
import { usePairIntelligence } from '../hooks/usePairIntelligence';
import { COUNTRY_NAME_TO_CODE } from '../utils/countryMapping';
import { COUNTRY_COORDINATES } from '../utils/mapConstants';
import './PairPage.css';

const MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde8f0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c0c0c0' }] },
];

const QUALITY_CONFIG = {
  rich: { label: 'Rich data', cls: 'quality-rich' },
  moderate: { label: 'Moderate data', cls: 'quality-moderate' },
  sparse: { label: 'Sparse data', cls: 'quality-sparse' },
  thin: { label: 'Limited data', cls: 'quality-thin' },
};

function confidenceLabel(v) {
  if (v > 0.7) return { label: 'High', cls: 'conf-high' };
  if (v >= 0.4) return { label: 'Medium', cls: 'conf-medium' };
  return { label: 'Low', cls: 'conf-low' };
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function PairMapInner({ coordA, coordB }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !window.google) return;
    if (mapRef.current) return;

    const center = {
      lat: (coordA.lat + coordB.lat) / 2,
      lng: (coordA.lng + coordB.lng) / 2,
    };

    const map = new window.google.maps.Map(ref.current, {
      center,
      zoom: 3,
      styles: MAP_STYLES,
      disableDefaultUI: true,
      gestureHandling: 'none',
      zoomControl: false,
    });
    mapRef.current = map;

    lineRef.current = new window.google.maps.Polyline({
      path: [coordA, coordB],
      geodesic: true,
      strokeColor: '#374151',
      strokeOpacity: 0.6,
      strokeWeight: 1.5,
      map,
    });

    [coordA, coordB].forEach(coord => {
      new window.google.maps.Circle({
        center: coord,
        radius: 400000,
        fillColor: '#374151',
        fillOpacity: 0.07,
        strokeColor: '#374151',
        strokeOpacity: 0.25,
        strokeWeight: 1,
        map,
      });
    });
  }, [coordA, coordB]);

  return <div ref={ref} className="pp-map-canvas" />;
}

function PairMap({ countries }) {
  const apiKey = typeof window !== 'undefined' ? window.GOOGLE_MAPS_API_KEY : '';
  const codes = countries.map(n => COUNTRY_NAME_TO_CODE[n]).filter(Boolean);
  const coords = codes.map(c => COUNTRY_COORDINATES[c]).filter(Boolean);
  if (coords.length < 2 || !apiKey) return <div className="pp-map-canvas pp-map-placeholder" />;

  return (
    <Wrapper apiKey={apiKey}>
      <PairMapInner coordA={coords[0]} coordB={coords[1]} />
    </Wrapper>
  );
}

function DataQualityBadge({ quality }) {
  const cfg = QUALITY_CONFIG[quality] || QUALITY_CONFIG.thin;
  return <span className={`pp-quality-badge ${cfg.cls}`}>{cfg.label}</span>;
}

function RootDriverSection({ rootDriver }) {
  if (!rootDriver) return null;
  const { layer1, layer2, layer3 } = rootDriver;
  return (
    <section className="pp-section pp-root-driver">
      <h2 className="pp-section-title">Root Driver</h2>
      <div className="pp-rd-layers">
        {layer1 && (
          <div className="pp-rd-layer pp-rd-l1">
            <div className="pp-rd-dot" />
            <div className="pp-rd-content">
              {layer1.actor && <span className="pp-rd-actor">{layer1.actor}</span>}
              {layer1.action && <p className="pp-rd-text">{layer1.action}</p>}
              {layer1.date && <span className="pp-rd-date">{formatDate(layer1.date)}</span>}
            </div>
          </div>
        )}
        {layer2 && (
          <div className="pp-rd-layer pp-rd-l2">
            <div className="pp-rd-dot" />
            <div className="pp-rd-content">
              <p className="pp-rd-text">{typeof layer2 === 'string' ? layer2 : layer2.text || JSON.stringify(layer2)}</p>
            </div>
          </div>
        )}
        {layer3 && (
          <div className="pp-rd-layer pp-rd-l3">
            <div className="pp-rd-dot" />
            <div className="pp-rd-content">
              <p className="pp-rd-text">{typeof layer3 === 'string' ? layer3 : layer3.text || JSON.stringify(layer3)}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineSection({ timeline }) {
  if (!timeline?.length) return null;
  return (
    <section className="pp-section pp-timeline">
      <h2 className="pp-section-title">Timeline</h2>
      <div className="pp-tl-rail">
        {timeline.map((item, i) => (
          <div key={i} className="pp-tl-event">
            <div className="pp-tl-dot" />
            <div className="pp-tl-body">
              <span className="pp-tl-date">{formatDate(item.date)}</span>
              <p className="pp-tl-event-text">{item.event}</p>
              {item.significance && <p className="pp-tl-sig">{item.significance}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PredictionsSection({ predictions }) {
  if (!predictions?.length) return null;
  return (
    <section className="pp-section pp-predictions">
      <h2 className="pp-section-title">Predictions</h2>
      <div className="pp-pred-grid">
        {predictions.map((p, i) => {
          const conf = confidenceLabel(p.confidence);
          return (
            <div key={i} className="pp-pred-card">
              <p className="pp-pred-claim">{p.claim}</p>
              <div className="pp-pred-meta">
                {p.timeframe && <span className="pp-pred-timeframe">{p.timeframe}</span>}
                <span className={`pp-conf-pill ${conf.cls}`}>{conf.label} confidence</span>
              </div>
              {p.mechanism && <p className="pp-pred-mechanism">{p.mechanism}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WatchItemsSection({ watchItems }) {
  if (!watchItems?.length) return null;
  return (
    <section className="pp-section pp-watch-items">
      <h2 className="pp-section-title">Watch Items</h2>
      <div className="pp-watch-grid">
        {watchItems.map((w, i) => (
          <div key={i} className="pp-watch-card">
            {w.actor && <div className="pp-watch-actor">{w.actor}</div>}
            {w.indicator && <div className="pp-watch-indicator">{w.indicator}</div>}
            {w.why && <p className="pp-watch-why">{w.why}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PairPage() {
  const { slug } = useParams();
  const { data, loading, error } = usePairIntelligence(slug);

  if (loading) {
    return (
      <div className="pp-loading">
        <IntelligenceLoader type="typewriter" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="pp-not-found">
        <h1>Pair analysis not available</h1>
        <p>{error || 'No analysis found for this pair.'}</p>
        <Link to="/weekly/pairs" className="pp-back-link">← All pairs</Link>
      </div>
    );
  }

  const { pairTitle, currentState, trajectory, rootDriver, timeline, predictions, watchItems, dataQuality, countries = [], generatedAt } = data;

  return (
    <div className="pp-page">
      <div className="pp-hero">
        {countries.length >= 2 && <PairMap countries={countries} />}
        <div className="pp-hero-overlay">
          <div className="pp-hero-content">
            <div className="pp-breadcrumb">
              <Link to="/weekly/pairs">All pairs</Link>
              {countries.map((c, i) => (
                <span key={i}>
                  {' · '}
                  <Link to={`/weekly/country/${encodeURIComponent(c)}`}>{c}</Link>
                </span>
              ))}
            </div>
            <h1 className="pp-hero-title">{pairTitle}</h1>
          </div>
          {dataQuality && (
            <div className="pp-quality-wrap">
              <DataQualityBadge quality={dataQuality} />
            </div>
          )}
        </div>
      </div>

      <div className="pp-body">
        {currentState && (
          <section className="pp-section pp-current-state">
            <h2 className="pp-section-title">Current State</h2>
            {currentState.split('\n').filter(Boolean).map((p, i) => (
              <p key={i} className="pp-narrative">{p}</p>
            ))}
          </section>
        )}

        <RootDriverSection rootDriver={rootDriver} />
        <TimelineSection timeline={timeline} />

        {trajectory && (
          <section className="pp-section pp-trajectory">
            <h2 className="pp-section-title">Trajectory</h2>
            {trajectory.split('\n').filter(Boolean).map((p, i) => (
              <p key={i} className="pp-narrative">{p}</p>
            ))}
          </section>
        )}

        <PredictionsSection predictions={predictions} />
        <WatchItemsSection watchItems={watchItems} />

        <section className="pp-section pp-disclosure">
          <div className="pp-disclosure-inner">
            {generatedAt && (
              <p>Analysis generated {formatDate(generatedAt)}.</p>
            )}
            {(dataQuality === 'sparse' || dataQuality === 'thin') && (
              <p className="pp-quality-warning">This analysis is based on limited source data and may be incomplete.</p>
            )}
            <p>Generated by AI from open-source intelligence. Not a substitute for professional analysis.</p>
          </div>
        </section>

        <div className="pp-share-row">
          <ShareButtons path={`/weekly/pair/${slug}`} title={pairTitle} />
        </div>
      </div>
    </div>
  );
}
