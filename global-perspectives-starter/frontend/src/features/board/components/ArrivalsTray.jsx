import { useEffect, useState } from 'react';
import { PIN_BUDGET } from '@/shared/lib/board.js';
import Card from '@/shared/ui/Card.jsx';
import Button from '@/shared/ui/Button.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { callBoard } from '@/features/board/lib/boardApi.js';
import { reportFetchError } from '@/shared/api/errorSink';
const DIRECTION = { drives: 'drives', driven_by: 'driven by', shared_cause: 'shared cause' };
export default function ArrivalsTray({ board, onDismiss, onKeep }) {
  const [state, setState] = useState({loading:true});
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
  const cards = (state.arrivals || []).filter((c) => !board.dismissed.includes(c.threadId) && !board.pins.some((p) => p.kind === 'thread' && p.refId === c.threadId));
  if (!state.loading && !state.error && !state.recordAvailable) return null; // no story record yet: nothing to show
  return <Card as="section" aria-label="Arrivals"><SectionHeader label="Arrivals" as="h2" />
    {state.loading ? <p className="board-line">Checking new stories against your board.</p> : state.error ? <p className="board-line">New arrivals could not be checked. Reopen the board to try again.</p> : cards.length ? <ul className="board-list">{cards.map((c) => <li key={c.threadId}>
      <EntityLink kind="story" id={c.threadId}>{c.title || c.threadId}</EntityLink><p className="board-line"><ClaimTag kind="judgment" /> strong · <time>{c.date}</time></p>
      {c.via.map((v) => <p className="board-line" key={v.pinId}>Via {board.pins.find((p) => p.pinId === v.pinId)?.line || v.threadId}: {v.mechanism}{DIRECTION[v.direction] ? ` (${DIRECTION[v.direction]})` : ''}</p>)}
      <div className="board-actions"><Button disabled={board.pins.length >= PIN_BUDGET} onClick={() => onKeep(c)}>Keep story</Button><Button onClick={() => onDismiss(c.threadId)}>Dismiss arrival</Button></div>
    </li>)}</ul> : <p className="board-line">No new story touches your board since {state.since?.slice(0, 10)}.</p>}
  </Card>;
}
