import test from 'node:test';
import assert from 'node:assert/strict';
import candidate from './candidate.mjs';

const env = {};
const ctx = {};

async function call(url, { method = 'GET', headers = {} } = {}, fetchImpl) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await candidate.fetch(new Request(url, { method, headers }), env, ctx);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertNoindex(response) {
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
}

test('production host keeps the baseline SPA blog response unchanged', async () => {
  let requested;
  const response = await call('https://globalperspective.net/blog/pair-intelligence/', {}, async (input) => {
    requested = String(input);
    return new Response('<html>baseline shell</html>', { headers: { 'X-Origin': 'pages' } });
  });

  assert.equal(requested, 'https://globalperspective.net/index.html');
  assert.equal(await response.text(), '<html>baseline shell</html>');
  assert.equal(response.headers.get('X-Rendered-By'), 'cf-worker-spa-fallback');
  assert.equal(response.headers.get('X-Robots-Tag'), null);
});

test('candidate blog path bypasses the SPA fallback and preserves query and method', async () => {
  const requested = [];
  const response = await call('https://next.globalperspective.net/blog/pair-intelligence/?ref=qa', {}, async (input) => {
    requested.push(input);
    return new Response('<article>blog page</article>', { headers: { 'Content-Type': 'text/html' } });
  });

  assert.equal(requested.length, 1);
  assert.equal(requested[0].url, 'https://next.globalperspective.net/blog/pair-intelligence/?ref=qa');
  assert.equal(await response.text(), '<article>blog page</article>');
  assertNoindex(response);

  let headMethod;
  const headResponse = await call('https://next.globalperspective.net/blog?feed=1', { method: 'HEAD' }, async (input) => {
    headMethod = input.method;
    return new Response(null, { status: 200 });
  });
  assert.equal(headMethod, 'HEAD');
  assertNoindex(headResponse);
});

test('candidate bot-rendered root HTML is noindexed at the outer wrapper', async () => {
  const response = await call('https://next.globalperspective.net/', {
    headers: { 'User-Agent': 'Twitterbot' },
  }, async () => {
    throw new Error('root bot rendering should not need an origin fetch');
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /text\/html/);
  assert.match(await response.text(), /Global Perspectives/);
  assertNoindex(response);
});

test('candidate SPA response retains its baseline headers and gains noindex', async () => {
  const response = await call('https://next.globalperspective.net/account', {}, async (input) => {
    assert.equal(String(input), 'https://next.globalperspective.net/index.html');
    return new Response('<html>shell</html>', { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  });

  assert.equal(response.headers.get('X-Rendered-By'), 'cf-worker-spa-fallback');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
  assertNoindex(response);
});

test('candidate exceptions become controlled no-store 502 responses', async () => {
  const response = await call('https://next.globalperspective.net/blog/oops', {}, async () => {
    throw new Error('origin unavailable');
  });
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assertNoindex(response);
  assert.equal(await response.text(), 'Candidate Worker error');

  const baselineError = new Error('production behavior stays unchanged');
  await assert.rejects(
    call('https://globalperspective.net/blog/oops', {}, async () => { throw baselineError; }),
    (error) => error === baselineError,
  );
});

test('/blogger does not match the blog bypass and uses the baseline shell', async () => {
  let requested;
  const response = await call('https://next.globalperspective.net/blogger', {}, async (input) => {
    requested = String(input);
    return new Response('<html>shell</html>');
  });

  assert.equal(requested, 'https://next.globalperspective.net/index.html');
  assert.equal(response.headers.get('X-Rendered-By'), 'cf-worker-spa-fallback');
  assertNoindex(response);
});

test('candidate member data remains denied and the denial is noindexed', async () => {
  const response = await call('https://next.globalperspective.net/data/world/example.member.json', {}, async () => {
    throw new Error('denied member path must not access S3');
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'unauthorized' });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertNoindex(response);
});
