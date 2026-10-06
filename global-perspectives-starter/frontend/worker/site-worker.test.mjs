import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

const BLOG_PAGES = [
  ['/blog/', '/blog/index.html', 'blog index'],
  ['/blog/ai-news-aggregation-guide/', '/blog/ai-news-aggregation-guide/index.html', 'ai news guide'],
  ['/blog/building-animated-loading-screens/', '/blog/building-animated-loading-screens/index.html', 'loading screens'],
  ['/blog/country-risk-analysis-ai/', '/blog/country-risk-analysis-ai/index.html', 'country risk'],
  ['/blog/geopolitical-intelligence-for-ai-agents/', '/blog/geopolitical-intelligence-for-ai-agents/index.html', 'agent intelligence'],
  ['/blog/google-news-vs-ai-news/', '/blog/google-news-vs-ai-news/index.html', 'news comparison'],
  ['/blog/pair-intelligence/', '/blog/pair-intelligence/index.html', 'pair intelligence'],
  ['/blog/thread-and-country-intelligence/', '/blog/thread-and-country-intelligence/index.html', 'thread intelligence'],
];

function makeEnvironment(overrides = {}) {
  const calls = [];
  const files = new Map([
    ['/index.html', { body: '<!doctype html><title>App shell</title>', type: 'text/html; charset=utf-8' }],
    ['/config.js', { body: 'window.RUNTIME_CONFIG = true;', type: 'text/javascript; charset=utf-8' }],
    ['/assets/main-A1b2C3d4.js', { body: 'console.log("app")', type: 'text/javascript; charset=utf-8' }],
    ['/assets/vendor.js', { body: 'console.log("vendor")', type: 'text/javascript; charset=utf-8', cache: 'public, max-age=600' }],
    ['/assets/vendor-component.js', { body: 'console.log("component")', type: 'text/javascript; charset=utf-8', cache: 'public, max-age=600' }],
    ...BLOG_PAGES.map(([, assetPath, body]) => [assetPath, { body: `<article>${body}</article>`, type: 'text/html; charset=utf-8' }]),
  ]);

  const env = {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        calls.push({ url: url.toString(), pathname: url.pathname, method: request.method });
        const file = files.get(url.pathname);
        if (!file) {
          return new Response('Asset not found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }

        const headers = new Headers({ 'Content-Type': file.type });
        if (file.cache) headers.set('Cache-Control', file.cache);
        return new Response(request.method === 'HEAD' ? null : file.body, {
          status: 200,
          headers,
        });
      },
    },
  };

  return { env: { ...env, ...overrides }, calls, files };
}

function request(path, options = {}) {
  return new Request(`https://globalperspective-site-candidate.example${path}`, {
    headers: { Accept: 'text/html' },
    ...options,
  });
}

test('root and /index.html return the shell directly with status 200', async () => {
  for (const path of ['/', '/index.html?source=front-worker']) {
    const { env, calls } = makeEnvironment();
    const response = await worker.fetch(request(path), env);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /App shell/);
    assert.equal(response.headers.get('Location'), null);
    assert.equal(calls.at(-1).pathname, '/index.html');
    assert.equal(calls.at(-1).url.includes('source=front-worker'), path.includes('?'));
  }
});

test('all eight blog URLs resolve to their real HTML files before SPA fallback', async () => {
  for (const [route, assetPath, articleText] of BLOG_PAGES) {
    const { env, calls } = makeEnvironment();
    const response = await worker.fetch(request(route), env);

    assert.equal(response.status, 200, route);
    assert.match(await response.text(), new RegExp(articleText), route);
    assert.equal(calls[0].pathname, assetPath, route);
  }
});

test('blog directory paths without a slash redirect canonically and keep queries', async () => {
  const { env, calls } = makeEnvironment();
  const response = await worker.fetch(request('/blog/pair-intelligence?ref=nav'), env);

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), 'https://globalperspective-site-candidate.example/blog/pair-intelligence/?ref=nav');
  assert.equal(calls.length, 0);
});

