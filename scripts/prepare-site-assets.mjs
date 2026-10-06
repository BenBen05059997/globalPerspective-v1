#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const FRONTEND_DIR = path.join(REPO_ROOT, 'global-perspectives-starter/frontend');
const REQUIRED_CONFIG_FIELDS = [
  'SENSITIVE_PROXY_ENDPOINT', 'FIREBASE_CONFIG', 'GOOGLE_MAPS_API_KEY',
  'CLIENT_ERRORS_ENDPOINT', 'NEWS_ANALYZE_ENDPOINT', 'NEWS_SHARE_ENDPOINT',
  'POLAR_BILLING_ENDPOINT', 'SAVED_ITEMS_ENDPOINT', 'USER_PREFS_ENDPOINT',
];
const REQUIRED_BLOG_FILES = [
  'blog/index.html',
  'blog/ai-news-aggregation-guide/index.html',
  'blog/building-animated-loading-screens/index.html',
  'blog/country-risk-analysis-ai/index.html',
  'blog/geopolitical-intelligence-for-ai-agents/index.html',
  'blog/google-news-vs-ai-news/index.html',
  'blog/pair-intelligence/index.html',
  'blog/thread-and-country-intelligence/index.html',
];
const SKIP_NAMES = new Set(['CNAME', '.nojekyll', 'config.js']);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArgs(argv) {
  const values = { dist: path.join(FRONTEND_DIR, 'dist'), docs: path.join(REPO_ROOT, 'docs'), out: path.join(FRONTEND_DIR, 'site-dist') };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!['--dist', '--docs', '--out'].includes(key)) throw new Error(`Unknown argument: ${key}`);
    const value = argv[++i];
    if (!value) throw new Error(`${key} requires a path`);
    values[key.slice(2)] = path.resolve(value);
  }
  return values;
}

