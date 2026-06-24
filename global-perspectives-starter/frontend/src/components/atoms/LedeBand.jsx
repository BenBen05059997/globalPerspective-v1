// LedeBand — the deterministic "Today's lede" orientation strip shown at the top
// of Home and the Map. Fed by utils/composeTopicsLede (pure, no LLM). Renders
// NOTHING when there is no real lede, so it can never show a fabricated headline.
//
// Props: the spread result of composeTopicsLede() — { empty, lede, topicCount,
// countryCount, threadCount }. The headline links into the story-arc analysis
// via the shared threadPath() helper.
import { Link } from 'react-router-dom';
import { threadPath } from '../../utils/threadPath';
import './LedeBand.css';

export default function LedeBand({
  empty,
  lede,
  topicCount = 0,
  countryCount = 0,
  threadCount = 0,
}) {
  if (empty || !lede || !lede.title) return null;

  const metaParts = [`${topicCount} ${topicCount === 1 ? 'story' : 'stories'}`];
  if (countryCount) metaParts.push(`${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`);
  if (threadCount) metaParts.push(`${threadCount} active ${threadCount === 1 ? 'thread' : 'threads'}`);

  // Link into the story-arc analysis ONLY when the topic carries a real threadId.
  // No fallback link — an unlinked headline is honest; a guessed destination is not.
  const headline = lede.threadId
    ? <Link to={threadPath(lede.threadId)} className="lede-headline-link">{lede.title} →</Link>
    : <span className="lede-headline-text">{lede.title}</span>;

  return (
    <div className="lede-band" role="note" aria-label={`Today's lede: ${lede.title}`}>
      <span className="lede-kicker">Today&rsquo;s lede</span>
      <span className="lede-headline">{headline}</span>
      {lede.reason && <span className="lede-reason">{lede.reason}</span>}
      <span className="lede-meta">{metaParts.join(' · ')}</span>
    </div>
  );
}
