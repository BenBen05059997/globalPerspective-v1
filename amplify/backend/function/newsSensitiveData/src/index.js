export const handler = async (event) => {
  const allowedOrigins = [
    'https://BenBen05059997.github.io',
    'https://BenBen05059997.github.io/GlobalPerspective'
  ];
  const origin = event.headers?.origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization'
      },
      body: ''
    };
  }

  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  const action = body?.action;
  const payload = body?.payload || {};
  const timeoutMs = Number(process.env.TIMEOUT_MS || 10000);

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Content-Type': 'application/json'
  };

  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms));

  const fetchJson = async (url, options) => {
    const res = await Promise.race([fetch(url, options), timeout(timeoutMs)]);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      throw new Error(JSON.stringify({ status: res.status, data }));
    }
    return data;
  };

  try {
    if (action === 'appsync') {
      const endpoint = process.env.GRAPHQL_ENDPOINT;
      const apiKey = process.env.GRAPHQL_API_KEY;
      const { query, variables } = payload || {};
      const data = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ query, variables })
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    if (action === 'openai') {
      const key = process.env.OPENAI_API_KEY;
      const { model, messages, temperature, max_tokens } = payload || {};
      const data = await fetchJson('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model, messages, temperature, max_tokens })
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    // Deprecated: external NewsData API calls removed to enforce Gemini-only pipeline

    if (action === 'geocode') {
      const key = process.env.GOOGLE_GEOCODING_KEY;
      const { address } = payload || {};
      const params = new URLSearchParams({ address, key });
      const data = await fetchJson(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, { method: 'GET' });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Unknown action' }) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ success: false, error: String(err.message || err) }) };
  }
};