'use strict';
// Rebuild test (decision 0035): rebuild every view from a local copy of record/ (facts, inbox, operator, readings) in memory and
// compare with a local copy of the live views. Nothing is written anywhere but memory. Not a test file.
//
//   node rebuild-test.js RECORD_DIR LIVE_VIEWS_DIR TODAY [--ignore field,field]
//   RECORD_DIR      a copy of s3://<world bucket>/record/ without views/ (aws s3 sync ... --exclude 'views/*')
//   LIVE_VIEWS_DIR  a copy of s3://<world bucket>/record/views/
//   TODAY           the day the live views were built for (views/manifest.json factsThrough)
//   --ignore        extra top-level or story fields to drop before comparing (e.g. a field the deployed code no longer writes)
//
// builtAt and runId are always ignored. Exit 1 when any view differs, is missing, or is extra.
const fs = require('node:fs');
const path = require('node:path');
const {fakeS3} = require('../test/fake-s3');
const {makePublisher} = require('../src/publish');

const [recordDir, liveDir, today, flag, list] = process.argv.slice(2);
if (!recordDir || !liveDir || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) {
  console.error('usage: node rebuild-test.js RECORD_DIR LIVE_VIEWS_DIR TODAY [--ignore field,field]');
  process.exit(2);
}
const ignore = new Set(['builtAt', 'runId', ...(flag === '--ignore' && list ? list.split(',') : [])]);

const files = (dir) => fs.readdirSync(dir, {recursive: true}).filter((n) => fs.statSync(path.join(dir, n)).isFile());
const strip = (v) => {
  if (Array.isArray(v)) return v.map(strip);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.keys(v).filter((k) => !ignore.has(k)).sort().map((k) => [k, strip(v[k])]));
};

(async () => {
  const f = fakeS3();
  for (const n of files(recordDir)) f.objs.set(`record/${n}`, {body: fs.readFileSync(path.join(recordDir, n), 'utf8'), etag: '"copy"'});
  const builtAt = `${today}T23:59:00.000Z`;
  const out = await makePublisher({s3json: f.s3json}).publish({prefix: 'record/', today, builtAt, runId: 'rebuild-test'});

  const rebuilt = new Map([...f.objs].filter(([k]) => k.startsWith('record/views/')).map(([k, o]) => [k.slice('record/views/'.length), o.body]));
  const live = new Map(files(liveDir).map((n) => [n, fs.readFileSync(path.join(liveDir, n), 'utf8')]));
  const counts = (k) => k.startsWith('counts/');
  const missing = [...live.keys()].filter((k) => !rebuilt.has(k) && !counts(k)); // counts are rewritten only for recent days
  const extra = [...rebuilt.keys()].filter((k) => !live.has(k));
  const differ = [];
  for (const [k, body] of rebuilt) {
    if (!live.has(k)) continue;
    if (JSON.stringify(strip(JSON.parse(body))) !== JSON.stringify(strip(JSON.parse(live.get(k))))) differ.push(k);
  }
  console.log(JSON.stringify({today, rebuilt: rebuilt.size, live: live.size, compared: rebuilt.size - extra.length, stories: out.stories, active: out.active,
    same: rebuilt.size - extra.length - differ.length, differ: differ.length, missing: missing.length, extra: extra.length, ignored: [...ignore]}));
  for (const [label, keys] of [['differ', differ], ['missing', missing], ['extra', extra]]) if (keys.length) console.log(label, keys.slice(0, 10).join(' '));
  process.exit(differ.length || missing.length || extra.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
