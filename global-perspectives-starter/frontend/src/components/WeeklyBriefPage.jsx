import { useWeeklyBrief } from '../hooks/useWeeklyBrief';
import Markdown from './Markdown';
import './WeeklyBriefPage.css';

function formatWeekOf(weekKey) {
  if (!weekKey) return '';
  const d = new Date(weekKey + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return weekKey;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function readingTime(text) {
  const words = String(text || '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

export default function WeeklyBriefPage() {
  const { brief, loading, error } = useWeeklyBrief();

  return (
    <div className="wb-page">
      <article className="wb-article">
        <div className="wb-eyebrow">Weekly Intelligence Brief</div>

        {loading ? (
          <p className="wb-status">Loading the latest brief…</p>
        ) : error ? (
          <p className="wb-status">Couldn’t load the brief right now. Please try again shortly.</p>
        ) : !brief ? (
          <div className="wb-empty">
            <h1 className="wb-headline">No brief published yet</h1>
            <p className="wb-dek">The first weekly intelligence brief will appear here once it’s published. Check back at the start of the week.</p>
          </div>
        ) : (
          <>
            <h1 className="wb-headline">{brief.headline}</h1>
            {brief.dek && <p className="wb-dek">{brief.dek}</p>}
            <div className="wb-meta">
              {brief.weekOf && <span>Week of {formatWeekOf(brief.weekOf)}</span>}
              {brief.brief && <span className="wb-meta-sep">·</span>}
              {brief.brief && <span>{readingTime(brief.brief)} min read</span>}
            </div>
            <Markdown text={brief.brief} className="gp-md wb-body" />
            <div className="wb-footer">
              Global Perspectives — analyst-grade global news intelligence.
            </div>
          </>
        )}
      </article>
    </div>
  );
}
