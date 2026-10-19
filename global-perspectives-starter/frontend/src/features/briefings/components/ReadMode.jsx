import { useEffect } from 'react';
import { Link } from 'react-router';
import { threadIdOf, peekInputForStory } from '@/features/briefings/lib/briefingSlides.js';
import { addDaysKey, daysBetween, todayKey } from '@/features/briefings/lib/editions.js';
import { briefingHref, countryHref } from '@/shared/lib/links.js';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import PlaceLinks from '@/features/briefings/components/PlaceLinks.jsx';
import { useDailyBrief } from '@/shared/hooks/useDailyBrief';
import { crisisDotVar } from '@/shared/lib/crisisHue';
import { tierFromLevel } from '@/shared/lib/riskTiers';
import TierChip from '@/shared/ui/TierChip.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import SharedSectionHeader from '@/shared/ui/SectionHeader.jsx';
import ShareButtons from '@/shared/ui/ShareButtons';
import CopyBriefing, { formatDailyBrief } from '@/shared/ui/CopyBriefing';
import { SaveButton } from '@/shared/ui/SaveButton';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import Trajectory from '@/features/briefings/components/Trajectory.jsx';
import BriefingError from '@/features/briefings/components/BriefingError.jsx';
import '@/features/briefings/components/ReadMode.css';

function BoldText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )}</>;
}

