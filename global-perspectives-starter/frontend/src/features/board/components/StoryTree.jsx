import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { latestStatus } from '@/features/board/lib/recordProjection.js';
const confidence = (n) => n == null ? null : `Confidence ${Math.round(n * 100)}%`;
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
    {level === 'line' ? (story.line?.text ? <p className="board-line"><ClaimTag kind="judgment" /> {story.line.text} <time>{story.line.writtenAt}</time> {confidence(story.line.confidence)}</p> : <p className="board-line">No dated one-line read has been written for this story.</p>) : null}
    {level === 'chapters' ? (story.chapters?.length ? <ol>{story.chapters.map((c) => <li key={c.startedAt}><ClaimTag kind="judgment" /> <time>{c.startedAt}</time> {c.name}: {c.text} {confidence(c.confidence)}</li>)}</ol> : <p className="board-line">No chapter has been recorded for this story.</p>) : null}
    {level === 'forks and events' ? <>
      <h3>Trunk</h3>
      {story.events?.length ? <ol>{story.events.map((e) => <li key={`${e.archive}:${e.topicId}`}><time>{e.date}</time> <ClaimTag kind="fact" /> <button className="board-strings__btn" onClick={() => { setEvent(e); setLevel('event'); }}>{e.headline}</button></li>)}</ol> : <p className="board-line">No dated event has been recorded for this story.</p>}
      <h3>Forks</h3>
      {!story.forks?.length ? <p className="board-line">No forecast branch has been recorded for this story.</p> : story.forks.map((f) => <details key={f.forkId}><summary><time>{f.drawnAt}</time> · {f.branches.length} branches</summary>
        {f.branches.map((b) => {
          const status = latestStatus(b);
          return <details key={b.branchId} className={status?.status === 'dead' ? 'board-tree__dead' : undefined}><summary>{b.text}{b.p != null ? ` · ${b.p}%` : ''}{status ? ` · ${status.status} ${status.date}` : ' · not checked'}</summary>
            <p className="board-line"><ClaimTag kind="judgment" /> {b.trigger}{b.due ? ` · due ${b.due}` : ''}</p>
            {!b.status?.length ? <p className="board-line">No branch of this story has been checked yet.</p> : <ol>{b.status.map((s, i) => <li key={`${s.date}:${i}`}><ClaimTag kind="judgment" /> <time>{s.date}</time> {s.status}: {s.note} {confidence(s.confidence)}{s.evidence?.map((src, n) => <a className="board-link" key={n} href={src.url} target="_blank" rel="noreferrer">Evidence {n + 1}</a>)}</li>)}</ol>}
          </details>;
        })}
      </details>)}
    </> : null}
    {level === 'event' ? (event ? <div><p className="board-line"><ClaimTag kind="fact" /> <time>{event.date}</time> {event.headline}</p>{event.outlets?.map((s, i) => s.url ? <a className="board-link" key={i} href={s.url} target="_blank" rel="noreferrer">{s.outlet || s.source || s.url}</a> : null)}{event.driftNote?.whyChanged ? <p className="board-line"><ClaimTag kind="judgment" /> {event.driftNote.whyChanged}</p> : null}{event.killed?.length ? <p className="board-line">Branches killed: {event.killed.join(', ')}</p> : null}</div> : <p className="board-line">Choose a dated event from the trunk to read its evidence.</p>) : null}
  </section>;
}
