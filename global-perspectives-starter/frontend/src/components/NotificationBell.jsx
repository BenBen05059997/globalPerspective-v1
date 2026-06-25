import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import './NotificationBell.css';

// A breaking alert is a point-in-time story snapshot, NOT a narrative thread — it
// has its own page (/breaking/:id), keyed on the alert id. (Previously this linked
// to /weekly/thread/:id, which rendered a thin/"not found" shell for the new,
// single-entry stories breaking alerts are by definition.)
function alertPath(a) {
  return `/breaking/${encodeURIComponent(a.id || a.threadId)}`;
}

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

export default function NotificationBell() {
  const { alerts, unread, markAllRead, endpointMissing } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // If the endpoint isn't configured, show nothing rather than a dead bell.
  if (endpointMissing) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAllRead();
  }

  return (
    <div className="gp-bell-wrap" ref={ref}>
      <button
        type="button"
        className="gp-bell"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M8 1.5a3.5 3.5 0 0 0-3.5 3.5c0 2.8-1 4-1 4h9s-1-1.2-1-4A3.5 3.5 0 0 0 8 1.5z" strokeLinejoin="round" />
          <path d="M6.7 12.5a1.4 1.4 0 0 0 2.6 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && <span className="gp-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="gp-bell-panel" role="menu">
          <div className="gp-bell-head">Breaking alerts</div>
          {alerts.length === 0 ? (
            <div className="gp-bell-empty">
              You’re all caught up. Major breaking stories will show up here.
            </div>
          ) : (
            <>
              <ul className="gp-bell-list">
                {alerts.map((a) => (
                  <li key={a.id || a.threadId}>
                    <Link
                      to={alertPath(a)}
                      className="gp-bell-item"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      <span className="gp-bell-title">{a.title}</span>
                      <span className="gp-bell-time">{relTime(a.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/breaking"
                className="gp-bell-all"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                See all breaking alerts →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
