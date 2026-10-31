import { useMemo, useRef, useState } from 'react';
import { stringTexture, pairKey } from '@/shared/lib/board.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import { dayMonth } from '@/shared/lib/branchWording.js';
import TierChip from '@/shared/ui/TierChip.jsx';
import { layoutPins, ghostPosition, KIND_WORD } from '@/features/board/lib/boardOps.js';
import { pinTypeLine, pinCountParts, stringLabel } from '@/features/board/lib/graphText.js';

// The graph view: pins and strings in plain SVG. Pin positions come from layoutPins (an ellipse; pins joined by a
// string sit next to each other), so they stay put between renders. Strings are drawn by stringTexture: dashed
// (ours, inferred), dashed-alt (yours), cut (faint), solid (ours with a strength); thickness follows the strength.
// Drag a pin onto another to test the pair; or select two pins (click / Enter) and use Connect (or press "c").
// Optional parts, each drawn only when the board holds the data: `ghosts` (suggested pins: actors on two or more of
// your pins that you do not follow), `failed` (tests that found no link) and `coverageGap` (a day with no archive).
const W = 1080;
const H = 660;
const PIN_W = 190;
const PIN_H = 120;
const GHOST_W = 150;
const GHOST_H = 72;
const LABEL_W = 190;
const LABEL_H = 52;
const DRAG_PX = 6;

function StringLabel({ x, y, head, body, ghost = false }) {
  return (
    <foreignObject x={x - LABEL_W / 2} y={y - LABEL_H / 2} width={LABEL_W} height={LABEL_H} className="board-label-box" aria-hidden="true">
      <div className={`board-label${ghost ? ' board-label--ghost' : ''}`}>
        <span className="board-label__head">{head}</span>
        {body ? <span className="board-label__body">{body}</span> : null}
      </div>
    </foreignObject>
  );
}

function Legend() {
  const key = (cls, label) => <span><svg width="26" height="8" aria-hidden="true"><line className={`board-key ${cls}`} x1="0" y1="4" x2="26" y2="4" /></svg> {label}</span>;
  return (
    <div className="board-legend" aria-label="How strings are drawn">
      {key('board-key--strong', 'strong')}
      {key('board-key--medium', 'medium')}
      {key('board-key--weak', 'weak')}
      {key('board-key--dashed', 'inferred')}
      {key('board-key--dashed-alt', 'yours')}
      {key('board-key--cut', 'cut, or no link')}
    </div>
  );
}

