import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { boardWeek } from '@/features/board/lib/recordProjection.js';
export default function BoardWeekly({ board, stories, links = {}, loading, errors, now, info = {} }) {
  const week = boardWeek(board, stories, links, now);
  const label = (id) => info[id]?.label || board.pins.find((p) => p.pinId === id)?.line || board.pins.find((p) => p.pinId === id)?.refId || id;
  return <Card as="section" aria-label="This week on your board"><SectionHeader label="This week on your board" as="h2" />
    {loading ? <p className="board-line">Loading the pinned story records.</p> : null}
    {Object.keys(errors || {}).length ? <p className="board-line">Some pinned story records could not be read; this week’s changes are incomplete.</p> : null}
    {week.moved.length ? <><h3>Pins that moved</h3><ul>{week.moved.map((p) => <li key={p.pinId}><time>{p.lastMoved}</time> {p.line ? <ClaimTag kind="judgment" /> : null} {p.line || p.refId}</li>)}</ul></> : null}
    {week.strings.length ? <><h3>Strings changed</h3><ul>{week.strings.map((s) => <li key={`${s.a}:${s.b}:${s.change}`}><ClaimTag kind={s.owner === 'yours' ? 'yours' : 'inference'} /> {label(s.a)} / {label(s.b)}: {s.change} <time>{s.date.slice(0, 10)}</time>{s.line ? ` · ${s.line}` : ''}</li>)}</ul></> : null}
    {week.branches.length ? <><h3>Branch outcomes</h3><ul>{week.branches.map((b, i) => <li key={`${b.branchId}:${i}`}><ClaimTag kind="fact" /> <time>{b.date}</time> {b.text}: {b.status}</li>)}</ul></> : null}
    {week.links.length ? <><h3>Confirmed links</h3><ul>{week.links.map((l) => <li key={`${l.threadId}:${l.otherThreadId}`}><ClaimTag kind="judgment" /> {l.mechanism} <time>{l.week}</time></li>)}</ul></> : null}
    {!loading && !week.moved.length && !week.strings.length && !week.branches.length && !week.links.length ? <p className="board-line">Nothing on your board changed in the last seven days.</p> : null}
  </Card>;
}
