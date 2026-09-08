// worldData — reads the map-as-home data bundle from S3 via the Cloudflare Worker `/data/*` route
// (DATA_STRATEGY.md §5). No proxy Lambda in this path: content is a static CDN fetch.
//
//   world/latest.json          → the whole map bundle (situations + freshness + lede + ranked)
//   situations/state/<id>.json → per-situation detail (history, evidence) on click
//
// Dev override: set VITE_WORLD_URL to a local fixture (see frontend/fixtures/README.md).

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WORLD_URL) || '/data';
const ROOT = BASE.replace(/\/world\/latest\.json$/, '');
const WORLD_URL = BASE.endsWith('.json') ? BASE : `${BASE}/world/latest.json`;
// situationIds contain '#'; the tracker stores state objects under a URL/S3-safe key — match it here.
const stateKey = (id) => String(id).replace(/[^A-Za-z0-9._-]/g, '_');
const DETAIL_URL = (id) => `${ROOT}/situations/state/${stateKey(id)}.json`;

async function getJson(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 404) return null; // not generated yet — a valid empty state, not an error
  if (!res.ok) throw new Error(`worldData ${res.status} for ${url}`);
  return res.json();
}

/** Fetch the world bundle. Returns the parsed bundle, or null if not generated yet. */
export function fetchWorld(signal) {
  return getJson(WORLD_URL, signal);
}

/** Fetch one situation's full detail object. Returns null if it doesn't exist (or was archived). */
export function fetchSituationDetail(id, signal) {
  return getJson(DETAIL_URL(id), signal);
}

/** The oldest of the bundle's per-source stamps — the honest "as of" the page should display. */
export function oldestSource(sources) {
  const stamps = Object.values(sources || {}).filter(Boolean).map((s) => new Date(s).getTime()).filter((n) => Number.isFinite(n));
  return stamps.length ? new Date(Math.min(...stamps)).toISOString() : null;
}