export default function BoardGraph({ pins, strings, info, selected, pickedKey, onSelectPin, onPickString, onConnect, ghosts = [], failed = [], onAddGhost, coverageGap = null }) {
  const svgRef = useRef(null);
  const suppressClick = useRef(false);
  const [drag, setDragState] = useState(null);
  const dragRef = useRef(null); // the handlers read the ref: a fast press-move-release can arrive before a re-render
  const setDrag = (d) => { dragRef.current = d; setDragState(d); };
  const pos = useMemo(() => layoutPins(pins, W, H, strings), [pins, strings]);
  const ghostAt = useMemo(() => Object.fromEntries(ghosts.map((g) => [g.name, ghostPosition(g.pins.map((id) => pos[id]).filter(Boolean), Object.values(pos), W, H)])), [ghosts, pos]);
  const now = useMemo(() => new Date(), []);

  const toSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / (r.width || W), y: ((e.clientY - r.top) * H) / (r.height || H) };
  };

  const onPinDown = (e, pinId) => {
    if (e.button > 0 || e.pointerType === 'touch') return; // touch pans the graph and page; connect by selecting two pins + Connect
    setDrag({ from: pinId, ...toSvg(e), sx: e.clientX, sy: e.clientY, moved: false });
  };
  const onMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > DRAG_PX;
    // Capture only once it is a drag: capturing on press would send the click to the svg, not the pin.
    if (moved && !drag.moved) svgRef.current?.setPointerCapture?.(e.pointerId);
    setDrag({ ...drag, ...toSvg(e), moved });
  };
  const onUp = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setDrag(null);
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d.moved) return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0); // the click after a drag may land elsewhere
    const el = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(e.clientX, e.clientY) : null;
    const target = el?.closest?.('[data-pin-id]')?.getAttribute('data-pin-id');
    if (target && target !== d.from) onConnect(d.from, target);
  };
  const onPinClick = (pinId) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    onSelectPin(pinId);
  };

  if (!pins.length) {
    return <p className="board-empty">No pins yet. Add a story, a country or an actor to start the board.</p>;
  }

  return (
    <div className="board-graph" data-testid="board-graph">
      <div className="board-stage">
        <Legend />
        {coverageGap ? (
          <div className="board-fog" data-testid="board-fog">
            <span className="board-fog__head">No coverage {dayMonth(coverageGap.date)}</span>
            {coverageGap.note ? <span className="board-fog__note">{coverageGap.note}</span> : null}
          </div>
        ) : null}
        <svg
          ref={svgRef}
          className="board-svg"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="group"
          aria-label="Board graph"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag(null)}
        >
          {strings.map((s) => {
            const p = pos[s.a];
            const q = pos[s.b];
            if (!p || !q) return null;
            const texture = stringTexture(s);
            const key = pairKey(s.a, s.b);
            const { head, body } = stringLabel(s);
            return (
              <g key={key} className={`board-string board-string--${texture}${pickedKey === key ? ' is-picked' : ''}`} data-texture={texture} data-owner={s.owner} data-strength={s.strength}>
                <line className="board-string__line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
                <line className="board-string__hit" x1={p.x} y1={p.y} x2={q.x} y2={q.y} onClick={() => onPickString(s)} />
                <StringLabel x={(p.x + q.x) / 2} y={(p.y + q.y) / 2} head={head} body={body} />
              </g>
            );
          })}
          {failed.map((f) => {
            const p = pos[f.a];
            const q = pos[f.b];
            if (!p || !q) return null;
            return (
              <g key={`failed-${pairKey(f.a, f.b)}`} className="board-string board-string--cut" data-texture="cut" data-failed="true">
                <line className="board-string__line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
                <StringLabel x={(p.x + q.x) / 2} y={(p.y + q.y) / 2} head="Combination failed" body={f.text} ghost />
              </g>
            );
          })}
          {ghosts.map((g) => {
            const at = ghostAt[g.name];
            return (
              <g key={`ghost-${g.name}`} className="board-string board-string--ghost" data-texture="ghost">
                {g.pins.map((id) => (pos[id] ? <line key={id} className="board-string__line" x1={at.x} y1={at.y} x2={pos[id].x} y2={pos[id].y} /> : null))}
                <StringLabel x={(at.x + (pos[g.pins[0]]?.x ?? at.x)) / 2} y={(at.y + (pos[g.pins[0]]?.y ?? at.y)) / 2} head="Suggested · Not followed" body={`${g.pins.length} of your pins touch this`} ghost />
              </g>
            );
          })}
          {drag?.moved ? <line className="board-drag" x1={pos[drag.from].x} y1={pos[drag.from].y} x2={drag.x} y2={drag.y} /> : null}
          {ghosts.map((g) => {
            const at = ghostAt[g.name];
            return (
              <foreignObject key={`ghost-pin-${g.name}`} x={at.x - GHOST_W / 2} y={at.y - GHOST_H / 2} width={GHOST_W} height={GHOST_H}>
                <button type="button" className="board-pin board-pin--ghost" aria-label={`Suggested pin: ${g.name}, not followed. Add pin`} onClick={() => onAddGhost?.(g.name)}>
                  <span className="board-pin__kind">Suggested pin</span>
                  <span className="board-pin__title">{g.name}</span>
                  <span className="board-pin__was">not followed</span>
                </button>
              </foreignObject>
            );
          })}
          {pins.map((pin) => {
            const at = pos[pin.pinId];
            const i = info[pin.pinId] || { label: pin.refId, risk: null };
            const on = selected.includes(pin.pinId);
            const tier = i.risk != null ? tierFromScore(i.risk) : null;
            const type = pinTypeLine(pin, i, now);
            const counts = pinCountParts(pin);
            return (
              <foreignObject key={pin.pinId} x={at.x - PIN_W / 2} y={at.y - PIN_H / 2} width={PIN_W} height={PIN_H}>
                <div
                  className={`board-pin${on ? ' is-selected' : ''}`}
                  data-pin-id={pin.pinId}
                  data-kind={pin.kind}
                  data-tier={tier || undefined}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`${KIND_WORD[pin.kind]}: ${i.label}${i.risk != null ? `, risk ${Math.round(i.risk)}` : ''}`}
                  onPointerDown={(e) => onPinDown(e, pin.pinId)}
                  onClick={() => onPinClick(pin.pinId)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPin(pin.pinId); } }}
                >
                  <span className="board-pin__kind"><span className="board-pin__dot" style={type.dot ? { '--pin-hue': type.dot } : undefined} aria-hidden="true" />{type.text}</span>
                  <span className="board-pin__title">{i.label}</span>
                  {pin.recordAvailable && pin.line ? <span className="board-pin__line">{pin.line}</span> : null}
                  {counts.length ? <span className="board-pin__counts">{counts.join(' · ')}</span> : null}
                  {i.risk != null ? (
                    <span className="board-pin__risk">
                      <TierChip tier={tier} score={i.risk} />
                      {i.riskWas != null ? <span className="board-pin__was">was {Math.round(i.riskWas)}</span> : null}
                    </span>
                  ) : null}
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
