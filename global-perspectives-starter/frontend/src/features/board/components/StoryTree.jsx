import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { RECOVERED_LABEL, RECOVERED_DETAIL } from '@/features/board/lib/recordText.js';
import { branchStatus, dayMonth } from '@/shared/lib/branchWording.js';
const evidenceOf = (v) => Array.isArray(v) ? v.map((e, n) => (e?.url ? <a className="board-link" key={n} href={e.url} target="_blank" rel="noreferrer">Evidence {n + 1}</a> : null)) : v ? <span> · {String(v)}</span> : null;
// Facts view of one story (0037 story view). line, chapters and branch status are the weekly reading's; empty until the story has one.
export default function StoryTree({ story, loading, error }) {
  const [chosen, setLevel] = useState(null);
  const [event, setEvent] = useState(null);
  if (loading) return <p className="board-line">Loading this story’s record.</p>;
  if (error) return <p className="board-line">This story’s record could not be read. Try opening the pin again.</p>;
  if (!story) return null;
  // Readings (line, chapters) exist only after a weekly review: their tabs appear only when there is something to read.
  const hasLine = Boolean(story.line?.text);
  const hasChapters = Boolean(story.chapters?.length);
  const level = chosen || (hasLine ? 'line' : 'forks and events');
  const tabs = [hasLine && 'line', hasChapters && 'chapters', 'forks and events'].filter(Boolean);
  return <section className="board-tree" aria-label="Story tree">
    <div className="board-actions" role="group" aria-label="Tree zoom">
      {tabs.map((name) => <Button compact key={name} selected={level === name} onClick={() => setLevel(name)}>{name}</Button>)}
      <Button compact selected={level === 'event'} disabled={!event} onClick={() => setLevel('event')}>event</Button>
      {event ? null : <span className="board-tree__hint">choose an event on the trunk</span>}
    </div>
    {level === 'line' && hasLine ? <p className="board-line"><ClaimTag kind="judgment" /> {story.line.text} <time>{story.line.week}</time></p> : null}
    {level === 'chapters' && hasChapters ? <ol>{story.chapters.map((c) => <li key={`${c.from}:${c.title}`}><ClaimTag kind="judgment" /> <time>{c.from}</time> – <time>{c.to}</time> · {c.title}{c.summary ? <p className="board-line">{c.summary}</p> : null}</li>)}</ol> : null}
    {level === 'forks and events' ? <>
      {story.entries?.length ? <><h3>Trunk</h3><ol>{story.entries.map((e) => <li key={e.eventId}><time>{e.date}</time> <ClaimTag kind="fact" /> <button className="board-strings__btn" onClick={() => { setEvent(e); setLevel('event'); }}>{e.title}</button>{e.recovered ? <span className="board-line"> · {RECOVERED_LABEL}</span> : null}</li>)}</ol></> : null}
      {story.forks?.length ? <><h3>Forks</h3>{story.forks.map((f) => <details key={f.forkId}><summary><time>{dayMonth(f.drawnAt) || f.drawnAt}</time> · {f.branches.length} branches</summary>
        {f.branches.map((b) => { const st = branchStatus(b); return <details key={b.branchId}><summary><span>{b.text}{b.p != null ? ` · ${b.p}%` : ''} · {st.text}</span>{b.trigger ? <span className="board-branch__text">{b.trigger}</span> : null}</summary>
          <p className="board-line"><ClaimTag kind="judgment" /> {b.trigger}{b.due ? ` · due ${b.due}` : ''}</p>
          {b.verdict ? <p className="board-line"><time>{b.verdict.at.slice(0, 10)}</time> {st.text}{st.quote ? <> · “{st.quote}”</> : null}{evidenceOf(b.verdict.evidence)}</p> : null}
        </details>; })}
      </details>)}</> : null}
      {!story.entries?.length && !story.forks?.length ? <p className="board-line">No dated event or forecast branch has been recorded for this story.</p> : null}
    </> : null}
    {level === 'event' && event ? <div><p className="board-line"><ClaimTag kind="fact" /> <time>{event.date}</time> {event.title}</p>{event.recovered ? <p className="board-line">{RECOVERED_LABEL} · {RECOVERED_DETAIL}</p> : null}{event.summary ? <p className="board-line">{event.summary}</p> : null}{event.sources?.map((s, i) => s.url ? <a className="board-link" key={i} href={s.url} target="_blank" rel="noreferrer">{s.outlet || s.title || s.url}</a> : null)}</div> : null}
  </section>;
}
