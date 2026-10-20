// shareApi — reads and deletes shared runs (newsSharedAnalysis Function URL). Runs can no longer be created from
// the site (the Studio retired 2026-10-20); links already out there keep working. The page is hidden while
// window.NEWS_SHARE_ENDPOINT is unset (docs/config.js, operator-owned).
import { currentAuthToken } from '@/shared/api/restProxy';

// Defence in depth: the server already stores only http(s) links, and the page never renders anything else.
export function httpOnly(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

export function shareConfigured() {
  return typeof window !== 'undefined' && Boolean(window.NEWS_SHARE_ENDPOINT);
}

const base = () => String(window.NEWS_SHARE_ENDPOINT).replace(/\/$/, '');

// Words for a refused delete (never "something went wrong").
export function shareErrorMessage(status, body) {
  if (status === 401) return 'Sign in to delete a shared analysis.';
  if (body && body.message) return body.message;
  return `The share service answered with an error (HTTP ${status}).`;
}

// Public read; the token is sent only so the owner gets `owner: true`.
export async function fetchShare(id) {
  const token = await currentAuthToken();
  const res = await fetch(`${base()}?id=${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) { const e = new Error(`share read failed (HTTP ${res.status})`); e.status = res.status; throw e; }
  const body = await res.json();
  return { share: body.share };
}

export async function deleteShare(id) {
  const token = await currentAuthToken();
  if (!token) { const e = new Error(shareErrorMessage(401)); e.status = 401; throw e; }
  const res = await fetch(`${base()}?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) { let b = null; try { b = await res.json(); } catch { /* */ } const e = new Error(shareErrorMessage(res.status, b)); e.status = res.status; throw e; }
  return true;
}
