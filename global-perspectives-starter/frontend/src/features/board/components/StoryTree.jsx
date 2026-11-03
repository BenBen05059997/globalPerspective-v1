import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import StoryTreeDrawing from '@/features/board/components/StoryTreeDrawing.jsx';
import { RECOVERED_LABEL, RECOVERED_DETAIL } from '@/features/board/lib/recordText.js';
import { branchStatus, dayMonth } from '@/shared/lib/branchWording.js';
import { branchLine, branchScenario, branchPercent } from '@/features/board/lib/branchView.js';
import { storyHref } from '@/shared/lib/links.js';
import { factsThrough, isLate, forkOutcome, forkClosed, drawnBranches, outcomeText, inChapter, foldTrunk } from '@/features/board/lib/storyTree.js';
import { branchCounts, branchCountText, todayUTC } from '@/features/board/lib/branchDays.js';
import { DEAD_BRANCH_P } from '@/features/board/lib/folding.js';
import { weekMonday } from '@/features/board/lib/recordViews.js';
import '@/features/board/storyTree.css';

const evidenceOf = (v) => Array.isArray(v) ? v.map((e, n) => (e?.url ? <a className="board-link" key={n} href={e.url} target="_blank" rel="noreferrer">Evidence {n + 1}</a> : null)) : v ? <span> · {String(v)}</span> : null;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// The four rungs of the zoom ladder. Rung 1 and 2 are readings of the weekly review and exist only once the story has one.
const RUNGS = { 1: 'story line', 2: 'chapters', 3: 'forks and events', 4: 'the event' };
// The canvas captions (artboard 11): what the rung shows and how you get to it.
const CAPTIONS = {
  1: ['the pin as it sits on the board', 'default on the board'],
  2: ['three chapters on a thin trunk, each with the sentence written at the time', 'tap the pin / zoom one step'],
  3: ['one chapter opened: its events and its forks, open or closed', 'zoom into a chapter'],
  4: ['one event opened as a card', 'zoom into an event; the only level with raw sources'],
};

