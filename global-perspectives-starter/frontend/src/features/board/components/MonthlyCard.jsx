import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { OursBadge } from '@/features/board/components/StringBadges.jsx';
import { monthlyView, firstLine } from '@/features/board/lib/monthly.js';
import { dayMonth } from '@/shared/lib/branchWording.js';
import '@/features/board/alerts.css';

// "Board summary and the monthly" (artboard 7), the parts that need no model: the stored weekly summaries (as the
// arc and the list of previous ones), strings kept or cut this month, branches settled, our coverage gap, pins that
// went quiet and the next dates. The model-written summary paragraph and "the surprise" are not built. Public = ours,
// Private = yours (only the reader sees it). Every part with nothing in it is absent; with nothing at all, so is the card.
const Private = () => <span className="al-mark al-mark--private">Private</span>;
const Public = () => <span className="al-mark">Ours · public</span>;
const CHANGE = { held: 'held', kept: 'kept by you', cut: 'cut by you' };

export default function MonthlyCard({ board, stories, today, labelOf, storyLabel, onRetire }) {
  const m = monthlyView(board, stories, today);
  const parts = [m.arc.length, m.previous.length, m.strings.length, m.ours, m.yours, m.missed, m.quiet.length, m.dates.length];
  if (!parts.some(Boolean)) return null;
  const month = new Date(`${today}T00:00:00Z`).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  const pair = (s) => `${labelOf(s.a)} — ${labelOf(s.b)}`;
  return (
    <Card as="section" aria-label="The monthly" className="al-card">
      <SectionHeader label={`The monthly · ${month}`} as="h2" />
      {m.previous.length ? (
        <p className="al-line"><span className="pn-kicker">Previous summaries</span> {m.previous.map((v) => dayMonth(v.date)).join(' · ')}</p>
      ) : null}
      {m.arc.length ? (
        <section className="al-sec" aria-label="The arc">
          <h3 className="pn-kicker">The arc <Private /></h3>
          <ul className="al-rows">{m.arc.map((v) => <li key={v.date} className="al-row"><time className="al-when" dateTime={v.date}>{dayMonth(v.date)}</time><span>{firstLine(v.text)}</span></li>)}</ul>
        </section>
      ) : null}
      {m.strings.length ? (
        <section className="al-sec" aria-label="Strings over the month">
          <h3 className="pn-kicker">Strings over the month</h3>
          <ul className="al-rows">{m.strings.map((s) => (
            <li key={`${s.a}:${s.b}`} className="al-row">
              <time className="al-when" dateTime={s.date}>{dayMonth(s.date)}</time>
              <span>{pair(s)} · {CHANGE[s.change]}</span>
              {s.owner === 'yours' ? <Private /> : <OursBadge />}
            </li>
          ))}</ul>
        </section>
      ) : null}
      {m.ours || m.yours ? (
        <section className="al-sec" aria-label="Branches settled">
          <h3 className="pn-kicker">Branches settled</h3>
          {m.ours ? <p className="al-line"><Public /> {m.ours.settled} settled this month. {m.ours.dueThisWeek} due this week.</p> : null}
          {m.yours ? <p className="al-line"><Private /> You set numbers on {m.yours.set} {m.yours.set === 1 ? 'branch' : 'branches'}; {m.yours.settled ? `${m.yours.settled} settled` : 'none settled yet'}.</p> : null}
        </section>
      ) : null}
      {m.missed ? (
        <section className="al-sec" aria-label="What we missed">
          <h3 className="pn-kicker">What we missed <Public /></h3>
          <p className="al-line">{m.missed}</p>
        </section>
      ) : null}
      {m.quiet.length ? (
        <section className="al-sec" aria-label="Pins that went quiet">
          <h3 className="pn-kicker">Pins that went quiet <Private /></h3>
          <ul className="al-rows">{m.quiet.map((q) => (
            <li key={q.pinId} className="al-row">
              <span className="al-what">{labelOf(q.pinId)} · no move in {q.weeks} weeks</span>
              {onRetire ? <Button compact onClick={() => onRetire(q.pinId)} aria-label={`Retire pin ${labelOf(q.pinId)}`}>Retire?</Button> : null}
            </li>
          ))}</ul>
        </section>
      ) : null}
      {m.dates.length ? (
        <section className="al-sec" aria-label="Next dates">
          <h3 className="pn-kicker">Next dates</h3>
          <ul className="al-rows">{m.dates.map((d) => (
            <li key={d.id} className="al-row"><time className="al-when" dateTime={d.due}>{dayMonth(d.due)}{d.p != null ? ` · ${d.p}%` : ''}{d.late ? ' · past due' : ''}</time><span>{storyLabel ? `${storyLabel(d.threadId)}: ` : ''}{d.line}{d.scenario ? ` (${d.scenario})` : ''}</span></li>
          ))}</ul>
        </section>
      ) : null}
    </Card>
  );
}
