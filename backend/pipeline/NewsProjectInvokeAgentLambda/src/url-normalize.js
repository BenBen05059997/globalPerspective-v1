'use strict';

// URL normalization for the event-registry matcher (Tier 1: exact article-URL overlap).
// Verbatim JS port of the Phase 0 measurement's normalize_url() — the 31.7%/32.9% baseline was
// measured with THESE rules, so changing them (even to something "more correct") would ship a bridge
// that no longer matches the measured/gated number. Phase 0b confirmed Google-News URL wrapping is
// negligible (0%/1.7%), so no un-wrapping logic is needed. Pure; no AWS deps.

const TRACKING_PREFIXES = ['utm_', 'at_', 'cmpid', 'icid', 'ito', 'smid', 'ncid'];
const TRACKING_EXACT = new Set(['fbclid', 'gclid', 'ocid', 'spm', 'ref', 'cmp', 'src', 'mc_cid',
  'mc_eid', 'guccounter', 'guce_referrer', 'guce_referrer_sig', 'taid', 'campaign_id', 'partner',
  'cid', 'sfnsn']);

function isTrackingParam(k) {
  const kl = k.toLowerCase();
  if (TRACKING_EXACT.has(kl)) return true;
  return TRACKING_PREFIXES.some((p) => kl.startsWith(p));
}

function normalizeUrl(url) {
  if (!url) return null;
  let u;
  try { u = new URL(String(url).trim()); } catch { return String(url).trim().toLowerCase() || null; }
  let host = u.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  const path = u.pathname.replace(/\/$/, '');
  const kept = [...u.searchParams.entries()].filter(([k]) => !isTrackingParam(k));
  kept.sort(([a], [b]) => a.localeCompare(b));
  const query = kept.map(([k, v]) => `${k}=${v}`).join('&');
  return `${host}${path}` + (query ? `?${query}` : '');
}

module.exports = { normalizeUrl, isTrackingParam };
