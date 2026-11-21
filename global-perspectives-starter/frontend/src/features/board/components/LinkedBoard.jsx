// LinkedBoard: one public board opened (board look SPEC §2), a theme from themes.json or a region preset, in one layout:
// the title, the centre sentence, what moved, the legend and the list of story cards in link order (with the desktop
// arcs beside it), the stories with no judged link, "How this board is made", and the buttons to the diagram and map.
// `rows` are the board's stories ({ id, title, category, tier, riskScore, born, newestStep?, stepCount? }); `links` are
// its judged links in story ids, or null when the board carries none; `shared` its shared-name pairs.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useIsPhone } from '@/shared/hooks/useIsPhone.js';
import { boardHref } from '@/shared/lib/links.js';
import { pairKey } from '@/shared/lib/board.js';
import Button from '@/shared/ui/Button.jsx';
import FoldRow from '@/shared/ui/FoldRow.jsx';
import PageLine from '@/shared/ui/PageLine.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { shortDay } from '@/shared/ui/StoryCard.jsx';
import { useStoryViews } from '@/features/board/hooks/useStoryViews.js';
import { useCardLinkViews } from '@/features/board/hooks/useCardLinkViews.js';
import { pairPlaces } from '@/shared/lib/linkLine.js';
import { todayUTC } from '@/features/board/lib/branchDays.js';
import {
  storyFacts, judgedLinks, sharedPairs, linkOrder, cardLinks, whatMoved, judgedOn, visitBoard,
} from '@/features/board/lib/linkedBoard.js';
import StoryLinkCard from '@/features/board/components/StoryLinkCard.jsx';
import StrengthBars from '@/shared/ui/StrengthBars.jsx';
import WhatMoved from '@/features/board/components/WhatMoved.jsx';
import LinkArcs, { GUTTER } from '@/features/board/components/LinkArcs.jsx';
import PublicDiagram from '@/features/board/components/PublicDiagram.jsx';
import '@/features/board/linked.css';

export const CENTRE = 'A board shows which stories we judge feed into others, which way, how strongly, and which moved lately.';
const VISITS_KEY = 'gp-board-visits'; // { [boardKey]: { seen, prev } }: visitBoard in lib/linkedBoard.js
const ARCS_FROM = 701; // px: arcs and their gutter from this width up; below, the rows carry the links

// This board's visit, read and recorded once when it opens. Storage that throws or holds junk gives a first visit.
function openVisit(boardKey, today) {
  let map = null;
  try { map = JSON.parse(localStorage.getItem(VISITS_KEY) || 'null'); } catch { map = null; }
  const { since, next } = visitBoard(map, boardKey, today);
  try { localStorage.setItem(VISITS_KEY, JSON.stringify(next)); } catch { /* storage blocked: every visit is a first visit */ }
  return since;
}

function Legend({ links, shared, arcs }) {
  const strengths = ['weak', 'medium', 'strong'].filter((s) => links.some((l) => l.strength === s));
  return (
    <p className="bl-legend">
      <span>→ feeds into (our judgment)</span>
      {strengths.map((s) => <StrengthBars key={s} strength={s} />)}
      {shared.length ? <span className="bl-legend__shared">⋯ only named in both: not a judged link</span> : null}
      {arcs ? <span>Arcs take the colour of the story that feeds.</span> : null}
    </p>
  );
}

