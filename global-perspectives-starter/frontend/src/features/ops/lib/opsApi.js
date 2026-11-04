// The one door the ops page reads through: the real `ops` action and the public health view, or, in a dev build opened with
// ?devOps=1 (or =403 for the not-the-operator answer), fixtures (a dynamic import behind import.meta.env.DEV, so a production
// build drops them entirely).
import { fetchOps } from '@/shared/api/restProxy';
import { fetchRecordView } from '@/shared/api/recordViews';

const DEV_KEY = 'gp_dev_ops';
const DEV_MODES = { 1: 'operator', nc: 'notConnected', cferr: 'cfError', 403: 'forbidden' };

/**
 * 'operator' | 'notConnected' | 'cfError' | 'forbidden' | null: in a dev build opened with ?devOps=1 (readers connected), =nc (Cloudflare
 * not connected), =cferr (Cloudflare error) or =403 (remembered for the tab) the page runs on fixtures.
 */
export function devOps() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  try {
    const asked = new URLSearchParams(window.location.search).get('devOps');
    if (asked && Object.hasOwn(DEV_MODES, asked)) sessionStorage.setItem(DEV_KEY, asked);
    return DEV_MODES[sessionStorage.getItem(DEV_KEY)] || null;
  } catch { return null; }
}

/** { status: 200, data } for the operator (data null until newsHealth has written the file), { status: 403 } for everyone else. */
export async function loadOps() {
  const mode = devOps();
  if (mode) return (await import('../dev/fixtures.js')).devOpsReply(mode);
  return fetchOps();
}

/** health.json (public, no sign-in), or null when it is not generated yet. */
export async function loadHealth() {
  if (devOps()) return (await import('../dev/fixtures.js')).devHealth();
  return fetchRecordView('health.json');
}
