import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { NO_READING } from '@/features/board/lib/recordText.js';
import { branchStatus } from '@/shared/lib/branchWording.js';
const evidenceOf = (v) => Array.isArray(v) ? v.map((e, n) => (e?.url ? <a className="board-link" key={n} href={e.url} target="_blank" rel="noreferrer">Evidence {n + 1}</a> : null)) : v ? <span> · {String(v)}</span> : null;
// Facts view of one story (0037 story view). line, chapters and branch status are the weekly reading's; empty until the story has one.
export default function StoryTree({ story, loading, error }) {
  const [level, setLevel] = useState('line');
  const [event, setEvent] = useState(null);
  if (loading) return <p className="board-line">Loading this story’s record.</p>;
  if (error) return <p className="board-line">This story’s record could not be read. Try opening the pin again.</p>;
  if (!story) return <p className="board-line">Branch status starts when the story record goes live.</p>;
  return <section className="board-tree" aria-label="Story tree">
    <div className="board-actions" role="group" aria-label="Tree zoom">
      {['line', 'chapters', 'forks and events', 'event'].map((name) => <Button compact key={name} selected={level === name} onClick={() => setLevel(name)}>{name}</Button>)}
    </div>
    {level === 'line' ? (story.line?.text ? <p className="board-line"><ClaimTag kind="judgment" /> {story.line.text} <time>{story.line.week}</time></p> : <p className="board-line">{NO_READING}</p>) : null}
    {level === 'chapters' ? (story.chapters?.length ? <ol>{story.chapters.map((c) => <li key={`${c.from}:${c.title}`}><ClaimTag kind="judgment" /> <time>{c.from}</time> – <time>{c.to}</time> · {c.title}{c.summary ? <p className="board-line">{c.summary}</p> : null}</li>)}</ol> : <p className="board-line">{NO_READING}</p>) : null}
    {level === 'forks and events' ? <>
      <h3>Trunk</h3>
      {story.entries?.length ? <ol>{story.entries.map((e) => <li key={e.eventId}><time>{e.date}</time> <ClaimTag kind="fact" /> <button className="board-strings__btn" onClick={() => { setEvent(e); setLevel('event'); }}>{e.title}</button></li>)}</ol> : <p className="board-line">No dated event has been recorded for this story.</p>}
      <h3>Forks</h3>
      {!story.forks?.length ? <p className="board-line">No forecast branch has been recorded for this story.</p> : story.forks.map((f) => <details key={f.forkId}><summary><time>{f.drawnAt}</time> · {f.branches.length} branches</summary>
        {f.branches.map((b) => { const st = branchStatus(b); return <details key={b.branchId}><summary>{b.text}{b.p != null ? ` · ${b.p}%` : ''} · {st.text}</summary>
          <p className="board-line"><ClaimTag kind="judgment" /> {b.trigger}{b.due ? ` · due ${b.due}` : ''}</p>
          {b.verdict ? <p className="board-line"><time>{b.verdict.at.slice(0, 10)}</time> {st.text}{st.quote ? <> · “{st.quote}”</> : null}{evidenceOf(b.verdict.evidence)}</p> : null}
          {!b.verdict && story.branchStatus?.[b.branchId] ? <p className="board-line"><ClaimTag kind="judgment" /> {story.branchStatus[b.branchId].status}{story.branchStatus[b.branchId].why ? ` · ${story.branchStatus[b.branchId].why}` : ''}</p> : null}
          {story.reading?.state === 'none' ? <p className="board-line">Status history: {NO_READING}</p> : null}
        </details>; })}
      </details>)}
    </> : null}
    {level === 'event' ? (event ? <div><p className="board-line"><ClaimTag kind="fact" /> <time>{event.date}</time> {event.title}</p>{event.summary ? <p className="board-line">{event.summary}</p> : null}{event.sources?.map((s, i) => s.url ? <a className="board-link" key={i} href={s.url} target="_blank" rel="noreferrer">{s.outlet || s.title || s.url}</a> : null)}</div> : <p className="board-line">Choose a dated event from the trunk to read its evidence.</p>) : null}
  </section>;
}
