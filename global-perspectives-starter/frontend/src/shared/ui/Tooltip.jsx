import '@/shared/ui/primitives.css';

// Tooltip — the one hover/focus preview card (StoryPeek is this card fed from peekData()). Nothing
// inside is clickable: the card is role="tooltip" and the trigger points at it with aria-describedby.
// Every line is optional except the title; a line without data is not drawn.
//   id        element id (the trigger's aria-describedby)
//   kicker    small mono line above the title (e.g. the crisis type); `dot` = its colour (a crisis hue)
//   title     the headline
//   meta      array of short facts on one line (falsy entries are dropped)
//   note      one dim line (e.g. "updated 3h ago")
//   hint      one italic line (e.g. "Click to open")
// Placement, one of:
//   style     a ready position (usePeek().style: position fixed next to a DOM trigger)
//   at        { x, y } a point inside a positioned container (a map marker's screen position);
//             with `bounds` { width, height } (the container size) the card flips / clamps to stay inside
export const TIP_WIDTH = 280;
const TIP_HEIGHT = 140;
const GAP = 12;
const MARGIN = 8;

// placeTooltip — pure: the card's { left, top } for a point, to the right of it (left when it would
// overflow), vertically centred on it, clamped inside `bounds`.
export function placeTooltip({ x, y }, { bounds, width = TIP_WIDTH, height = TIP_HEIGHT } = {}) {
  let left = x + GAP;
  let top = y - height / 2;
  if (bounds) {
    if (left + width > bounds.width - MARGIN) left = x - GAP - width;
    left = Math.max(MARGIN, Math.min(left, bounds.width - width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, bounds.height - height - MARGIN));
  }
  return { left, top };
}

export default function Tooltip({ id, kicker = null, dot = null, title, meta = [], note = null, hint = null, style, at, bounds, className = '' }) {
  const place = at ? { position: 'absolute', width: TIP_WIDTH, ...placeTooltip(at, { bounds }) } : style;
  const facts = meta.filter(Boolean);
  return (
    <div id={id} role="tooltip" className={`gp-tip ${className}`.trim()} style={place}>
      {kicker ? (
        <div className="gp-tip__kicker">
          {dot ? <span className="gp-tip__dot" style={{ background: dot }} aria-hidden="true" /> : null}
          {kicker}
        </div>
      ) : null}
      <div className="gp-tip__title">{title}</div>
      {facts.length ? <div className="gp-tip__meta">{facts.map((f, i) => <span key={i}>{f}</span>)}</div> : null}
      {note ? <div className="gp-tip__note">{note}</div> : null}
      {hint ? <div className="gp-tip__hint">{hint}</div> : null}
    </div>
  );
}
