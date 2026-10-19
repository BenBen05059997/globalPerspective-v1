import { countryLinkPath, storyLinkPath, peekInputForStory } from '@/features/briefings/lib/briefingSlides.js';
import { Link } from 'react-router';
import StoryLink from '@/shared/ui/StoryLink.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';

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
          <SectionHeader label="The day" />
          {brief.summary.split(/\n{2,}/).map((p, i) => <p key={i}>{p.replace(/\*\*/g, '')}</p>)}
        </section>
      )}

      {(brief.stats?.totalArticles || brief.stats?.sourceOutlets || brief.stats?.countriesCovered) && (
        <section>
          <SectionHeader label="By the numbers" />
          <ul>
            {brief.stats.totalArticles > 0 && <li>{brief.stats.totalArticles} articles</li>}
            {brief.stats.countriesCovered > 0 && <li>{brief.stats.countriesCovered} countries</li>}
            {brief.stats.sourceOutlets > 0 && <li>{brief.stats.sourceOutlets} outlets</li>}
          </ul>
        </section>
      )}

      {(brief.topStories || []).length > 0 && (
        <section>
          <SectionHeader label="Top stories" />
          {brief.topStories.map((s, i) => (
            <div key={i} className="bm-readtext-item">
              <h3>{i + 1}. {storyLinkPath(s) ? <StoryLink to={storyLinkPath(s)} topic={peekInputForStory(s)}>{s.title}</StoryLink> : s.title}</h3>
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
          <SectionHeader label="Country to watch" />
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
          <SectionHeader label="Signals" />
          {brief.signals.map((s, i) => (
            <div key={s.threadId || i} className="bm-readtext-item">
              <h3>{i + 1}. {s.lede}</h3>
              {s.region && <p className="bm-readtext-meta">{s.region}</p>}
              {s.fact && <p><strong>Fact:</strong> {s.fact}</p>}
              {s.soWhat && <p><strong>So what:</strong> {s.soWhat}</p>}
              {s.threadId && <p><StoryLink threadId={s.threadId} topic={{ title: s.lede, regions: s.region ? [s.region] : undefined }}>Read the full story arc →</StoryLink></p>}
            </div>
          ))}
        </section>
      )}

      {(brief.watch || []).length > 0 && (
        <section>
          <SectionHeader label="Next week's watchlist" />
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
