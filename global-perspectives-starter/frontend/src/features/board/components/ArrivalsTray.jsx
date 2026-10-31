import { useEffect, useRef, useState } from 'react';
import { PIN_BUDGET } from '@/shared/lib/board.js';
import Card from '@/shared/ui/Card.jsx';
import Button from '@/shared/ui/Button.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { StrengthBadge } from '@/features/board/components/StringBadges.jsx';
import { callBoard } from '@/features/board/lib/boardApi.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { dayMonth } from '@/shared/lib/branchWording.js';
import { strongestArrivals } from '@/features/board/lib/folding.js';
import '@/features/board/panels.css';

// Arrivals as a clue pool (artboard 5): new stories linked to your pins wait face down until you turn them over;
// nothing is on the board until you keep it. "Unseen" means not turned over since this page opened.
// Not built: dragging a card onto the board, the landed-on-string fact (no strength history), a count on the pin.
const DIRECTION = { drives: 'drives', driven_by: 'driven by', shared_cause: 'shared cause' };
const FADE_MS = 1200;

export default function ArrivalsTray({ board, labelOf, onDismiss, onKeep }) {
  const [state, setState] = useState({loading:true});
  const [seen, setSeen] = useState(() => new Set());
  const [fading, setFading] = useState({});
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    let live = true;
    setState({loading:true});
    callBoard('arrivals', {boardId:board.boardId}).then(async (out) => {
      if (!live) return;
      setState(out);
      // Advance only after a successful read; the response retains the previous visit for this session.
      try { await callBoard('visit_board', {boardId:board.boardId}); }
      catch (err) { reportFetchError('board-visit', err); }
    }).catch((err) => { reportFetchError('board-arrivals', err); if(live)setState({error:true}); });
    return () => { live = false; };
  }, [board.boardId]);
  const dismiss = (id) => {
    setFading((f) => ({ ...f, [id]: true }));
    onDismiss(id);
    timers.current.push(setTimeout(() => setFading((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== id))), FADE_MS));
  };
  const { shown: cards } = strongestArrivals((state.arrivals || []).filter((c) => (!board.dismissed.includes(c.threadId) || fading[c.threadId]) && !board.pins.some((p) => p.kind === 'thread' && p.refId === c.threadId)));
  const unseen = cards.filter((c) => !fading[c.threadId] && !seen.has(c.threadId)).length;
  if (!state.loading && !state.error && !state.recordAvailable) return null; // no story record yet: nothing to show
  const viaLabel = (v) => (labelOf ? labelOf(v.pinId) : v.threadId); // the pin's name as the board shows it
  return <Card as="section" aria-label="Arrivals"><SectionHeader label="Clue pool" hint={cards.length ? `${unseen} unseen` : null} as="h2" />
    {state.loading ? <p className="board-line">Checking new stories against your board.</p> : state.error ? <p className="board-line">New arrivals could not be checked. Reopen the board to try again.</p> : cards.length ? <>
      <p className="board-note">Cards wait here. Nothing is on the board until you place it.</p>
      <ul className="board-list pn-pool">{cards.map((c) => {
        const when = <time dateTime={c.date}>{dayMonth(c.date)}</time>;
        if (fading[c.threadId]) return <li key={c.threadId} className="pn-card is-fading"><span className="pn-kicker">Dismissed · fading</span><span>{c.title || c.threadId}</span><span className="board-note">{when}</span></li>;
        if (!seen.has(c.threadId)) return <li key={c.threadId} className="pn-card is-down">
          <span className="pn-kicker">Face down · unseen</span>
          <span className="pn-card__title">{c.title || c.threadId}</span>
          <span className="board-note">via {viaLabel(c.via[0])}{c.via.length > 1 ? ` / ${c.via.length} tracked stories` : ''}</span>
          <span className="board-line"><StrengthBadge strength={c.strength} /> {when}</span>
          <div className="board-actions"><Button onClick={() => setSeen((s) => new Set(s).add(c.threadId))}>Turn over</Button></div>
        </li>;
        return <li key={c.threadId} className="pn-card">
          <EntityLink kind="story" id={c.threadId}>{c.title || c.threadId}</EntityLink>
          <p className="board-line"><ClaimTag kind="judgment" /><StrengthBadge strength={c.strength} /> {when}</p>
          {c.via.map((v) => <p className="board-line" key={v.pinId}>Via {viaLabel(v)}: {v.mechanism}{DIRECTION[v.direction] ? ` (${DIRECTION[v.direction]})` : ''}</p>)}
          <div className="board-actions"><Button disabled={board.pins.length >= PIN_BUDGET} onClick={() => onKeep(c)}>Keep story</Button><Button onClick={() => dismiss(c.threadId)}>Dismiss arrival</Button></div>
        </li>;
      })}</ul></> : <p className="board-line">No new story touches your board since {dayMonth(state.since)}.</p>}
  </Card>;
}
