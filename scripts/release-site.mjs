#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { access, cp, copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND_DIR = path.join(REPO_ROOT, 'global-perspectives-starter/frontend');
const CONFIG_PATH = path.join(FRONTEND_DIR, 'wrangler.jsonc');
const SAFETY_CONFIG_PATH = path.join(REPO_ROOT, 'scripts/site-release.config.json');
const RELEASES_DIR = path.join(REPO_ROOT, '.site-releases');
const WORKER_NAMES = {
  candidate: 'globalperspective-site-candidate',
  production: 'globalperspective-site',
};

export function extractCurrentVersionId(output) {
  return output.match(/Current Version ID:\s*([0-9a-f-]{36})/i)?.[1] ?? null;
}

function parseJsonc(text) {
  let output = '';
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      output += char;
    } else if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      output += '\n';
    } else if (char === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 1;
    } else if (char === ',') {
      let nextNonSpace = index + 1;
      while (/\s/.test(text[nextNonSpace] ?? '')) nextNonSpace += 1;
      if (text[nextNonSpace] !== '}' && text[nextNonSpace] !== ']') output += char;
    } else output += char;
  }
  return JSON.parse(output);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function assertNoReleaseSymlink(target) {
  const relative = path.relative(REPO_ROOT, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Release metadata path is outside the repository: ${target}`);
  }
  let current = REPO_ROOT;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = await lstat(current).catch(() => null);
    if (!info) break;
    if (info.isSymbolicLink()) throw new Error(`Refusing symlink in release metadata path: ${current}`);
    if (!info.isDirectory() && current !== target) throw new Error(`Invalid release metadata path component: ${current}`);
  }
}

async function parseWranglerOAuth() {
  const configPaths = [
    path.join(os.homedir(), '.wrangler/config/default.toml'),
    path.join(os.homedir(), '.config/.wrangler/config/default.toml'),
  ];
  for (const configPath of configPaths) {
    try {
      await access(configPath);
      const contents = await readFile(configPath, 'utf8');
      const token = contents.match(/^\s*oauth_token\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*$/m)?.[1];
      const expiryRaw = contents.match(/^\s*expiration_time\s*=\s*(.+?)\s*$/m)?.[1];
      if (!token || !expiryRaw) continue;
      const expiryValue = expiryRaw.replace(/^"|"$/g, '');
      let expiry = Number(expiryValue);
      if (!Number.isFinite(expiry)) expiry = Date.parse(expiryValue);
      if (!Number.isFinite(expiry)) continue;
      if (expiry < 10_000_000_000) expiry *= 1000;
      if (expiry <= Date.now()) throw new Error('Stored Wrangler OAuth token is expired; run `wrangler whoami` or `wrangler login` and retry.');
      return token;
    } catch (error) {
      if (error.message.includes('expired')) throw error;
    }
  }
  return null;
}

async function requireCloudflareReadConfig() {
  const safetyConfig = JSON.parse(await readFile(SAFETY_CONFIG_PATH, 'utf8'));
  const token = process.env.CLOUDFLARE_API_TOKEN || await parseWranglerOAuth();
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== safetyConfig.accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID does not match scripts/site-release.config.json.');
  }
  if (process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_ZONE_ID !== safetyConfig.zoneId) {
    throw new Error('CLOUDFLARE_ZONE_ID does not match scripts/site-release.config.json.');
  }
  const accountId = safetyConfig.accountId;
  const zoneId = safetyConfig.zoneId;
  const missing = [!token && 'a valid Wrangler OAuth session or CLOUDFLARE_API_TOKEN', !accountId && 'scripts/site-release.config.json accountId', !zoneId && 'scripts/site-release.config.json zoneId'].filter(Boolean);
  if (missing.length) throw new Error(`Cloudflare release requires ${missing.join(', ')} for remote safety checks.`);
  return { token, accountId, zoneId, routeCheckZone: safetyConfig.routeCheckZone };
}

async function cloudflareGet(pathname, { token, accountId }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Cloudflare read failed (${response.status}) for ${pathname}.`);
  const body = await response.json();
  if (body.success !== true) throw new Error(`Cloudflare read was not successful for ${pathname}.`);
  return body;
}

