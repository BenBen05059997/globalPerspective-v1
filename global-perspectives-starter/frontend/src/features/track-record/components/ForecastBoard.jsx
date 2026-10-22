import { useEffect, useMemo, useState } from 'react';
import RadarMap from '@/shared/map/RadarMap.jsx';
import Card from '@/shared/ui/Card.jsx';
import Tabs from '@/shared/ui/Tabs.jsx';
import { forecastPlaceCounts } from '@/features/track-record/lib/forecastPlaces.js';
import ForecastLinks from '@/features/track-record/components/ForecastLinks.jsx';
import { forecastAnchorId } from '@/shared/lib/links.js';
import { itemState, stateMeta, VOID_REASON_LABEL } from '@/shared/lib/questionStates.js';
import { fmtDay } from '@/shared/lib/trFormatDate.js';
import '@/features/track-record/components/ForecastBoard.css';

// ForecastBoard — the E2 "Forecast board: MAP (default) | BOARD" (TRACK_RECORD_AND_STUDIO_
// RULING.md). Reuses the console's own RadarMap (2D fallback, no WebGL needed for a small
// analytics widget) with the same `shading` contract StoryMode uses: a country wash + a count
// badge, never a made-up pin, never a per-country accuracy score (too few resolved per place —
// the ruling is explicit: "revisit only at >=30 per country"). Clicking a place opens the right
// panel listing its actual resolved questions with their source.
// One neutral hue for every place (monitor, S6): colouring a country by "more happened than
// didn't" reads as a per-country score, which the ruling rules out. The count badge carries it.
// Stable empty arrays: RadarMap's draw effect depends on `countryRisk`, so an inline `[]` is a new
// reference every render and the effect re-ran forever ("Maximum update depth exceeded").
const NO_SITUATIONS = [];
const NO_COUNTRY_RISK = [];
const PLACE_HUE = 'var(--accent)';
const VIEWS = [{ key: 'map', label: 'MAP' }, { key: 'board', label: 'BOARD' }];

// One question: text, frozen %, named source, state, verdict evidence, then its story and countries.
// Used by the panel and the tiles.
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
      {st === 'void' && item.voidReason && <span className="tr-fb-meta">Could not be checked{VOID_REASON_LABEL[item.voidReason] ? ` · ${VOID_REASON_LABEL[item.voidReason]}` : ''}.</span>}
      {quote && <span className="tr-fb-quote">&ldquo;{quote}&rdquo;</span>}
      {url && /^https?:\/\//.test(url) && <a href={url} target="_blank" rel="noreferrer" className="tr-fb-cite">source →</a>}
      <ForecastLinks item={item} className="tr-fb-links" />
    </>
  );
}

// `focusQid` (from /track-record?q=<qid>, built by forecastHref): when that question is on the board, the
// BOARD view opens, scrolls to its tile (DOM id forecastAnchorId(qid)) and highlights it.
export default function ForecastBoard({ items = [], emptyText = null, focusQid = null }) {
  const focusOnBoard = Boolean(focusQid) && items.some((it) => it.qid === focusQid);
  const [view, setView] = useState(focusOnBoard ? 'board' : 'map');
  const [selectedIso3, setSelectedIso3] = useState(null);

  useEffect(() => {
    if (!focusOnBoard || view !== 'board') return;
    document.getElementById(forecastAnchorId(focusQid))?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [focusOnBoard, focusQid, view]);

  const places = useMemo(() => forecastPlaceCounts(items), [items]);
  const shading = useMemo(
    () => places.map((p) => ({ iso3: p.iso3, count: p.all, hue: PLACE_HUE, top: { title: p.name } })),
    [places],
  );
  const selected = places.find((p) => p.iso3 === selectedIso3) || null;

  return (
    <div className="tr-fb">
      <Tabs variant="segmented" idBase="tr-fb" label="Forecast board view" tabs={VIEWS} active={view} onChange={setView} />
      {items.length === 0 && emptyText && <p className="tr-fb-panel-hint">{emptyText}</p>}

      {view === 'map' ? (
        <div className="tr-fb-mapgrid">
          <div className="tr-fb-map">
            <RadarMap
              situations={NO_SITUATIONS} focusId={null} newIds={null} height={340}
              onSelect={() => {}} onScan={() => {}}
              shading={shading} storyFocusIso3={selectedIso3}
              onSelectCountry={(iso3) => setSelectedIso3((cur) => (cur === iso3 ? null : iso3))}
              countryRisk={NO_COUNTRY_RISK}
            />
          </div>
          <Card pad="sm" className="tr-fb-panel">
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
          </Card>
        </div>
      ) : (
        <ul className="tr-fb-boardlist">
          {items.length === 0 && <li className="tr-fb-panel-hint">Nothing to show yet.</li>}
          {items.map((it, i) => (
            <Card
              as="li" pad="sm" key={it.qid || i}
              id={it.qid ? forecastAnchorId(it.qid) : undefined}
              selected={Boolean(it.qid) && it.qid === focusQid}
            >
              <QuestionDetail item={it} />
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
