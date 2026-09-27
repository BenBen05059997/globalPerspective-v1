import { countryLinkPath } from '@/features/briefings/lib/briefingSlides.js';
import { Link } from 'react-router-dom';

// ReadAsText — a plain, printable, accessible text version of the current edition (semantic
// headings, no map/slide chrome), for email / print / search / screen readers. Built only from
// fields the edition actually carries — no invented sections.
function DailyText({ brief }) {
  return (
    <article className="bm-readtext">
      <header>
        <p className="bm-readtext-kicker">DAILY BRIEFING · {brief.displayDate || brief.dateKey}</p>
        <h1>{brief.headline}</h1>
        <p className="bm-readtext-meta">
          AI-generated{brief.generatedAt ? ` · published ${new Date(brief.generatedAt).toUTCString()}` : ''}
        </p>
      </header>

      {brief.summary && (
        <section>
          <h2>The day</h2>
          {brief.summary.split(/\n{2,}/).map((p, i) => <p key={i}>{p.replace(/\*\*/g, '')}</p>)}
        </section>
      )}

      {(brief.stats?.totalArticles || brief.stats?.sourceOutlets || brief.stats?.countriesCovered) && (
        <section>
          <h2>By the numbers</h2>
          <ul>
            {brief.stats.totalArticles > 0 && <li>{brief.stats.totalArticles} articles</li>}
            {brief.stats.countriesCovered > 0 && <li>{brief.stats.countriesCovered} countries</li>}
            {brief.stats.sourceOutlets > 0 && <li>{brief.stats.sourceOutlets} outlets</li>}
          </ul>
        </section>
      )}

      {(brief.topStories || []).length > 0 && (
        <section>
          <h2>Top stories</h2>
          {brief.topStories.map((s, i) => (
            <div key={i} className="bm-readtext-item">
              <h3>{i + 1}. {s.title}</h3>
              {s.regions?.length > 0 && (
                <p className="bm-readtext-meta">
                  {s.regions.map((r, j) => (
                    <span key={r}>
                      {j > 0 && ' · '}
                      <Link to={countryLinkPath(r)}>{r}</Link>
                    </span>
                  ))}
                </p>
              )}
              {s.prediction && <p><em>Model judgment:</em> {s.prediction}</p>}
            </div>
          ))}
        </section>
      )}

      {brief.countryToWatch?.countryName && (
        <section>
          <h2>Country to watch</h2>
          <h3>
            <Link to={countryLinkPath(brief.countryToWatch.countryName)}>{brief.countryToWatch.countryName}</Link>
            {brief.countryToWatch.riskLevel ? ` — ${brief.countryToWatch.riskLevel} risk` : ''}
          </h3>
          {brief.countryToWatch.headline && <p>{brief.countryToWatch.headline}</p>}
        </section>
      )}
    </article>
  );
}

function WeeklyText({ brief }) {
  return (
    <article className="bm-readtext">
      <header>
        <p className="bm-readtext-kicker">WEEKLY BRIEFING · week of {brief.weekOf}</p>
        <h1>The week's signals, ranked by risk</h1>
        <p className="bm-readtext-meta">
          AI-generated{brief.generatedAt ? ` · published ${new Date(brief.generatedAt).toUTCString()}` : ''}
        </p>
      </header>

      {(brief.signals || []).length > 0 && (
        <section>
          <h2>Signals</h2>
          {brief.signals.map((s, i) => (
            <div key={s.threadId || i} className="bm-readtext-item">
              <h3>{i + 1}. {s.lede}</h3>
              {s.region && <p className="bm-readtext-meta">{s.region}</p>}
              {s.fact && <p><strong>Fact:</strong> {s.fact}</p>}
              {s.soWhat && <p><strong>So what:</strong> {s.soWhat}</p>}
              {s.threadId && <p><Link to={`/weekly/thread/${encodeURIComponent(s.threadId)}`}>Read the full story arc →</Link></p>}
            </div>
          ))}
        </section>
      )}

      {(brief.watch || []).length > 0 && (
        <section>
          <h2>Next week's watchlist</h2>
          <ul>
            {brief.watch.map((w, i) => (
              <li key={i}>{w.event}{w.stake ? ` — ${w.stake}` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

export default function ReadAsText({ mode, brief }) {
  if (!brief) return null;
  return mode === 'weekly' ? <WeeklyText brief={brief} /> : <DailyText brief={brief} />;
}
