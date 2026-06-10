import { useState, useEffect, useCallback } from 'react';
import { fetchAlerts } from '../services/restProxy';

// In-app notification feed (the bell). The breaking-alert feed is a global broadcast, so
// this is the same public list for everyone; the unread count is client-side (a
// localStorage "last read" timestamp) — no per-user backend write needed for v1.
// Honest by construction: an empty feed renders an empty state, never a fabricated count.
const READ_KEY = 'gp_notif_read_at';
const POLL_MS = 5 * 60 * 1000; // refresh every 5 min while the tab is open

function getReadAt() {
  try { return localStorage.getItem(READ_KEY) || ''; } catch { return ''; }
}

export function useNotifications() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readAt, setReadAt] = useState(getReadAt);

  const endpointMissing = typeof window !== 'undefined' && !window.USER_PREFS_ENDPOINT;

  const load = useCallback(() => {
    if (endpointMissing) { setLoading(false); return; }
    fetchAlerts()
      .then((res) => { if (Array.isArray(res?.alerts)) setAlerts(res.alerts); })
      .catch(() => { /* honest: leave feed as-is, no error UI in the nav */ })
      .finally(() => setLoading(false));
  }, [endpointMissing]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Unread = alerts newer than the last time the user opened the bell.
  const unread = alerts.filter((a) => a.at && a.at > readAt).length;

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    try { localStorage.setItem(READ_KEY, now); } catch { /* ignore */ }
    setReadAt(now);
  }, []);

  return { alerts, unread, loading, markAllRead, endpointMissing };
}
