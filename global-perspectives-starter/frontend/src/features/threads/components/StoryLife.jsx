import { useState } from 'react';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import EntryRole from '@/shared/ui/EntryRole.jsx';
import Button from '@/shared/ui/Button.jsx';
import PageLine from '@/shared/ui/PageLine.jsx';
import StoryLinkLine from '@/shared/ui/StoryLinkLine.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import { forecastLine } from '@/features/threads/lib/forecastOutcome.js';
import { WatchNext, StoryName, shortDay, firstStepLabel, sinceWord, sinceText } from '@/shared/ui/StoryCard.jsx';
import { MEASURE_NOTE } from '@/shared/ui/JudgmentTip.jsx';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import '@/features/threads/components/StoryLife.css';

// StoryLife — the top of the story page (SPEC §4): one story's life, how it began, every step since, and what we watch next,
// above story mode (which stays as it is). Story facts are the builder's stamps (`stamp`, useNarrativeThread); a missing stamp
// hides its words. Steps are the view's rows, oldest first; the only arithmetic is how many rows a fold hides.
const FOLD_DESKTOP = 12; // more steps than this: the first, a fold, then the last 5
const KEEP_LAST = 5;

const stepsWord = (n) => `${n} ${n === 1 ? 'step' : 'steps'}`;

// "A story we follow since Sep 8 · 64 steps on 37 days": the page's lead-in before the shared since phrase.
function sinceLine(stamp) {
  const since = sinceText(stamp);
  return since ? `A story ${sinceWord(stamp) === 'since' ? 'we follow ' : ''}${since}` : null;
}

// One dated line per step. The newest line refers to the h1 ("the headline above") unless the h1 is the story's name; a one-step
// story's only line is both, so the headline is never written twice (R6).
function StepLine({ entry, first, newest, firstRole, named }) {
  const n = entry.sources?.length || 0;
  const sources = n ? ` · ${n} ${n === 1 ? 'source' : 'sources'}` : '';
  const label = first ? <b>{firstStepLabel(firstRole)} </b> : null;
  let text = entry.title;
  if (newest && !named) text = first ? 'the headline above' : 'Newest step: the headline above';
  return (
    <li className={`sl-step${newest ? ' sl-step--now' : ''}`}>
      <span className="sl-date">{shortDay(entry.date)}</span>
      {newest ? <EntryRole role={entry.role} /> : null}
      <span>{label}{text}{newest ? sources : ''}</span>
      {entry.role === 'measure' ? <span className="sl-note">{MEASURE_NOTE}</span> : null}
    </li>
  );
}
// `forecast` is the story's stored question forecast the page already loaded (no second read); `threadId` / `aliasId` name the
// story and the story it is an alias of (for the link line); `board` is { href, count } of the theme board that holds it, or null.
export default function StoryLife({ thread, stamp, analysis, displayTitle, name = null, category, isPhone, actions = null, forecast = null, threadId = null, aliasId = null, board = null }) {
  const [open, setOpen] = useState(false);
  const [allQs, setAllQs] = useState(false);
  // Oldest first. Rows of one day can come in either order, so the stamped first and newest steps are put at the ends by their
  // eventId. The first step is stamped even when the 400-row cap cut its row (CONTRACT): then it is drawn from the stamp.
  const fs = stamp?.firstStep;
  const ns = stamp?.newestStep;
  const rows = [...thread.entries].reverse();
  const pull = (id) => { const i = id ? rows.findIndex((r) => r.eventId === id) : -1; return i < 0 ? null : rows.splice(i, 1)[0]; };
  const firstRow = pull(fs?.eventId);
  const newestRow = ns?.eventId !== fs?.eventId ? pull(ns?.eventId) : null;
  if (firstRow) rows.unshift(firstRow);
  else if (fs?.title && rows.length && rows[0].title !== fs.title) rows.unshift({ eventId: fs.eventId, date: fs.date, title: fs.title, role: fs.role });
  if (newestRow) rows.push(newestRow);
  const steps = rows;
  const n = steps.length;
  // Phone: the first, a fold, the newest. Desktop: all up to 12, else the first, a fold, the last 5.
  const tail = isPhone ? 1 : KEEP_LAST;
  const folds = !open && (isPhone ? n > 2 : n > FOLD_DESKTOP);
  const shown = folds ? [steps[0], ...steps.slice(n - tail)] : steps;
  const hidden = n - shown.length;
  const questions = analysis?.watchQuestions || [];
  const score = analysis?.riskScore;
  const fline = forecastLine(forecast);

  return (
    <section className="sl" aria-label="The story so far">
      <PageLine>One story’s life: how it began, every step since, and what we watch next.</PageLine>
      <div className="sl-cols">
        <div className="sl-main">
          {sinceLine(stamp) ? <p className="sl-since">{sinceLine(stamp)}</p> : null}
          <div className="sl-where">
            <EntryRole role={ns?.role || steps[n - 1]?.role} />
            <CategoryTag category={category} />
            {thread.regions.slice(0, 3).map((r) => <EntityLink key={r} kind="country" id={r}>{r}</EntityLink>)}
          </div>
          <h1 className="sl-title">{name ? <StoryName name={name} /> : displayTitle}</h1>
          {fline ? <p className="sl-forecast"><b>{fline.pct}</b> that {fline.text}, by {shortDay(fline.by)}</p> : null}
          <StoryLinkLine id={threadId} aliasIds={[aliasId, ...(stamp?.mergedFrom || [])]} category={category} />
          {board ? <p className="sl-board"><Button compact to={board.href}>Open the story’s board · {board.count} stories</Button></p> : null}
          <ol className="sl-steps">
            {shown.map((e, i) => (
              <StepLineWithFold
                key={e.topicId || e.eventId || `${e.date}-${i}`}
                entry={e}
                first={i === 0}
                newest={i === shown.length - 1}
                firstRole={fs?.role ?? null}
                named={!!name}
                fold={folds && i === 1 ? (
                  <li className="sl-fold">
                    <button type="button" className="sl-fold-btn" aria-expanded="false" onClick={() => setOpen(true)}>
                      Show the {stepsWord(hidden)} in between ▾
                    </button>
                  </li>
                ) : null}
              />
            ))}
          </ol>
        </div>
        <div className="sl-side">
          <WatchNext questions={isPhone && !allQs ? questions.slice(0, 1) : questions} all />
          {isPhone && !allQs && questions.length > 1 ? (
            <button type="button" className="sl-fold-btn" aria-expanded="false" onClick={() => setAllQs(true)}>
              {questions.length - 1} more {questions.length - 1 === 1 ? 'question' : 'questions'} ▾
            </button>
          ) : null}
          {stamp?.outletCount != null && stamp?.stepCount != null ? (
            <p className="sl-fact">{stamp.outletCount} {stamp.outletCount === 1 ? 'outlet' : 'outlets'} across {stepsWord(stamp.stepCount)}</p>
          ) : null}
          {score != null ? (
            <p className="sl-fact">How serious: <TierChip tier={tierFromScore(score)} /> {score} of 100 (our model’s rating)</p>
          ) : null}
          {actions ? <div className="sl-actions">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

function StepLineWithFold({ fold, ...props }) {
  return <>{fold}<StepLine {...props} /></>;
}
