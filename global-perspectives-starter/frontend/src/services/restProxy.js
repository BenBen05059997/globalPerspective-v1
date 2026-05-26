// REST proxy client for the newsSensitiveData Lambda cache facade.
// Reads the endpoint from window.SENSITIVE_PROXY_ENDPOINT or configureProxy().

let PROXY_ENDPOINT = null;

// Set by AuthContext on init — returns a Promise<string|null> for the Firebase ID token.
// Falls back to legacy x-api-key if not set (migration period).
let getAuthToken = null;
export function setAuthProvider(getTokenFn) {
  getAuthToken = getTokenFn;
}

export function configureProxy({ endpoint }) {
  PROXY_ENDPOINT = endpoint;
}

function assertProxy() {
  const endpoint = PROXY_ENDPOINT || (typeof window !== 'undefined' && window.SENSITIVE_PROXY_ENDPOINT);
  if (!endpoint) {
    throw new Error('Missing REST proxy config: set window.SENSITIVE_PROXY_ENDPOINT or call configureProxy({ endpoint })');
  }
  PROXY_ENDPOINT = endpoint;
}

export async function proxyAction(action, payload = {}) {
  assertProxy();
  const res = await fetch(PROXY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    // Special case: 503 with stale data should return the data, not throw
    if (res.status === 503 && body && typeof body === 'object') {
      // Check if Lambda proxy format with body field
      if ('body' in body) {
        const parsed = typeof body.body === 'string' ? JSON.parse(body.body) : body.body;
        if (parsed?.data?.topics && Array.isArray(parsed.data.topics) && parsed.data.topics.length > 0) {
          return parsed;
        }
      }
      // Check if direct format
      if (body?.data?.topics && Array.isArray(body.data.topics) && body.data.topics.length > 0) {
        return body;
      }
    }

    const details = typeof body === 'object' ? JSON.stringify(body) : String(body);
    throw new Error(`Proxy HTTP ${res.status}: ${details}`);
  }

  // Lambda proxy style: { statusCode, headers, body }
  if (body && typeof body === 'object' && 'statusCode' in body && 'body' in body) {
    try {
      return typeof body.body === 'string' ? JSON.parse(body.body) : body.body;
    } catch {
      return body.body;
    }
  }
  return body;
}

export async function geocodeProxy(address) {
  return proxyAction('geocode', { address });
}

export async function fetchTopicsCache() {
  return proxyAction('topics');
}

export async function fetchSummaryCache(topicId) {
  return proxyAction('summary', { topicId });
}

export async function fetchPredictionCache(topicId) {
  return proxyAction('prediction', { topicId });
}

export async function fetchTraceCauseCache(topicId) {
  return proxyAction('trace_cause', { topicId });
}

export async function fetchResearchBriefingCache(topicId) {
  return proxyAction('research_briefing', { topicId });
}

export async function fetchTodayArchive() {
  return proxyAction('today');
}

async function proxyActionWithAuth(action, payload = {}) {
  assertProxy();
  const headers = { 'Content-Type': 'application/json' };

  if (getAuthToken) {
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(PROXY_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const details = typeof body === 'object' ? JSON.stringify(body) : String(body);
    throw new Error(`Proxy HTTP ${res.status}: ${details}`);
  }
  if (body && typeof body === 'object' && 'statusCode' in body && 'body' in body) {
    try { return typeof body.body === 'string' ? JSON.parse(body.body) : body.body; } catch { return body.body; }
  }
  return body;
}

export async function fetchArchiveRange(days = 30) {
  return proxyActionWithAuth('archive_range', { days });
}

export async function fetchThreadAnalyses(threadIds) {
  return proxyActionWithAuth('thread_analysis', { threadIds });
}

export async function fetchNarrativeThread(threadId) {
  return proxyActionWithAuth('narrative_thread', { threadId });
}

export async function fetchCountryIntelligence(countryNames) {
  return proxyActionWithAuth('country_intelligence', { countryNames });
}

export async function fetchCountryHistory(countryName) {
  return proxyAction('country_history', { countryName });
}

export async function fetchDailyBrief(dateKey) {
  const today = new Date().toISOString().slice(0, 10);
  if (!dateKey || dateKey === today) {
    return proxyAction('daily_brief', { dateKey: dateKey || today });
  }
  return proxyActionWithAuth('daily_brief', { dateKey });
}

export async function fetchPairAnalysis(slug) {
  return proxyAction('pair_analysis', { pair: slug });
}

export async function fetchPairAnalysesList() {
  return proxyAction('pair_analyses_list');
}

// ── Markets data (public, no auth required) ──────────────────────────────────
export async function fetchMarketsGlobal() {
  return proxyAction('markets_global');
}

export async function fetchMarketsCountry(country) {
  return proxyAction('markets_country', { country });
}

export async function fetchMarketsHistory(symbol, days = 30) {
  return proxyAction('markets_history', { symbol, days });
}

export async function fetchSystemsAnalysis(countryName) {
  return proxyAction('systems_analysis', { countryName });
}

// ── Economic Impact (per-thread economic disruption) ─────────────────────────
export async function fetchEconomicImpact(threadId) {
  return proxyAction('economic_impact', { threadId });
}

export async function fetchDisruptionsList({ minSeverity, country, limit } = {}) {
  const payload = {};
  if (minSeverity) payload.minSeverity = minSeverity;
  if (country) payload.country = country;
  if (limit) payload.limit = limit;
  return proxyAction('economic_impact_list', payload);
}

export async function fetchTopMovers(limit = 10) {
  return proxyAction('economic_top_movers', { limit });
}

// Public preview endpoints (no auth required, for SEO / non-signed-in users)
export async function fetchCountryPreview(countryName) {
  return proxyAction('country_preview', { countryName });
}

export async function fetchThreadPreview(threadId) {
  return proxyAction('thread_preview', { threadId });
}

// ── Saved items (newsSavedItems Lambda, separate Function URL endpoint) ────
async function savedItemsRequest(action, payload = {}) {
  const endpoint = typeof window !== 'undefined' && window.SAVED_ITEMS_ENDPOINT;
  if (!endpoint) throw new Error('Missing SAVED_ITEMS_ENDPOINT');
  const token = getAuthToken ? await getAuthToken() : null;
  if (!token) throw new Error('Sign in required');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) throw new Error(`SavedItems HTTP ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

export async function saveItem(itemType, itemId, metadata = {}) {
  return savedItemsRequest('save_item', { itemType, itemId, metadata });
}

export async function unsaveItem(itemType, itemId) {
  return savedItemsRequest('unsave_item', { itemType, itemId });
}

export async function fetchSavedItems(itemType = null) {
  return savedItemsRequest('get_saved_items', itemType ? { itemType } : {});
}

