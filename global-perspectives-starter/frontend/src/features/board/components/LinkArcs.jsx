// LinkArcs: the desktop gutter left of the board's list (SPEC §3.7). One dashed arc per judged link, from the right
// edge of the gutter at the feeding card to the fed card, with an arrowhead there; its colour is the feeding story's
// crisis hue, its strength 1-3 parallel strands. Ends at one card are spread apart, one per link. Decoration only
// (aria-hidden): the cards' rows say the same. Redrawn when the list resizes or a disclosure in it opens.
import { useEffect, useState } from 'react';
import { crisisHueForCategory } from '@/shared/lib/crisisHue.js';

export const GUTTER = 150;
const STRANDS = { weak: 1, medium: 2, strong: 3 };
const STRAND_GAP = 3.5;
const END_GAP = 14;
const TOP = 28; // the first end sits this far below the card's top, beside its top line

function measure(list, links) {
  const box = list.getBoundingClientRect();
  const at = {};
  for (const el of list.querySelectorAll('[data-story]')) {
    const r = el.getBoundingClientRect();
    at[el.dataset.story] = { top: r.top - box.top, height: r.height };
  }
  const used = {};
  const endY = (id) => {
    const n = used[id] || 0;
    used[id] = n + 1;
    return Math.min(at[id].top + TOP + n * END_GAP, at[id].top + at[id].height - 8);
  };
  return { height: box.height, arcs: links.filter((l) => at[l.from] && at[l.to]).map((l) => ({ ...l, y1: endY(l.from), y2: endY(l.to) })) };
}

export default function LinkArcs({ listRef, links, categoryOf }) {
  const [{ arcs, height }, setDrawn] = useState({ arcs: [], height: 0 });
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const draw = () => setDrawn(measure(list, links));
    draw();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
    ro?.observe(list);
    list.addEventListener('toggle', draw, true); // a "why" opening moves every card below it
    return () => { ro?.disconnect(); list.removeEventListener('toggle', draw, true); };
  }, [listRef, links]);

  const x = GUTTER - 4;
  return (
    <svg className="bl-arcs" width={GUTTER} height={height} aria-hidden="true" focusable="false">
      {arcs.map((a) => {
        const hue = crisisHueForCategory(categoryOf(a.from));
        const reach = Math.min(GUTTER - 16, 30 + Math.abs(a.y2 - a.y1) * 0.25);
        const n = STRANDS[a.strength] || 1;
        return (
          <g key={`${a.from}>${a.to}`} style={{ color: hue }}>
            {Array.from({ length: n }, (_, i) => {
              const o = (i - (n - 1) / 2) * STRAND_GAP;
              return <path key={i} className="bl-arc" d={`M ${x} ${a.y1 + o} C ${x - reach + o} ${a.y1 + o}, ${x - reach + o} ${a.y2 + o}, ${x - 6} ${a.y2 + o}`} />;
            })}
            <path className="bl-arc__head" d={`M ${x - 6} ${a.y2 - 4} L ${x} ${a.y2} L ${x - 6} ${a.y2 + 4} Z`} />
          </g>
        );
      })}
    </svg>
  );
}
