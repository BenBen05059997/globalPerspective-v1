'use strict';

// The review's S3 access: reads through shared s3json, plain PutObject for the keys only the review writes
// (readings, review Runs, merge inbox). The client and command classes are injected so tests use a fake.
function makeStore({s3json, client, PutObjectCommand, bucket}) {
  const put = (key, text, ContentType) => client.send(new PutObjectCommand({Bucket: bucket, Key: key, Body: text, ContentType, CacheControl: 'no-cache'}));
  return {
    getJson: s3json.getJson,
    getLines: async (key) => (await s3json.getLines(key)).lines,
    putJson: (key, obj) => put(key, `${JSON.stringify(obj)}\n`, 'application/json'),
    putLines: (key, lines) => put(key, lines.map((l) => `${JSON.stringify(l)}\n`).join(''), 'application/x-ndjson'),
  };
}

module.exports = {makeStore};
