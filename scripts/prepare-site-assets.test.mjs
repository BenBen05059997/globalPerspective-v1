import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import { prepareSiteAssets, validateOutputPath } from './prepare-site-assets.mjs';

const CONFIG_FIELDS = [
  'SENSITIVE_PROXY_ENDPOINT', 'FIREBASE_CONFIG', 'GOOGLE_MAPS_API_KEY',
  'CLIENT_ERRORS_ENDPOINT', 'NEWS_ANALYZE_ENDPOINT', 'NEWS_SHARE_ENDPOINT',
  'POLAR_BILLING_ENDPOINT', 'SAVED_ITEMS_ENDPOINT', 'USER_PREFS_ENDPOINT',
];
const BLOG_FILES = [
  'blog/index.html',
  'blog/ai-news-aggregation-guide/index.html',
  'blog/building-animated-loading-screens/index.html',
  'blog/country-risk-analysis-ai/index.html',
  'blog/geopolitical-intelligence-for-ai-agents/index.html',
  'blog/google-news-vs-ai-news/index.html',
  'blog/pair-intelligence/index.html',
  'blog/thread-and-country-intelligence/index.html',
];

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'site-package-test-'));
  const dist = path.join(root, 'dist');
  const docs = path.join(root, 'docs');
  const out = path.join(root, 'site-dist');
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await mkdir(path.join(dist, 'textures'), { recursive: true });
  await mkdir(path.join(docs, 'blog'), { recursive: true });
  await writeFile(path.join(dist, 'index.html'), '<main>app</main>');
  await writeFile(path.join(dist, 'assets/app.js'), 'compiled');
  await writeFile(path.join(dist, 'assets/app.js.map'), 'private-map');
  await writeFile(path.join(dist, 'config.js'), 'window.SENSITIVE_PROXY_ENDPOINT="wrong";');
  await writeFile(path.join(dist, 'CNAME'), 'wrong.example');
  await writeFile(path.join(dist, '.nojekyll'), '');
  await writeFile(path.join(dist, 'textures/earth-night.jpg'), 'texture');
  for (const file of BLOG_FILES) {
    const target = path.join(docs, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `page:${file}`);
  }
  await writeFile(path.join(docs, 'sitemap.xml'), '<urlset/>');
  await writeFile(path.join(docs, 'WHITEPAPER.md'), '# Whitepaper');
  const config = `${CONFIG_FIELDS.map((field) => {
    if (field === 'FIREBASE_CONFIG') return `window.${field} = {apiKey:'test',authDomain:'test',projectId:'test',appId:'test'};`;
    if (field === 'SENSITIVE_PROXY_ENDPOINT' || field === 'GOOGLE_MAPS_API_KEY') return `window.${field} = 'test';`;
    return `window.${field} = '';`;
  }).join('\n')}\n`;
  await writeFile(path.join(docs, 'config.js'), config);
  return { root, dist, docs, out, config };
}

test('packages full static content with authoritative runtime config and excludes forbidden files', async () => {
  const fixture = await makeFixture();
  try {
    const { manifest, out } = await prepareSiteAssets(fixture);
    assert.equal(await readFile(path.join(out, 'config.js'), 'utf8'), fixture.config);
    assert.equal(await readFile(path.join(out, 'blog/index.html'), 'utf8'), 'page:blog/index.html');
    assert.equal(await readFile(path.join(out, 'blog/pair-intelligence/index.html'), 'utf8'), 'page:blog/pair-intelligence/index.html');
    assert.equal(await readFile(path.join(out, 'sitemap.xml'), 'utf8'), '<urlset/>');
    assert.equal(await readFile(path.join(out, 'WHITEPAPER.md'), 'utf8'), '# Whitepaper');
    assert.equal(await readFile(path.join(out, 'textures/earth-night.jpg'), 'utf8'), 'texture');
    assert.equal(manifest.files.some(({ path: file }) => file.endsWith('.map')), false);
    assert.equal(manifest.files.some(({ path: file }) => file === 'CNAME' || file === '.nojekyll'), false);
    assert.equal(manifest.files.length, 14);
    assert.match(manifest.artifactHash, /^[a-f0-9]{64}$/);
    assert.match(manifest.runtimeConfigSha256, /^[a-f0-9]{64}$/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('package hash is stable for identical inputs', async () => {
  const fixture = await makeFixture();
  try {
    const first = await prepareSiteAssets(fixture);
    const second = await prepareSiteAssets(fixture);
    assert.equal(first.manifest.artifactHash, second.manifest.artifactHash);
    assert.deepEqual(first.manifest.files, second.manifest.files);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('rejects incomplete runtime config and symlinks in source trees', async () => {
  const fixture = await makeFixture();
  try {
    await writeFile(path.join(fixture.docs, 'config.js'), 'window.SENSITIVE_PROXY_ENDPOINT="";');
    await assert.rejects(prepareSiteAssets(fixture), /Runtime config is missing required fields/);
    await writeFile(path.join(fixture.docs, 'config.js'), fixture.config);
    await symlink(path.join(fixture.dist, 'index.html'), path.join(fixture.dist, 'linked-index.html'));
    await assert.rejects(prepareSiteAssets(fixture), /Refusing symlink in source tree/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('allows only the default package path or an isolated temporary path', async () => {
  const fixture = await makeFixture();
  try {
    await assert.rejects(validateOutputPath({ dist: fixture.dist, docs: fixture.docs, out: os.tmpdir() }), /Output must be/);
    const productionOut = path.join(REPO_ROOT, 'global-perspectives-starter/frontend/site-dist');
    await assert.doesNotReject(validateOutputPath({ dist: fixture.dist, docs: fixture.docs, out: productionOut }));
    await assert.rejects(validateOutputPath({ dist: fixture.dist, docs: fixture.docs, out: path.join(REPO_ROOT, 'global-perspectives-starter/frontend/src') }), /Output must be/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
