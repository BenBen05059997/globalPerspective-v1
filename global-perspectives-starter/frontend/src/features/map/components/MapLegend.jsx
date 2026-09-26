// MapLegend — the "Key" panel (L2: collapsed by default, toggled by the Key button). R4a: it now
// describes exactly the approved token channels the globe and radar draw (lib/legend.js,
// Legend.dc.html) and nothing else — shape = kind, hue = crisis type, size + double ring = HIGH,
// brightness = freshness, ▲●◆▼ badges, motion budget, GDACS level as text. Items with nothing on
// the map right now are dimmed with "none now" rather than hidden, so the key never changes shape.
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import { TIER_LABEL } from '@/features/map/lib/situationLabels.js';
import { tierSize, TIERS, STATUS_GLYPHS, markerHex } from '@/features/map/lib/legend.js';

const AXES = ['conflict', 'political', 'economic', 'humanitarian'];
const AXIS_LABEL = { conflict: 'Conflict', political: 'Political', economic: 'Economic', humanitarian: 'Humanitarian' };
const SW = 22; // swatch box (px)
const C = SW / 2;
const GREY = '#b9c7d1';

function Swatch({ children, w = SW }) {
  return <svg className="lg-sw" width={w} height={SW} viewBox={`0 0 ${w} ${SW}`} aria-hidden="true">{children}</svg>;
}

export function DiamondMark({ color = AXIS_HUE.humanitarian, k = 6 }) {
  return <Swatch><path d={`M${C} ${C - k}L${C + k} ${C}L${C} ${C + k}L${C - k} ${C}Z`} fill={color} stroke="#04070c" strokeWidth="1" /></Swatch>;
}
export function SoftDotMark({ color = AXIS_HUE.political }) {
  return (
    <Swatch>
      <circle cx={C} cy={C} r="10" fill={color} fillOpacity="0.16" />
      <circle cx={C} cy={C} r="6.5" fill={color} fillOpacity="0.3" />
      <circle cx={C} cy={C} r="3" fill={color} />
    </Swatch>
  );
}
function WashMark({ color = AXIS_HUE.political }) {
  return <Swatch><path d="M3 7L9 3L17 4L20 11L16 19L7 19L3 13Z" fill={color} fillOpacity="0.22" stroke={color} strokeOpacity="0.5" /></Swatch>;
}
function BracketsMark() {
  return (
    <Swatch>
      <path d="M2 7V2H7M15 2H20V7M20 15V20H15M7 20H2V15" fill="none" stroke="#eef5f9" strokeWidth="1.6" />
      <circle cx={C} cy={C} r="3.5" fill={AXIS_HUE.conflict} />
    </Swatch>
  );
}
function TierMark({ tier }) {
  const { r, ringR } = tierSize(tier);
  // Scaled to fit the swatch while keeping the real steps' proportions.
  const k = 0.62;
  return (
    <Swatch>
      <circle cx={C} cy={C} r={r * k} fill={GREY} />
      {ringR ? <circle cx={C} cy={C} r={ringR * k} fill="none" stroke={GREY} strokeWidth="1.3" /> : null}
    </Swatch>
  );
}
function FreshMark({ state }) {
  const base = AXIS_HUE.political;
  if (state === 'hidden') return <Swatch><circle cx={C} cy={C} r="5" fill="none" stroke="#7d8b96" strokeDasharray="2 2" /></Swatch>;
  return (
    <Swatch>
      {state === 'live' ? <circle cx={C} cy={C} r="9.5" fill={base} fillOpacity="0.28" /> : null}
      <circle cx={C} cy={C} r="5" fill={markerHex(base, state)} opacity={state === 'older' ? 0.85 : 1} />
    </Swatch>
  );
}

function Item({ on = true, mark, children, note }) {
  return (
    <span className={`sh-leg${on ? '' : ' sh-leg-off'}`}>
      {mark}{children}{note ? <i>{note}</i> : null}
    </span>
  );
}

/**
 * present: { kinds:Set('alert'|'situation'|'story'), tiers:Set, glyphs:Set(key), fresh:Set(state),
 *            axes:Set, neutral:boolean }
 */
export default function MapLegend({ id = 'sh-legend-panel', present, hiddenCount = 0, storiesOlderLabel = null, onClose }) {
  const has = (set, k) => !!set && set.has(k);
  return (
    <div id={id} className="sh-legend sh-legend-open" role="region" aria-label="How to read the map">
      <button className="sh-legend-close" onClick={onClose} aria-label="Close">×</button>
      <div className="sh-legrow">
        <b>Shape = what it is</b>
        <Item on={has(present?.kinds, 'alert')} mark={<DiamondMark />}>Official disaster alert (GDACS)</Item>
        <Item on={has(present?.kinds, 'situation')} mark={<SoftDotMark />}>News situation · approximate place</Item>
        <Item on={has(present?.kinds, 'story')} mark={<WashMark />} note={storiesOlderLabel || undefined}>Shaded country · story with no exact place</Item>
        <Item mark={<BracketsMark />}>Selected</Item>
      </div>
      <div className="sh-legrow">
        <b>Colour = crisis type</b>
        {AXES.map((a) => (
          <Item key={a} on={has(present?.axes, a)} mark={<span className="sh-leg-dot" style={{ background: AXIS_HUE[a] }} />}>{AXIS_LABEL[a]}</Item>
        ))}
        {present?.neutral ? <Item mark={<span className="sh-leg-dot" style={{ background: '#9aa4b2' }} />}>Other topic</Item> : null}
      </div>
      <div className="sh-legrow">
        <b>Size = severity</b>
        {TIERS.map((t) => (
          <Item key={t} on={has(present?.tiers, t)} mark={<TierMark tier={t} />} note={t === 'high' ? 'double ring' : undefined}>
            {TIER_LABEL[t]}
          </Item>
        ))}
      </div>
      <div className="sh-legrow">
        <b>Brightness = freshness</b>
        <Item on={has(present?.fresh, 'live')} mark={<FreshMark state="live" />}>Under 24h · glows</Item>
        <Item on={has(present?.fresh, 'plain')} mark={<FreshMark state="plain" />}>1–7 days</Item>
        <Item on={has(present?.fresh, 'older')} mark={<FreshMark state="older" />}>7–30 days · faded, “older”</Item>
        <Item on={hiddenCount > 0} mark={<FreshMark state="hidden" />} note={hiddenCount ? `${hiddenCount} hidden` : undefined}>30+ days · not drawn</Item>
      </div>
      <div className="sh-legrow">
        <b>Badge = direction</b>
        {['escalating', 'new', 'steady', 'cooling'].map((k) => (
          <Item key={k} on={has(present?.glyphs, k)} mark={<span className="lg-glyph" aria-hidden="true">{STATUS_GLYPHS[k].glyph}</span>}>
            {STATUS_GLYPHS[k].label}
          </Item>
        ))}
      </div>
      <div className="sh-legrow">
        <b>Motion</b>
        <span className="sh-leg"><i>a soft pulse marks items new or escalating in the last 24h (at most 8) · the radar sweep · reduced motion keeps everything still</i></span>
      </div>
      <div className="sh-legrow">
        <b>Alert level</b>
        <span className="sh-leg"><i>GDACS alerts carry their own level as text (e.g. “ORANGE ALERT”); colour still means crisis type</i></span>
      </div>
    </div>
  );
}
