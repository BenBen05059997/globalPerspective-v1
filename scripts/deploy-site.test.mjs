import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertCandidateUnbound, extractCurrentVersionId, stagePagesFromPackage } from './release-site.mjs';

const auth = {
  token: 'unit-test-token',
  accountId: 'account-id',
  zoneId: 'zone-id',
  routeCheckZone: 'globalperspective.net',
};

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function cloudflareFixture({ domains = [], routes = [], zoneName = 'globalperspective.net', accountId = 'account-id', status = 200 } = {}) {
  return async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/workers/domains')) return response({ success: status === 200, result: domains, result_info: { total_pages: 1 } }, status);
    if (pathname === '/client/v4/zones/zone-id') return response({ success: status === 200, result: { name: zoneName, account: { id: accountId } } }, status);
    if (pathname.endsWith('/workers/routes')) return response({ success: status === 200, result: routes, result_info: { total_pages: 1 } }, status);
    throw new Error(`Unexpected API path: ${pathname}`);
  };
}

test('extracts the exact Current Version ID from Wrangler deploy output', () => {
  const versionId = 'a445aebe-4ef2-44c4-9f6f-59898eb78ade';
  assert.equal(extractCurrentVersionId(`Total Upload: 4.2 KiB\nCurrent Version ID: ${versionId}\nhttps://example.workers.dev`), versionId);
  assert.equal(extractCurrentVersionId('Uploaded successfully, but no version identity was printed.'), null);
});

test('candidate guard passes only after account domains and configured zone routes are readable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = cloudflareFixture();
  try {
    assert.deepEqual(await assertCandidateUnbound(auth), { checkedDomains: 0, checkedRoutes: 0 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('candidate guard refuses any attached domain or route and fails closed on unreadable state', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = cloudflareFixture({ domains: [{ service: 'globalperspective-site-candidate', hostname: 'next.globalperspective.net' }] });
    await assert.rejects(assertCandidateUnbound(auth), /already has production-capable triggers.*next\.globalperspective\.net/);

    globalThis.fetch = cloudflareFixture({ routes: [{ script: 'globalperspective-site-candidate', pattern: 'globalperspective.net/*' }] });
    await assert.rejects(assertCandidateUnbound(auth), /already has production-capable triggers.*globalperspective\.net\/\*/);

    globalThis.fetch = cloudflareFixture({ status: 403 });
    await assert.rejects(assertCandidateUnbound(auth), /Cloudflare read failed \(403\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('candidate guard requires the selected zone to belong to this account and production hostname', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = cloudflareFixture({ zoneName: 'other.example' });
  try {
    await assert.rejects(assertCandidateUnbound(auth), /expected production zone/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stages an archived Pages artifact while preserving runtime config and Pages markers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'stage-pages-test-'));
  const packageDir = path.join(root, 'package');
  const docsDir = path.join(root, 'docs');
  const releasesDir = path.join(root, '.site-releases');
  try {
    await mkdir(path.join(packageDir, 'assets'), { recursive: true });
    await mkdir(path.join(docsDir, 'assets'), { recursive: true });
    await mkdir(path.join(docsDir, 'blog'), { recursive: true });
    const config = 'window.CONFIG = true;';
    await writeFile(path.join(packageDir, 'index.html'), '<main>release</main>');
    await writeFile(path.join(packageDir, 'config.js'), config);
    await writeFile(path.join(packageDir, 'assets/release.js'), 'release asset');
    await writeFile(path.join(docsDir, 'config.js'), config);
    await writeFile(path.join(docsDir, 'CNAME'), 'globalperspective.net');
    await writeFile(path.join(docsDir, '.nojekyll'), '');
    await writeFile(path.join(docsDir, 'assets/old.js'), 'stale');
    await writeFile(path.join(docsDir, 'blog/old.html'), 'stale');
    const sha256 = (value) => createHash('sha256').update(value).digest('hex');
    const files = ['index.html', 'config.js', 'assets/release.js'].map((file) => {
      const content = file === 'index.html' ? '<main>release</main>' : file === 'config.js' ? config : 'release asset';
      return { path: file, size: Buffer.byteLength(content), sha256: sha256(content) };
    });
    const manifest = { files, runtimeConfigSha256: sha256(config) };
    await stagePagesFromPackage({ artifactHash: 'test-hash', manifest, packageDir, docsDir, releasesDir });
    assert.equal(await readFile(path.join(docsDir, 'index.html'), 'utf8'), '<main>release</main>');
    assert.equal(await readFile(path.join(docsDir, '404.html'), 'utf8'), '<main>release</main>');
    assert.equal(await readFile(path.join(docsDir, 'config.js'), 'utf8'), config);
    assert.equal(await readFile(path.join(docsDir, 'CNAME'), 'utf8'), 'globalperspective.net');
    assert.equal(await readFile(path.join(docsDir, '.nojekyll'), 'utf8'), '');
    assert.equal(await readFile(path.join(docsDir, 'assets/release.js'), 'utf8'), 'release asset');
    await assert.rejects(readFile(path.join(docsDir, 'assets/old.js')));
    await assert.rejects(readFile(path.join(docsDir, 'blog/old.html')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