function overlaps(left, right) {
  const relative = path.relative(left, right);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function assertNoSymlinkUnder(base, target) {
  const relative = path.relative(base, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path is outside its allowed root: ${target}`);
  }
  let current = await realpath(base);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = await lstat(current).catch(() => null);
    if (!info) break;
    if (info.isSymbolicLink()) throw new Error(`Refusing symlink path component: ${current}`);
    if (!info.isDirectory() && current !== target) throw new Error(`Path component is not a directory: ${current}`);
  }
}

function validateRuntimeConfig(configSource) {
  const context = vm.createContext({ window: {} }, { codeGeneration: { strings: false, wasm: false } });
  try {
    vm.runInContext(configSource, context, { timeout: 100 });
  } catch {
    throw new Error('Runtime config could not be parsed safely.');
  }
  const config = context.window;
  const missingFields = REQUIRED_CONFIG_FIELDS.filter((field) => !Object.hasOwn(config, field));
  if (missingFields.length) throw new Error(`Runtime config is missing required fields: ${missingFields.join(', ')}`);
  const firebase = config.FIREBASE_CONFIG;
  if (!config.SENSITIVE_PROXY_ENDPOINT || typeof config.SENSITIVE_PROXY_ENDPOINT !== 'string') {
    throw new Error('Runtime config requires a nonempty SENSITIVE_PROXY_ENDPOINT.');
  }
  if (!config.GOOGLE_MAPS_API_KEY || typeof config.GOOGLE_MAPS_API_KEY !== 'string') {
    throw new Error('Runtime config requires a nonempty GOOGLE_MAPS_API_KEY.');
  }
  if (!firebase || typeof firebase !== 'object' || ['apiKey', 'authDomain', 'projectId', 'appId'].some((key) => !firebase[key])) {
    throw new Error('Runtime config requires Firebase apiKey, authDomain, projectId, and appId.');
  }
}

async function assertRegularTree(source) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Refusing symlink in source tree: ${source}`);
  if (info.isDirectory()) {
    for (const entry of await readdir(source)) await assertRegularTree(path.join(source, entry));
  } else if (!info.isFile()) {
    throw new Error(`Refusing non-file entry in source tree: ${source}`);
  }
}

async function copyTreeFiltered(source, destination, relative = '') {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Refusing symlink in source tree: ${source}`);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const name of (await readdir(source)).sort()) {
      if (SKIP_NAMES.has(name)) continue;
      const childRelative = path.posix.join(relative, name);
      if (childRelative.split('/').some((part) => part === '..' || part === '.')) {
        throw new Error(`Unsafe relative path: ${childRelative}`);
      }
      await copyTreeFiltered(path.join(source, name), path.join(destination, name), childRelative);
    }
    return;
  }
  if (!info.isFile()) throw new Error(`Refusing non-file entry in source tree: ${source}`);
  if (source.endsWith('.map')) return;
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { errorOnExist: false, force: true });
}

async function enumerateFiles(root, relative = '') {
  const output = [];
  for (const name of (await readdir(path.join(root, relative))).sort()) {
    const childRelative = relative ? `${relative}/${name}` : name;
    const fullPath = path.join(root, childRelative);
    const info = await lstat(fullPath);
    if (info.isSymbolicLink()) throw new Error(`Refusing symlink in staged site: ${fullPath}`);
    if (info.isDirectory()) output.push(...await enumerateFiles(root, childRelative));
    else if (info.isFile()) output.push(childRelative);
    else throw new Error(`Refusing non-file entry in staged site: ${fullPath}`);
  }
  return output;
}

async function getCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

async function getSourceState() {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { dirty: status.trim().length > 0 };
  } catch {
    return { dirty: null };
  }
}

export async function prepareSiteAssets({ dist, docs, out }) {
  dist = path.resolve(dist);
  docs = path.resolve(docs);
  out = path.resolve(out);
  await validateOutputPath({ dist, docs, out });
  await assertRegularTree(dist);

  const indexStat = await lstat(path.join(dist, 'index.html')).catch(() => null);
  if (!indexStat?.isFile()) throw new Error(`Missing build entrypoint: ${path.join(dist, 'index.html')}`);
  const configPath = path.join(docs, 'config.js');
  const configInfo = await lstat(configPath).catch(() => null);
  if (!configInfo?.isFile() || configInfo.isSymbolicLink()) throw new Error(`Runtime config missing or unsafe: ${configPath}`);
  const configBytes = await readFile(configPath);
  const configSource = configBytes.toString('utf8');
  validateRuntimeConfig(configSource);

  for (const file of REQUIRED_BLOG_FILES) {
    const source = path.join(docs, file);
    const info = await lstat(source).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`Required blog page missing or unsafe: ${source}`);
  }
  for (const file of ['sitemap.xml', 'WHITEPAPER.md']) {
    const info = await lstat(path.join(docs, file)).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`Required public file missing or unsafe: ${path.join(docs, file)}`);
  }

  const outInfo = await lstat(out).catch(() => null);
  if (outInfo?.isSymbolicLink()) throw new Error(`Refusing symlink output directory: ${out}`);
  if (outInfo && !outInfo.isDirectory()) throw new Error(`Output path is not a directory: ${out}`);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await copyTreeFiltered(dist, out);

  // The config copied from Vite's public directory is intentionally skipped above.
  await writeFile(path.join(out, 'config.js'), configBytes);
  for (const file of [...REQUIRED_BLOG_FILES, 'sitemap.xml', 'WHITEPAPER.md']) {
    const destination = path.join(out, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(docs, file), destination);
  }

  const files = [];
  for (const file of await enumerateFiles(out)) {
    if (file.endsWith('.map') || file === 'CNAME' || file === '.nojekyll') {
      throw new Error(`Forbidden file in upload package: ${file}`);
    }
    const bytes = await readFile(path.join(out, file));
    files.push({ path: file, size: bytes.length, sha256: sha256(bytes) });
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const workerSha256 = sha256(await readFile(path.join(FRONTEND_DIR, 'worker/index.js')));
  const wranglerConfigSha256 = sha256(await readFile(path.join(FRONTEND_DIR, 'wrangler.jsonc')));
  const runtimeConfigSha256 = sha256(configBytes);
  const artifactHash = sha256(Buffer.from(JSON.stringify({ files, workerSha256, wranglerConfigSha256 })));
  const manifest = {
    schemaVersion: 1,
    artifactHash,
    commit: await getCommit(),
    sourceDirty: (await getSourceState()).dirty,
    runtimeConfigSha256,
    workerSha256,
    wranglerConfigSha256,
    files,
  };
  return { manifest, out };
}

export async function validateOutputPath({ dist, docs, out }) {
  dist = path.resolve(dist);
  docs = path.resolve(docs);
  out = path.resolve(out);
  const defaultOut = path.join(FRONTEND_DIR, 'site-dist');
  const tempRoot = path.resolve(os.tmpdir());
  if (out !== defaultOut && (out === tempRoot || !overlaps(tempRoot, out) || path.basename(out) !== 'site-dist')) {
    throw new Error(`Output must be ${defaultOut} or a scratch directory inside ${tempRoot}`);
  }
  const sourceBase = (candidate) => overlaps(REPO_ROOT, candidate) ? REPO_ROOT : overlaps(tempRoot, candidate) ? tempRoot : null;
  const distBase = sourceBase(dist);
  const docsBase = sourceBase(docs);
  if (!distBase || !docsBase) throw new Error('Build and docs inputs must be inside the repository or an isolated temporary directory.');
  await assertNoSymlinkUnder(distBase, dist);
  await assertNoSymlinkUnder(docsBase, docs);
  await assertNoSymlinkUnder(out === defaultOut ? FRONTEND_DIR : tempRoot, out);
  if ([dist, docs].some((source) => overlaps(out, source) || overlaps(source, out)) || out === REPO_ROOT || overlaps(out, REPO_ROOT)) {
    throw new Error('Output directory overlaps a protected source directory');
  }
  return true;
}

async function main() {
  const result = await prepareSiteAssets(parseArgs(process.argv.slice(2)));
  const metadataDir = path.join(REPO_ROOT, '.site-releases');
  await assertNoSymlinkUnder(REPO_ROOT, metadataDir);
  await mkdir(path.join(metadataDir, 'manifests'), { recursive: true });
  const manifestPath = path.join(metadataDir, 'manifests', `${result.manifest.artifactHash}.json`);
  const manifestText = `${JSON.stringify(result.manifest, null, 2)}\n`;
  try {
    await writeFile(manifestPath, manifestText, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (existing.artifactHash !== result.manifest.artifactHash || JSON.stringify(existing.files) !== JSON.stringify(result.manifest.files)) {
      throw new Error(`Existing manifest conflicts with artifact ${result.manifest.artifactHash}`);
    }
  }
  const archivePath = path.join(metadataDir, 'packages', result.manifest.artifactHash);
  const archiveInfo = await lstat(archivePath).catch(() => null);
  if (archiveInfo?.isSymbolicLink()) throw new Error(`Refusing symlink release archive: ${archivePath}`);
  if (!archiveInfo) await cp(result.out, archivePath, { recursive: true, errorOnExist: true, force: false });
  process.stdout.write(`Prepared ${result.manifest.files.length} files\nArtifact: ${result.manifest.artifactHash}\nConfig: ${result.manifest.runtimeConfigSha256}\nManifest: ${path.relative(REPO_ROOT, manifestPath)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`prepare-site-assets: ${error.message}\n`);
    process.exitCode = 1;
  });
}
