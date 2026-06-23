import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import InstrumentChip from './atoms/InstrumentChip';
import SeverityBadge from './atoms/SeverityBadge';
import { CATEGORY_BADGE_COLORS, RISK_COLORS } from '../tokens';
import ShareButtons from './ShareButtons';
import CopyBriefing, { formatDailyBrief } from './CopyBriefing';
import { SaveButton } from './SaveButton';
import IntelligenceLoader from './IntelligenceLoader';
import './DailyPage.css';

const TRAJECTORY_LABELS = {
  escalating:      { arrow: '↗', label: 'Escalating',      cls: 'up' },
  stable:          { arrow: '→', label: 'Stable',           cls: 'flat' },
  'de-escalating': { arrow: '↘', label: 'De-escalating',   cls: 'down' },
};

function BoldText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )}</>;
}

function prevDateKey(dk) {
  const d = new Date(dk + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
// Relative label for how old the *served* brief is vs today (UTC day diff).
// Returns null when it's actually today's brief.
function relativeDayLabel(servedKey, todayKey) {
  if (!servedKey || servedKey === todayKey) return null;
  const a = new Date(servedKey + 'T00:00:00Z').getTime();
  const b = new Date(todayKey + 'T00:00:00Z').getTime();
  const days = Math.round((b - a) / 86400000);
  if (days <= 0) return null;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
function nextDateKey(dk) {
  const d = new Date(dk + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function formatTimeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Strip markdown bold markers for plain-text contexts (e.g. the trimmed lead).
function stripBold(text) {
  return (text || '').replace(/\*\*([^*]+)\*\*/g, '$1');
}
// First N sentences of a longer block — used for the trimmed lead so the
// "Big Picture" verdict stays short; the full summary lives in Full Analysis.
function firstSentences(text, n = 2) {
  const clean = stripBold(text).trim();
  if (!clean) return '';
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return clean;
  return sentences.slice(0, n).join(' ').trim();
}
// Split the long summary into real paragraphs for the Full Analysis block.
function toParagraphs(text) {
  return (text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

// Key Takeaways — the scannable 10-second read.
// Prefer a server-generated `keyPoints` array; otherwise derive an honest list
// from the structured fields the brief already carries (no fabrication —
// these are the real rising thread, country watch, and top story headlines).
function deriveTakeaways(brief) {
  if (Array.isArray(brief.keyPoints) && brief.keyPoints.length) {
    return brief.keyPoints.slice(0, 4).map(p =>
      typeof p === 'string' ? { text: p } : p
    );
  }
  const out = [];
  if (brief.risingThread?.oneLiner) {
    out.push({ tag: 'Rising', text: brief.risingThread.oneLiner });
  }
  if (brief.countryToWatch?.headline) {
    out.push({ tag: brief.countryToWatch.countryName, text: brief.countryToWatch.headline });
  }
  for (const s of (brief.topStories || [])) {
    if (out.length >= 4) break;
    if (!s?.title) continue;
    // skip the lead — already implied by the verdict headline
    if (s.title === brief.headline) continue;
    out.push({ tag: s.category, text: s.title });
  }
  return out.slice(0, 4);
}

function SectionHeader({ num, title, meta }) {
  return (
    <div className="daily-sec-hd">
      <span className="daily-sec-num">{num}</span>
      <h2>{title}</h2>
      {meta && <span className="daily-sec-meta">{meta}</span>}
    </div>
  );
}

function EconomicFootprint() {
  const { data: disruptions = [] } = useDisruptionsList({ limit: 50 });

  // Aggregate: pick top 5 instruments by citation count across active disruptions,
  // average direction (consensus) for each.
  const topInstruments = useMemo(() => {
    const agg = {};
    for (const d of disruptions) {
      for (const inst of (d.instruments || [])) {
        if (!inst.instrumentId) continue;
        if (!agg[inst.instrumentId]) {
          agg[inst.instrumentId] = {
            instrumentId: inst.instrumentId,
            citations: 0,
            up: 0, down: 0, mixed: 0,
            example: inst,
            marketSnap: d.marketContext?.[inst.instrumentId],
          };
        }
        agg[inst.instrumentId].citations++;
        const dir = inst.direction || 'mixed';
        if (agg[inst.instrumentId][dir] != null) agg[inst.instrumentId][dir]++;
      }
    }
    const top = Object.values(agg)
      .map(a => {
        const counts = { up: a.up, down: a.down, mixed: a.mixed };
        const consensus = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] || 'mixed';
        return {
          instrumentId: a.instrumentId,
          direction: consensus,
          magnitude: a.example.magnitude || 'moderate',
          rationale: a.example.rationale,
          marketSnap: a.marketSnap,
          citations: a.citations,
        };
      })
      .sort((x, y) => y.citations - x.citations)
      .slice(0, 5);
    return top;
  }, [disruptions]);

  const severeCount = disruptions.filter(d => d.severity === 'severe').length;
  const leadHeadline = disruptions[0]?.headline || null;

  if (disruptions.length === 0) return null;

  return (
    <section className="daily-sec">
      <SectionHeader
        num="5"
        title="Economic Footprint"
        meta={`${disruptions.length} active${severeCount > 0 ? ` · ${severeCount} severe` : ''}`}
      />

      {topInstruments.length > 0 && (
        <div className="daily-footprint-chips">
          {topInstruments.map(i => (
            <InstrumentChip key={i.instrumentId} instrument={i} marketSnap={i.marketSnap} compact />
          ))}
        </div>
      )}

      {leadHeadline && (
        <p className="daily-footprint-lead">
          <SeverityBadge level={disruptions[0].severity} size="sm" />{' '}
          {disruptions[0].scopeId ? (
            <Link
              to={`/weekly/thread/${encodeURIComponent(disruptions[0].scopeId)}?tab=economy`}
              style={{ color: 'inherit' }}
            >
              {leadHeadline}
            </Link>
          ) : leadHeadline}
          {' '}
          <Link to="/economy" className="daily-footprint-all">View all →</Link>
        </p>
      )}
    </section>
  );
}

export default function DailyPage() {
  const { dateKey: paramDateKey } = useParams();
  const { loading: authLoading } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const dateKey = paramDateKey || today;
  const isToday = dateKey === today;
  const prev = prevDateKey(dateKey);
  const next = nextDateKey(dateKey);

  const { brief, servedDateKey, loading } = useDailyBrief(dateKey);
  // The served brief may be older than the requested date (today's isn't
  // generated until end of day; the hook falls back up to 7 days).
  const relLabel = relativeDayLabel(servedDateKey, today);
  const servedIsOlderThanRequest = servedDateKey && servedDateKey !== dateKey;

  useEffect(() => {
    const title = brief?.displayDate || dateKey;
    document.title = `Daily Brief — ${title} | Global Perspectives`;
  }, [brief, dateKey]);

  if (authLoading) return null;
  if (loading) return <IntelligenceLoader type="typewriter" />;

  if (!brief) {
    return (
      <div className="daily-page daily-empty">
        <h3>No brief available</h3>
        <p>
          {isToday
            ? "Today's brief hasn't been generated yet. It publishes daily — check back soon."
            : `No brief found for ${dateKey}.`}
        </p>
        <div className="daily-empty-links">
          <Link to={`/daily/${prev}`}>← Previous day</Link>
          {!isToday && <Link to="/daily">Today's brief</Link>}
        </div>
      </div>
    );
  }

  const stats = brief.stats || {};
  const risingTraj = brief.risingThread?.trajectory
    ? (TRAJECTORY_LABELS[brief.risingThread.trajectory] || TRAJECTORY_LABELS.stable)
    : null;
  const countryRisk = brief.countryToWatch?.riskLevel
    ? (RISK_COLORS[brief.countryToWatch.riskLevel] || RISK_COLORS.moderate)
    : null;
  const catEntries = Object.entries(brief.categoryBreakdown || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const catMax = catEntries.length ? catEntries[0][1] : 1;

  const takeaways = deriveTakeaways(brief);
  const lead = firstSentences(brief.summary, 2);
  const fullParas = toParagraphs(brief.summary);

  return (
    <div className="daily-page">

      {/* Date nav topbar */}
      <div className="daily-topbar">
        <Link to="/">← Home</Link>
        <div className="daily-date-nav">
          <Link to={`/daily/${prev}`} className="daily-date-arrow" title="Previous day">←</Link>
          <span className="daily-date-label">{brief.displayDate || servedDateKey || dateKey}</span>
          {relLabel && <span className="daily-rel-tag">{relLabel}</span>}
          {!isToday && <Link to={`/daily/${next}`} className="daily-date-arrow" title="Next day">→</Link>}
          {!isToday && <Link to="/daily">Today</Link>}
        </div>
        <div className="daily-topbar-right">
          <ShareButtons path={`/daily/${dateKey}`} title={`Daily Intelligence Brief — ${brief.displayDate}`} />
          <CopyBriefing getText={() => formatDailyBrief(brief)} />
          <SaveButton itemType="daily" itemId={dateKey} metadata={{ headline: brief.headline, date: brief.displayDate }} />
        </div>
      </div>

      {/* Honest fallback notice — requested "today" but today's brief isn't out yet */}
      {isToday && servedIsOlderThanRequest && (
        <div className="daily-fallback-note">
          Today&rsquo;s brief publishes at the end of the day — showing{' '}
          <strong>{brief.displayDate || servedDateKey}</strong>
          {relLabel ? ` (${relLabel.toLowerCase()})` : ''}.
        </div>
      )}

      {/* Masthead */}
      <header className="daily-masthead">
        <div className="daily-masthead-top">
          <span>Daily Intelligence Brief</span>
          <span className="daily-masthead-center">Global Perspectives™</span>
          <span>{brief.displayDate || dateKey}</span>
        </div>
        <h1 className="daily-masthead-h1">Today's <em>Brief</em></h1>
        <div className="daily-masthead-sub">
          A single read on what the world's newsroom cycle was actually about.
        </div>
        <div className="daily-masthead-bar">
          <span>
            {brief.generatedAt
              ? <>Generated <strong>{formatTimeAgo(brief.generatedAt)}</strong></>
              : 'AI-generated'}
          </span>
          <span>AI-generated · analyst-reviewed</span>
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
                <span className="daily-verdict-loc">· {brief.countryToWatch.countryName}</span>
              )}
            </div>
            <h3 className="daily-verdict-h3">{brief.headline}</h3>
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
              return (
                <article key={i} className={`daily-story${hasPred ? '' : ' no-pred'}`}>
                  <div className="daily-story-num">{String(i + 1).padStart(2, '0')}</div>

                  <div className="daily-story-body">
                    <div className="daily-story-kicker">
                      {story.category && <span className="daily-tag daily-tag-cat">{story.category}</span>}
                      {(story.regions || []).slice(0, 3).map((r, j) => (
                        <Link key={j} to={`/weekly/country/${encodeURIComponent(r)}`} className="daily-tag daily-tag-region">{r}</Link>
                      ))}
                      {story.sourceCount > 0 && (
                        <span className="daily-tag-src">{story.sourceCount} source{story.sourceCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <h4 className="daily-story-h4">{story.title}</h4>
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
          <Link
            to={/^thread-/.test(brief.risingThread.threadId || '') ? `/weekly/thread/${brief.risingThread.threadId}` : '/weekly'}
            className="daily-highlight"
          >
            <div className="daily-highlight-kicker">
              <span>Rising Thread</span>
              {risingTraj && (
                <span className={`daily-highlight-traj ${risingTraj.cls}`}>
                  {risingTraj.arrow} {risingTraj.label}
                </span>
              )}
              {brief.risingThread.articleCount > 0 && (
                <span className="daily-highlight-meta">
                  {brief.risingThread.articleCount} articles · {brief.risingThread.dayCount || '?'} days
                </span>
              )}
            </div>
            <h3 className="daily-highlight-h3">{brief.risingThread.title}</h3>
            {brief.risingThread.oneLiner && (
              <p className="daily-highlight-deck">{brief.risingThread.oneLiner}</p>
            )}
            <span className="daily-highlight-cta">Read full arc →</span>
          </Link>
        </section>
      )}

      {/* ④ COUNTRY TO WATCH */}
      {brief.countryToWatch?.countryName && (
        <section className="daily-sec">
          <SectionHeader num="4" title="Country to Watch" />
          <Link
            to={`/weekly/country/${encodeURIComponent(brief.countryToWatch.countryName)}`}
            className="daily-riskcard"
            style={countryRisk ? { borderLeftColor: countryRisk.color } : {}}
          >
            <div className="daily-riskcard-flag">{brief.countryToWatch.countryName}</div>
            <div className="daily-riskcard-body">
              <div className="daily-riskcard-top">
                {countryRisk && (
                  <span
                    className="daily-badge-risk"
                    style={{ background: countryRisk.bg, color: countryRisk.color }}
                  >
                    {brief.countryToWatch.riskLevel} risk
                  </span>
                )}
                {brief.countryToWatch.trajectory && TRAJECTORY_LABELS[brief.countryToWatch.trajectory] && (
                  <span className={`daily-traj ${TRAJECTORY_LABELS[brief.countryToWatch.trajectory].cls}`}>
                    {TRAJECTORY_LABELS[brief.countryToWatch.trajectory].arrow} {TRAJECTORY_LABELS[brief.countryToWatch.trajectory].label}
                  </span>
                )}
              </div>
              {brief.countryToWatch.headline && (
                <div className="daily-riskcard-headline">{brief.countryToWatch.headline}</div>
              )}
              <div className="daily-riskcard-cta">View full briefing →</div>
            </div>
          </Link>
        </section>
      )}

      {/* ⑤ ECONOMIC FOOTPRINT */}
      <EconomicFootprint />

      {/* ⑥ SHAPE OF THE DAY — category breakdown */}
      {catEntries.length > 0 && (
        <section className="daily-sec">
          <SectionHeader num="6" title="Shape of the Day" meta="stories by category" />
          <div className="daily-bars">
            {catEntries.map(([cat, count]) => {
              const c = CATEGORY_BADGE_COLORS[cat];
              return (
                <div key={cat} className="daily-bar-row">
                  <span className="daily-bar-label">{cat}</span>
                  <div className="daily-bar-track">
                    <div
                      className="daily-bar-fill"
                      style={{ width: `${Math.max(4, (count / catMax) * 100)}%`, background: c?.color || 'var(--ink)' }}
                    />
                  </div>
                  <span className="daily-bar-val">{count}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ⑦ FULL ANALYSIS — long-form, folded */}
      {fullParas.length > 0 && (
        <section className="daily-sec">
          <SectionHeader num="7" title="Full Analysis" meta="the complete synthesis" />
          <details className="daily-fullread">
            <summary>
              Read the full intelligence synthesis
              <span className="daily-chev">▾</span>
            </summary>
            <div className="daily-full-body">
              {fullParas.map((p, i) => (
                <p key={i}><BoldText text={p} /></p>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Footer nav */}
      <div className="daily-footer-nav">
        <Link to={`/daily/${prev}`}>← Previous day</Link>
        <Link to="/weekly">Weekly Analysis →</Link>
        {!isToday
          ? <Link to={`/daily/${next}`}>Next day →</Link>
          : <span className="daily-fn-muted">Latest</span>
        }
      </div>
    </div>
  );
}
