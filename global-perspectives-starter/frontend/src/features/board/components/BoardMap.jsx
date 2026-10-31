import { useEffect, useMemo, useRef } from 'react';
import { stringTexture, pairKey } from '@/shared/lib/board.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import { crisisDotVar } from '@/shared/lib/crisisHue.js';
import { dayMonth } from '@/shared/lib/branchWording.js';
import { placeLabels, KIND_WORD } from '@/features/board/lib/boardOps.js';
import { stringLabel, mapPinLine } from '@/features/board/lib/graphText.js';
import {
  MAP_W, RING_R, mapFrame, placeOfPin, touchesOfPin, ringCentres, placeRingLabels, arcPath, arcMid,
} from '@/features/board/lib/mapPlaces.js';
import { StringLabel } from '@/features/board/components/BoardGraph.jsx';
import '@/features/board/boardMap.css';

const LABEL = { w: 190, h: 52 };
const SMALL = { w: 130, h: 24 };
const clip = (t, n = 30) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

// The map view (artboard 2): the board's pins as rings on their places and its strings as arcs between them, on a
// sketch of the world's coastlines. Ring weight is the risk tier, ring hue the crisis type (never severity); arc
// weight is the string's strength, and the arc's dash follows the graph's (dashed = ours, inferred; dotted = yours).
// A pin with no place (an actor, a story whose record names no country) is not guessed onto the map: it waits in the
// "No place" chips. Suggested pins (`ghosts`) have no place either. `coverageGap` draws the fog. The pin and string
// lists under the board are the text form of this map.
export default function BoardMap({ pins, strings, info, stories = {}, selected = [], pickedKey, ghosts = [], failed = [], coverageGap = null, onPickPin, onPickString, onAddGhost }) {
  const now = useMemo(() => new Date(), []);
  const layout = useMemo(() => {
    const geo = pins.map((p) => ({ pinId: p.pinId, at: placeOfPin(p, stories[p.refId]), touches: touchesOfPin(p, stories[p.refId]) })).filter((p) => p.at);
    const frame = mapFrame(geo.flatMap((p) => [p.at, ...p.touches.map((t) => t.at)]));
    const MAP_H = frame.h;
    const centres = ringCentres(geo.map((p) => ({ pinId: p.pinId, at: frame.project(p.at) })));
    const text = Object.fromEntries(pins.filter((p) => centres[p.pinId]).map((p) => [p.pinId, { name: clip(info[p.pinId]?.label || p.refId), line: mapPinLine(p, info[p.pinId], now) }]));
    const labels = placeRingLabels(
      Object.entries(text).map(([pinId, t]) => ({ pinId, text: t.name.length > t.line.length ? t.name : t.line })),
      centres, MAP_W, MAP_H,
    );
    const ends = (a, b) => {
      if (!centres[a] || !centres[b]) return null;
      const m = arcMid(centres[a], centres[b]);
      const dx = m.x - (centres[a].x + centres[b].x) / 2;
      const dy = m.y - (centres[a].y + centres[b].y) / 2;
      return { a: { x: centres[a].x + dx, y: centres[a].y + dy }, b: { x: centres[b].x + dx, y: centres[b].y + dy } };
    };
    const shown = [...strings.map((s) => ({ id: `s:${pairKey(s.a, s.b)}`, ...ends(s.a, s.b) })), ...failed.map((f) => ({ id: `f:${pairKey(f.a, f.b)}`, ...ends(f.a, f.b) }))].filter((it) => it.a);
    const obstacles = [
      ...Object.values(centres).map((c) => ({ x: c.x, y: c.y, w: RING_R * 2 + 4, h: RING_R * 2 + 4 })),
      ...Object.values(labels),
    ];
    const touches = Object.fromEntries(geo.map((p) => [p.pinId, p.touches.map((t) => { const q = frame.project(t.at); return q && { ...t, x: q[0], y: q[1] }; }).filter(Boolean)]));
    return { frame, centres, text, labels, touches, strings: placeLabels(shown, obstacles, MAP_W, MAP_H, LABEL, SMALL, { dropBlocked: true }) };
  }, [pins, strings, failed, info, stories, now]);

  // when the map is wider than its box (a phone), open it scrolled to the middle of the pins, not to the Americas
  const box = useRef(null);
  const placedXs = Object.values(layout.centres).map((c) => c.x);
  const midX = placedXs.length ? (Math.min(...placedXs) + Math.max(...placedXs)) / 2 : null;
  useEffect(() => {
    const el = box.current;
    if (!el || midX == null || el.scrollWidth <= el.clientWidth) return;
    const scale = (el.querySelector('svg')?.getBoundingClientRect().width || MAP_W) / MAP_W;
    el.scrollLeft = Math.max(0, midX * scale - el.clientWidth / 2);
  }, [midX]);

  if (!pins.length) return <p className="board-empty">No pins yet. Add a story, a country or an actor to start the board.</p>;

  const unplaced = pins.filter((p) => !layout.centres[p.pinId]);
  const arc = (a, b) => (layout.centres[a] && layout.centres[b] ? arcPath(layout.centres[a], layout.centres[b]) : null);

  return (
    <div ref={box} className="board-graph bm" data-testid="board-map">
      <div className="board-stage bm-stage">
        {coverageGap ? (
          <div className="board-fog" data-testid="board-fog">
            <span className="board-fog__head">No coverage {dayMonth(coverageGap.date)}</span>
            {coverageGap.note ? <span className="board-fog__note">{coverageGap.note}</span> : null}
          </div>
        ) : null}
        <svg className="board-svg bm-svg" viewBox={`0 0 ${MAP_W} ${layout.frame.h}`} width={MAP_W} height={layout.frame.h} role="group" aria-label="Board map. The pin and string lists below give the same board as text.">
          <path className="bm-land" d={layout.frame.worldPath} />
          {layout.frame.regions.map((r) => <text key={r.name} className="bm-region" x={r.x} y={r.y} aria-hidden="true">{r.name}</text>)}
          {/* every other country a story touches: a small mark tied to its ring (a place involved is a place affected) */}
          {Object.entries(layout.touches).flatMap(([pinId, ts]) => ts.map((t) => (
            <g key={`t-${pinId}-${t.iso3}`} className="bm-touch" data-pin-id={pinId}>
              <title>{`${info[pinId]?.label || pinId} also touches ${t.name}`}</title>
              <line className="bm-touch__tie" x1={layout.centres[pinId].x} y1={layout.centres[pinId].y} x2={t.x} y2={t.y} />
              <circle className="bm-touch__dot" cx={t.x} cy={t.y} r={RING_R / 3} />
            </g>
          )))}
          {strings.map((s) => {
            const d = arc(s.a, s.b);
            if (!d) return null;
            const key = pairKey(s.a, s.b);
            const { head, body } = stringLabel(s);
            return (
              <g key={key} className={`board-string board-string--${stringTexture(s)}${pickedKey === key ? ' is-picked' : ''}`} data-owner={s.owner} data-strength={s.strength}>
                <title>{[head, body].filter(Boolean).join('. ')}</title>
                <path className="board-string__line" d={d} />
                <path className="board-string__hit" d={d} onClick={() => onPickString(s)} />
              </g>
            );
          })}
          {failed.map((f) => {
            const d = arc(f.a, f.b);
            return d ? <g key={`failed-${pairKey(f.a, f.b)}`} className="board-string board-string--cut" data-failed="true"><path className="board-string__line" d={d} /></g> : null;
          })}
          {strings.map((s) => {
            const at = layout.strings[`s:${pairKey(s.a, s.b)}`];
            const { head, body } = stringLabel(s);
            return at ? <StringLabel key={`l-${pairKey(s.a, s.b)}`} at={at} head={head} body={body} /> : null;
          })}
          {failed.map((f) => {
            const at = layout.strings[`f:${pairKey(f.a, f.b)}`];
            return at ? <StringLabel key={`lf-${pairKey(f.a, f.b)}`} at={at} head="No link found" body={f.text} ghost /> : null;
          })}
          {pins.filter((p) => layout.centres[p.pinId]).map((p) => {
            const c = layout.centres[p.pinId];
            const lab = layout.labels[p.pinId];
            const t = layout.text[p.pinId];
            const i = info[p.pinId] || {};
            const on = selected.includes(p.pinId);
            const left = lab.side === 'left';
            return (
              <g
                key={p.pinId}
                className={`bm-pin${on ? ' is-selected' : ''}`}
                data-pin-id={p.pinId}
                data-kind={p.kind}
                data-tier={i.risk != null ? tierFromScore(i.risk) : undefined}
                style={p.kind === 'thread' && crisisDotVar(i.category) ? { '--pin-hue': crisisDotVar(i.category) } : undefined}
                role="button"
                tabIndex={0}
                aria-label={`${KIND_WORD[p.kind]}: ${i.label || p.refId}${i.risk != null ? `, risk ${Math.round(i.risk)}` : ''}`}
                onClick={() => onPickPin(p.pinId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickPin(p.pinId); } }}
              >
                <title>{i.label || p.refId}</title>
                <line className="bm-pin__leader" x1={c.x} y1={c.y} x2={left ? lab.x + lab.w / 2 : lab.x - lab.w / 2} y2={lab.y} />
                <circle className="bm-pin__ring" cx={c.x} cy={c.y} r={RING_R} />
                <text className="bm-pin__name" x={left ? lab.x + lab.w / 2 : lab.x - lab.w / 2} y={lab.y - 2} textAnchor={left ? 'end' : 'start'}>{t.name}</text>
                {t.line ? <text className="bm-pin__line" x={left ? lab.x + lab.w / 2 : lab.x - lab.w / 2} y={lab.y + 11} textAnchor={left ? 'end' : 'start'}>{t.line}</text> : null}
              </g>
            );
          })}
        </svg>
        <p className="bm-note">Sketch map. Rings = pins, arcs = strings, weight = strength. Dashed arc = ours, inferred; dotted arc = yours.</p>
        {ghosts.length || unplaced.length ? (
          <ul className="bm-chips" aria-label="Pins with no place">
            {ghosts.map((g) => (
              <li key={`ghost-${g.name}`}>
                <button type="button" className="bm-chip bm-chip--ghost" aria-label={`Suggested pin: ${g.name}, not followed. Add pin`} onClick={() => onAddGhost?.(g.name)}>
                  <span className="bm-chip__head">Suggested pin · No place</span>
                  <span className="bm-chip__name">{g.name}</span>
                  <span className="bm-chip__tail">not followed</span>
                </button>
              </li>
            ))}
            {unplaced.map((p) => (
              <li key={p.pinId}>
                <button type="button" className="bm-chip" onClick={() => onPickPin(p.pinId)}>
                  <span className="bm-chip__head">No place</span>
                  <span className="bm-chip__name">{info[p.pinId]?.label || p.refId}</span>
                  <span className="bm-chip__tail">{KIND_WORD[p.kind].toLowerCase()}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