async function listAll(urlPath, auth) {
  const results = [];
  for (let page = 1; page <= 100; page += 1) {
    const separator = urlPath.includes('?') ? '&' : '?';
    const body = await cloudflareGet(`${urlPath}${separator}page=${page}&per_page=100`, auth);
    const items = Array.isArray(body.result) ? body.result : body.result?.items;
    if (!Array.isArray(items)) throw new Error(`Unexpected Cloudflare list response for ${urlPath}.`);
    results.push(...items);
    const totalPages = body.result_info?.total_pages;
    if ((Number.isFinite(totalPages) && page >= totalPages) || items.length < 100) return results;
  }
  throw new Error(`Cloudflare list exceeded 100 pages: ${urlPath}`);
}

export async function assertCandidateUnbound({ token, accountId, zoneId, routeCheckZone, domains, routes }) {
  const workerName = WORKER_NAMES.candidate;
  if (workerName === WORKER_NAMES.production) throw new Error('Candidate Worker name must differ from production.');
  const customDomains = domains ?? await listAll(`/accounts/${encodeURIComponent(accountId)}/workers/domains`, { token, accountId });
  const zoneBody = await cloudflareGet(`/zones/${encodeURIComponent(zoneId)}`, { token, accountId });
  if (zoneBody.result?.account?.id !== accountId || zoneBody.result?.name !== routeCheckZone) {
    throw new Error('Candidate safety check requires the configured zone ID to resolve to the expected production zone in the selected Cloudflare account.');
  }
  const workerRoutes = routes ?? await listAll(`/zones/${encodeURIComponent(zoneId)}/workers/routes`, { token, accountId });
  const attachedDomains = customDomains.filter((entry) => entry.service === workerName);
  const attachedRoutes = workerRoutes.filter((entry) => entry.script === workerName);
  if (attachedDomains.length || attachedRoutes.length) {
    const details = [
      ...attachedDomains.map((entry) => `custom domain ${entry.hostname}`),
      ...attachedRoutes.map((entry) => `route ${entry.pattern}`),
    ];
    throw new Error(`Candidate Worker ${workerName} already has production-capable triggers (${details.join(', ')}); refusing candidate upload.`);
  }
  return { checkedDomains: customDomains.length, checkedRoutes: workerRoutes.length };
}

