import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { boardWeek } from '@/features/board/lib/recordProjection.js';
export default function BoardWeekly({ board, stories, loading, errors, now, info = {} }) {
  const week = boardWeek(board, stories, now);
  const label = (id) => info[id]?.label || board.pins.find((p) => p.pinId === id)?.line || board.pins.find((p) => p.pinId === id)?.refId || id;
  return <Card as="section" aria-label="This week on your board"><SectionHeader label="This week on your board" as="h2" />
    {loading ? <p className="board-line">Loading the pinned story records.</p> : null}
    {Object.keys(errors || {}).length ? <p className="board-line">Some pinned story records could not be read; this week’s changes are incomplete.</p> : null}
    <h3>Pins that moved</h3>
    {week.moved.length ? <ul>{week.moved.map((p) => <li key={p.pinId}><time>{p.lastMoved}</time> {p.line ? <ClaimTag kind="judgment" /> : null} {p.line || p.refId}</li>)}</ul> : <p className="board-line">{board.recordAvailable ? 'No pinned story has a recorded move in the last seven days.' : 'Pin changes start when the story record goes live.'}</p>}
    <h3>Strings changed</h3>
    {week.strings.length ? <ul>{week.strings.map((s) => <li key={`${s.a}:${s.b}:${s.change}`}><ClaimTag kind={s.owner === 'yours' ? 'yours' : 'inference'} /> {label(s.a)} / {label(s.b)}: {s.change} <time>{s.date.slice(0, 10)}</time>{s.line ? ` · ${s.line}` : ''}</li>)}</ul> : <p className="board-line">No kept or cut string is dated in the last seven days.</p>}
    <h3>Branches confirmed or killed</h3>
    {week.branches.length ? <ul>{week.branches.map((b, i) => <li key={`${b.branchId}:${i}`}><ClaimTag kind="judgment" /> <time>{b.date}</time> {b.text}: {b.status}{b.note ? ` · ${b.note}` : ''}</li>)}</ul> : <p className="board-line">{Object.values(stories).some(Boolean) ? 'No branch confirmation or death has been recorded this week.' : 'Branch status starts when the story record goes live.'}</p>}
    <h3>Confirmed links</h3>
    {week.links.length ? <ul>{week.links.map((l) => <li key={`${l.threadId}:${l.otherThreadId}`}><ClaimTag kind="judgment" /> {l.strength}: {l.mechanism} <time>{l.since}</time></li>)}</ul> : <p className="board-line">No confirmed link has been recorded this week.</p>}
  </Card>;
}
