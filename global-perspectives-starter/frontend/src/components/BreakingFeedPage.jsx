import { Link } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import SourceRobustness from './atoms/SourceRobustness';
import SubscribeCard from './SubscribeCard';
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

function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const today = new Date();
  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function MarketPill({ economic }) {
  if (!economic || !economic.direction || !economic.magnitude) return null;
  const arrow = economic.direction === 'up' ? '▲' : economic.direction === 'down' ? '▼' : '◆';
  return <span className="bk-pill bk-pill-sm">{arrow}&nbsp; {economic.magnitude} move, {economic.direction}</span>;
}

function AlertCard({ a }) {
  return (
    <Link to={`/breaking/${encodeURIComponent(a.id || a.threadId)}`} className="bk-feed-item">
      <div className="bk-feed-top">
        <span className="bk-chip bk-chip-sm">BREAKING</span>
        {a.at && <span className="bk-time">{relTime(a.at)}</span>}
      </div>
      {(a.category || (a.regions || []).length > 0) && (
        <div className="bk-feed-tags">
          {a.category && <span className="bk-cat">{a.category}</span>}
          {(a.regions || []).slice(0, 4).join(' · ')}
        </div>
      )}
      <div className="bk-feed-title">{a.title}</div>
      <div className="bk-feed-meta">
        <MarketPill economic={a.economic} />
        <SourceRobustness outlets={a.outletCount} sources={a.sourceCount} regions={(a.regions || []).length} />
      </div>
    </Link>
  );
}

export default function BreakingFeedPage() {
  const { alerts, loading, endpointMissing } = useNotifications();

  // Group by day, newest first (alerts already arrive sorted newest-first).
  const groups = [];
  const seen = new Map();
  for (const a of alerts) {
    const k = dayKey(a.at);
    if (!seen.has(k)) { seen.set(k, []); groups.push([k, seen.get(k)]); }
    seen.get(k).push(a);
  }

  return (
    <div className="bk-wrap">
      <header className="bk-page-head">
        <span className="bk-chip">BREAKING</span>
        <h1 className="bk-page-title">Breaking alerts</h1>
        <p className="bk-page-sub">
          Major stories the pipeline flags as genuinely significant — paired with our own analysis,
          not just a headline. We stay silent when nothing rises to the bar.
        </p>
      </header>

      <SubscribeCard kind="breaking" variant="breaking" />

      {loading ? (
        <div className="bk-skel" />
      ) : alerts.length === 0 ? (
        <div className="bk-empty">
          <h2>No major breaking stories right now</h2>
          <p>
            {endpointMissing
              ? 'Breaking alerts aren’t configured on this site yet.'
              : 'When a story crosses the significance bar, it’ll appear here. Quiet is the normal state.'}
          </p>
          <Link to="/" className="bk-maplink">Back to today’s briefing →</Link>
        </div>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="bk-feed-day">
            <h2 className="bk-feed-daylabel">{day}</h2>
            <div className="bk-feed-list">
              {items.map((a) => <AlertCard key={a.id || a.threadId} a={a} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