async function readManifest(artifactHash, { verifyCurrentSource = false } = {}) {
  if (!/^[a-f0-9]{64}$/.test(artifactHash ?? '')) throw new Error('Pass the full 64-character artifact hash from the build output.');
  const manifestPath = path.join(RELEASES_DIR, 'manifests', `${artifactHash}.json`);
  await assertNoReleaseSymlink(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.artifactHash !== artifactHash) throw new Error('Manifest hash does not match the selected artifact.');
  const archivePath = path.join(RELEASES_DIR, 'packages', artifactHash);
  await assertNoReleaseSymlink(archivePath);
  const archivedFiles = [];
  async function visit(relative = '') {
    for (const name of (await readdir(path.join(archivePath, relative))).sort()) {
      const child = relative ? `${relative}/${name}` : name;
      const full = path.join(archivePath, child);
      const info = await lstat(full);
      if (info.isSymbolicLink()) throw new Error(`Release archive contains a symlink: ${child}`);
      if (info.isDirectory()) await visit(child);
      else if (info.isFile()) {
        const bytes = await readFile(full);
        archivedFiles.push({ path: child, size: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`Release archive contains an unsupported entry: ${child}`);
    }
  }
  await visit();
  archivedFiles.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const computedHash = sha256(Buffer.from(JSON.stringify({
    files: archivedFiles,
    workerSha256: manifest.workerSha256,
    wranglerConfigSha256: manifest.wranglerConfigSha256,
  })));
  if (computedHash !== artifactHash || JSON.stringify(archivedFiles) !== JSON.stringify(manifest.files)) {
    throw new Error('Archived package no longer matches its manifest; refusing upload.');
  }
  if (verifyCurrentSource) {
    const workerBytes = await readFile(path.join(FRONTEND_DIR, 'worker/index.js'));
    const configBytes = await readFile(CONFIG_PATH);
    if (sha256(workerBytes) !== manifest.workerSha256 || sha256(configBytes) !== manifest.wranglerConfigSha256) {
      throw new Error('Worker source or Wrangler config changed after packaging; rebuild before upload.');
    }
  }
  return manifest;
}

async function readWorkerConfig() {
  return parseJsonc(await readFile(CONFIG_PATH, 'utf8'));
}

async function assertWorkerTarget(target) {
  const config = await readWorkerConfig();
  if (config.main !== 'worker/index.js') throw new Error('wrangler.jsonc main must remain worker/index.js.');
  if (target === 'production') {
    if (config.name !== WORKER_NAMES.production) throw new Error(`Base Wrangler name must be ${WORKER_NAMES.production} for production releases.`);
    return;
  }
  const candidate = config.env?.candidate;
  if (candidate?.name !== WORKER_NAMES.candidate) throw new Error(`Candidate env name must be ${WORKER_NAMES.candidate}.`);
  if (candidate.workers_dev !== true || Object.hasOwn(candidate, 'domains') || !Array.isArray(candidate.routes) || candidate.routes.length !== 0) {
    throw new Error('Candidate env must use workers.dev with an explicit empty routes list and no custom domains.');
  }
}

async function deploy(target, artifactHash) {
  const manifest = await readManifest(artifactHash, { verifyCurrentSource: true });
  await assertWorkerTarget(target);
  if (target === 'candidate') {
    const auth = await requireCloudflareReadConfig();
    const check = await assertCandidateUnbound(auth);
    process.stdout.write(`Remote guard passed (${check.checkedDomains} Worker domains across this account; ${check.checkedRoutes} routes on globalperspective.net).\n`);
  }

  const wrangler = path.join(FRONTEND_DIR, 'node_modules/.bin/wrangler');
  const archivePath = path.join(RELEASES_DIR, 'packages', artifactHash);
  const args = ['deploy', '--config', CONFIG_PATH, '--assets', archivePath];
  if (target === 'candidate') args.push('--env', 'candidate');
  process.stdout.write(`Uploading ${artifactHash} to ${WORKER_NAMES[target]} using local Wrangler.\n`);
  const safetyConfig = JSON.parse(await readFile(SAFETY_CONFIG_PATH, 'utf8'));
  const result = await execFileAsync(wrangler, args, {
    cwd: FRONTEND_DIR,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: safetyConfig.accountId },
  });
  const output = `${result.stdout}\n${result.stderr}`;
  process.stdout.write(output);
  const versionId = extractCurrentVersionId(output);
  if (!versionId) throw new Error('Wrangler succeeded but its output did not include Current Version ID; inspect the Cloudflare deployment before marking it verified.');
  const record = {
    schemaVersion: 1,
    target,
    workerName: WORKER_NAMES[target],
    artifactHash,
    commit: manifest.commit,
    runtimeConfigSha256: manifest.runtimeConfigSha256,
    workerSha256: manifest.workerSha256,
    wranglerConfigSha256: manifest.wranglerConfigSha256,
    sourceDirty: manifest.sourceDirty,
    versionId,
    recordedAt: new Date().toISOString(),
  };
  const uploadDir = path.join(RELEASES_DIR, 'uploads');
  await assertNoReleaseSymlink(uploadDir);
  await mkdir(uploadDir, { recursive: true });
  const recordPath = path.join(uploadDir, `${Date.now()}-${target}-${artifactHash}.json`);
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`Uploaded version: ${record.versionId}\nArtifact: ${artifactHash}\nRecord: ${path.relative(REPO_ROOT, recordPath)}\n`);
}

