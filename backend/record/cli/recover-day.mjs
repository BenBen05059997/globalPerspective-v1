#!/usr/bin/env node
// Recovery of a missed day's raw articles from public records, no model (decision 0040 rule 2). Operator script:
// runs from a laptop with AWS CLI credentials (only for --merge / --write). Dry-run by default: it fetches and writes
// local files only. See README.md in this folder.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  readFeeds, gdeltTargets, gdeltUrl, parseGdeltDoc, gdeltLine, cdxUrl, snapshotUrl, parseCdx, waybackLines,
  dedupeLines, tally, dayRange, splitWindow, gkgFileUrls, unzipFirst, parseGkg,
} from './recover-lib.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INBOX = 'record/inbox/articles';
const SHADOW = 'record/shadow/inbox/articles';

const THROTTLED = /429|limit requests/i;
const COOLDOWN_AFTER = 3;
const COOLDOWN_MS = 600000;

/** Polite fetch: at least `gapMs` between two requests to one host, retry 429/5xx/network errors with backoff.
 *  429 backoff is 60 s doubling to a 10 min cap (GDELT's limiter lasts minutes); after 3 consecutive 429s (any URL)
 *  it sleeps a 10 min cool-down instead of burning the remaining retries. A thrown error carries `.status`.
 *  `fetchText(url, { binary: true })` returns a Buffer (the GKG zips). */
export function makeFetcher({ gapMs = {}, defaultGapMs = 1000, retries = 6, fetchImpl = fetch, log = console, sleepImpl = sleep, cooldownMs = COOLDOWN_MS } = {}) {
  const last = new Map();
  let streak = 0;
  return async function fetchText(url, { binary = false } = {}) {
    const host = new URL(url).host;
    const gap = gapMs[host] ?? defaultGapMs;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const wait = (last.get(host) || 0) + gap - Date.now();
      if (wait > 0) await sleepImpl(wait);
      last.set(host, Date.now());
      try {
        const res = await fetchImpl(url, { headers: { 'user-agent': 'globalperspective-recovery/1 (operator script)' }, signal: AbortSignal.timeout(60000) });
        if (res.status === 429 || res.status >= 500) { lastErr = Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }); }
        else if (!res.ok) { throw Object.assign(new Error(`HTTP ${res.status}`), { final: true, status: res.status }); }
        else { streak = 0; return binary ? Buffer.from(await res.arrayBuffer()) : await res.text(); }
      } catch (e) {
        if (e.final) throw e;
        lastErr = e;
      }
      const is429 = lastErr.status === 429;
      streak = is429 ? streak + 1 : 0;
      if (attempt < retries) {
        let back;
        if (is429 && streak >= COOLDOWN_AFTER) { back = cooldownMs; streak = 0; log.warn(`  ${COOLDOWN_AFTER} consecutive 429s: cool-down ${back / 1000}s`); }
        else back = is429 ? Math.min(COOLDOWN_MS, 60000 * 2 ** attempt) : Math.min(60000, 5000 * 2 ** attempt);
        log.warn(`  retry ${attempt + 1}/${retries} in ${back / 1000}s: ${host} ${lastErr.message}`);
        await sleepImpl(back);
      }
    }
    throw lastErr;
  };
}

/** GDELT GKG 2.1 raw files (primary GDELT source): the day's 96 quarter-hour zips, `concurrency` at a time. A 404 is a missing
 *  quarter (recorded, not fatal); any other failure after the fetcher's retries is a failed file. status: ok (all 96 read),
 *  partial (some missing/failed), failed (no file read). */
