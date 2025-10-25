let lambdaClient;
let InvokeCommandCtor;

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
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
  const summaryLambdaName = process.env.SUMMARY_LAMBDA_NAME || 'NewsProjectInvokeAgentLambda';

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

  const invokeSummaryLambda = async (lambdaPayload) => {
    if (!summaryLambdaName) {
      throw new Error('SUMMARY_LAMBDA_NAME env var is not set');
    }
    if (!lambdaClient) {
      const mod = await import('@aws-sdk/client-lambda');
      lambdaClient = new mod.LambdaClient({ region });
      InvokeCommandCtor = mod.InvokeCommand;
    }

    const command = new InvokeCommandCtor({
      FunctionName: summaryLambdaName,
      Payload: Buffer.from(JSON.stringify(lambdaPayload ?? {}))
    });

    const response = await lambdaClient.send(command);
    const rawPayload = response.Payload;
    const text = rawPayload
      ? Buffer.isBuffer(rawPayload)
        ? rawPayload.toString('utf-8')
        : new TextDecoder().decode(rawPayload)
      : '';
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };

  const pickCacheItem = (result, action) => {
    if (!result) return null;
    const target = action === 'prediction' ? 'prediction' : 'summary';

    if (Array.isArray(result.items)) {
      return result.items.find(item => item?.action === target) || null;
    }

    if (Array.isArray(result.results)) {
      for (const entry of result.results) {
        if (Array.isArray(entry?.items)) {
          const match = entry.items.find(item => item?.action === target);
          if (match) return match;
        }
      }
    }

    return null;
  };

  const shapeCacheResponse = (item) => {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = typeof item.ttl === 'number' ? item.ttl : null;
    const remaining = ttlSeconds != null ? Math.max(ttlSeconds - nowSeconds, 0) : null;

    return {
      topicId: item.topicId,
      title: item.title,
      content: item.content,
      model: item.model,
      provider: item.provider,
      generatedAt: item.generatedAt,
      latencyMs: item.latencyMs,
      remainingTtlSeconds: remaining,
      ttl: ttlSeconds,
    };
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

    if (action === 'summary' || action === 'prediction') {
      const topicId = payload.topicId || payload.topic_id || null;
      if (!topicId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing topicId' })
        };
      }

      // Attempt to read cache first unless caller explicitly asks to skip.
      let shaped = null;
      if (!payload.skipCache) {
        const cachedResponse = await invokeSummaryLambda({ action, topicId, readOnly: true });
        const cachedItem = pickCacheItem(cachedResponse, action);
        shaped = shapeCacheResponse(cachedItem);
        if (shaped && shaped.remainingTtlSeconds != null && shaped.remainingTtlSeconds > 0) {
          const { ttl, ...rest } = shaped;
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, cached: true, data: rest })
          };
        }
      }

      const refreshResponse = await invokeSummaryLambda({ action, topicId, readOnly: false });
      const refreshedItem = pickCacheItem(refreshResponse, action);
      const refreshed = shapeCacheResponse(refreshedItem);

      if (!refreshed) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({ success: false, error: 'Cache miss', reason: 'MISSING' })
        };
      }

      const { ttl, ...rest } = refreshed;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          cached: false,
          data: rest
        })
      };
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
