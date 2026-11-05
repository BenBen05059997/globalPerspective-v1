#!/usr/bin/env node
// Recovery of a missed day's raw articles from public records, no model (decision 0040 rule 2). Operator script:
// runs from a laptop with AWS CLI credentials (only for --merge / --write). Dry-run by default: it fetches and writes
// local files only. See README.md in this folder.
import fs from 'node:fs';
import { requireSdk, REGION } from './sdk.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { readFeeds, gdeltTargets, dedupeLines, tally, dayRange } from './recover-lib.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');

const INBOX = 'record/inbox/articles';
const SHADOW = 'record/shadow/inbox/articles';

// The fetcher and the per-source recoveries live in the newsRecover Lambda (one copy); re-exported for the tests.
const { makeFetcher, recoverGkg, recoverGdelt, gdeltSummary, recoverWayback } = createRequire(import.meta.url)('../newsRecover/src/recover.js');
export { makeFetcher, recoverGkg, recoverGdelt, gdeltSummary, recoverWayback };

async function loadS3(bucket) {
  const sdk = requireSdk('@aws-sdk/client-s3');
  return makeS3Json({ client: new sdk.S3Client({ region: REGION }), GetObjectCommand: sdk.GetObjectCommand, PutObjectCommand: sdk.PutObjectCommand, bucket });
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
