import { Link } from 'react-router';
import { storyHref, mapHref } from '@/shared/lib/links.js';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import { usePeek } from '@/shared/hooks/usePeek.js';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import { peekData } from '@/shared/lib/peekData.js';
import QuestionChip from '@/shared/ui/QuestionChip.jsx';
import { useStoryQuestion } from '@/features/briefings/hooks/useStoryQuestion.js';
import SubscribeCard from '@/shared/ui/SubscribeCard';
import Trajectory from '@/features/briefings/components/Trajectory.jsx';
import PlaceLinks from '@/features/briefings/components/PlaceLinks.jsx';
import { threadIdOf, placeNames, firstCountry, peekInputForStory, peekInputForSignal } from '@/features/briefings/lib/briefingSlides.js';

// A brief's riskLevel as the neutral TierChip; a value outside the four tiers stays plain text
// (TierChip would otherwise read it as "Not scored").
const TIERS = new Set(['low', 'moderate', 'elevated', 'high']);
function RiskLevel({ level }) {
  const tier = String(level).toLowerCase();
  return TIERS.has(tier) ? <TierChip tier={tier} /> : <span>{level} risk</span>;
}

function Peekable({ id, item, children }) {
  const peek = usePeek();
  const data = item ? peekData(item) : null;
  if (!data) return children;
  return (
    <span
      onMouseEnter={(e) => peek.openOnHover(id, e.currentTarget)}
      onMouseLeave={peek.close}
      onFocus={(e) => peek.openOnFocus(id, e.currentTarget)}
      onBlur={peek.close}
      className="bm-peekable"
    >
      {children}
      {peek.openId === id && <StoryPeek id={`${id}-peek`} data={data} style={peek.style} />}
    </span>
  );
}

// ── Daily ─────────────────────────────────────────────────────────────────────

export function DaySlide({ brief }) {
  return (
    <div className="bm-slide bm-slide-day">
      <div className="bm-slide-kicker">
        DAILY · {brief.displayDate || brief.dateKey}
        <span className="bm-ai-tag">AI-generated</span>
      </div>
      <h2 className="bm-slide-title">{brief.headline}</h2>
      {brief.summary && (
        <p className="bm-slide-text">{brief.summary.split(/\n{2,}/)[0].replace(/\*\*/g, '')}</p>
      )}
    </div>
  );
}

// One line under a top story: its next dated question with its own probability (only when the
// story has a threadId and a question exists; otherwise nothing).
function StoryNextQuestion({ threadId }) {
  const q = useStoryQuestion(threadId);
  if (!q) return null;
  return (
    <div className="bm-next-question">
      <span className="bm-next-question-kicker">Next dated question</span>
      <p className="bm-slide-text">
        {q.qid ? <EntityLink kind="forecast" id={q.qid}>{q.text}</EntityLink> : q.text}
        {' '}<span className="bm-next-question-by">by {q.deadline}</span>
      </p>
      <QuestionChip trigger={q} />
    </div>
  );
}

export function StorySlide({ story, index }) {
  const threadId = threadIdOf(story);
  const country = firstCountry(story);
  return (
    <div className="bm-slide bm-slide-story">
      <div className="bm-slide-kicker">
        TOP STORY {index + 1} of 8
        <CategoryTag category={story.category} />
      </div>
      <Peekable id={`bm-story-${index}`} item={peekInputForStory(story)}>
        <h2 className="bm-slide-title">{story.title}</h2>
      </Peekable>
      {(story.regions || []).length > 0 && (
        <p className="bm-slide-tags">
          <PlaceLinks names={story.regions} className="bm-tag" />
          {story.sourceCount > 0 && <span className="bm-tag-src">{story.sourceCount} source{story.sourceCount === 1 ? '' : 's'}</span>}
        </p>
      )}
      {story.prediction && (
        <div className="bm-forecast">
          <span className="bm-inference-badge">model judgment</span>
          <p>{story.prediction}</p>
        </div>
      )}
      {story.threadId ? <StoryNextQuestion threadId={story.threadId} /> : null}
      {threadId && (
        <Link to={storyHref(threadId)} className="bm-slide-link bm-story-link">Read the full story →</Link>
      )}
      {country && (
        <Link to={mapHref({ country: country.iso3 })} className="bm-slide-link">Show {country.name} on the map →</Link>
      )}
    </div>
  );
}

