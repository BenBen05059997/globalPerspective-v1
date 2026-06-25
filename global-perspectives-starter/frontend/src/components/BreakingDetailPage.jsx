import { useParams, Link } from 'react-router-dom';
import { useBreakingAlert } from '../hooks/useBreakingAlert';
import SourceRobustness from './atoms/SourceRobustness';
import Markdown from './Markdown';
import './BreakingPage.css';

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Mirror the email renderer's trace normalization (newsBreakingAlert/render.js):
// surface only the parts of the structured TRACE_CAUSE worth showing. Returns null
// when there is nothing usable → the whole section is omitted (honesty contract).
function normalizeTrace(tc) {
  if (!tc || typeof tc !== 'object') return null;
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  const trigger = s(tc.proximate && tc.proximate.what);
  const when = s(tc.proximate && tc.proximate.when);
  const building = (Array.isArray(tc.contributing) ? tc.contributing : [])
    .map((c) => ({ factor: s(c && c.factor), evidence: s(c && c.evidence) }))
    .filter((c) => c.factor)
    .slice(0, 2);
  const root = s(tc.structural && tc.structural.factor);
  const depth = s(tc.structural && tc.structural.depth);
  const altAngle = s(tc.alternativePerspective);
  const verdict = s(tc.signalVsNoise && tc.signalVsNoise.verdict);
  const confidence = s(tc.signalVsNoise && tc.signalVsNoise.confidence);
  if (!trigger && !building.length && !root) return null;
  return { trigger, when, building, root, depth, altAngle, verdict, confidence };
}

function MarketPill({ economic }) {
  if (!economic || !economic.direction || !economic.magnitude) return null;
  const arrow = economic.direction === 'up' ? '▲' : economic.direction === 'down' ? '▼' : '◆';
  return (
    <span className="bk-pill">
      {arrow}&nbsp; Market impact: {economic.magnitude} move, {economic.direction}
    </span>
  );
}

export default function BreakingDetailPage() {
  const { id } = useParams();
  const { alert, loading, endpointMissing } = useBreakingAlert(id);

  if (loading) {
    return <div className="bk-wrap"><div className="bk-skel" /></div>;
  }

  // No alert (unknown id, unconfirmed, or endpoint unset) → honest not-found, never a placeholder.
  if (!alert) {
    return (
      <div className="bk-wrap">
        <Link to="/breaking" className="bk-back">← All breaking alerts</Link>
        <div className="bk-empty">
          <h2>This alert isn’t available</h2>
          <p>
            {endpointMissing
              ? 'Breaking alerts aren’t configured on this site yet.'
              : 'It may have expired, or the link is no longer valid.'}
          </p>
        </div>
      </div>
    );
  }

  const story = alert.story || {};
  const trace = normalizeTrace(story.traceCause);
  const tags = [alert.category, ...(alert.regions || [])].filter(Boolean);
  const sources = Array.isArray(story.sources) ? story.sources.filter((s) => s && s.url) : [];

  return (
    <div className="bk-wrap">
      <Link to="/breaking" className="bk-back">← All breaking alerts</Link>

      <article className="bk-card">
        <header className="bk-head">
          <span className="bk-chip">BREAKING</span>
          {alert.at && <span className="bk-time">{relTime(alert.at)}</span>}
        </header>

        {tags.length > 0 && (
          <div className="bk-tags">
            {alert.category && <span className="bk-cat">{alert.category}</span>}
            {(alert.regions || []).map((r) => (
              <Link key={r} className="bk-region" to={`/weekly/country/${encodeURIComponent(r)}`}>{r}</Link>
            ))}
          </div>
        )}

        <h1 className="bk-title">{alert.title}</h1>

        <div className="bk-trust">
          <SourceRobustness outlets={alert.outletCount} sources={alert.sourceCount} regions={(alert.regions || []).length} size="md" />
          {(alert.regions || []).length > 0 && (
            <Link to="/map" className="bk-maplink">See on the map →</Link>
          )}
        </div>

        {alert.editorNote && <p className="bk-note">{alert.editorNote}</p>}

        {/* Legacy records (pre-structured-fields) only carry the rendered email text. */}
        {!alert.story && alert.fallbackText && (
          <div className="bk-section"><Markdown text={alert.fallbackText} /></div>
        )}

        {story.summary && (
          <section className="bk-section">
            <h2 className="bk-label">What happened</h2>
            <Markdown text={story.summary} />
          </section>
        )}

        {trace && (
          <section className="bk-section">
            <h2 className="bk-label">How we got here</h2>
            {trace.trigger && (
              <p className="bk-trace"><span>Trigger:</span> {trace.trigger}{trace.when ? ` (${trace.when})` : ''}</p>
            )}
            {trace.building.map((b, i) => (
              <p className="bk-trace" key={i}><span>Building:</span> {b.factor}{b.evidence ? ` — ${b.evidence}` : ''}</p>
            ))}
            {trace.root && (
              <p className="bk-trace"><span>Root cause:</span> {trace.root}{trace.depth ? ` (${trace.depth})` : ''}</p>
            )}
            {trace.altAngle && (
              <div className="bk-angle"><span>Underreported angle:</span> {trace.altAngle}</div>
            )}
            {trace.verdict && (
              <p className="bk-signal">Signal vs noise: {trace.verdict}{trace.confidence ? ` · ${trace.confidence} confidence` : ''}</p>
            )}
          </section>
        )}

        {story.prediction && (
          <section className="bk-section">
            <h2 className="bk-label">Our read — what comes next</h2>
            <Markdown text={story.prediction} />
          </section>
        )}

        {story.economic && (
          <div className="bk-section"><MarketPill economic={story.economic} /></div>
        )}

        {alert.hasArc && alert.threadId && (
          <div className="bk-section">
            <Link to={`/weekly/thread/${encodeURIComponent(alert.threadId)}`} className="bk-arc">
              Read the full story arc →
            </Link>
          </div>
        )}

        {sources.length > 0 && (
          <section className="bk-section">
            <h2 className="bk-label">Sources</h2>
            <ul className="bk-sources">
              {sources.slice(0, 8).map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {Array.isArray(alert.reasons) && alert.reasons.length > 0 && (
          <footer className="bk-why">
            <span className="bk-why-label">Why we flagged this</span>
            <span className="bk-why-list">{alert.reasons.join(' · ')}</span>
          </footer>
        )}
      </article>
    </div>
  );
}
