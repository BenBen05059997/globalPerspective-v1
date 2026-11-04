// Would the digest skip make sense on live data? Read-only.
// 1. `aws s3 sync s3://<world bucket>/record/ <liveDir>/record/ --exclude 'shadow/*' --exclude 'shadow-history/*' --exclude 'legacy/*' --exclude 'inbox/*'`
//    and sync inbox/entries for the last two UTC days (the views read them).
// 2. node dryrun-digests.mjs <liveDir> [--sample N] [--ignore-provisional]
// The live view files stand in for the digest file (md5 of their bytes; --sample N keeps only N random stories' stories/ and links/ files, the
// rest in full). --ignore-provisional drops builtFrom.provisionalThrough from the live bodies first. The real publisher then builds the views from the downloaded facts over a filesystem stand-in and reports what it would write.
// Nothing is written anywhere. Not exact for a refresh: its provisional entries come from DynamoDB, so views that show today's entries differ.
import {createRequire} from 'node:module';
import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const require = createRequire(import.meta.url);
const {makePublisher} = require('./src/publish.js');
const args = process.argv.slice(2);
const liveDir = args[0];
const sampleAt = args.indexOf('--sample');
const sample = sampleAt >= 0 ? Number(args[sampleAt + 1]) : 0;
if (!liveDir) throw new Error('usage: node dryrun-digests.mjs <liveDir> [--sample N] [--ignore-provisional]');

const viewsDir = join(liveDir, 'record/views');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
let keys = walk(viewsDir).map((f) => f.slice(viewsDir.length + 1)).filter((k) => k !== 'manifest.json' && k !== 'digests.json');
if (sample) {
  const ids = [...new Set(keys.filter((k) => k.startsWith('stories/')).map((k) => k.slice(8, -5)))].sort(() => Math.random() - 0.5).slice(0, sample);
  const keep = new Set(ids);
  keys = keys.filter((k) => !/^(stories|links)\//.test(k) || keep.has(k.replace(/^[a-z]+\//, '').slice(0, -5)));
}
// A refresh stamps builtFrom.provisionalThrough on every view and the nightly run, having no provisional facts, leaves it out, so views built by
// the other kind of run all differ by that one key; --ignore-provisional shows what is left once it is not counted.
const ignoreProv = args.includes('--ignore-provisional');
const bytes = (k) => {
  const raw = readFileSync(join(viewsDir, k));
  if (!ignoreProv) return raw;
  const o = JSON.parse(raw.toString('utf8'));
  if (o.builtFrom) delete o.builtFrom.provisionalThrough;
  return `${JSON.stringify(o)}\n`;
};
const files = Object.fromEntries(keys.map((k) => [k, createHash('md5').update(bytes(k)).digest('hex')]));

const written = [];
const local = {
  async getJson(key) {
    if (key.endsWith('views/digests.json')) return {schemaVersion: 1, builtAt: null, files};
    const f = join(liveDir, key);
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  },
  async getLines(key) {
    const f = join(liveDir, key);
    if (!existsSync(f)) return {lines: [], etag: null};
    return {lines: readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)), etag: null};
  },
  async putLatest(key) { written.push(key.replace(/^record\/views\//, '')); },
};

const today = new Date().toISOString().slice(0, 10);
const result = await makePublisher({s3json: local}).publish({prefix: 'record/', today, builtAt: new Date().toISOString(), runId: `${today}-dryrun`});
const dir = (k) => (k.includes('/') ? k.split('/').slice(0, k.startsWith('briefs/') ? 2 : 1).join('/') : k);
const byDir = {};
for (const k of written) byDir[dir(k)] = (byDir[dir(k)] || 0) + 1;
console.log(JSON.stringify({sample: sample || 'all', liveFilesCompared: keys.length, result, wouldWriteByDir: byDir, changed: written.filter((k) => !/^(stories|links|counts|forecasts)\//.test(k))}, null, 2));
