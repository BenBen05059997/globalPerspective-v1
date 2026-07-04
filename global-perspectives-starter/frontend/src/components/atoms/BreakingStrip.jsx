import { Link } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import './BreakingStrip.css';

const FRESH_MS = 24 * 60 * 60 * 1000; // only surface genuinely fresh alerts (last 24h)

// Slim "BREAKING" entry point shown at the top of Home + Map — surfaces today's breaking
// news: the latest fresh (<24h) confirmed alert, plus a "+N more" count when there are
// others today (→ /breaking). Renders nothing when there is no fresh alert (honest: no
// fresh alert → no strip, never a stale or fabricated banner).
export default function BreakingStrip() {
  const { alerts } = useNotifications();
  if (!alerts || !alerts.length) return null;

  const now = Date.now();
  const fresh = alerts.filter((a) => {
    if (!a.at) return false;
    const age = now - new Date(a.at).getTime();
    return age >= 0 && age <= FRESH_MS;
  });
  if (!fresh.length) return null;

  const latest = fresh[0]; // alerts arrive newest-first
  const more = fresh.length - 1;
  const id = encodeURIComponent(latest.id || latest.threadId);
  // One fresh alert → deep-link to it; several → send to the full feed.
  const to = more > 0 ? '/breaking' : `/breaking/${id}`;
  const label = `Breaking: ${latest.title}${more > 0 ? ` — and ${more} more today` : ''}`;

  return (
    <Link to={to} className="bk-strip" aria-label={label}>
      <span className="bk-strip-tag"><span className="bk-strip-dot" />BREAKING</span>
      <span className="bk-strip-title">{latest.title}</span>
      {more > 0 && <span className="bk-strip-more">+{more} more today</span>}
      <span className="bk-strip-go" aria-hidden="true">→</span>
    </Link>
  );
}
