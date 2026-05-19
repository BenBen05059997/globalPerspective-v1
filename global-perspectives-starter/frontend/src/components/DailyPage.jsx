import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import InstrumentChip from './atoms/InstrumentChip';
import SeverityBadge from './atoms/SeverityBadge';
import { CATEGORY_BADGE_COLORS, RISK_COLORS } from './WeeklyPage';
import ShareButtons from './ShareButtons';
import CopyBriefing, { formatDailyBrief } from './CopyBriefing';
import { SaveButton } from './SaveButton';
import IntelligenceLoader from './IntelligenceLoader';
import './DailyPage.css';

const TRAJECTORY_LABELS = {
  escalating:      { arrow: '↗', label: 'Escalating',      color: 'var(--risk-h)' },
  stable:          { arrow: '→', label: 'Stable',           color: 'var(--ink-dim)' },
  'de-escalating': { arrow: '↘', label: 'De-escalating',   color: 'var(--risk-l)' },
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
    <section className="daily-footprint">
      <div className="daily-footprint-hd">
        <h3>Today's Economic Footprint</h3>
        <span className="daily-footprint-meta">
          {disruptions.length} active · {severeCount > 0 && <><b style={{ color: 'var(--risk-h)' }}>{severeCount} severe</b> · </>}
          <Link to="/economy">View all →</Link>
        </span>
      </div>

      {topInstruments.length > 0 && (
        <div className="daily-footprint-chips">
          {topInstruments.map(i => (
            <InstrumentChip key={i.instrumentId} instrument={i} marketSnap={i.marketSnap} compact />
          ))}
        </div>
      )}

      {leadHeadline && (
        <p className="daily-footprint-lead">
          <SeverityBadge level={disruptions[0].severity} size="sm" /> {leadHeadline}
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

  const { brief, loading } = useDailyBrief(dateKey);

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

  // Footprint will be rendered inside the page body below

  const countryRisk = brief.countryToWatch?.riskLevel
    ? (RISK_COLORS[brief.countryToWatch.riskLevel] || RISK_COLORS.moderate)
    : null;
  const topPred = brief.topStories?.[0]?.prediction || null;
  const catEntries = Object.entries(brief.categoryBreakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="daily-page">

      {/* Date nav topbar */}
      <div className="daily-topbar">
        <Link to="/">← Home</Link>
        <div className="daily-date-nav">
          <Link to={`/daily/${prev}`} className="daily-date-arrow" title="Previous day">←</Link>
          <span className="daily-date-label">{brief.displayDate || dateKey}</span>
          {!isToday && <Link to={`/daily/${next}`} className="daily-date-arrow" title="Next day">→</Link>}
          {!isToday && <Link to="/daily">Today</Link>}
        </div>
        <div className="daily-topbar-right">
          <ShareButtons path={`/daily/${dateKey}`} title={`Daily Intelligence Brief — ${brief.displayDate}`} />
          <CopyBriefing getText={() => formatDailyBrief(brief)} />
          <SaveButton itemType="daily" itemId={dateKey} metadata={{ headline: brief.headline, date: brief.displayDate }} />
        </div>
      </div>

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
          <div className="daily-masthead-counts">
            {stats.totalArticles > 0 && (
              <span className="dc">
                <span className="daily-masthead-num">{stats.totalArticles}</span>
                articles
              </span>
            )}
            {stats.countriesCovered > 0 && (
              <span className="dc">
                <span className="daily-masthead-num">{stats.countriesCovered}</span>
                countries
              </span>
            )}
            {stats.sourceOutlets > 0 && (
              <span className="dc">
                <span className="daily-masthead-num">{stats.sourceOutlets}</span>
                outlets
              </span>
            )}
          </div>
          <span>AI-generated · analyst-reviewed</span>
        </div>
      </header>

      {/* Lead story */}
      {brief.headline && (
        <section className={`daily-headline${topPred ? '' : ' no-pred'}`}>
          <div className="daily-headline-left">
            <div className="daily-headline-kicker">
              <span className="daily-kicker-pill">Lead Story</span>
              {brief.countryToWatch?.countryName && (
                <span>{brief.countryToWatch.countryName}</span>
              )}
            </div>
            <h2 className="daily-headline-h2">{brief.headline}</h2>
            {brief.summary && (
              <p className="daily-headline-deck">
                <BoldText text={brief.summary} />
              </p>
            )}
            <div className="daily-headline-meta">
              {stats.countriesCovered > 0 && (
                <span>Countries <b>{stats.countriesCovered}</b></span>
              )}
              {stats.sourceOutlets > 0 && (
                <span>Sources <b>{stats.sourceOutlets}</b></span>
              )}
              {brief.generatedAt && (
                <span>Updated <b>{formatTimeAgo(brief.generatedAt)}</b></span>
              )}
            </div>
          </div>

          {topPred && (
            <aside className="daily-predict-box">
              <div className="daily-predict-ph">
                <span className="hz">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 13l4-4 3 3 5-6"/><path d="M11 6h3v3"/>
                  </svg>
                  AI Prediction
                </span>
                <span>Lead story</span>
              </div>
              <div className="daily-predict-pb">
                <div className="daily-predict-lbl">Forecast</div>
                <p>{topPred}</p>
              </div>
              <div className="daily-predict-ac">
                <span>Forecast model v1.2</span>
                <span>Updates as sources shift</span>
              </div>
            </aside>
          )}
        </section>
      )}

      <EconomicFootprint />

      {/* Top Stories */}
      {brief.topStories?.length > 0 && (
        <section className="daily-stories">
          <div className="daily-stories-hd">
            <h3>Top Stories</h3>
            <span className="daily-stories-n">
              {brief.topStories.length} item{brief.topStories.length !== 1 ? 's' : ''} · ordered by signal breadth
            </span>
          </div>

          {brief.topStories.map((story, i) => {
            const catColors = CATEGORY_BADGE_COLORS[(story.category || '').toLowerCase()];
            const hasPred = !!story.prediction;
            return (
              <article key={i} className={`daily-story${hasPred ? '' : ' no-pred'}`}>
                <div className="daily-story-num">{String(i + 1).padStart(2, '0')}</div>

                <div className="daily-story-body">
                  <div className="daily-story-kicker">
                    {story.category && <span className="daily-story-cat">{story.category}</span>}
                    {(story.regions || []).slice(0, 3).map((r, j) => (
                      <span key={j} className="daily-story-kicker-region">{r}</span>
                    ))}
                    {story.sourceCount > 0 && (
                      <span style={{ color: 'var(--ink-faint)' }}>{story.sourceCount} source{story.sourceCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <h4 className="daily-story-h4">{story.title}</h4>
                  {(story.regions || []).length > 0 && (
                    <div className="daily-story-regions">
                      {(story.regions || []).slice(0, 5).map((r, j) => (
                        <Link key={j} to={`/weekly/country/${encodeURIComponent(r)}`} className="daily-story-region">{r}</Link>
                      ))}
                    </div>
                  )}
                </div>

                {hasPred && (
                  <aside className="daily-story-pred">
                    <div className="daily-story-pred-lbl">
                      <span>Prediction</span>
                    </div>
                    <p>{story.prediction}</p>
                  </aside>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* Rising Thread */}
      {brief.risingThread?.title && (
        <Link
          to={brief.risingThread.threadId ? `/weekly/thread/${brief.risingThread.threadId}` : '/weekly'}
          className="daily-rising"
        >
          <div className="daily-rising-badge">
            <span>Rising Thread</span>
            {risingTraj && (
              <span className="daily-rising-traj" style={{ color: risingTraj.color }}>
                {risingTraj.arrow} {risingTraj.label}
              </span>
            )}
            {brief.risingThread.articleCount > 0 && (
              <span style={{ color: 'var(--ink-dim)' }}>
                {brief.risingThread.articleCount} articles · {brief.risingThread.dayCount || '?'} days
              </span>
            )}
          </div>
          <div className="daily-rising-h4">{brief.risingThread.title}</div>
          {brief.risingThread.oneLiner && (
            <div className="daily-rising-deck">{brief.risingThread.oneLiner}</div>
          )}
          <div className="daily-rising-cta">Read full arc →</div>
        </Link>
      )}

      {/* Country to Watch */}
      {brief.countryToWatch?.countryName && (
        <div>
          <div className="daily-country-section-lbl">Country to Watch</div>
          <Link
            to={`/weekly/country/${encodeURIComponent(brief.countryToWatch.countryName)}`}
            className="daily-country"
            style={countryRisk ? { borderColor: countryRisk.color } : {}}
          >
            <div className="daily-country-top">
              <span className="daily-country-name">{brief.countryToWatch.countryName}</span>
              {countryRisk && (
                <span
                  className="daily-risk-badge"
                  style={{ background: countryRisk.bg, color: countryRisk.color }}
                >
                  {brief.countryToWatch.riskLevel}
                </span>
              )}
            </div>
            {brief.countryToWatch.headline && (
              <div className="daily-country-headline">{brief.countryToWatch.headline}</div>
            )}
            <div className="daily-country-cta">View full briefing →</div>
          </Link>
        </div>
      )}

      {/* Method */}
      <section className="daily-method">
        <div className="daily-method-grid">
          <div className="daily-method-item">
            <div className="daily-method-lbl">Articles scanned</div>
            <div className="daily-method-val">{stats.totalArticles || '—'}</div>
            <p>Across {stats.sourceOutlets || '?'} outlets in 24h window.</p>
          </div>
          <div className="daily-method-item">
            <div className="daily-method-lbl">Countries covered</div>
            <div className="daily-method-val">{stats.countriesCovered || '—'}</div>
            <p>Ranked by signal breadth, not volume.</p>
          </div>
          <div className="daily-method-item">
            <div className="daily-method-lbl">Outlets</div>
            <div className="daily-method-val">{stats.sourceOutlets || '—'}</div>
            <p>International wire services + regional sources.</p>
          </div>
          <div className="daily-method-item">
            <div className="daily-method-lbl">Categories</div>
            <div className="daily-method-val">{catEntries.length || '—'}</div>
            <p>Predictions are probabilistic, not advice.</p>
          </div>
        </div>
      </section>

      {/* Category Breakdown */}
      {catEntries.length > 0 && (
        <div className="daily-cats">
          <div className="daily-cats-lbl">Category Breakdown</div>
          <div className="daily-cats-grid">
            {catEntries.map(([cat, count]) => {
              const c = CATEGORY_BADGE_COLORS[cat];
              return (
                <span key={cat} className="daily-cat-pill">
                  {c && <span className="daily-cat-dot" style={{ background: c.color }} />}
                  {cat} <b>{count}</b>
                </span>
              );
            })}
          </div>
        </div>
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
