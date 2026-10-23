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
  dedupeLines, tally, dayRange, splitWindow,
} from './recover-lib.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INBOX = 'record/inbox/articles';
const SHADOW = 'record/shadow/inbox/articles';

/** Polite fetch: at least `gapMs` between two requests to one host, retry 429/5xx/network errors with backoff. */
export function makeFetcher({ gapMs = {}, defaultGapMs = 1000, retries = 6, fetchImpl = fetch, log = console } = {}) {
  const last = new Map();
  return async function fetchText(url) {
    const host = new URL(url).host;
    const gap = gapMs[host] ?? defaultGapMs;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const wait = (last.get(host) || 0) + gap - Date.now();
      if (wait > 0) await sleep(wait);
      last.set(host, Date.now());
      try {
        const res = await fetchImpl(url, { headers: { 'user-agent': 'globalperspective-recovery/1 (operator script)' }, signal: AbortSignal.timeout(60000) });
        if (res.status === 429 || res.status >= 500) { lastErr = new Error(`HTTP ${res.status}`); }
        else if (!res.ok) { throw Object.assign(new Error(`HTTP ${res.status}`), { final: true }); }
        else return await res.text();
      } catch (e) {
        if (e.final) throw e;
        lastErr = e;
      }
      if (attempt < retries) { const back = /429/.test(lastErr.message) ? Math.min(120000, 15000 * (attempt + 1)) : Math.min(60000, 5000 * 2 ** attempt); log.warn(`  retry ${attempt + 1}/${retries} in ${back / 1000}s: ${host} ${lastErr.message}`); await sleep(back); }
    }
    throw lastErr;
  };
}

/** GDELT: every target domain for the day. Windows that return the 250 cap are halved (down to 15 minutes). */
export async function recoverGdelt({ targets, day, fetchText, now, englishOnly = true, split = true, log = console }) {
  const lines = [];
  const failures = [];
  const perDomain = {};
  for (const t of targets) {
    const queue = [[`${day.replace(/-/g, '')}000000`, `${day.replace(/-/g, '')}235959`]];
    let n = 0;
    while (queue.length) {
      const [from, to] = queue.shift();
      const url = gdeltUrl(t.domains, day, { from, to, englishOnly });
      let arts;
      try { arts = parseGdeltDoc(await fetchText(url)); } catch (e) { failures.push({ source: 'gdelt-doc', target: `${t.domain} ${from}-${to}`, error: e.message }); continue; }
      const halves = split && arts.length >= 250 ? splitWindow(from, to) : null;
      if (halves) { queue.push(...halves); continue; }
      for (const a of arts) { const l = gdeltLine(a, now); if (l) { lines.push(l); n += 1; } }
    }
    perDomain[t.domain] = n;
    log.log(`  gdelt ${t.domain}: ${n}`);
  }
  return { lines, failures, perDomain };
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

export async function main(argv = process.argv.slice(2)) {
  const { values: v } = parseArgs({
    args: argv,
    options: {
      day: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' },
      write: { type: 'boolean', default: false }, shadow: { type: 'boolean', default: false }, merge: { type: 'boolean', default: false },
      bucket: { type: 'string' }, 'no-gdelt': { type: 'boolean', default: false }, 'no-wayback': { type: 'boolean', default: false },
      'all-languages': { type: 'boolean', default: false }, 'no-split': { type: 'boolean', default: false },
      domains: { type: 'string' }, 'gdelt-delay-ms': { type: 'string', default: '6500' },
    },
  });
  if (!v.day) throw new Error('usage: recover-day.mjs --day YYYY-MM-DD [--to YYYY-MM-DD] [--out dir] [--merge] [--write] [--shadow] [--bucket name]');
  const days = dayRange(v.day, v.to || v.day);
  const out = path.resolve(v.out || 'recovery-out');
  fs.mkdirSync(out, { recursive: true });
  const bucket = v.bucket || process.env.WORLD_BUCKET;
  const s3 = v.write || v.merge ? await (async () => { if (!bucket) throw new Error('--merge/--write need --bucket or WORLD_BUCKET'); return loadS3(bucket); })() : null;
  const prefix = v.shadow ? SHADOW : INBOX;
  let feeds = readFeeds();
  let targets = gdeltTargets(feeds);
  if (v.domains) { const only = new Set(v.domains.split(',')); targets = targets.filter((t) => only.has(t.domain)); feeds = feeds.filter((f) => only.has(f.source)); }
  const fetchText = makeFetcher({ gapMs: { 'api.gdeltproject.org': Number(v['gdelt-delay-ms']) }, defaultGapMs: 1000 });
  console.log(`${v.write ? 'WRITE' : 'dry run'}: ${days.join(', ')}; ${targets.length} domains, ${feeds.length} feeds; out ${out}`);

  for (const day of days) {
    const now = new Date().toISOString();
    console.log(`\n== ${day}`);
    const g = v['no-gdelt'] ? { lines: [], failures: [], perDomain: {} } : await recoverGdelt({ targets, day, fetchText, now, englishOnly: !v['all-languages'], split: !v['no-split'] });
    const w = v['no-wayback'] ? { lines: [], failures: [], perFeed: {} } : await recoverWayback({ feeds, day, fetchText, now });
    const existing = s3 ? (await s3.getLines(`${prefix}/${day}.jsonl`)).lines : [];
    // Wayback first: it carries the feed's own publishedAt, GDELT only its seendate. The day file holds the day's lines (UTC publishedAt).
    const onDay = (l) => !l.publishedAt || l.publishedAt.slice(0, 10) === day;
    const { lines, dupes } = dedupeLines([w.lines.filter(onDay), g.lines.filter(onDay)], existing);
    const failures = [...g.failures, ...w.failures];
    printCounts(day, lines, dupes, failures);
    console.log(`  gdelt domains with results: ${Object.values(g.perDomain).filter((n) => n > 0).length} of ${targets.length}`);
    fs.writeFileSync(path.join(out, `${day}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + (lines.length ? '\n' : ''));
    const { bySource, byOutlet } = tally(lines);
    fs.writeFileSync(path.join(out, `recovery-manifest-${day}.json`), `${JSON.stringify({
      day, fetchedAt: now,
      counts: { lines: lines.length, existingInbox: existing.length, duplicatesDropped: dupes, bySource, byOutlet },
      sources: { 'gdelt-doc': { domains: g.perDomain, queried: !v['no-gdelt'] }, 'wayback-rss': { feeds: w.perFeed, queried: !v['no-wayback'] } },
      failures,
    }, null, 2)}\n`);
    if (v.write) {
      if (!lines.length) { console.log('  nothing to write'); continue; }
      const res = await s3.appendLines(`${prefix}/${day}.jsonl`, lines, { idKey: 'rawId' });
      console.log(`  wrote ${prefix}/${day}.jsonl: ${res.appended} appended, ${res.skipped} already there`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
