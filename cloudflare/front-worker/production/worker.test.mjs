import test from 'node:test';
import assert from 'node:assert/strict';
import baseline from '../baseline/worker2.mjs';
import patched from './worker.mjs';

const env = { S3_ACCESS_KEY_ID: 'AKIATEST', S3_SECRET_ACCESS_KEY: 'secret' };
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Stub origin: records every outbound call; behaviour keyed on URL.
function makeFetch(log) {
  return async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const u = new URL(req.url);
    log.push(`${req.method} ${req.url}`);
    if (u.hostname === 'ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com') {
      if (u.searchParams.get('action') === 'rss') return new Response('<rss/>', { status: 200 });
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    }
    if (u.hostname.endsWith('.amazonaws.com')) {
      return u.pathname.includes('missing') ? new Response('', { status: 403 }) : new Response('{"ok":1}', { status: 200, headers: { etag: '"e1"' } });
    }
    if (u.pathname === '/index.html') return new Response('<title>SHELL</title>', { status: 200 });
    if (u.pathname === '/blog' ) return new Response('', { status: 301, headers: { location: '/blog/' } });
    if (u.pathname === '/blog/') return new Response('<title>Blog — Global Perspectives</title>', { status: 200, headers: { 'X-Origin': 'pages' } });
    if (u.pathname === '/blog/pair-intelligence/') return new Response('<title>Article</title>', { status: 200 });
    if (u.pathname === '/blog/feed.xml') return new Response('<feed/>', { status: 200 });
    if (u.pathname === '/app.js') return new Response('js', { status: 200 });
    return new Response('origin 404', { status: 404 });
  };
}

async function run(worker, url, { method = 'GET', ua } = {}) {
  const log = [];
  const orig = globalThis.fetch;
  globalThis.fetch = makeFetch(log);
  try {
    const headers = ua ? { 'User-Agent': ua } : {};
    const res = await worker.fetch(new Request(url, { method, headers, redirect: 'manual' }), env, {});
    const body = await res.text();
    return { status: res.status, body, headers: Object.fromEntries([...res.headers].filter(([k]) => k !== 'date')), log };
  } finally { globalThis.fetch = orig; }
}

const H = 'https://globalperspective.net';

test('/blog/ passes through to origin unchanged', async () => {
  const r = await run(patched, `${H}/blog/`);
  assert.equal(r.status, 200);
  assert.match(r.body, /Blog — Global Perspectives/);
  assert.equal(r.headers['x-origin'], 'pages');
  assert.deepEqual(r.log, [`GET ${H}/blog/`]);
});

test('/blog (no slash) passes the origin redirect through', async () => {
  const r = await run(patched, `${H}/blog`);
  assert.equal(r.status, 301);
  assert.equal(r.headers.location, '/blog/');
  assert.deepEqual(r.log, [`GET ${H}/blog`]);
});

test('/blog/<article>/ passes through', async () => {
  const r = await run(patched, `${H}/blog/pair-intelligence/`);
  assert.equal(r.status, 200);
  assert.equal(r.body, '<title>Article</title>');
  assert.deepEqual(r.log, [`GET ${H}/blog/pair-intelligence/`]);
});

test('missing /blog/nope/ returns the origin 404, not the shell', async () => {
  const r = await run(patched, `${H}/blog/nope/`);
  assert.equal(r.status, 404);
  assert.equal(r.body, 'origin 404');
  assert.ok(!r.log.some((l) => l.includes('/index.html')));
});

test('HEAD /blog/ and Googlebot /blog/ pass through (no pre-render, no shell)', async () => {
  for (const opts of [{ method: 'HEAD' }, { ua: GOOGLEBOT }]) {
    const r = await run(patched, `${H}/blog/`, opts);
    assert.equal(r.status, 200);
    assert.ok(!r.log.some((l) => l.includes('/index.html') || l.includes('execute-api')));
  }
});

test('lookalikes (/blogger, /blog-x) still get the shell', async () => {
  for (const p of ['/blogger', '/blog-x/y']) {
    const r = await run(patched, `${H}${p}`);
    assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
  }
});

test('shell fallback for /, /weekly, /weekly/thread/x is unchanged', async () => {
  for (const p of ['/', '/weekly', '/weekly/thread/x']) {
    const r = await run(patched, `${H}${p}`);
    assert.equal(r.status, 200);
    assert.equal(r.body, '<title>SHELL</title>');
    assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
  }
});

// Baseline vs patched must be identical for everything outside /blog.
const SAME = [
  ['GET', '/'], ['GET', '/weekly'], ['GET', '/weekly/thread/x'], ['GET', '/weekly/countries'], ['GET', '/analyze/s/abc'],
  ['GET', '/rss'], ['GET', '/rss/'], ['GET', '/app.js'], ['GET', '/nope.png'],
  ['GET', '/data/world/latest.json'], ['GET', '/data/world/missing.json'], ['GET', '/data/evil/x.json'], ['GET', '/data/world/a.member.json'],
  ['POST', '/weekly'], ['HEAD', '/weekly'],
  ['GET', '/', GOOGLEBOT], ['GET', '/weekly/thread/x', GOOGLEBOT], ['GET', '/daily', GOOGLEBOT], ['GET', '/briefings', GOOGLEBOT], ['GET', '/analyze/s/abc', GOOGLEBOT],
];
test(`baseline vs patched identical for ${SAME.length} non-blog requests`, async () => {
  for (const [method, path, ua] of SAME) {
    const a = await run(baseline, `${H}${path}`, { method, ua });
    const b = await run(patched, `${H}${path}`, { method, ua });
    assert.deepEqual(b, a, `${method} ${path} ${ua ? '(bot)' : ''}`);
  }
});

test('baseline really did shadow /blog/ (regression proof)', async () => {
  const a = await run(baseline, `${H}/blog/`);
  assert.equal(a.body, '<title>SHELL</title>');
});