test('unknown blog pages and missing assets return 404 even for HTML navigations', async () => {
  for (const path of ['/blog/not-a-post/', '/assets/missing.js', '/assets/missing-A1b2C3d4.js', '/images/missing.svg', '/missing.html']) {
    const { env } = makeEnvironment();
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 404, path);
    if (path.includes('A1b2C3d4')) {
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
  }
});

test('extensionless HTML navigations use the SPA shell, other accepts stay 404', async () => {
  const { env: htmlEnv } = makeEnvironment();
  const htmlResponse = await worker.fetch(request('/weekly/thread/thread-123'), htmlEnv);
  assert.equal(htmlResponse.status, 200);
  assert.match(await htmlResponse.text(), /App shell/);

  const { env: jsonEnv } = makeEnvironment();
  const jsonResponse = await worker.fetch(request('/weekly/thread/thread-123', {
    headers: { Accept: 'application/json' },
  }), jsonEnv);
  assert.equal(jsonResponse.status, 404);
});

test('site Worker does not claim the retained RSS or data endpoints', async () => {
  for (const path of ['/rss', '/rss/', '/data/world/latest.json']) {
    const { env } = makeEnvironment();
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 404, path);
  }
});

test('HEAD and query strings are preserved on asset reads', async () => {
  const { env, calls } = makeEnvironment();
  const response = await worker.fetch(request('/blog/pair-intelligence/?utm_source=test', {
    method: 'HEAD',
  }), env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.equal(calls[0].method, 'HEAD');
  assert.equal(calls[0].url.includes('utm_source=test'), true);
});

test('candidate responses are noindex; production allowlisted hosts are not', async () => {
  const candidate = await worker.fetch(request('/'), makeEnvironment().env);
  assert.equal(candidate.headers.get('X-Robots-Tag'), 'noindex');

  for (const host of ['globalperspective.net', 'www.globalperspective.net']) {
    const prodResponse = await worker.fetch(
      new Request(`https://${host}/`, { headers: { Accept: 'text/html' } }),
      makeEnvironment().env,
    );
    assert.equal(prodResponse.headers.get('X-Robots-Tag'), null, host);
  }

  const missing = await worker.fetch(request('/assets/missing.js'), makeEnvironment().env);
  assert.equal(missing.headers.get('X-Robots-Tag'), 'noindex');

  const redirect = await worker.fetch(request('/blog/pair-intelligence'), makeEnvironment().env);
  assert.equal(redirect.headers.get('X-Robots-Tag'), 'noindex');
});

test('asset binding failures produce a candidate noindex error response', async () => {
  const env = {
    ASSETS: {
      async fetch() {
        throw new Error('simulated asset failure');
      },
    },
  };
  const response = await worker.fetch(request('/assets/main-A1b2C3d4.js'), env);

  assert.equal(response.status, 502);
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('hashed assets cache immutably while HTML and runtime config revalidate', async () => {
  const hashed = await worker.fetch(request('/assets/main-A1b2C3d4.js'), makeEnvironment().env);
  assert.equal(hashed.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');

  const html = await worker.fetch(request('/'), makeEnvironment().env);
  assert.equal(html.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');

  const config = await worker.fetch(request('/config.js'), makeEnvironment().env);
  assert.equal(config.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');

  const unhashed = await worker.fetch(request('/assets/vendor.js'), makeEnvironment().env);
  assert.equal(unhashed.headers.get('Cache-Control'), 'public, max-age=600');

  const namedChunk = await worker.fetch(request('/assets/vendor-component.js'), makeEnvironment().env);
  assert.equal(namedChunk.headers.get('Cache-Control'), 'public, max-age=600');
});

test('unsupported methods return 405 with an Allow header', async () => {
  const response = await worker.fetch(request('/'), makeEnvironment().env);
  const post = await worker.fetch(new Request('https://globalperspective-site-candidate.example/', {
    method: 'POST',
  }), makeEnvironment().env);

  assert.equal(response.status, 200);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
});
