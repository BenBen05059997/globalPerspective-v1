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
