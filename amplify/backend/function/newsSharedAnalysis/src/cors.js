// CORS is emitted HERE, in code (the newsAnalyze pattern): the Function URL's own CORS config stays EMPTY,
// otherwise the two layers double-emit headers. Allow-list only; an unknown origin gets the first allowed
// origin (the browser then blocks it), never a wildcard.
export const DEFAULT_ORIGINS = [
  'https://globalperspective.net',
  'https://www.globalperspective.net',
  'https://benben05059997.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function corsHeaders(origin, allowed = DEFAULT_ORIGINS) {
  const allow = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '600',
    // the response can differ by Authorization (owner: true), so a browser must not reuse a cached anonymous copy for the owner
    Vary: 'Origin, Authorization',
  };
}
