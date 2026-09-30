import { Link } from 'react-router-dom';
import { threadPath } from '@/shared/lib/threadPath';
import { CATEGORY_BADGE_COLORS, RISK_SOLID } from '@/shared/styles/tokens';
import { usePeek } from '@/shared/hooks/usePeek.js';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import { peekData } from '@/shared/lib/peekData.js';
import { countryLinkPath, storyLinkPath, peekInputForStory, peekInputForSignal } from '@/features/briefings/lib/briefingSlides.js';

const TRAJECTORY = {
  escalating: { arrow: '↗', label: 'Escalating' },
  stable: { arrow: '→', label: 'Stable' },
  'de-escalating': { arrow: '↘', label: 'De-escalating' },
};

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
  const stats = brief.stats || {};
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
      <div className="bm-slide-stats">
        {stats.totalArticles > 0 && <span><b>{stats.totalArticles}</b> articles</span>}
        {stats.sourceOutlets > 0 && <span><b>{stats.sourceOutlets}</b> outlets</span>}
        {stats.countriesCovered > 0 && <span><b>{stats.countriesCovered}</b> countries</span>}
      </div>
    </div>
  );
}

export function StorySlide({ story, index }) {
  const catColors = CATEGORY_BADGE_COLORS[story.category];
  const region = (story.regions || [])[0];
  return (
    <div className="bm-slide bm-slide-story">
      <div className="bm-slide-kicker">
        TOP STORY {index + 1} of 8
        {catColors && <span className="bm-cat-badge" style={{ background: catColors.bg, color: catColors.color }}>{story.category}</span>}
      </div>
      <Peekable id={`bm-story-${index}`} item={peekInputForStory(story)}>
        <h2 className="bm-slide-title">{story.title}</h2>
      </Peekable>
      {(story.regions || []).length > 0 && (
        <p className="bm-slide-tags">
          {story.regions.map((r) => (
            <Link key={r} to={countryLinkPath(r)} className="bm-tag">{r}</Link>
          ))}
          {story.sourceCount > 0 && <span className="bm-tag-src">{story.sourceCount} source{story.sourceCount === 1 ? '' : 's'}</span>}
        </p>
      )}
      {story.prediction && (
        <div className="bm-forecast">
          <span className="bm-inference-badge">model judgment</span>
          <p>{story.prediction}</p>
        </div>
      )}
      {storyLinkPath(story) && (
        <Link to={storyLinkPath(story)} className="bm-slide-link bm-story-link">Read the full story →</Link>
      )}
      {region && (
        <Link to={countryLinkPath(region)} className="bm-slide-link">Show on map / country card →</Link>
      )}
    </div>
  );
}

export function WatchSlide({ countryToWatch, risingThread }) {
  const traj = countryToWatch.trajectory && TRAJECTORY[countryToWatch.trajectory];
  return (
    <div className="bm-slide bm-slide-watch">
      <div className="bm-slide-kicker">COUNTRY TO WATCH</div>
      <h2 className="bm-slide-title">
        <Link to={countryLinkPath(countryToWatch.countryName)}>{countryToWatch.countryName}</Link>
      </h2>
      <div className="bm-slide-stats">
        {countryToWatch.riskLevel && (
          <span style={{ color: RISK_SOLID[countryToWatch.riskLevel] || RISK_SOLID.moderate }}>
            <b>{countryToWatch.riskLevel}</b> risk
          </span>
        )}
        {traj && <span>{traj.arrow} {traj.label}</span>}
      </div>
      {countryToWatch.headline && <p className="bm-slide-text">{countryToWatch.headline}</p>}
      {risingThread?.title && (
        <div className="bm-rising">
          <span className="bm-inference-badge">rising thread</span>
          <p className="bm-rising-title">{risingThread.title}</p>
          {risingThread.oneLiner && <p>{risingThread.oneLiner}</p>}
        </div>
      )}
    </div>
  );
}

// ── Weekly ────────────────────────────────────────────────────────────────────

export function WeekSlide({ brief }) {
  const signals = brief.signals || [];
  const threats = signals.filter((s) => s.kind !== 'development');
  const highest = threats.length ? threats[0].riskLevel : null;
  return (
    <div className="bm-slide bm-slide-week">
      <div className="bm-slide-kicker">
        WEEKLY · week of {brief.weekOf}
        <span className="bm-ai-tag">AI-generated</span>
      </div>
      <h2 className="bm-slide-title">The week's signals, ranked by risk</h2>
      <div className="bm-slide-stats">
        <span><b>{signals.length}</b> signals</span>
        {highest && <span><b>{highest}</b> highest risk</span>}
        <span><b>{(brief.watch || []).length}</b> to watch</span>
      </div>
    </div>
  );
}

export function SignalSlide({ signal, index }) {
  return (
    <div className="bm-slide bm-slide-signal">
      <div className="bm-slide-kicker">
        SIGNAL {index + 1}
        {signal.kind === 'development'
          ? <span className="bm-cat-badge bm-cat-dev">development</span>
          : signal.riskLevel && <span className="bm-cat-badge bm-cat-risk">{signal.riskLevel} risk</span>}
      </div>
      <Peekable id={`bm-signal-${index}`} item={peekInputForSignal(signal)}>
        <h2 className="bm-slide-title">{signal.lede}</h2>
      </Peekable>
      {signal.region && <p className="bm-slide-tags">{signal.region}</p>}
      {signal.fact && <p className="bm-slide-text"><span className="bm-fact-badge">FACT</span> {signal.fact}</p>}
      {signal.soWhat && <p className="bm-slide-text"><span className="bm-inference-badge">so what</span> {signal.soWhat}</p>}
      {signal.threadId && <Link to={threadPath(signal.threadId)} className="bm-slide-link">Read the full story arc →</Link>}
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

export function SlideBody({ mode, slide, brief }) {
  if (!slide) return null;
  if (mode === 'weekly') {
    if (slide.kind === 'week') return <WeekSlide brief={brief} />;
    if (slide.kind === 'signal') return <SignalSlide signal={slide.signal} index={slide.index} />;
    if (slide.kind === 'next') return <NextWeekSlide watch={slide.watch} />;
    return null;
  }
  if (slide.kind === 'day') return <DaySlide brief={brief} />;
  if (slide.kind === 'story') return <StorySlide story={slide.story} index={slide.index} />;
  if (slide.kind === 'watch') return <WatchSlide countryToWatch={slide.countryToWatch} risingThread={slide.risingThread} />;
  return null;
}
