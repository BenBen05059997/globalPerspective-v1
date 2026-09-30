// shareApi — the Studio share endpoint (newsSharedAnalysis Function URL). The whole share UI is hidden
// while window.NEWS_SHARE_ENDPOINT is unset (docs/config.js, operator-owned), exactly like the member-run
// path is hidden until NEWS_ANALYZE_ENDPOINT exists.
import { currentAuthToken } from '@/shared/api/restProxy';

// Defence in depth: the server already stores only http(s) links, and the page never renders anything else.
export function httpOnly(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

export function shareConfigured() {
  return typeof window !== 'undefined' && Boolean(window.NEWS_SHARE_ENDPOINT);
}

const base = () => String(window.NEWS_SHARE_ENDPOINT).replace(/\/$/, '');

// Words for every server refusal (never "something went wrong").
export function shareErrorMessage(status, body) {
  const code = body && body.error;
  if (status === 401) return 'Sign in to share an analysis.';
  if (code === 'daily_limit') return `You've reached today's limit of ${body.limit || 20} shared analyses. Try again tomorrow.`;
  if (code === 'sources_changed') return 'The stories changed since your run, so the sources it cited no longer match. Run it again to share.';
  if (code === 'checks_failed') {
    const reasons = (body.failures || []).flatMap((f) => f.reasons || []);
    return `This analysis failed the server's checks, so it cannot be shared${reasons.length ? `: ${reasons.slice(0, 2).join(' ')}` : '.'}`;
  }
  if (code === 'too_large') return body.message || 'The analysis text is too long to share (32 KB limit).';
  if (code === 'unsafe_content') return 'The text contains markup that is not allowed in a shared analysis.';
  if (code === 'unknown_story') return 'One of the stories could not be found in our archive.';
  if (code === 'upstream_failed') return 'Our archive could not be read just now. Please try again in a minute.';
  if (body && body.message) return body.message;
  return `The share service answered with an error (HTTP ${status}).`;
}

export async function createShare(payload) {
  const token = await currentAuthToken();
  if (!token) { const e = new Error(shareErrorMessage(401)); e.status = 401; throw e; }
  const res = await fetch(base(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) { const e = new Error(shareErrorMessage(res.status, body)); e.status = res.status; e.code = body && body.error; throw e; }
  return body; // { id }
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

// "Your shared analyses on this browser": a browser-only list, never a library. Storage may be blocked.
const KEY = 'gp_shared_analyses';
export function loadMyShares() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string') : []; } catch { return []; }
}
export function rememberShare(id, title) {
  try {
    const list = loadMyShares().filter((x) => x.id !== id);
    list.unshift({ id, title: String(title || '').slice(0, 120), at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch { /* storage blocked: the link is still shown once */ }
}
export function forgetShare(id) {
  try { localStorage.setItem(KEY, JSON.stringify(loadMyShares().filter((x) => x.id !== id))); } catch { /* */ }
}
