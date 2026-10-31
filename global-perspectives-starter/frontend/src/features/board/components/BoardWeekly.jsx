import Card from '@/shared/ui/Card.jsx';
import Button from '@/shared/ui/Button.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import { OursBadge } from '@/features/board/components/StringBadges.jsx';
import { boardWeek } from '@/features/board/lib/recordProjection.js';
import { isoWeekEnd, weekMonday } from '@/features/board/lib/recordViews.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import { dayMonth } from '@/shared/lib/branchWording.js';
import { PIN_BUDGET } from '@/shared/lib/board.js';
import '@/features/board/panels.css';

// "Your board moved" (artboard 4). Facts and our readings of the last seven days; an empty section is absent.
// Not built, for lack of data: old -> new scores, a string strengthening (we store no history), the coverage note.
// onAddPin / onDismissLink are optional: without them a new link shows no buttons.
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function BoardWeekly({ board, stories, links = {}, loading, errors, now = new Date(), info = {}, onAddPin, onDismissLink }) {
  const week = boardWeek(board, stories, links, now);
  const pinOf = (id) => board.pins.find((p) => p.pinId === id);
  const label = (id) => info[id]?.label || pinOf(id)?.line || pinOf(id)?.refId || id;
  const pinnedThread = (threadId) => board.pins.find((p) => p.kind === 'thread' && p.refId === threadId);
  const newLinks = week.links.filter((l) => !(board.dismissed || []).includes(l.otherThreadId));
  const summary = [
    week.moved.length ? count(week.moved.length, 'pin moved', 'pins moved') : null,
    week.strings.length ? count(week.strings.length, 'string changed', 'strings changed') : null,
    newLinks.length ? count(newLinks.length, 'new link found', 'new links found') : null,
  ].filter(Boolean);
  const changed = week.moved.length || week.strings.length || week.branches.length || newLinks.length;
  const title = summary.length ? `Your board moved · week ending ${dayMonth(isoWeekEnd(now.toISOString().slice(0, 10)))}` : 'This week on your board';

  return <Card as="section" aria-label="This week on your board" className="pn-weekly">
    <SectionHeader label={title} as="h2" />
    {board.name ? <p className="pn-kicker">{board.name}</p> : null}
    {summary.length ? <p className="board-line">{summary.join(' · ')}</p> : null}
    {loading ? <p className="board-line">Loading the pinned story records.</p> : null}
    {Object.keys(errors || {}).length ? <p className="board-line">Some pinned story records could not be read; this week’s changes are incomplete.</p> : null}

    {week.moved.length ? <section className="pn-sec"><h3 className="pn-kicker">Pins that moved</h3><ul className="pn-rows">{week.moved.map((p) => <li key={p.pinId} className="pn-row pn-row--stack">
      <span className="pn-row__head">{label(p.pinId)} {info[p.pinId]?.risk != null ? <TierChip tier={tierFromScore(info[p.pinId].risk)} score={info[p.pinId].risk} /> : null}</span>
      <span className="board-note"><time dateTime={p.lastMoved}>{dayMonth(p.lastMoved)}</time>{p.line ? <> · <ClaimTag kind="judgment" />{p.line}</> : null}</span>
    </li>)}</ul></section> : null}

    {week.strings.length ? <section className="pn-sec"><h3 className="pn-kicker">Strings that changed</h3><ul className="pn-rows">{week.strings.map((s) => <li key={`${s.a}:${s.b}:${s.change}`} className="pn-row pn-row--stack">
      <span className="pn-row__head">{s.owner === 'yours' ? <ClaimTag kind="yours" /> : <OursBadge />} {label(s.a)} — {label(s.b)} · {s.change}</span>
      <span className="board-note"><time dateTime={s.date}>{dayMonth(s.date)}</time>{s.line ? ` · ${s.line}` : ''}</span>
    </li>)}</ul></section> : null}

    {week.branches.length ? <section className="pn-sec"><h3 className="pn-kicker">Branch outcomes</h3><ul className="pn-rows">{week.branches.map((b, i) => <li key={`${b.branchId}:${i}`} className="pn-row pn-row--stack">
      <span className="pn-row__head"><ClaimTag kind="fact" />{b.text}: {b.status}</span><span className="board-note"><time dateTime={b.date}>{dayMonth(b.date)}</time></span>
    </li>)}</ul></section> : null}

    {newLinks.map((l) => {
      const mine = pinnedThread(l.threadId);
      const other = pinnedThread(l.otherThreadId);
      return <section key={`${l.threadId}:${l.otherThreadId}`} className="pn-box pn-box--ours" aria-label="New link we found">
        <span className="pn-kicker">New link we found</span>
        <p className="pn-row__head">{mine ? label(mine.pinId) : l.threadId} — {other ? label(other.pinId) : <EntityLink kind="story" id={l.otherThreadId}>linked story</EntityLink>}</p>
        <p className="board-line"><ClaimTag kind="judgment" />{l.mechanism} <time dateTime={weekMonday(l.week) || undefined}>week of {dayMonth(weekMonday(l.week))}</time></p>
        {!other && onAddPin && onDismissLink ? <div className="board-actions">
          <Button disabled={board.pins.length >= PIN_BUDGET} onClick={() => onAddPin(l.otherThreadId)}>Add pin</Button>
          <Button onClick={() => onDismissLink(l.otherThreadId)}>Dismiss</Button>
        </div> : null}
      </section>;
    })}

    {!loading && !changed ?<p className="board-line">Nothing on your board changed in the last seven days.</p> : null}
  </Card>;
}
