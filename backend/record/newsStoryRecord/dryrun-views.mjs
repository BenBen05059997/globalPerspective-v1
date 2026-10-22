// Local dry run of the views builder against facts downloaded from S3 (read-only `aws s3 sync` of record/facts/).
// Usage: node dryrun-views.mjs <factsDir> <outDir> [today]
// Goes through the real publisher over a filesystem stand-in for s3json; nothing is written to S3.
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';

const require = createRequire(import.meta.url);
const {makePublisher} = require('./src/publish.js');
const [factsDir, outDir, todayArg] = process.argv.slice(2);
if (!factsDir || !outDir) throw new Error('usage: node dryrun-views.mjs <factsDir> <outDir> [today]');
const today = todayArg || new Date().toISOString().slice(0, 10);

const local = {
  async getJson(key) { const f = join(factsDir, key.replace(/^record\/facts\//, '')); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; },
  async getLines(key) {
    const f = join(factsDir, key.replace(/^record\/facts\//, ''));
    if (!existsSync(f)) return {lines: [], etag: null};
    return {lines: readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)), etag: null};
  },
  async putLatest(key, obj) {
    const f = join(outDir, key.replace(/^record\//, ''));
    mkdirSync(dirname(f), {recursive: true});
    writeFileSync(f, `${JSON.stringify(obj)}\n`);
  },
};

const t0 = Date.now();
const result = await makePublisher({s3json: local}).publish({prefix: 'record/', today, builtAt: new Date().toISOString(), runId: `${today}-dryrun`});
const ms = Date.now() - t0;

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const viewsDir = join(outDir, 'views');
const files = walk(viewsDir);
const read = (p) => JSON.parse(readFileSync(join(viewsDir, p), 'utf8'));
const all = read('index/all.json').stories;
const active = read('index/active.json').stories;
const largest = files.filter((f) => f.includes('/stories/')).map((f) => ({f, size: statSync(f).size, v: JSON.parse(readFileSync(f, 'utf8'))})).sort((a, b) => b.size - a.size)[0];
const linkCounts = files.filter((f) => f.includes('/links/')).map((f) => JSON.parse(readFileSync(f, 'utf8')).links.length);
const summary = {
  today, buildMs: ms, filesWritten: files.length, storiesAll: all.length, storiesActive: active.length, aliases: all.filter((r) => r.aliasOf).length,
  allJsonBytes: statSync(join(viewsDir, 'index/all.json')).size, activeJsonBytes: statSync(join(viewsDir, 'index/active.json')).size,
  largestStory: largest && {threadId: largest.v.threadId, bytes: largest.size, entries: largest.v.entries.length, entriesOmitted: largest.v.entriesOmitted, forks: largest.v.forks.length},
  linksFiles: linkCounts.length, linksMax: Math.max(0, ...linkCounts), linksCapped: linkCounts.filter((n) => n === 50).length,
  counts: files.filter((f) => f.includes('/counts/')).length, manifest: read('manifest.json'),
  entryCountDistribution: {max: Math.max(...all.map((r) => r.entryCount)), over400: all.filter((r) => r.entryCount > 400).length},
};
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
void result;