export default function LinkedBoard({ boardKey, kind, title, region = null, rows, links: linkRows, shared: sharedRows = [], diagram }) {
  const isPhone = useIsPhone();
  const arcs = !useIsPhone(ARCS_FROM);
  const today = todayUTC();
  const [lastSeen] = useState(() => openVisit(boardKey, today));
  const [view, setView] = useState('list');
  const listRef = useRef(null);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  // story views: for the rows that do not carry their own step facts (region pins; themes.json before its step stamp)
  const viewPins = useMemo(() => rows.filter((r) => !r.newestStep).map((r) => ({ pinId: r.id, kind: 'thread', refId: r.id })), [rows]);
  const views = useStoryViews(viewPins);
  const stories = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, storyFacts(r.id, r, views.stories[r.id])])), [rows, views.stories]);
  const storyOf = (id) => stories[id] || { id, title: id };

  const cardViews = useCardLinkViews(ids);
  const placesOf = (id, otherId) => (cardViews[id] ? pairPlaces(cardViews[id].ids, cardViews[id].views, otherId) : null);
  const known = linkRows != null;
  const links = useMemo(() => judgedLinks(linkRows || [], ids), [linkRows, ids]);
  const shared = useMemo(() => sharedPairs(sharedRows, ids, links), [sharedRows, ids, links]);
  const order = useMemo(() => linkOrder(ids, links, stories), [ids, links, stories]); // no links known: every story stands alone
  const moved = useMemo(() => whatMoved(ids, stories, lastSeen, today), [ids, stories, lastSeen, today]);
  const judged = judgedOn(links);
  const ready = !views.loading;

  const card = (id) => (
    <StoryLinkCard key={id} story={storyOf(id)} rows={known ? cardLinks(id, links, shared) : { feeds: [], fedBy: [], notes: [] }}
      storyOf={storyOf} placesOf={placesOf} mark={moved.mark[id]} mode={moved.mode} />
  );
  const { linked: list, alone } = order;
  const legend = links.length ? <Legend links={links} shared={shared} arcs={arcs} /> : null;

  // design review 1: no confirmed state exists, so none is claimed; ", made on {date}" only when a link carries its date
  const linkLine = links.length
    ? ` Every link is our model’s judgment${judged ? `, made on ${shortDay(judged)}` : ''}, so every link is drawn dashed.`
    : known && kind === 'region' ? ' No links were judged between these stories.' : '';
  const made = kind === 'theme'
    ? `These ${ids.length} stories are one group in our story web.${linkLine}`
    : `The ${ids.length} highest-risk stories that touch ${region}.${linkLine}`;

  return (
    <div className="bl-board">
      <Link className="board-link" to={boardHref()}>← All boards</Link>
      <h1 className="bl-title">{title}</h1>
      <PageLine>{CENTRE}</PageLine>
      {ready ? <WhatMoved moved={moved} storyOf={storyOf} startOpen={!isPhone} /> : null}
      {view === 'list' ? (
        <>
          {!isPhone ? legend : null}
          {!known ? <p className="board-line">The links of this board are not available yet.</p> : null}
          {list.length ? (
            <>
              {!isPhone ? <p className="bl-order">In link order: stories that feed others come before the stories they feed.</p> : null}
              <div className={`bl-listwrap${arcs ? ' has-arcs' : ''}`} style={arcs ? { '--bl-gutter': `${GUTTER}px` } : undefined}>
                {arcs ? <LinkArcs listRef={listRef} links={links} categoryOf={(id) => stories[id]?.category} /> : null}
                <div className="bl-list" ref={listRef}>{list.map(card)}</div>
              </div>
            </>
          ) : null}
          {alone.length ? (
            <section className="bl-alone" aria-label="No judged link yet">
              {known ? <SectionHeader as="h2" label="No judged link yet" /> : null}
              <div className="bl-list">{alone.map(card)}</div>
            </section>
          ) : null}
        </>
      ) : (
        <PublicDiagram pins={diagram.pins} strings={diagram.strings} view={view} stories={views.stories} today={today} />
      )}
      <FoldRow title="How this board is made">
        <p className="board-line">{made}</p>
        {isPhone ? legend : null}
      </FoldRow>
      <div className="bl-buttons" role="group" aria-label="Board view">
        <Button selected={view === 'graph'} onClick={() => setView(view === 'graph' ? 'list' : 'graph')}>{view === 'graph' ? 'Show as a list' : 'Show as a diagram'}</Button>
        <Button selected={view === 'map'} onClick={() => setView(view === 'map' ? 'list' : 'map')}>Map</Button>
      </div>
    </div>
  );
}

/** A theme's drawing: its stories as pins and its judged links as our inferred strings, each pair once. */
export function themeDiagram(theme) {
  const pins = (theme.stories || []).map((s) => ({ pinId: s.threadId, kind: 'thread', refId: s.threadId, title: s.title, riskScore: s.riskScore, category: s.category }));
  const seen = new Set();
  const strings = [];
  for (const l of theme.links || []) {
    const key = pairKey(l.from, l.to);
    if (seen.has(key)) continue;
    seen.add(key);
    strings.push({ a: l.from, b: l.to, owner: 'ours', strength: 'inferred', ...(l.reason ? { mechanism: l.reason } : {}) });
  }
  return { pins, strings };
}