// Facts view of one story (0037 story view) as a zoom ladder: 1 line, 2 chapters, 3 forks and events (the drawn tree), 4 one event.
// The tree's present is `today` (UTC); late is judged against it. A story record that could not be read shows nothing (the
// failure is already reported by the loader).
export default function StoryTree({ story, loading, error, today = todayUTC() }) {
  const [chosen, setLevel] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [event, setEvent] = useState(null);
  const [unfolded, setUnfolded] = useState(false);
  const [unfoldedLow, setUnfoldedLow] = useState(false);
  if (loading) return <p className="board-line">Loading this story’s record.</p>;
  if (error) return null;
  if (!story) return null;
  const hasLine = Boolean(story.line?.text);
  const hasChapters = Boolean(story.chapters?.length);
  const present = today;
  const facts = factsThrough(story);
  const open = { 1: hasLine, 2: hasChapters, 3: true, 4: Boolean(event) };
  const steps = [1, 2, 3, 4].filter((n) => open[n]);
  const level = chosen || (hasLine ? 1 : 3);
  const at = steps.indexOf(level);
  const scoped = inChapter(story, level === 3 ? chapter : null);
  const pickEvent = (e) => { setEvent(e); setLevel(4); };

  const trunk = scoped.entries.length ? <><h3>Trunk</h3><ol>{scoped.entries.map((e) => <li key={e.eventId}><time dateTime={e.date}>{dayMonth(e.date)}</time> <ClaimTag kind="fact" /> <button className="board-strings__btn" onClick={() => pickEvent(e)}>{e.title}</button>{e.recovered ? <span className="board-line"> · {RECOVERED_LABEL}</span> : null}</li>)}</ol></> : null;

  const forkRow = (f) => {
    const o = forkOutcome(f, present);
    const closed = forkClosed(o);
    return <details key={f.forkId}><summary>
      <span className={closed ? 'story-tree__kicker' : 'story-tree__kicker story-tree__kicker--accent'}>{closed ? `${dayMonth(f.drawnAt) || f.drawnAt} fork · closed` : `open fork · ${dayMonth(f.drawnAt) || f.drawnAt} · provisional`}</span>
      <span>{outcomeText(o)}</span></summary>
      {f.branches.map((b) => { const st = branchStatus(b); return <details key={b.branchId}><summary><span>{branchLine(b)}{branchPercent(b) != null ? ` · ${branchPercent(b)}%` : ''} · {st.text}</span>{isLate(b, present) ? <span className="story-tree__stamp">▸ late · past {dayMonth(b.due)}</span> : null}{branchScenario(b) ? <span className="board-branch__text">{branchScenario(b)}</span> : null}</summary>
        <p className="board-line"><ClaimTag kind="judgment" /> {branchLine(b)}{b.due ? ` · due ${dayMonth(b.due)}` : ''}</p>
        {b.verdict ? <p className="board-line"><time dateTime={b.verdict.at.slice(0, 10)}>{dayMonth(b.verdict.at.slice(0, 10))}</time> {st.text}{st.quote ? <> · “{st.quote}”</> : null}{evidenceOf(b.verdict.evidence)}</p> : null}
      </details>; })}
    </details>;
  };

  const rung3 = () => {
    const { shown, folded } = foldTrunk(scoped.entries, scoped.forks, present);
    const all = foldTrunk(scoped.entries, scoped.forks).shown;
    const drawn = drawnBranches(scoped.forks, unfoldedLow);
    const empty = !scoped.entries.length && !scoped.forks.length;
    return <>
      {chapter ? <p className="board-line"><span className="story-tree__kicker story-tree__kicker--accent">{chapter.title} · opened</span> <Button compact onClick={() => setChapter(null)}>whole story</Button></p> : null}
      {folded ? <Button compact aria-expanded={unfolded} onClick={() => setUnfolded(!unfolded)}>{`Before ${dayMonth(folded.before)} · ${plural(folded.events, 'event', 'events')}${folded.branches ? ` · ${plural(folded.branches, 'branch', 'branches')}${folded.taken ? `, ${folded.taken} happened` : ''}` : ''} ${unfolded ? '▾' : '▸'}`}</Button> : null}
      {drawn.low ? <Button compact aria-expanded={unfoldedLow} onClick={() => setUnfoldedLow(!unfoldedLow)}>{`${plural(drawn.low, 'branch', 'branches')} under ${DEAD_BRANCH_P}% ${unfoldedLow ? 'drawn' : 'folded'} ${unfoldedLow ? '▾' : '▸'}`}</Button> : null}
      <StoryTreeDrawing shown={unfolded ? all : shown} branches={drawn.shown} present={present} />
      {facts && facts < present ? <p className="board-note">Facts run to {dayMonth(facts)}.</p> : null}
      {trunk}
      {scoped.forks.length ? <><h3>Forks</h3>{scoped.forks.map(forkRow)}</> : null}
      {empty ? <p className="board-line">No dated event or forecast branch has been recorded for this story.</p> : null}
    </>;
  };

  const rung4 = () => {
    const drawn = (story.forks || []).filter((f) => f.drawnAt?.slice(0, 10) === event.date).flatMap((f) => f.branches);
    return <div className="story-tree__body">
      <p className="board-line"><ClaimTag kind="fact" /> <time dateTime={event.date}>{dayMonth(event.date)}</time> {event.title}</p>
      {event.recovered ? <p className="board-line">{RECOVERED_LABEL} · {RECOVERED_DETAIL}</p> : null}
      {event.summary ? <p className="board-line">{event.summary}</p> : null}
      {event.sources?.map((s, i) => s.url ? <a className="board-link" key={i} href={s.url} target="_blank" rel="noreferrer">{s.outlet || s.title || s.url}</a> : null)}
      {drawn.length ? <><h3>Branches drawn this day</h3><ul>{drawn.map((b) => <li key={b.branchId}>{branchLine(b)}{branchPercent(b) != null ? ` · ${branchPercent(b)}%` : ''}</li>)}</ul></> : null}
      {story.threadId ? <p className="board-line"><Button compact to={storyHref(story.threadId)}>Open story page</Button></p> : null}
    </div>;
  };

  const readWeek = story.reading?.state === 'read' ? weekMonday(story.reading.week) : null; // chapters carry no date of their own: the reading's week
  const chapterCards = () => <ol className="story-tree__chapters">{story.chapters.map((c) => {
    const f = inChapter(story, c).forks;
    const branches = branchCountText(branchCounts(f, present));
    const here = facts || present;
    const now = here >= c.from && here <= c.to;
    return <li key={`${c.from}:${c.title}`} className={now ? 'story-tree__card story-tree__card--now' : 'story-tree__card'}>
      <div className="story-tree__card-head"><time>from {dayMonth(c.from)}</time>{now ? <span className="story-tree__kicker story-tree__kicker--accent">present · {dayMonth(present)}</span> : null}</div>
      <Button compact onClick={() => { setChapter(c); setLevel(3); }}>{c.title}</Button>
      {c.summary ? <p className="board-line"><ClaimTag kind="judgment" /> {c.summary}</p> : null}
      {readWeek ? <span className="story-tree__stamp">written week of {dayMonth(readWeek)} · never rewritten</span> : null}
      {f.length ? <span className="story-tree__counts">{[plural(f.length, 'fork', 'forks'), branches].filter(Boolean).join(' · ')}</span> : null}
    </li>;
  })}</ol>;

  const counts = [story.chapters?.length && plural(story.chapters.length, 'chapter', 'chapters'), story.entries?.length && plural(story.entries.length, 'event', 'events'), branchCountText(branchCounts(story.forks, present))].filter(Boolean).join(' · ');

  return <section className="board-tree story-tree" aria-label="Story tree">
    <div className="story-tree__ladder" role="group" aria-label="Tree zoom">
      <Button compact label="Zoom out" disabled={at <= 0} onClick={() => setLevel(steps[at - 1])}>−</Button>
      {[1, 2, 3, 4].filter((n) => n > 2 || open[n]).map((n) => <Button compact key={n} label={`Level ${n}, ${RUNGS[n]}`} selected={level === n} disabled={!open[n]} onClick={() => setLevel(n)}>{n}</Button>)}
      <Button compact label="Zoom in" disabled={at < 0 || at >= steps.length - 1} onClick={() => setLevel(steps[at + 1])}>+</Button>
      <span className="story-tree__zoom">ZOOM</span>
    </div>
    <div className="story-tree__body">
      <p className="story-tree__caption"><span className="story-tree__kicker">Level {level} · {RUNGS[level]}</span> {CAPTIONS[level][0]} <span className="story-tree__kicker">How you get here</span> {CAPTIONS[level][1]}</p>
      {level === 1 && hasLine ? <>
        <p className="board-line"><ClaimTag kind="judgment" /> <span className="story-tree__stamp">ours</span> {story.line.text}</p>
        {weekMonday(story.line.week) ? <span className="story-tree__stamp">written week of {dayMonth(weekMonday(story.line.week))} · never rewritten</span> : null}
        {counts ? <span className="story-tree__counts">{counts}</span> : null}
      </> : null}
      {level === 2 && hasChapters ? chapterCards() : null}
      {level === 3 ? rung3() : null}
      {level === 4 && event ? rung4() : null}
    </div>
    {event ? null : <span className="board-tree__hint story-tree__hint">choose an event on the trunk</span>}
  </section>;
}
