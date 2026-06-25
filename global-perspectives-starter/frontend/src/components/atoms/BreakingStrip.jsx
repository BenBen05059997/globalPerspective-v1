import { Link } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import './BreakingStrip.css';

const FRESH_MS = 24 * 60 * 60 * 1000; // only surface a genuinely fresh alert

// Slim "BREAKING" entry point shown at the top of Home + Map — but ONLY when there
// is a confirmed alert from the last 24h. Renders nothing otherwise (honest: no
// fresh alert → no strip, never a stale or fabricated banner).
export default function BreakingStrip() {
  const { alerts } = useNotifications();
  const latest = alerts && alerts[0]; // alerts arrive newest-first
  if (!latest || !latest.at) return null;

  const age = Date.now() - new Date(latest.at).getTime();
  if (!(age >= 0) || age > FRESH_MS) return null;

  const id = encodeURIComponent(latest.id || latest.threadId);
  return (
    <Link to={`/breaking/${id}`} className="bk-strip" aria-label={`Breaking: ${latest.title}`}>
      <span className="bk-strip-tag"><span className="bk-strip-dot" />BREAKING</span>
      <span className="bk-strip-title">{latest.title}</span>
      <span className="bk-strip-go" aria-hidden="true">→</span>
    </Link>
  );
}
