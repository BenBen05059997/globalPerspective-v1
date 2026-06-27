import { Link } from 'react-router-dom';
import { threadPath } from '../utils/threadPath';
import { useWeeklyMarkets } from '../hooks/useWeeklyMarkets';
import './WeeklyMarketsPage.css';

function formatWeekOf(weekKey) {
  if (!weekKey) return '';
  const d = new Date(weekKey + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return weekKey;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function formatPct(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function formatLevel(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Severity chip for an "Our coverage" thread. Economic-impact severity is its OWN
// taxonomy (severe/moderate/minor) — NOT the risk taxonomy (low/elevated/high) — so we
// color it with ink-shades, matching how EconomyPage renders severity, via CSS classes.
const SEVERITY_LEVELS = new Set(['severe', 'moderate', 'minor']);
function SeverityChip({ severity }) {
  if (!severity) return null;
  const key = String(severity).toLowerCase();
  const cls = SEVERITY_LEVELS.has(key) ? ` wm-sev-${key}` : '';
  return <span className={`wm-sev${cls}`}>{key.toUpperCase()}</span>;
}

// The grounding block — three VISIBLY DISTINCT trust tiers (the honesty contract):
//   coverage → our own analysis, links to the thread Economy tab
//   web      → self-search LLM context, explicitly NOT our analysis, cited
//   none     → honest "no clear driver found", never fabricated
function Grounding({ m }) {
  if (m.grounding === 'coverage') {
    const coverage = Array.isArray(m.coverage) ? m.coverage : [];
    return (
      <div className="wm-ground wm-ground-coverage">
        <div className="wm-ground-label wm-label-coverage">Our coverage</div>
        {m.note && <p className="wm-note">{m.note}</p>}
        {coverage.length > 0 && (
          <ul className="wm-cov-list">
            {coverage.map((c, i) => (
              <li className="wm-cov-row" key={c.threadId || i}>
                <Link className="wm-cov-link" to={threadPath(c.threadId, { tab: 'economy' })}>
                  {c.headline || 'View coverage'} →
                </Link>
                <SeverityChip severity={c.severity} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (m.grounding === 'web') {
    const sources = Array.isArray(m.sources) ? m.sources : [];
    return (
      <div className="wm-ground wm-ground-web">
        <div className="wm-ground-label wm-label-web">Web context (not our analysis)</div>
        {m.note && <p className="wm-note">{m.note}</p>}
        {sources.length > 0 && (
          <div className="wm-src">
            <span className="wm-src-label">Sources:</span>{' '}
            {sources.map((s, i) => (
              <span key={s.url || i}>
                {i > 0 && <span className="wm-dot">·</span>}
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // grounding === 'none' (or unknown) — honest, muted.
  return (
    <div className="wm-ground wm-ground-none">
      <div className="wm-ground-label wm-label-none">No clear driver found</div>
    </div>
  );
}

function MoverRow({ m }) {
  const up = m.direction === 'up';
  return (
    <div className="wm-mover" id={m.instrumentId}>
      <div className="wm-mover-top">
        <div className="wm-mover-name">{m.name || m.instrumentId}</div>
        <div className={`wm-change ${up ? 'wm-up' : 'wm-down'}`}>
          <span className="wm-arrow">{up ? '▲' : '▼'}</span>
          {formatPct(m.changePct)}
        </div>
      </div>
      <div className="wm-levels">
        {formatLevel(m.weekStart)} <span className="wm-levels-arrow">→</span> {formatLevel(m.weekEnd)}
        <span className="wm-dot">·</span> week-over-week
      </div>
      <Grounding m={m} />
    </div>
  );
}

export default function WeeklyMarketsPage() {
  const { report, loading, error } = useWeeklyMarkets();
  const movers = report && Array.isArray(report.movers) ? report.movers : null;

  return (
    <div className="wm-page">
      <div className="wm-wrap">
        <div className="wm-head">
          <div className="wm-eyebrow">Weekly Markets Report</div>
          <Link className="wm-xlink" to="/economy">Live dashboard →</Link>
        </div>

        {loading ? (
          <p className="wm-status">Loading the latest markets report…</p>
        ) : error ? (
          <p className="wm-status">Couldn’t load the markets report right now. Please try again shortly.</p>
        ) : !report || !movers ? (
          <div className="wm-empty">
            <h1 className="wm-h1">No markets report published yet</h1>
            <p className="wm-status">The weekly markets wrap will appear here once it’s published.</p>
          </div>
        ) : (
          <>
            <div className="wm-dateline">
              WEEK OF {formatWeekOf(report.weekOf).toUpperCase()}
              {report.asOf && <> · AS OF {report.asOf}</>} · {movers.length} MOVERS
            </div>
            <h1 className="wm-h1">What moved this week — and why</h1>

            <div className="wm-sec">This week’s movers</div>
            {movers.map((m) => <MoverRow key={m.instrumentId} m={m} />)}

            <div className="wm-foot">
              Price moves are computed deterministically from our markets history — never written by AI. “Our coverage” links our own analysis where a story cites the instrument. “Web context” is a self-searching LLM’s cited explanation, presented as candidate drivers, not our analysis and not asserted causation. Where neither exists, we say so rather than inventing a reason.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
