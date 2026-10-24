import { useMemo, useRef, useState } from 'react';
import { stringTexture, pairKey } from '@/shared/lib/board.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import TierChip from '@/shared/ui/TierChip.jsx';
import { layoutPins, KIND_WORD } from '@/features/board/lib/boardOps.js';

// The graph view: pins and strings in plain SVG. Pin positions come from layoutPins (a circle ordered by kind
// then id), so they stay put between renders. Strings are drawn by stringTexture: dashed (ours, inferred),
// dashed-alt (yours), cut (faint), solid (ours, confirmed: not in slice 1). Drag a pin onto another to test the
// pair; or select two pins (click / Enter) and use Connect (or press "c").
const W = 900;
const H = 620;
const PIN_W = 164;
const PIN_H = 92;
const DRAG_PX = 6;
const TAG = { dashed: 'inferred', 'dashed-alt': 'yours', cut: 'cut', solid: '' };

export default function BoardGraph({ pins, strings, info, selected, pickedKey, onSelectPin, onPickString, onConnect }) {
  const svgRef = useRef(null);
  const suppressClick = useRef(false);
  const [drag, setDragState] = useState(null);
  const dragRef = useRef(null); // the handlers read the ref: a fast press-move-release can arrive before a re-render
  const setDrag = (d) => { dragRef.current = d; setDragState(d); };
  const pos = useMemo(() => layoutPins(pins, W, H), [pins]);

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
          return (
            <g key={key} className={`board-string board-string--${texture}${pickedKey === key ? ' is-picked' : ''}`} data-texture={texture} data-owner={s.owner}>
              <line className="board-string__line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
              <line className="board-string__hit" x1={p.x} y1={p.y} x2={q.x} y2={q.y} onClick={() => onPickString(s)} />
              {TAG[texture] ? <text className="board-string__tag" x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 6} textAnchor="middle">{TAG[texture]}</text> : null}
            </g>
          );
        })}
        {drag?.moved ? <line className="board-drag" x1={pos[drag.from].x} y1={pos[drag.from].y} x2={drag.x} y2={drag.y} /> : null}
        {pins.map((pin) => {
          const at = pos[pin.pinId];
          const i = info[pin.pinId] || { label: pin.refId, risk: null };
          const on = selected.includes(pin.pinId);
          return (
            <foreignObject key={pin.pinId} x={at.x - PIN_W / 2} y={at.y - PIN_H / 2} width={PIN_W} height={PIN_H}>
              <div
                className={`board-pin${on ? ' is-selected' : ''}`}
                data-pin-id={pin.pinId}
                data-kind={pin.kind}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${KIND_WORD[pin.kind]}: ${i.label}${i.risk != null ? `, risk ${Math.round(i.risk)}` : ''}`}
                onPointerDown={(e) => onPinDown(e, pin.pinId)}
                onClick={() => onPinClick(pin.pinId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPin(pin.pinId); } }}
              >
                <span className="board-pin__kind"><span className="board-pin__dot" aria-hidden="true" />{KIND_WORD[pin.kind]}</span>
                <span className="board-pin__title">{i.label}</span>
                {i.risk != null ? <TierChip tier={tierFromScore(i.risk)} score={i.risk} /> : null}
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
