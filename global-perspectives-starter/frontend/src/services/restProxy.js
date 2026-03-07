// REST proxy client for the newsSensitiveData Lambda cache facade.
// Reads the endpoint from window.SENSITIVE_PROXY_ENDPOINT or configureProxy().

let PROXY_ENDPOINT = null;

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

export async function fetchTodayArchive() {
  return proxyAction('today');
}