export async function recoverGkg({ targets, day, fetchBuf, now, concurrency = 4, log = console }) {
  const urls = gkgFileUrls(day);
  const results = new Array(urls.length);
  const failures = [];
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      const file = urls[i].split('/').pop();
      try {
        const r = parseGkg(unzipFirst(await fetchBuf(urls[i], { binary: true })).toString('utf8'), targets, day, now);
        results[i] = { state: 'ok', ...r };
      } catch (e) {
        if (e.status === 404) results[i] = { state: 'missing' };
        else { results[i] = { state: 'failed' }; failures.push({ source: 'gdelt-gkg', file, error: e.message }); }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  const lines = [];
  const g = { status: 'ok', filesOk: 0, filesMissing: 0, filesFailed: 0, rows: 0, rowsOurs: 0 };
  for (const r of results) {
    if (r.state === 'ok') { g.filesOk += 1; g.rows += r.rows; g.rowsOurs += r.rowsOurs; lines.push(...r.lines); }
    else if (r.state === 'missing') g.filesMissing += 1;
    else g.filesFailed += 1;
  }
  g.status = g.filesOk === 0 ? 'failed' : (g.filesMissing || g.filesFailed ? 'partial' : 'ok');
  log.log(`  gkg ${g.status}: ${g.filesOk}/${urls.length} files, ${g.filesMissing} missing, ${g.filesFailed} failed, ${g.rows} rows, ${g.rowsOurs} ours, ${lines.length} with a title`);
  return { lines, failures, gkg: g };
}

/** GDELT DOC API: every target domain for the day. Windows that return the 250 cap are halved (down to 15 minutes).
 *  Per domain: ok (articles), zero (every window answered a parsed JSON body, none had articles), failed (a window
 *  failed and was not recovered; a domain that failed once and then answered 0 on the retry pass is still failed). */
export async function recoverGdelt({ targets, day, fetchText, now, englishOnly = true, split = true, log = console, retryPassWaitMs = 60000, sleepImpl = sleep }) {
  const lines = [];
  const perDomain = {};
  const runTarget = async (t) => {
    const failures = [];
    const queue = [[`${day.replace(/-/g, '')}000000`, `${day.replace(/-/g, '')}235959`]];
    let n = 0;
    while (queue.length) {
      const [from, to] = queue.shift();
      let arts;
      try { arts = parseGdeltDoc(await fetchText(gdeltUrl(t.domains, day, { from, to, englishOnly }))); } catch (e) { failures.push({ source: 'gdelt-doc', domain: t.domain, window: `${from}-${to}`, error: e.message }); continue; }
      const halves = split && arts.length >= 250 ? splitWindow(from, to) : null;
      if (halves) { queue.push(...halves); continue; }
      for (const a of arts) { const l = gdeltLine(a, now); if (l) { lines.push(l); n += 1; } }
    }
    perDomain[t.domain] = (perDomain[t.domain] || 0) + n;
    return failures;
  };
  const domainStatus = {};
  const failedOnce = [];
  for (const t of targets) {
    const f = await runTarget(t);
    log.log(`  gdelt ${t.domain}: ${perDomain[t.domain]}${f.length ? ` (${f.length} window(s) failed)` : ''}`);
    if (f.length) failedOnce.push({ t, f }); else domainStatus[t.domain] = perDomain[t.domain] > 0 ? 'ok' : 'zero';
  }
  // One more pass over the domains that failed (GDELT's rate limiter often clears after a pause); what still fails is reported.
  const failures = [];
  if (failedOnce.length) {
    log.log(`  retrying ${failedOnce.length} failed domain(s) once after ${retryPassWaitMs / 1000}s`);
    await sleepImpl(retryPassWaitMs);
    for (const { t, f: first } of failedOnce) {
      const before = perDomain[t.domain];
      const f = await runTarget(t);
      const got = perDomain[t.domain] - before;
      if (f.length) { domainStatus[t.domain] = 'failed'; failures.push(...f); log.log(`  gdelt ${t.domain} (retry): still failing`); }
      else if (got > 0) { domainStatus[t.domain] = 'ok'; log.log(`  gdelt ${t.domain} (retry): ${perDomain[t.domain]}`); }
      else { domainStatus[t.domain] = 'failed'; failures.push(...first.map((x) => ({ ...x, error: `${x.error} (retry answered 0, not trusted)` }))); log.log(`  gdelt ${t.domain} (retry): 0 after a failure, counted as failed`); }
    }
  }
  return { lines, failures, perDomain, domainStatus, gdelt: gdeltSummary(targets, domainStatus, failures) };
}

/** The manifest's gdelt block. throttled: no domain returned a body and every failure looks like the rate limiter;
 *  failed: no domain returned a body for another reason; partial: some domains failed. */
export function gdeltSummary(targets, domainStatus, failures) {
  const vals = targets.map((t) => domainStatus[t.domain]);
  const domainsOk = vals.filter((x) => x === 'ok').length;
  const domainsZero = vals.filter((x) => x === 'zero').length;
  const domainsFailed = vals.filter((x) => x === 'failed').length;
  let status = 'ok';
  if (domainsFailed) {
    if (domainsOk + domainsZero > 0) status = 'partial';
    else status = failures.every((f) => THROTTLED.test(f.error)) ? 'throttled' : 'failed';
  }
  return { status, domainsOk, domainsZero, domainsFailed };
}

/** Wayback: the day's snapshots of each feed, parsed with the selector's parser. */
export async function recoverWayback({ feeds, day, fetchText, now, log = console }) {
  const lines = [];
  const failures = [];
  const perFeed = {};
  for (const f of feeds) {
    let snaps;
    try { snaps = parseCdx(await fetchText(cdxUrl(f.url, day))); } catch (e) { failures.push({ source: 'wayback-rss', target: `${f.name} cdx`, error: e.message }); perFeed[f.name] = { snapshots: 0, lines: 0 }; continue; }
    let n = 0;
    for (const s of snaps) {
      try { const got = waybackLines(await fetchText(snapshotUrl(s.timestamp, s.original)), f, day, now); lines.push(...got); n += got.length; } catch (e) { failures.push({ source: 'wayback-rss', target: `${f.name} ${s.timestamp}`, error: e.message }); }
    }
    perFeed[f.name] = { snapshots: snaps.length, lines: n };
    log.log(`  wayback ${f.name}: ${snaps.length} snapshot(s), ${n} item(s) on the day`);
  }
  return { lines, failures, perFeed };
}

async function loadS3(bucket) {
  const dirs = [process.cwd(), process.env.RECOVER_SDK_DIR].filter(Boolean);
  for (const d of dirs) {
    try { const r = createRequire(path.join(d, 'x.js')); const sdk = r('@aws-sdk/client-s3'); return makeS3Json({ client: new sdk.S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' }), GetObjectCommand: sdk.GetObjectCommand, PutObjectCommand: sdk.PutObjectCommand, bucket }); } catch (e) { /* try next */ }
  }
  throw new Error('@aws-sdk/client-s3 not found: run `npm i --no-save @aws-sdk/client-s3` in a scratch directory and set RECOVER_SDK_DIR to it');
}

function printCounts(day, lines, dupes, failures) {
  const { bySource, byOutlet } = tally(lines);
  console.log(`\n${day}: ${lines.length} new line(s) ${JSON.stringify(bySource)} duplicates dropped ${JSON.stringify(dupes)} failures ${failures.length}`);
  for (const [o, s] of Object.entries(byOutlet).sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${o.padEnd(28)} ${Object.entries(s).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}

export async function main(argv = process.argv.slice(2), { fetchText: injected, sleepImpl } = {}) {
  const { values: v } = parseArgs({
    args: argv,
    options: {
      day: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' },
      write: { type: 'boolean', default: false }, shadow: { type: 'boolean', default: false }, merge: { type: 'boolean', default: false },
      bucket: { type: 'string' }, 'no-gdelt': { type: 'boolean', default: false }, 'no-gkg': { type: 'boolean', default: false }, 'gdelt-doc': { type: 'boolean', default: false }, 'no-wayback': { type: 'boolean', default: false },
      'all-languages': { type: 'boolean', default: false }, 'no-split': { type: 'boolean', default: false },
      domains: { type: 'string' }, 'gdelt-only': { type: 'boolean', default: false }, 'gdelt-delay-ms': { type: 'string', default: '10000' },
    },
  });
  if (!v.day) throw new Error('usage: recover-day.mjs --day YYYY-MM-DD [--to YYYY-MM-DD] [--out dir] [--merge] [--write] [--shadow] [--bucket name]');
  if (v['gdelt-only']) v['no-wayback'] = true; // re-run the GDELT half of a day whose Wayback half is already in
  const days = dayRange(v.day, v.to || v.day);
  const out = path.resolve(v.out || 'recovery-out');
  fs.mkdirSync(out, { recursive: true });
  const bucket = v.bucket || process.env.WORLD_BUCKET;
  const s3 = v.write || v.merge ? await (async () => { if (!bucket) throw new Error('--merge/--write need --bucket or WORLD_BUCKET'); return loadS3(bucket); })() : null;
  const prefix = v.shadow ? SHADOW : INBOX;
  let feeds = readFeeds();
  let targets = gdeltTargets(feeds);
  if (v.domains) { const only = new Set(v.domains.split(',')); targets = targets.filter((t) => only.has(t.domain)); feeds = feeds.filter((f) => only.has(f.source)); }
  const fetchText = injected || makeFetcher({ gapMs: { 'api.gdeltproject.org': Number(v['gdelt-delay-ms']), 'data.gdeltproject.org': 0 }, defaultGapMs: 1000 });
  console.log(`${v.write ? 'WRITE' : 'dry run'}: ${days.join(', ')}; ${targets.length} domains, ${feeds.length} feeds; out ${out}`);

  for (const day of days) {
    const now = new Date().toISOString();
    console.log(`\n== ${day}`);
    const gk = v['no-gdelt'] || v['no-gkg'] ? { lines: [], failures: [], gkg: { status: 'skipped', filesOk: 0, filesMissing: 0, filesFailed: 0, rows: 0, rowsOurs: 0 } } : await recoverGkg({ targets, day, fetchBuf: fetchText, now });
    const docOn = v['gdelt-doc'] && !v['no-gdelt'];
    const g = !docOn ? { lines: [], failures: [], perDomain: {}, gdelt: { status: 'skipped', domainsOk: 0, domainsZero: 0, domainsFailed: 0 } } : await recoverGdelt({ targets, day, fetchText, now, englishOnly: !v['all-languages'], split: !v['no-split'], ...(sleepImpl ? { sleepImpl } : {}) });
    const w = v['no-wayback'] ? { lines: [], failures: [], perFeed: {} } : await recoverWayback({ feeds, day, fetchText, now });
    const existing = s3 ? (await s3.getLines(`${prefix}/${day}.jsonl`)).lines : [];
    // Priority wayback > gkg > doc: Wayback carries the feed's own publishedAt, GDELT only when it saw the article. The day file holds the day's lines (UTC publishedAt).
    const onDay = (l) => !l.publishedAt || l.publishedAt.slice(0, 10) === day;
    const { lines, dupes } = dedupeLines([w.lines.filter(onDay), gk.lines.filter(onDay), g.lines.filter(onDay)], existing);
    const failures = [...gk.failures, ...g.failures, ...w.failures];
    printCounts(day, lines, dupes, failures);
    if (docOn) console.log(`  gdelt-doc ${g.gdelt.status}: ${g.gdelt.domainsOk} with results, ${g.gdelt.domainsZero} zero, ${g.gdelt.domainsFailed} failed of ${targets.length} domains`);
    fs.writeFileSync(path.join(out, `${day}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + (lines.length ? '\n' : ''));
    const { bySource, byOutlet } = tally(lines);
    fs.writeFileSync(path.join(out, `recovery-manifest-${day}.json`), `${JSON.stringify({
      day, fetchedAt: now,
      counts: { lines: lines.length, existingInbox: existing.length, duplicatesDropped: dupes, bySource, byOutlet },
      gkg: gk.gkg,
      gdelt: g.gdelt,
      sources: { 'gdelt-gkg': { queried: gk.gkg.status !== 'skipped' }, 'gdelt-doc': { domains: g.perDomain, queried: docOn }, 'wayback-rss': { feeds: w.perFeed, queried: !v['no-wayback'] } },
      failures,
    }, null, 2)}\n`);
    if (v.write) {
      if (!lines.length) console.log('  nothing to write');
      else {
        const res = await s3.appendLines(`${prefix}/${day}.jsonl`, lines, { idKey: 'rawId' });
        console.log(`  wrote ${prefix}/${day}.jsonl: ${res.appended} appended, ${res.skipped} already there`);
      }
    }
    if (gk.gkg.status === 'failed' || g.gdelt.status === 'throttled' || g.gdelt.status === 'failed') {
      console.log(`  GDELT ${gk.gkg.status === 'failed' ? `gkg failed (no file read)` : `doc ${g.gdelt.status}`}: stopping, exit 2 (re-run with --gdelt-only later)`);
      return 2;
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
