import { useMemo, useState } from 'react';
import RadarMap from '@/features/map/components/RadarMap.jsx';
import { forecastPlaceCounts } from '@/features/track-record/lib/forecastPlaces.js';
import '@/features/track-record/components/ForecastBoard.css';

// ForecastBoard — the E2 "Forecast board: MAP (default) | BOARD" (TRACK_RECORD_AND_STUDIO_
// RULING.md). Reuses the console's own RadarMap (2D fallback, no WebGL needed for a small
// analytics widget) with the same `shading` contract StoryMode uses: a country wash + a count
// badge, never a made-up pin, never a per-country accuracy score (too few resolved per place —
// the ruling is explicit: "revisit only at >=30 per country"). Clicking a place opens the right
// panel listing its actual resolved questions with their source.
// One neutral hue for every place (monitor, S6): colouring a country by "more happened than
// didn't" reads as a per-country score, which the ruling rules out. The count badge carries it.
function hueFor() {
  return 'var(--c-accent, #5fd4ff)';
}

export default function ForecastBoard({ items = [] }) {
  const [view, setView] = useState('map');
  const [selectedIso3, setSelectedIso3] = useState(null);

  const places = useMemo(() => forecastPlaceCounts(items), [items]);
  const shading = useMemo(
    () => places.map((p) => ({ iso3: p.iso3, count: p.total, hue: hueFor(p), top: { title: p.name } })),
    [places],
  );
  const selected = places.find((p) => p.iso3 === selectedIso3) || null;

  return (
    <div className="tr-fb">
      <div className="tr-fb-toggle" role="tablist" aria-label="Forecast board view">
        <button
          type="button" role="tab" aria-selected={view === 'map'}
          className={`tr-fb-tab${view === 'map' ? ' on' : ''}`} onClick={() => setView('map')}
        >MAP</button>
        <button
          type="button" role="tab" aria-selected={view === 'board'}
          className={`tr-fb-tab${view === 'board' ? ' on' : ''}`} onClick={() => setView('board')}
        >BOARD</button>
      </div>

      {view === 'map' ? (
        <div className="tr-fb-mapgrid">
          <div className="tr-fb-map">
            <RadarMap
              situations={[]} focusId={null} callout={null} newIds={null} height={340}
              onSelect={() => {}} onOpenCallout={() => {}} onScan={() => {}}
              shading={shading} storyFocusIso3={selectedIso3}
              onSelectCountry={(iso3) => setSelectedIso3((cur) => (cur === iso3 ? null : iso3))}
              countryRisk={[]}
            />
          </div>
          <div className="tr-fb-panel">
            {selected ? (
              <>
                <h4 className="tr-fb-panel-title">{selected.name}</h4>
                <p className="tr-fb-panel-counts">
                  <span className="tr-fb-tag fired">{selected.fired} happened</span>
                  <span className="tr-fb-tag notfired">{selected.notFired} didn&apos;t</span>
                </p>
                <ul className="tr-fb-panel-list">
                  {selected.items.map((it, i) => (
                    <li key={i} className="tr-fb-panel-item">
                      <span className={`tr-fb-verdict ${it.verdict}`}>{it.verdict === 'fired' ? '✓' : '✗'}</span>
                      <span className="tr-fb-panel-trigger">{it.trigger}</span>
                      {it.citation && (
                        <a href={it.citation} target="_blank" rel="noreferrer" className="tr-fb-cite">source →</a>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : places.length ? (
              <p className="tr-fb-panel-hint">Click a shaded place to see its questions.</p>
            ) : (
              <p className="tr-fb-panel-hint">No resolved forecast names a country we can plot.</p>
            )}
          </div>
        </div>
      ) : (
        <ul className="tr-fb-boardlist">
          {items.length === 0 && <li className="tr-fb-panel-hint">Nothing resolved yet.</li>}
          {items.map((it, i) => (
            <li key={i} className="tr-fb-tile">
              <span className={`tr-fb-verdict ${it.verdict}`}>{it.verdict === 'fired' ? '✓ Happened' : '✗ Didn’t happen'}</span>
              <p className="tr-fb-tile-trigger">{it.trigger}</p>
              <p className="tr-fb-tile-meta">
                {it.title}
                {it.deadline ? ` · due ${it.deadline}` : ''}
              </p>
              {it.citation && <a href={it.citation} target="_blank" rel="noreferrer" className="tr-fb-cite">source →</a>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
