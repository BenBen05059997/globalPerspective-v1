import test from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders, DEFAULT_ORIGINS } from '../src/cors.js';
import { handleRequest } from '../src/index.js';
import { makeDeps, event } from './helpers.js';

test('an allow-listed origin is echoed; an unknown one gets the first allowed origin, never a wildcard', () => {
  assert.equal(corsHeaders('http://localhost:5173')['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.equal(corsHeaders('https://evil.example')['Access-Control-Allow-Origin'], DEFAULT_ORIGINS[0]);
  assert.equal(corsHeaders(undefined)['Access-Control-Allow-Origin'], DEFAULT_ORIGINS[0]);
  assert.notEqual(corsHeaders('https://evil.example')['Access-Control-Allow-Origin'], '*');
});
test('methods list carries GET, POST, DELETE and OPTIONS; headers allow Authorization', () => {
  const h = corsHeaders('https://globalperspective.net');
  assert.equal(h['Access-Control-Allow-Methods'], 'GET,POST,DELETE,OPTIONS');
  assert.match(h['Access-Control-Allow-Headers'], /Authorization/);
});
test('OPTIONS is 204 with CORS and noindex; every response is noindex', async () => {
  const r = await handleRequest(event('OPTIONS'), makeDeps());
  assert.equal(r.statusCode, 204);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://globalperspective.net');
  assert.equal(r.headers['X-Robots-Tag'], 'noindex, nofollow');
  const g = await handleRequest(event('GET', { query: { id: 'x' } }), makeDeps());
  assert.equal(g.headers['X-Robots-Tag'], 'noindex, nofollow');
});

test('responses vary by Authorization (the owner flag), so a cached anonymous copy is never served to the owner', () => {
  assert.match(corsHeaders('https://globalperspective.net').Vary, /Authorization/);
  assert.match(corsHeaders('https://globalperspective.net').Vary, /Origin/);
});
