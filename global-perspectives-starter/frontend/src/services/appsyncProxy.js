/**
 * AppSync Proxy Interface for newsSensitive Lambda
 *
 * Connects the frontend to AppSync Query `proxySensitive(action, payload)`
 * and parses the AWSJSON string response into a JavaScript object.
 *
 * Configuration options (tool-agnostic):
 * - Provide endpoint and apiKey via configureAppSync({ endpoint, apiKey })
 * - Or set window.APPSYNC_ENDPOINT and window.APPSYNC_API_KEY globally
 */
let APPSYNC_ENDPOINT;
let APPSYNC_API_KEY;

export function configureAppSync({ endpoint, apiKey }) {
  APPSYNC_ENDPOINT = endpoint;
  APPSYNC_API_KEY = apiKey;
}

function assertConfig() {
  // Allow globals if configureAppSync was not called
  const endpoint = APPSYNC_ENDPOINT || (typeof window !== 'undefined' && window.APPSYNC_ENDPOINT);
  const apiKey = APPSYNC_API_KEY || (typeof window !== 'undefined' && window.APPSYNC_API_KEY);
  if (!endpoint || !apiKey) {
    throw new Error('Missing AppSync config: call configureAppSync({ endpoint, apiKey }) or set window.APPSYNC_ENDPOINT/APPSYNC_API_KEY');
  }
  // Normalize back to module variables for subsequent calls
  APPSYNC_ENDPOINT = endpoint;
  APPSYNC_API_KEY = apiKey;
}

/**
 * Call the AppSync proxySensitive resolver.
 * @param {string} action - e.g., 'geocode', 'appsync', 'gemini'
 * @param {object} payloadObj - arbitrary payload object (stringified as AWSJSON)
 * @returns {Promise<object>} Parsed result object
 */
export async function proxySensitive(action, payloadObj = {}) {
  assertConfig();

  const query = `query($payload: AWSJSON!){ proxySensitive(action:"${action}", payload:$payload) }`;
  const variables = { payload: JSON.stringify(payloadObj) };

  const res = await fetch(APPSYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APPSYNC_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`AppSync HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  if (body.errors && body.errors.length) {
    throw new Error(`AppSync errors: ${JSON.stringify(body.errors)}`);
  }

  const awsjsonStr = body?.data?.proxySensitive;
  if (typeof awsjsonStr !== 'string') {
    // In case the resolver returns parsed JSON, return as-is
    return awsjsonStr;
  }
  try {
    return JSON.parse(awsjsonStr);
  } catch (err) {
    return {
      success: false,
      error: 'Invalid AWSJSON payload from AppSync',
      details: String(err?.message ?? err),
      raw: awsjsonStr,
    };
  }
}

/**
 * Convenience: Geocoding via proxySensitive
 * @param {string} address
 */
export const geocodeProxy = (address) => proxySensitive('geocode', { address });

/**
 * Convenience: Gemini via proxySensitive
 * @param {object} params - { prompt, model, temperature, max_output_tokens }
 */
export const geminiProxy = (params) => proxySensitive('gemini', params);

/*
// Example usage
// import { proxySensitive, geocodeProxy, geminiProxy } from './services/appsyncProxy';

// Geocode
// geocodeProxy('Kyiv, Ukraine').then(console.log).catch(console.error);

// Gemini
// geminiProxy({ prompt: '3 global news topics today', model: 'gemini-1.5-flash', temperature: 0.2 })
//   .then(console.log)
//   .catch(console.error);
*/