async function markVerified(artifactHash, versionId) {
  if (!versionId) throw new Error('mark-verified requires --version-id from a production upload record.');
  const manifest = await readManifest(artifactHash);
  const uploadDir = path.join(RELEASES_DIR, 'uploads');
  const { readdir } = await import('node:fs/promises');
  const candidates = (await readdir(uploadDir).catch(() => []))
    .filter((file) => file.endsWith('.json'));
  let found = false;
  for (const file of candidates) {
    const record = JSON.parse(await readFile(path.join(uploadDir, file), 'utf8'));
    if (record.target === 'production' && record.artifactHash === artifactHash && record.versionId === versionId) found = true;
  }
  if (!found) throw new Error('No recorded production upload matches that artifact and version ID.');
  const marker = {
    schemaVersion: 1,
    artifactHash,
    versionId,
    commit: manifest.commit,
    runtimeConfigSha256: manifest.runtimeConfigSha256,
    markedVerifiedAt: new Date().toISOString(),
  };
  await writeFile(path.join(RELEASES_DIR, 'last-verified.json'), `${JSON.stringify(marker, null, 2)}\n`);
  process.stdout.write(`Marked ${artifactHash} / ${versionId} as last verified.\n`);
}

export async function stagePagesFromPackage({ artifactHash, manifest, packageDir, docsDir, releasesDir = RELEASES_DIR }) {
  const configPath = path.join(docsDir, 'config.js');
  const configBefore = await readFile(configPath);
  const configHash = sha256(configBefore);
  if (configHash !== manifest.runtimeConfigSha256) {
    throw new Error('Current docs/config.js does not match the archived package; refusing to stage Pages.');
  }
  for (const name of ['assets', 'blog']) {
    const target = path.join(docsDir, name);
    const info = await lstat(target).catch(() => null);
    if (info?.isSymbolicLink()) throw new Error(`Refusing symlink in docs staging path: ${target}`);
  }
  await rm(path.join(docsDir, 'assets'), { recursive: true, force: true });
  await rm(path.join(docsDir, 'blog'), { recursive: true, force: true });
  for (const { path: file } of manifest.files) {
    if (file === 'config.js') continue;
    const source = path.join(packageDir, file);
    const destination = path.join(docsDir, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
  }
  const indexPath = path.join(packageDir, 'index.html');
  await copyFile(indexPath, path.join(docsDir, 'index.html'));
  await copyFile(indexPath, path.join(docsDir, '404.html'));
  if (sha256(await readFile(configPath)) !== configHash) throw new Error('docs/config.js changed during Pages staging.');
  const stageRecord = {
    schemaVersion: 1,
    artifactHash,
    runtimeConfigSha256: configHash,
    stagedAt: new Date().toISOString(),
  };
  const stagedDir = path.join(releasesDir, 'staged-pages');
  if (path.resolve(releasesDir) === RELEASES_DIR) await assertNoReleaseSymlink(stagedDir);
  await mkdir(stagedDir, { recursive: true });
  await writeFile(path.join(stagedDir, `${Date.now()}-${artifactHash}.json`), `${JSON.stringify(stageRecord, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`Staged exact artifact ${artifactHash} into docs/.\nPages config preserved: ${configHash}\nCNAME and .nojekyll were left in place; no commit or push performed.\n`);
}

async function stagePages(artifactHash) {
  const manifest = await readManifest(artifactHash);
  await stagePagesFromPackage({
    artifactHash,
    manifest,
    packageDir: path.join(RELEASES_DIR, 'packages', artifactHash),
    docsDir: path.join(REPO_ROOT, 'docs'),
  });
}

export async function runRelease(args) {
  const [target, ...rest] = args;
  if (target === 'candidate' || target === 'production') {
    if (rest.length !== 1) throw new Error(`Usage: release-site.mjs ${target} <artifact-hash>`);
    await deploy(target, rest[0]);
    return;
  }
  if (target === 'mark-verified') {
    const options = Object.fromEntries(rest.map((value, index) => index % 2 === 0 ? [value, rest[index + 1]] : null).filter(Boolean));
    await markVerified(options['--artifact'], options['--version-id']);
    return;
  }
  if (target === 'stage-pages') {
    const options = Object.fromEntries(rest.map((value, index) => index % 2 === 0 ? [value, rest[index + 1]] : null).filter(Boolean));
    await stagePages(options['--artifact']);
    return;
  }
  throw new Error('Usage: release-site.mjs candidate|production <artifact-hash> | stage-pages --artifact <hash> | mark-verified --artifact <hash> --version-id <id>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runRelease(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`release-site: ${error.message}\n`);
    process.exitCode = 1;
  });
}