export function WatchSlide({ countryToWatch, risingThread }) {
  const risingId = threadIdOf(risingThread);
  return (
    <div className="bm-slide bm-slide-watch">
      <div className="bm-slide-kicker">COUNTRY TO WATCH</div>
      <h2 className="bm-slide-title">
        <EntityLink kind="country" id={countryToWatch.countryName}>{countryToWatch.countryName}</EntityLink>
      </h2>
      <div className="bm-slide-stats">
        {countryToWatch.riskLevel && <RiskLevel level={countryToWatch.riskLevel} />}
        <Trajectory value={countryToWatch.trajectory} />
      </div>
      {countryToWatch.headline && <p className="bm-slide-text">{countryToWatch.headline}</p>}
      {risingThread?.title && (
        <div className="bm-rising">
          <span className="bm-inference-badge">rising thread</span>
          <p className="bm-rising-title">
            {risingId
              ? <EntityLink kind="story" id={risingId} topic={{ title: risingThread.title }}>{risingThread.title}</EntityLink>
              : risingThread.title}
          </p>
          {risingThread.oneLiner && <p>{risingThread.oneLiner}</p>}
        </div>
      )}
    </div>
  );
}

// ── Weekly ────────────────────────────────────────────────────────────────────

export function WeekSlide({ brief }) {
  return (
    <div className="bm-slide bm-slide-week">
      <div className="bm-slide-kicker">
        WEEKLY · week of {brief.weekOf}
        <span className="bm-ai-tag">AI-generated</span>
      </div>
      <h2 className="bm-slide-title">The week's signals, ranked by risk</h2>
    </div>
  );
}

export function SignalSlide({ signal, index }) {
  return (
    <div className="bm-slide bm-slide-signal">
      <div className="bm-slide-kicker">
        SIGNAL {index + 1}
        {signal.kind === 'development'
          ? <CategoryTag category="development" />
          : signal.riskLevel && <RiskLevel level={signal.riskLevel} />}
      </div>
      <Peekable id={`bm-signal-${index}`} item={peekInputForSignal(signal)}>
        <h2 className="bm-slide-title">{signal.lede}</h2>
      </Peekable>
      {(signal.region || signal.asOf) && (
        <p className="bm-slide-tags">
          <PlaceLinks names={placeNames(signal)} sep=" · " />
          {signal.asOf && <span className="bm-tag-src">as of {signal.asOf}</span>}
        </p>
      )}
      {signal.fact && <p className="bm-slide-text"><span className="bm-fact-badge">FACT</span> {signal.fact}</p>}
      {signal.soWhat && <p className="bm-slide-text"><span className="bm-inference-badge">so what</span> {signal.soWhat}</p>}
      {threadIdOf(signal) && <Link to={storyHref(threadIdOf(signal))} className="bm-slide-link">Read the full story arc →</Link>}
    </div>
  );
}

export function NextWeekSlide({ watch }) {
  return (
    <div className="bm-slide bm-slide-next">
      <div className="bm-slide-kicker">NEXT WEEK · {watch.length} to watch</div>
      <h2 className="bm-slide-title">What to watch</h2>
      <ul className="bm-watch-list">
        {watch.map((w, i) => (
          <li key={i}>
            <div className="bm-watch-text">{w.event}</div>
            {w.stake && <div className="bm-watch-stake">{w.stake}</div>}
            {w.date && <div className="bm-watch-date">{w.date}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeeklySlide({ slide, brief }) {
  if (slide.kind === 'week') return <WeekSlide brief={brief} />;
  if (slide.kind === 'signal') return <SignalSlide signal={slide.signal} index={slide.index} />;
  if (slide.kind === 'next') return <NextWeekSlide watch={slide.watch} />;
  return null;
}

// The weekly deck ends with the weekly-brief email sign-up (the same card as the weekly read mode).
export function SlideBody({ mode, slide, brief, isLast = false }) {
  if (!slide) return null;
  if (mode === 'weekly') {
    return (
      <>
        <WeeklySlide slide={slide} brief={brief} />
        {isLast && <SubscribeCard variant="weekly" />}
      </>
    );
  }
  if (slide.kind === 'day') return <DaySlide brief={brief} />;
  if (slide.kind === 'story') return <StorySlide story={slide.story} index={slide.index} />;
  if (slide.kind === 'watch') return <WatchSlide countryToWatch={slide.countryToWatch} risingThread={slide.risingThread} />;
  return null;
}