// How old the *served* brief is vs today: null when it is today's.
function relativeDayLabel(servedKey, today) {
  if (!servedKey) return null;
  const days = daysBetween(servedKey, today);
  if (!(days > 0)) return null;
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function formatTimeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function stripBold(text) {
  return (text || '').replace(/\*\*([^*]+)\*\*/g, '$1');
}
// First N sentences: the short lead under the headline; the full summary lives in Full Analysis.
function firstSentences(text, n = 2) {
  const clean = stripBold(text).trim();
  if (!clean) return '';
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return clean;
  return sentences.slice(0, n).join(' ').trim();
}
function toParagraphs(text) {
  return (text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

// Key Takeaways — the scannable 10-second read. A server `keyPoints` array when present; otherwise
// an honest list from fields the brief already carries (rising thread, country to watch, top
// story headlines). Nothing is invented.
function deriveTakeaways(brief) {
  if (Array.isArray(brief.keyPoints) && brief.keyPoints.length) {
    return brief.keyPoints.slice(0, 4).map(p => (typeof p === 'string' ? { text: p } : p));
  }
  const out = [];
  if (brief.risingThread?.oneLiner) out.push({ tag: 'Rising', text: brief.risingThread.oneLiner });
  if (brief.countryToWatch?.headline) out.push({ tag: brief.countryToWatch.countryName, text: brief.countryToWatch.headline });
  for (const s of (brief.topStories || [])) {
    if (out.length >= 4) break;
    if (!s?.title || s.title === brief.headline) continue;
    out.push({ tag: s.category, text: s.title });
  }
  return out.slice(0, 4);
}

function SectionHeader({ num, title, meta }) {
  return <SharedSectionHeader label={`${num} · ${title}`} hint={meta} />;
}

// The rising thread: a story link only when the brief carries a real thread id; otherwise plain
// text (never a guessed target).
function RisingThreadCard({ thread }) {
  const threadId = threadIdOf(thread);
  const body = (
    <>
      <div className="daily-highlight-kicker">
        <span>Rising Thread</span>
        <Trajectory value={thread.trajectory} className="daily-traj daily-traj--pill" />
        {thread.articleCount > 0 && (
          <span className="daily-highlight-meta">
            {thread.articleCount} articles{thread.dayCount ? ` · ${thread.dayCount} days` : ''}
          </span>
        )}
      </div>
      <h3 className="daily-highlight-h3">{thread.title}</h3>
      {thread.oneLiner && <p className="daily-highlight-deck">{thread.oneLiner}</p>}
      {threadId && <span className="daily-highlight-cta">Read full arc →</span>}
    </>
  );
  return threadId
    ? <EntityLink kind="story" id={threadId} topic={{ title: thread.title }} className="daily-highlight">{body}</EntityLink>
    : <div className="daily-highlight">{body}</div>;
}

const dayHref = (dateKey) => briefingHref({ mode: 'read', date: dateKey });

// The country-to-watch card: a link to the country page, or the same card unlinked when the name is
// not a country (a region has no page).
function CountryCardLink({ name, className, children }) {
  const href = countryHref(name);
  return href ? <Link to={href} className={className}>{children}</Link> : <div className={className}>{children}</div>;
}

// ReadMode — /briefings (mode=read, the default): the daily brief as one long-form read. `?date=`
// asks for a specific edition; the hook falls back to the nearest earlier one and says so.
export default function ReadMode({ dateParam }) {
  const today = todayKey();
  const requested = dateParam || today;
  const { brief, servedDateKey, loading, error, refetch } = useDailyBrief(dateParam || undefined);

  useEffect(() => {
    const label = brief?.displayDate || servedDateKey || requested;
    document.title = `Daily Brief — ${label} | Global Perspectives`;
  }, [brief, servedDateKey, requested]);

  if (loading) return <BootLoader variant="inline" label="Loading the daily brief" text="Loading the daily brief" />;
  if (error && !brief) return <BriefingError what="daily" error={error} onRetry={refetch} />;

  // Date navigation steps from the served edition (the last known-good date), not the requested
  // one, so a walk through an outage never stalls on empty days one click at a time.
  const anchor = servedDateKey || requested;
  const prev = addDaysKey(anchor, -1);
  const next = anchor < today ? addDaysKey(anchor, 1) : null;

  if (!brief) {
    // Nothing in the hook's ~30-day lookback either side of the request: a real gap, not a delay.
    return (
      <div className="daily-page daily-empty">
        <h1>No brief available</h1>
        <p>
          {requested === today
            ? 'No brief has been generated in the last month. This looks like a real gap, not a same-day delay.'
            : `No brief was published within about a month of ${requested} — this looks like a real gap in the archive, not a delay.`}
        </p>
        <div className="daily-empty-links">
          <Link to={dayHref(prev)}>← Previous day</Link>
          {next && <Link to={dayHref(next)}>Next day →</Link>}
          {dateParam && <Link to={dayHref(null)}>Latest available brief</Link>}
        </div>
      </div>
    );
  }

  const shownDate = brief.displayDate || servedDateKey || requested;
  const relLabel = relativeDayLabel(servedDateKey, today);
  const servedOlder = !!servedDateKey && servedDateKey !== requested;
  const stats = brief.stats || {};
  const countryTier = tierFromLevel(brief.countryToWatch?.riskLevel); // unknown level reads "Not scored"
  const catEntries = Object.entries(brief.categoryBreakdown || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const catMax = catEntries.length ? catEntries[0][1] : 1;
  const takeaways = deriveTakeaways(brief);
  const lead = firstSentences(brief.summary, 2);
  const fullParas = toParagraphs(brief.summary);
  const editionKey = servedDateKey || requested;

  return (
    <div className="daily-page">
      <div className="daily-topbar">
        <nav className="daily-date-nav" aria-label="Daily editions">
          <Link to={dayHref(prev)}>← Previous day</Link>
          <span className="daily-date-label">{shownDate}</span>
          {relLabel && <span className="daily-rel-tag">{relLabel}</span>}
          {next && <Link to={dayHref(next)}>Next day →</Link>}
          {dateParam && <Link to={dayHref(null)}>Latest</Link>}
        </nav>
        <div className="daily-topbar-right">
          <ShareButtons path={dayHref(editionKey)} title={`Daily Intelligence Brief — ${shownDate}`} />
          <CopyBriefing getText={() => formatDailyBrief(brief)} />
          <SaveButton itemType="daily" itemId={editionKey} metadata={{ headline: brief.headline, date: brief.displayDate }} />
        </div>
      </div>

      {/* Honest fallback: say plainly which edition is shown when it is not the one asked for. */}
      {servedOlder && (
        <div className="daily-fallback-note">
          {requested === today
            ? <>No new brief since <strong>{shownDate}</strong>{relLabel ? ` (${relLabel.toLowerCase()})` : ''} while analysis is paused.</>
            : <>No brief was published for <strong>{requested}</strong>; showing the nearest earlier edition, <strong>{shownDate}</strong>.</>}
        </div>
      )}

      <header className="daily-masthead">
        {/* "Today's Brief" only when the shown edition really is today's (F4, review R2). */}
        <h1 className="daily-masthead-h1">
          {servedDateKey === today
            ? <>Today's <em>Brief</em></>
            : <>Latest <em>Brief</em> · {shownDate}</>}
        </h1>
        <div className="daily-masthead-bar">
          {brief.generatedAt && <span>Generated <strong>{formatTimeAgo(brief.generatedAt)}</strong></span>}
          <span>AI-generated</span>
        </div>
      </header>

      {/* ① THE BIG PICTURE — the 10-second read */}
      <section className="daily-sec">
        <SectionHeader num="1" title="The Big Picture" meta="10-second read" />

        {brief.headline && (
          <div className="daily-verdict">
            <div className="daily-verdict-kicker">
              <span className="daily-kicker-pill">Lead Story</span>
              {brief.countryToWatch?.countryName && (
                <span className="daily-verdict-loc">· <EntityLink kind="country" id={brief.countryToWatch.countryName}>{brief.countryToWatch.countryName}</EntityLink></span>
              )}
            </div>
            <h2 className="daily-verdict-h3">{brief.headline}</h2>
            {lead && <p className="daily-verdict-lead">{lead}</p>}
          </div>
        )}

        {takeaways.length > 0 && (
          <div className="daily-callout">
            <div className="daily-callout-title">★ Key Takeaways</div>
            <ul className="daily-takeaways">
              {takeaways.map((t, i) => (
                <li key={i}>
                  <span className="daily-tk-n">{i + 1}</span>
                  <span>
                    {t.tag && <b className="daily-tk-tag">{t.tag}. </b>}
                    {t.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="daily-statgrid">
          {stats.totalArticles > 0 && (
            <div className="daily-statcard">
              <div className="daily-stat-val">{stats.totalArticles}</div>
              <div className="daily-stat-lbl">Articles</div>
              <div className="daily-stat-sub">24-hour window</div>
            </div>
          )}
          {stats.countriesCovered > 0 && (
            <div className="daily-statcard">
              <div className="daily-stat-val">{stats.countriesCovered}</div>
              <div className="daily-stat-lbl">Countries</div>
              <div className="daily-stat-sub">by signal breadth</div>
            </div>
          )}
          {stats.sourceOutlets > 0 && (
            <div className="daily-statcard">
              <div className="daily-stat-val">{stats.sourceOutlets}</div>
              <div className="daily-stat-lbl">Outlets</div>
              <div className="daily-stat-sub">wire + regional</div>
            </div>
          )}
          {catEntries.length > 0 && (
            <div className="daily-statcard">
              <div className="daily-stat-val">{catEntries.length}</div>
              <div className="daily-stat-lbl">Categories</div>
              <div className="daily-stat-sub">active today</div>
            </div>
          )}
        </div>
      </section>

      {/* ② TOP STORIES */}
      {brief.topStories?.length > 0 && (
        <section className="daily-sec">
          <SectionHeader
            num="2"
            title="Top Stories"
            meta={`${brief.topStories.length} item${brief.topStories.length !== 1 ? 's' : ''} · by signal breadth`}
          />
          <div className="daily-stories">
            {brief.topStories.map((story, i) => {
              const hasPred = !!story.prediction;
              const threadId = threadIdOf(story);
              return (
                <article key={i} className={`daily-story${hasPred ? '' : ' no-pred'}`}>
                  <div className="daily-story-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="daily-story-body">
                    <div className="daily-story-kicker">
                      <CategoryTag category={story.category} />
                      <PlaceLinks names={(story.regions || []).slice(0, 3)} className="daily-tag-region" />
                      {story.sourceCount > 0 && (
                        <span className="daily-tag-src">{story.sourceCount} source{story.sourceCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <h3 className="daily-story-h4">
                      {threadId ? <EntityLink kind="story" id={threadId} topic={peekInputForStory(story)}>{story.title}</EntityLink> : story.title}
                    </h3>
                  </div>
                  {hasPred && (
                    <aside className="daily-story-pred">
                      <div className="daily-story-pred-lbl">Prediction</div>
                      <p>{story.prediction}</p>
                    </aside>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ③ THE STORY TO WATCH — rising thread */}
      {brief.risingThread?.title && (
        <section className="daily-sec">
          <SectionHeader num="3" title="The Story to Watch" />
          <RisingThreadCard thread={brief.risingThread} />
        </section>
      )}

      {/* ④ COUNTRY TO WATCH */}
      {brief.countryToWatch?.countryName && (
        <section className="daily-sec">
          <SectionHeader num="4" title="Country to Watch" />
          <CountryCardLink name={brief.countryToWatch.countryName} className="daily-riskcard">
            <div className="daily-riskcard-flag">{brief.countryToWatch.countryName}</div>
            <div className="daily-riskcard-body">
              <div className="daily-riskcard-top">
                {brief.countryToWatch.riskLevel && <TierChip tier={countryTier} />}
                <Trajectory value={brief.countryToWatch.trajectory} className="daily-traj" />
              </div>
              {brief.countryToWatch.headline && (
                <div className="daily-riskcard-headline">{brief.countryToWatch.headline}</div>
              )}
              {countryHref(brief.countryToWatch.countryName) && <div className="daily-riskcard-cta">View full briefing →</div>}
            </div>
          </CountryCardLink>
        </section>
      )}

      {/* ⑤ SHAPE OF THE DAY — category breakdown */}
      {catEntries.length > 0 && (
        <section className="daily-sec">
          <SectionHeader num="5" title="Shape of the Day" meta="stories by category" />
          <div className="daily-bars">
            {catEntries.map(([cat, count]) => (
              <div key={cat} className="daily-bar-row">
                <span className="daily-bar-label">{cat}</span>
                <div className="daily-bar-track">
                  {/* fill = the category's crisis hue (type), dim grey when it maps to none */}
                  <div
                    className="daily-bar-fill"
                    style={{ width: `${Math.max(4, (count / catMax) * 100)}%`, '--bar-hue': crisisDotVar(cat) }}
                  />
                </div>
                <span className="daily-bar-val">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ⑥ FULL ANALYSIS — long-form, folded */}
      {fullParas.length > 0 && (
        <section className="daily-sec">
          <SectionHeader num="6" title="Full Analysis" meta="the complete synthesis" />
          <details className="daily-fullread">
            <summary>
              Read the full intelligence synthesis
              <span className="daily-chev">▾</span>
            </summary>
            <div className="daily-full-body">
              {fullParas.map((p, i) => <p key={i}><BoldText text={p} /></p>)}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
