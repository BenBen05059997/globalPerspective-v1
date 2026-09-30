import { useMemo, useState } from 'react';
import RadarMap from '@/features/map/components/RadarMap.jsx';
import { forecastPlaceCounts } from '@/features/track-record/lib/forecastPlaces.js';
import { itemState, stateMeta, VOID_REASON_LABEL } from '@/features/track-record/lib/questionStates.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
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

// One question: text, frozen %, named source, state, verdict evidence. Used by the panel and the tiles.
function QuestionDetail({ item }) {
  const st = itemState(item);
  const meta = stateMeta(st);
  const text = item.question || item.trigger;
  const url = item.verdict && typeof item.verdict === 'object' ? item.verdict.url : item.citation;
  const quote = item.verdict && typeof item.verdict === 'object' ? item.verdict.quote : null;
  return (
    <>
      <span className={`tr-fb-verdict ${meta ? meta.kind : ''}`}>{meta ? `${meta.glyph} ${meta.label}` : ''}</span>
      <span className="tr-fb-panel-trigger">{text}</span>
      <span className="tr-fb-meta">
        {typeof item.p === 'number' ? <b>{item.p}% when locked</b> : null}
        {item.resolutionSource ? ` · source: ${item.resolutionSource}` : ''}
        {item.deadline ? ` · by ${fmtDay(item.deadline)}` : ''}
      </span>
      {st === 'void' && item.voidReason && <span className="tr-fb-meta">Void: {VOID_REASON_LABEL[item.voidReason] || item.voidReason}.</span>}
      {quote && <span className="tr-fb-quote">&ldquo;{quote}&rdquo;</span>}
      {url && /^https?:\/\//.test(url) && <a href={url} target="_blank" rel="noreferrer" className="tr-fb-cite">source →</a>}
    </>
  );
}

export default function ForecastBoard({ items = [], emptyText = null }) {
  const [view, setView] = useState('map');
  const [selectedIso3, setSelectedIso3] = useState(null);

  const places = useMemo(() => forecastPlaceCounts(items), [items]);
  const shading = useMemo(
    () => places.map((p) => ({ iso3: p.iso3, count: p.all, hue: hueFor(p), top: { title: p.name } })),
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
      {items.length === 0 && emptyText && <p className="tr-fb-panel-hint">{emptyText}</p>}

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
                  <span className="tr-fb-tag fired">✓ {selected.fired}</span>
                  <span className="tr-fb-tag notfired">✗ {selected.notFired}</span>
                  <span className="tr-fb-tag open">▢ {selected.awaiting + selected.pastUnchecked}</span>
                  <span className="tr-fb-tag void">◌ {selected.void}</span>
                </p>
                <ul className="tr-fb-panel-list">
                  {selected.items.map((it, i) => (
                    <li key={it.qid || i} className="tr-fb-panel-item"><QuestionDetail item={it} /></li>
                  ))}
                </ul>
              </>
            ) : places.length ? (
              <p className="tr-fb-panel-hint">Click a shaded place to see its questions. Counts only: ✓ happened · ✗ didn’t · ▢ open · ◌ void. Never an accuracy score for a country.</p>
            ) : (
              <p className="tr-fb-panel-hint">No question names a country we can plot.</p>
            )}
          </div>
        </div>
      ) : (
        <ul className="tr-fb-boardlist">
          {items.length === 0 && <li className="tr-fb-panel-hint">Nothing to show yet.</li>}
          {items.map((it, i) => (
            <li key={it.qid || i} className="tr-fb-tile">
              <QuestionDetail item={it} />
              {it.storyTitle || it.title ? <p className="tr-fb-tile-meta">{it.storyTitle || it.title}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
