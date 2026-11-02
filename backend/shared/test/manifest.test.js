'use strict';
// manifest.js: a day manifest {schemaVersion:1, days:[sorted unique]} rewritten under If-Match; on a lost race the object is re-read and
// the union recomputed, so two writers cannot lose a day. Tested against a scripted s3json (no S3).
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeManifest } = require('../src/manifest');

// A scripted s3json: reads answer from `state`, puts are recorded, `lose(n)` makes the first n conditional puts return false (412)
// after letting `onLose` change the stored object, as a concurrent writer would.
function fakeJson({ obj = null, etag = null, lose = 0, onLose = () => {} } = {}) {
  const f = { state: { obj, etag }, puts: [], reads: 0, losses: lose };
  f.s3json = {
    async getJsonEtag(key) { f.reads += 1; f.key = key; return { obj: f.state.obj, etag: f.state.etag }; },
    async putJsonIf(key, body, ifMatch) {
      f.puts.push({ key, body, ifMatch });
      if (f.losses > 0) { f.losses -= 1; onLose(f.state); return false; }
      f.state = { obj: body, etag: `${ifMatch}+` };
      return true;
    },
  };
  return f;
}

test('addDays creates the manifest when there is none: schemaVersion 1, the days sorted and unique', async () => {
  const f = fakeJson();
  const days = await makeManifest(f.s3json).addDays('record/facts/manifest.json', ['2026-10-03', '2026-10-01', '2026-10-03']);
  assert.deepEqual(days, ['2026-10-01', '2026-10-03']);
  assert.deepEqual(f.puts, [{ key: 'record/facts/manifest.json', body: { schemaVersion: 1, days: ['2026-10-01', '2026-10-03'] }, ifMatch: null }]);
});

test('addDays merges into the stored days and writes under the ETag it read', async () => {
  const f = fakeJson({ obj: { schemaVersion: 1, days: ['2026-10-01', '2026-10-05'] }, etag: '"e1"' });
  const days = await makeManifest(f.s3json).addDays('k', ['2026-10-03']);
  assert.deepEqual(days, ['2026-10-01', '2026-10-03', '2026-10-05']);
  assert.equal(f.puts[0].ifMatch, '"e1"');
});

test('addDays writes nothing when every day is already there (and returns the stored days)', async () => {
  const f = fakeJson({ obj: { schemaVersion: 1, days: ['2026-10-01', '2026-10-02'] }, etag: '"e1"' });
  const days = await makeManifest(f.s3json).addDays('k', ['2026-10-02', '2026-10-01']);
  assert.deepEqual(days, ['2026-10-01', '2026-10-02']);
  assert.equal(f.puts.length, 0);
  assert.deepEqual(await makeManifest(f.s3json).addDays('k', []), ['2026-10-01', '2026-10-02']); // an empty list is no change either
});

test('addDays with no days against no manifest still creates it (an empty manifest, not a missing one)', async () => {
  const f = fakeJson();
  assert.deepEqual(await makeManifest(f.s3json).addDays('k', []), []);
  assert.deepEqual(f.puts[0].body, { schemaVersion: 1, days: [] });
});

test('addDays treats a stored object without a days array as empty and rewrites it', async () => {
  for (const obj of [{}, { schemaVersion: 1 }, { days: 'x' }, { days: null }]) {
    const f = fakeJson({ obj, etag: '"e"' });
    assert.deepEqual(await makeManifest(f.s3json).addDays('k', ['2026-10-01']), ['2026-10-01']);
    assert.deepEqual(f.puts[0].body, { schemaVersion: 1, days: ['2026-10-01'] });
  }
});

test('addDays on a lost race re-reads, recomputes the union and keeps the other writer\'s day', async () => {
  const f = fakeJson({
    obj: { schemaVersion: 1, days: ['2026-10-01'] }, etag: '"e1"', lose: 1,
    onLose: (s) => { s.obj = { schemaVersion: 1, days: ['2026-10-01', '2026-10-02'] }; s.etag = '"e2"'; }, // the other writer got in first
  });
  const days = await makeManifest(f.s3json).addDays('k', ['2026-10-03']);
  assert.deepEqual(days, ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(f.puts.map((p) => p.ifMatch), ['"e1"', '"e2"']);
  assert.equal(f.reads, 2);
});

test('addDays on a lost race where the other writer already added our day writes nothing more', async () => {
  const f = fakeJson({
    obj: { schemaVersion: 1, days: [] }, etag: '"e1"', lose: 1,
    onLose: (s) => { s.obj = { schemaVersion: 1, days: ['2026-10-03'] }; s.etag = '"e2"'; },
  });
  assert.deepEqual(await makeManifest(f.s3json).addDays('k', ['2026-10-03']), ['2026-10-03']);
  assert.equal(f.puts.length, 1); // the lost one; the retry found nothing to add
});

test('addDays survives 5 lost races and succeeds on the 6th attempt', async () => {
  const f = fakeJson({ obj: { schemaVersion: 1, days: [] }, etag: '"e1"', lose: 5 });
  assert.deepEqual(await makeManifest(f.s3json).addDays('k', ['2026-10-01']), ['2026-10-01']);
  assert.equal(f.puts.length, 6);
});

test('addDays throws after 6 lost races naming the key, and the stored manifest is untouched', async () => {
  const f = fakeJson({ obj: { schemaVersion: 1, days: ['2026-10-01'] }, etag: '"e1"', lose: 99 });
  await assert.rejects(() => makeManifest(f.s3json).addDays('record/notes/entry/manifest.json', ['2026-10-02']), /manifest: record\/notes\/entry\/manifest\.json lost the write race 6 times \(412\)/);
  assert.equal(f.puts.length, 6);
  assert.deepEqual(f.state.obj, { schemaVersion: 1, days: ['2026-10-01'] });
});

test('addDays lets a read error through instead of writing over an unread manifest', async () => {
  const s3json = { getJsonEtag: async () => { throw new Error('AccessDenied'); }, putJsonIf: async () => { throw new Error('must not write'); } };
  await assert.rejects(() => makeManifest(s3json).addDays('k', ['2026-10-01']), /AccessDenied/);
});
