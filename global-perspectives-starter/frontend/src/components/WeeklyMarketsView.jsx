// WeeklyMarketsView — the "This week" markets wrap, rendered as a calm editorial
// read. Shared by two surfaces: the /economy page's "This week" mode and the
// /weekly-markets permalink (which redirects into that mode). Data comes from
// useWeeklyMarkets (the latest human-published, quality-gated weekly report).
//
// House rules baked into the layout (the honesty contract):
//   • The % change + week start→end levels are deterministic, computed facts →
//     they are the visual anchor (gains green ▲, losses red ▼).
//   • Three grounding tiers must read as VISIBLY different trust levels:
//       coverage → our own analysis (note + linked stories w/ severity chips)
//       web      → external context, explicitly "not our analysis", cited
//       none     → honest "no clear driver found" — muted, never fabricated
//   • ~80% of movers are tier "none", so the few explained movers are FEATURED
//     up top (the stars) and the rest collapse into a compact, scannable list —
//     present, honest, but visually subordinate.
//   • Tagged as a reviewed/weekly wrap (NOT live) via the kicker + dateline.

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { threadPath } from '../utils/threadPath';
import { useWeeklyMarkets } from '../hooks/useWeeklyMarkets';
import './WeeklyMarketsView.css';

function formatWeekOf(weekKey) {
  if (!weekKey) return '';
  const d = new Date(weekKey + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return weekKey;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// The hero number — the realized weekly move. Two decimals: it is a computed
// fact, and the precision reads as credible. Never fabricated (returns — if null).
function formatPct(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function formatLevel(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const isExplained = (m) => m && (m.grounding === 'coverage' || m.grounding === 'web');

// Severity chip for an "Our coverage" thread. Economic-impact severity is its OWN
// taxonomy (severe/moderate/minor) — NOT the risk taxonomy (low/elevated/high) — so we
// color it with ink-shades via CSS classes, matching how EconomyPage renders severity.
const SEVERITY_LEVELS = new Set(['severe', 'moderate', 'minor']);
function SeverityChip({ severity }) {
  if (!severity) return null;
  const key = String(severity).toLowerCase();
  const cls = SEVERITY_LEVELS.has(key) ? ` wm-sev-${key}` : '';
  return <span className={`wm-sev${cls}`}>{key.toUpperCase()}</span>;
}

// The realized weekly move — green ▲ / red ▼, with the week range underneath.
// Shared by featured cards and compact rows so the anchor number renders identically.
function MoveStat({ m, size }) {
  const up = m.direction === 'up';
  return (
    <div className={`wm-move wm-move-${size}`}>
      <div className={`wm-change ${up ? 'wm-up' : 'wm-down'}`}>
        <span className="wm-arrow" aria-hidden="true">{up ? '▲' : '▼'}</span>
        {formatPct(m.changePct)}
      </div>
      <div className="wm-levels">
        {formatLevel(m.weekStart)} <span className="wm-levels-arrow">→</span> {formatLevel(m.weekEnd)}
        <span className="wm-dot">·</span> wk/wk
      </div>
    </div>
  );
}

// The grounding block for an EXPLAINED mover (coverage or web). The "none" tier
// never renders here — it lives inline in the compact list, by design.
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

  // grounding === 'web' — external context, explicitly NOT our analysis. The slot
  // is kept even though the tier is currently never emitted (intentionally off).
  const sources = Array.isArray(m.sources) ? m.sources : [];
  return (
    <div className="wm-ground wm-ground-web">
      <div className="wm-ground-label wm-label-web">Web context · not our analysis</div>
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

// FEATURED mover — the explained ones (coverage/web). The most "designed" block:
// name + big move stat, then the grounding analysis. These are the stars.
function FeaturedMover({ m }) {
  return (
    <article className="wm-feat" id={m.instrumentId}>
      <div className="wm-feat-top">
        <div className="wm-feat-id">
          <h3 className="wm-feat-name">{m.name || m.instrumentId}</h3>
          <span className="wm-feat-ticker">{m.instrumentId}</span>
        </div>
        <MoveStat m={m} size="lg" />
      </div>
      <Grounding m={m} />
    </article>
  );
}

// COMPACT mover — tier "none". An honest absence: present + anchorable, but
// visually subordinate so the explained movers above stay the stars. The muted
// "No clear driver found" tag must read as "we don't know", never as broken.
function CompactMover({ m }) {
  return (
    <div className="wm-row" id={m.instrumentId}>
      <div className="wm-row-id">
        <span className="wm-row-name">{m.name || m.instrumentId}</span>
        <span className="wm-row-ticker">{m.instrumentId}</span>
      </div>
      <MoveStat m={m} size="sm" />
      <span className="wm-nodriver">No clear driver found</span>
    </div>
  );
}

export default function WeeklyMarketsView() {
  const { report, loading, error } = useWeeklyMarkets();
  const movers = report && Array.isArray(report.movers) ? report.movers : null;
  const location = useLocation();

  // Deep-link support: #BRENT-style anchors must land on the right mover row even
  // though content loads async (so the browser's native hash-scroll misses). Once
  // movers render, scroll the anchored row into view. Both featured + compact rows
  // carry id={instrumentId}, so any cited instrument is reachable.
  useEffect(() => {
    if (!movers || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [movers, location.hash]);

  if (loading) {
    return (
      <div className="wm-view">
        <p className="wm-status">Loading the latest markets report…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="wm-view">
        <p className="wm-status">Couldn’t load the markets report right now. Please try again shortly.</p>
      </div>
    );
  }
  if (!report || !movers || movers.length === 0) {
    return (
      <div className="wm-view">
        <div className="wm-empty">
          <div className="wm-kicker">Reviewed weekly wrap</div>
          <h2 className="wm-h1">No weekly wrap published yet</h2>
          <p className="wm-status">
            The weekly markets wrap — the biggest realized moves and the vetted notes behind
            them — appears here once it’s reviewed and published. Check the live{' '}
            <Link className="wm-inline-link" to="/economy?view=today">Today</Link> view in the meantime.
          </p>
        </div>
      </div>
    );
  }

  const explained = movers.filter(isExplained);
  const unexplained = movers.filter((m) => !isExplained(m));
  const excludedN = Array.isArray(report.excluded) ? report.excluded.length : 0;

  return (
    <div className="wm-view">
      {/* ===== HEADER — tags the mode as reviewed/weekly, NOT live ===== */}
      <header className="wm-head">
        <div className="wm-kicker">
          Reviewed weekly wrap{report.asOf && <> · as of {report.asOf}</>}
        </div>
        <h2 className="wm-h1">What moved this week — and why</h2>
        <div className="wm-dateline">
          WEEK OF {formatWeekOf(report.weekOf).toUpperCase()} · {movers.length} MOVER{movers.length === 1 ? '' : 'S'}
        </div>
        <p className="wm-lede">
          The biggest realized moves over the week. Price changes are computed deterministically
          from our markets history — the trustworthy anchor. The few moves we can explain are
          featured first; the rest we list honestly, without inventing a reason.
        </p>
      </header>

      {/* ===== FEATURED — explained movers (the stars) ===== */}
      {explained.length > 0 && (
        <section className="wm-section">
          <div className="wm-sec">Explained moves <span className="wm-sec-n">{explained.length}</span></div>
          {explained.map((m) => <FeaturedMover key={m.instrumentId} m={m} />)}
        </section>
      )}

      {/* ===== COMPACT — honest "no clear driver" list ===== */}
      {unexplained.length > 0 && (
        <section className="wm-section">
          <div className="wm-sec wm-sec-muted">
            Moved without a clear driver <span className="wm-sec-n">{unexplained.length}</span>
          </div>
          <p className="wm-sec-note">
            Real moves we couldn’t tie to our coverage or a cited source. Shown for completeness —
            an honest “we don’t know”, not a verdict.
          </p>
          <div className="wm-list">
            {unexplained.map((m) => <CompactMover key={m.instrumentId} m={m} />)}
          </div>
        </section>
      )}

      {excludedN > 0 && (
        <p className="wm-excluded">
          {excludedN} tracked instrument{excludedN === 1 ? '' : 's'} excluded this week — history still accruing.
        </p>
      )}

      <div className="wm-foot">
        Price moves are computed deterministically from our markets history — never written by AI.
        “Our coverage” links our own analysis where a story cites the instrument. “Web context” is a
        self-searching LLM’s cited explanation, presented as candidate drivers — not our analysis and
        not asserted causation. Where neither exists, we say so rather than inventing a reason.
      </div>
    </div>
  );
}
