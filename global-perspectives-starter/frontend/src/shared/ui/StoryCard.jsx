import { Link } from 'react-router';
import EntryRole from '@/shared/ui/EntryRole.jsx';
import JudgmentTip, { NAME_NOTE } from '@/shared/ui/JudgmentTip.jsx';
import { ROUTE } from '@/shared/lib/links.js';
import '@/shared/ui/blocks.css';

// StoryCard pieces (SPEC §0): a news item drawn inside its story. Every fact comes from the builder's story stamp
// (`stories[storyId]` of index/today.json, CONTRACT): `born`, `stepCount`, `firstStep`, `watch`. A missing stamp hides its
// line; nothing is guessed. The only arithmetic is "steps in between" (stepCount - 2) and "later steps" (stepCount - 1).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD…' -> 'Nov 17'; anything else -> ''. */
export function shortDay(s) {
  const m = String(s || '').match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${MONTHS[+m[1] - 1]} ${+m[2]}` : '';
}

const steps = (n) => `${n} ${n === 1 ? 'step' : 'steps'}`;

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
/** The story's name (SPEC §6b), or null: no name, an empty one, or one that matches the headline (case, spacing and punctuation
 * aside) counts as none. The name is shown as stamped; nothing here writes or shortens one. */
export function storyName(name, headline) {
  const n = typeof name === 'string' ? name.trim() : '';
  return n && norm(n) !== norm(headline) ? n : null;
}

/** A story's name followed by its MODEL JUDGMENT tag (§6b). `interactive={false}` inside a row that is one control. */
export function StoryName({ name, interactive = true, small = false }) {
  return <>{name}<span className="gp-sname__tag"><JudgmentTip text={NAME_NOTE} interactive={interactive} small={small} /></span></>;
}

/** The first-step label (SPEC §0), from the stamped `firstStep.role` only: start -> "Began:", measure -> "First step:" (the chip
 * beside it says Measured change), anything else -> "Earliest step in our record:" (the record may not hold the story's real start). */
export function firstStepLabel(role) {
  if (role === 'start') return 'Began:';
  if (role === 'measure') return 'First step:';
  return 'Earliest step in our record:';
}

/** "since" or "in our record since": a story whose stamped first step is not a start may be older than our record. */
export const sinceWord = (story) => (story?.firstStep && story.firstStep.role !== 'start' && story.firstStep.role !== 'measure' ? 'in our record since' : 'since');

/** Top line: the kind chip, then "since {born} · {n} steps", or the step's own date for a one-step story. */
export function StoryTopLine({ role, story, stepDate = null, children = null, interactive = false }) {
  const n = Number(story?.stepCount) || 0;
  const since = n > 1 && story?.born ? `${sinceWord(story)} ${shortDay(story.born)} · ${steps(n)}` : shortDay(stepDate || story?.newestStep?.date);
  if (!role && !since && !children) return null;
  return (
    <div className="gp-scard__top">
      <EntryRole role={role} interactive={interactive} />
      {since ? <span className="gp-scard__since">{since}</span> : null}
      {children}
    </div>
  );
}

/** Map row top line (SPEC §2): the kind of the story's newest step, then "newest step {date} · {n} steps" (never "since").
 * No stamped newest step: the chip of `role` alone, or nothing. */
export function NewestStepLine({ story, role = null }) {
  const step = story?.newestStep;
  const n = Number(story?.stepCount) || 0;
  if (!step?.date) return role ? <EntryRole role={role} /> : null;
  return <><EntryRole role={step.role} /><span className="gp-scard__since">newest step {shortDay(step.date)}{n ? ` · ${steps(n)}` : ''}</span></>;
}

/** The faint dated steps under the headline: how the story began, or that this is its first step. */
export function StorySteps({ role, story, newest = null }) {
  const n = Number(story?.stepCount) || 0;
  if (!n) return null;
  // With a name (§6b), the newest step's headline is no longer the title: it closes the list as a bright line.
  const newestLine = newest?.title ? (
    <li className="gp-scard__newest"><span className="gp-scard__date">{shortDay(newest.date)}</span> Newest step: {newest.title}</li>
  ) : null;
  // The edition's other steps (R1, stamped `alsoToday`): one by its headline, more as a count. None or no stamp: no line.
  const also = Array.isArray(story.alsoToday) ? story.alsoToday.filter((x) => x?.title) : [];
  const alsoLine = also.length ? (
    <li className="gp-scard__clamp">Also today: {also.length === 1 ? also[0].title : `${also.length} more steps, on the story page`}</li>
  ) : null;
  // A story whose only step is this one starts here.
  if (role === 'start' && n === 1) {
    return (
      <ol className="gp-scard__steps">
        <li>This is the story’s first step. Its next steps will show here.</li>
        {newestLine}
      </ol>
    );
  }
  const first = story.firstStep;
  if (!first?.title || n < 2) return newestLine || alsoLine ? <ol className="gp-scard__steps">{alsoLine}{newestLine}</ol> : null;
  const between = n - 2 - also.length; // the steps not already on the card (Also today lists this edition's)
  return (
    <ol className="gp-scard__steps">
      <li className="gp-scard__clamp">
        <span className="gp-scard__date">{shortDay(first.date)}</span>{' '}
        <b>{firstStepLabel(first.role)} </b>{first.title}
      </li>
      {between > 0 ? <li>{steps(between)} in between, on the story page</li> : null}
      {alsoLine}
      {newestLine}
    </ol>
  );
}

/** What we watch next: the questions (the first only, unless `all`), then the public Track record line. None -> nothing. */
export function WatchNext({ questions, all = false, className = '' }) {
  const list = (Array.isArray(questions) ? questions : []).filter((q) => typeof q === 'string' && q.trim());
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 1);
  return (
    <div className={`gp-watch ${className}`.trim()}>
      <div className="gp-watch__label">What we watch next</div>
      {all
        ? <ol className="gp-watch__list">{shown.map((q, i) => <li key={i}>{q}</li>)}</ol>
        : <p className="gp-watch__q">{shown[0]}</p>}
      <p className="gp-watch__tr">We check a weekly sample of these in public. <Link to={ROUTE.trackRecord}>Track record →</Link></p>
    </div>
  );
}
