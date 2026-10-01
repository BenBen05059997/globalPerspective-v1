import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import { CRISIS_LABEL } from '@/shared/lib/crisisHue.js';
import { peekData } from '@/shared/lib/peekData.js';
import { threadPath } from '@/shared/lib/threadPath';
import { useWebIndex } from '@/features/threads/hooks/useWebIndex.js';
import {
  CONF_WIDTH, LAYOUT, WEB_DEFAULT_NODES, WEB_HIDE_DAYS, WEB_LIST_DEFAULT, WEB_LIST_MAX, WEB_MAX_NODES,
  layoutWeb, mergeWebLinks, nodeLinkWords, pickWebNodes, strongestLinks, webDateLabel, webFootnote,
} from '@/features/threads/lib/storyWeb.js';

// StoriesWeb — the WEB view (/weekly?view=web, REDESIGN_MASTER_PLAN §3.4 B4): the union of every
// analysis's story links as a story graph, plus its accessible list twin "Strongest links".
//   graph: the N most-linked stories as nodes in crisis-type lanes, x = the story's peak coverage
//          day (the archive day with the most articles), node size = link degree, dashed edges
//          (thicker = stronger; the confidence WORD on hover). Hover/focus = StoryPeek; click opens.
//   twin:  "<from> ↓ judged to feed into · <confidence> · <n> analyses <to>", the mechanism text
//          labelled "model judgment", dated cited headlines. Default on phones (<900 px), where the
//          graph sits below it inside a sideways-scrolling frame.
//   footnote: computed from the data (analyses merged, newest date, how many older than 30 days hidden).
// Honesty: a link is a model judgment, never "caused"; nothing is padded (fewer links = fewer nodes).
const LABEL_CHARS = LAYOUT.labelChars;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const hueOf = (key) => (key === 'neutral' ? 'var(--text-dim)' : `var(--hue-${key})`);
const plural = (n, one, many) => (n === 1 ? one : many);

function edgePath(a, b) {
  const mx = (a.x + b.x) / 2;
  if (Math.abs(a.y - b.y) < 4) { // same row: arch over it so the line is visible
    return `M${a.x} ${a.y} C${mx} ${a.y - 34} ${mx} ${b.y - 34} ${b.x} ${b.y}`;
  }
  return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
}

function Graph({ picked, titleOf, peek }) {
  const frameRef = useRef(null);
  const [w, setW] = useState(LAYOUT.width);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const measure = () => setW(Math.round(el.clientWidth) || LAYOUT.width);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout = useMemo(() => layoutWeb(picked.nodes, w), [picked.nodes, w]);
  const [active, setActive] = useState(null);
  const [tip, setTip] = useState(null); // { edge, x, y } (pointer position inside the graph)
  const pos = useMemo(() => Object.fromEntries(layout.nodes.map((n) => [n.id, n])), [layout]);
  const { width, height } = layout;
  return (
    <div className="sw-frame" ref={frameRef} role="region" aria-label="Story graph (scrolls sideways)" tabIndex={0}>
      <div className="sw-graph" style={{ height, width }} data-testid="web-graph" onMouseLeave={() => setTip(null)}>
        <svg className="sw-edges" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {layout.lanes.map((l) => <line key={l.key} x1="0" x2={width} y1={l.top} y2={l.top} className="sw-laneline" vectorEffect="non-scaling-stroke" />)}
          {picked.edges.map((e) => {
            const a = pos[e.from]; const b = pos[e.to];
            if (!a || !b) return null;
            const on = active && (e.from === active || e.to === active);
            const d = edgePath(a, b);
            return (
              <g key={e.key} className={`sw-edge${on ? ' is-on' : ''}${active && !on ? ' is-dim' : ''}`} data-conf={e.confidence} data-edge={e.key}>
                <path d={d} className="sw-edge__line" style={{ strokeWidth: CONF_WIDTH[e.confidence] || 1.2 }} vectorEffect="non-scaling-stroke" />
                <path
                  d={d}
                  className="sw-edge__hit"
                  vectorEffect="non-scaling-stroke"
                  onMouseMove={(ev) => {
                    const r = ev.currentTarget.ownerSVGElement.getBoundingClientRect();
                    setTip({ edge: e, x: ev.clientX - r.left, y: ev.clientY - r.top });
                  }}
                  onMouseLeave={() => setTip(null)}
                />
              </g>
            );
          })}
        </svg>
        {layout.lanes.map((l) => (
          <span key={l.key} className="sw-lane" style={{ top: l.top + 8, '--lane-hue': hueOf(l.key) }}>{CRISIS_LABEL[l.key]}</span>
        ))}
        {layout.ticks.map((t) => (
          <span key={t.date} className="sw-tick" style={{ left: `${(t.x / width) * 100}%`, top: layout.axisY }}>{webDateLabel(t.date)}</span>
        ))}
        {layout.nodes.map((n) => {
          const id = `web:${n.id}`;
          const open = !!(peek && peek.openId === id);
          const title = titleOf(n.id);
          const data = peekData(
            { title, category: n.thread.category, regions: n.thread.regions, sources: n.thread.sourceCount },
            { asOf: n.thread.changedAt },
          );
          if (data) {
            const words = nodeLinkWords(n.id, picked.edges);
            data.hint = `${words ? `${words} · ` : ''}Peak coverage ${webDateLabel(n.peak)} · click to open the story`;
          }
          const left = n.x / width > 0.66;
          return (
            <span key={n.id} className="sw-nodewrap" style={{ left: `${(n.x / width) * 100}%`, top: n.y }}>
              <Link
                to={threadPath(n.id)}
                className={`sw-node${left ? ' sw-node--left' : ''}`}
                style={{ '--d': `${n.diameter}px`, '--row-hue': hueOf(n.lane) }}
                data-thread={n.id}
                data-degree={n.degree}
                aria-label={`${title}. ${n.degree} ${plural(n.degree, 'link', 'links')}. Peak coverage ${webDateLabel(n.peak)}.`}
                aria-describedby={open ? `peek-${id}` : undefined}
                onMouseEnter={(e) => { setActive(n.id); if (peek) peek.openOnHover(id, e.currentTarget); }}
                onMouseLeave={() => { setActive(null); if (peek) peek.close(); }}
                onFocus={(e) => { setActive(n.id); if (peek) peek.openOnFocus(id, e.currentTarget); }}
                onBlur={() => { setActive(null); if (peek) peek.close(); }}
              >
                <span className="sw-dot" />
                <span className="sw-label">{clip(title, LABEL_CHARS)}</span>
              </Link>
              {open && typeof document !== 'undefined' ? createPortal(<StoryPeek id={`peek-${id}`} data={data} style={peek.style} />, document.body) : null}
            </span>
          );
        })}
        {tip ? (
          <div className="sw-tip" style={{ left: tip.x + 12, top: tip.y + 12 }} role="presentation" data-testid="web-edge-tip">
            <b>{tip.edge.confidence || 'unrated'}</b> · model judgment · {tip.edge.webs.length} {plural(tip.edge.webs.length, 'analysis', 'analyses')}
            <span>{clip(titleOf(tip.edge.from), 48)} {'→'} {clip(titleOf(tip.edge.to), 48)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LinkItem({ edge, titleOf }) {
  const n = edge.webs.length;
  const cites = edge.cited.slice(0, 3);
  const more = edge.cited.length - cites.length;
  return (
    <li className="sw-link" data-conf={edge.confidence} data-edge={edge.key}>
      <Link className="sw-link__story" to={threadPath(edge.from)}>{titleOf(edge.from)}</Link>
      <p className="sw-link__rel">
        <span aria-hidden="true">{'↓'} </span>judged to feed into {'·'} <b className="sw-link__conf">{edge.confidence || 'unrated'}</b> {'·'} {n} {plural(n, 'analysis', 'analyses')}
        {edge.older ? <span className="sw-link__older"> {'·'} older analysis</span> : null}
      </p>
      <Link className="sw-link__story" to={threadPath(edge.to)}>{titleOf(edge.to)}</Link>
      <p className="sw-link__webs">
        {edge.webs.map((w) => `${w.country || 'Unnamed analysis'}${w.confidence ? ` (${w.confidence}${w.generatedAt ? `, ${webDateLabel(w.generatedAt)}` : ''})` : ''}`).join(' · ')}
      </p>
      {edge.mechanism ? (
        <p className="sw-link__mech"><span className="sw-link__tag">Model judgment</span> {'“'}{edge.mechanism}{'”'}</p>
      ) : null}
      {cites.length ? (
        <ul className="sw-link__cites" aria-label="Cited headlines">
          {cites.map((c) => (
            <li key={c.title}>{c.date ? <time dateTime={c.date}>{webDateLabel(c.date)}</time> : null}{c.date ? ' · ' : ''}{c.title}</li>
          ))}
          {more > 0 ? <li className="sw-link__more">+{more} more cited {plural(more, 'headline', 'headlines')}</li> : null}
        </ul>
      ) : null}
    </li>
  );
}

export default function StoriesWeb({ threads, analyses, now, peek, isPhone }) {
  const { index, loading, failed } = useWebIndex(true);
  const [showAll, setShowAll] = useState(false);
  const [listAll, setListAll] = useState(false);

  const merged = useMemo(() => (index ? mergeWebLinks(index, now) : null), [index, now]);
  const threadsById = useMemo(() => new Map(threads.map((t) => [t.threadId, t])), [threads]);
  const picked = useMemo(
    () => (merged ? pickWebNodes({ edges: merged.edges, threadsById, limit: showAll ? WEB_MAX_NODES : WEB_DEFAULT_NODES }) : null),
    [merged, threadsById, showAll],
  );
  const list = useMemo(() => (picked ? strongestLinks(picked.edges) : []), [picked]);

  const titleOf = (id) => {
    const t = threadsById.get(id);
    return analyses?.[id]?.threadTitle || t?.latestTitle || index?.threads?.[id]?.title || id;
  };

  if (loading) return <BootLoader variant="inline" className="gp-boot--tight" label="Loading story links" text="Loading story links" />;
  if (failed) {
    return <div className="weekly-error" role="alert">The story-link index could not be read just now, so no links are shown. It is retried on the next visit.</div>;
  }
  if (!index || !merged) {
    return <div className="weekly-empty-state"><p>No story-link analysis has been published yet.</p></div>;
  }

  const foot = <p className="sw-foot" data-testid="web-footnote">{webFootnote(merged.analyses)}</p>;

  if (!merged.edges.length) {
    return (
      <div className="sw">
        <div className="weekly-empty-state" data-testid="web-empty">
          <p>No story links in the analyses from the last {WEB_HIDE_DAYS} days{merged.hiddenLinks ? ` (${merged.hiddenLinks} ${plural(merged.hiddenLinks, 'link is', 'links are')} older and hidden)` : ''}.</p>
        </div>
        {foot}
      </div>
    );
  }
  if (!picked.nodes.length) {
    return (
      <div className="sw">
        <div className="weekly-empty-state" data-testid="web-empty">
          <p>None of the {merged.edges.length} linked {plural(merged.edges.length, 'pair', 'pairs')} match your filters or have coverage in the archive.</p>
        </div>
        {foot}
      </div>
    );
  }

  const shownList = listAll ? list.slice(0, WEB_LIST_MAX) : list.slice(0, WEB_LIST_DEFAULT);
  const canShowAll = !showAll && picked.totalLinked > picked.nodes.length && picked.nodes.length >= WEB_DEFAULT_NODES;
  const lonely = picked.nodes.filter((n) => n.shownDegree === 0).length;

  const twin = (
    <section className="sw-twin" aria-labelledby="sw-twin-h" data-testid="web-twin">
      <h2 className="sw-h" id="sw-twin-h">Strongest links <span className="sw-h__sub">list view of the graph</span></h2>
      {list.length ? (
        <>
          <ol className="sw-links">
            {shownList.map((e) => <LinkItem key={e.key} edge={e} titleOf={titleOf} />)}
          </ol>
          {list.length > shownList.length ? (
            <button type="button" className="sf-more" onClick={() => setListAll(true)}>Show {Math.min(list.length, WEB_LIST_MAX) - shownList.length} more links</button>
          ) : null}
        </>
      ) : (
        <p className="sw-note">The stories shown are each linked to stories outside this view; use Show more stories to see those links.</p>
      )}
    </section>
  );

  const graph = (
    <section className="sw-graphwrap" aria-labelledby="sw-graph-h">
      <h2 className="sw-h" id="sw-graph-h">
        Story graph <span className="sw-h__sub">the {picked.nodes.length} most-linked {plural(picked.nodes.length, 'story', 'stories')} {'·'} x = peak coverage day</span>
      </h2>
      <Graph picked={picked} titleOf={titleOf} peek={peek} />
      <p className="sw-note" data-testid="web-count">
        {picked.edges.length} of {merged.edges.length} merged {plural(merged.edges.length, 'link', 'links')} shown{picked.outside ? `; ${picked.outside} involve stories outside your filters or the archive` : ''}.
        {lonely ? ` ${lonely} of these ${plural(lonely, 'story is', 'stories are')} linked only to stories not shown here.` : ''}
        {canShowAll ? <> <button type="button" className="sf-more sw-more" onClick={() => setShowAll(true)}>Show more stories</button></> : null}
      </p>
    </section>
  );

  return (
    <div className="sw" data-testid="web-view">
      {isPhone ? <>{twin}{graph}</> : <>{graph}{twin}</>}
      {foot}
    </div>
  );
}
