'use strict';

// record/facts/manifest.json {schemaVersion:1, days:[sorted unique]} (decision 0036 section 1). Rewritten under If-Match;
// on 412 the object is re-read and the union recomputed, so two writers cannot lose a day. Built on the same injected
// client as s3json. TODO(coordinator): fold getEtag/putIf into shared s3json.js (REQUEST in the lane mailbox); it is
// local here because this lane may not edit s3json.js.

const status = (e) => (e && e.$metadata && e.$metadata.httpStatusCode) || 0;
const named = (e, ...names) => e && (names.includes(e.name) || names.includes(e.Code) || names.includes(e.code));
const RETRIES = 5;

function makeManifest({client, GetObjectCommand, PutObjectCommand, bucket}) {
  async function read(key) {
    try {
      const res = await client.send(new GetObjectCommand({Bucket: bucket, Key: key}));
      const text = typeof res.Body.transformToString === 'function' ? await res.Body.transformToString() : String(res.Body);
      return {manifest: JSON.parse(text), etag: res.ETag || null};
    } catch (e) {
      if (named(e, 'NoSuchKey', 'NotFound') || status(e) === 404) return {manifest: null, etag: null};
      throw e;
    }
  }

  /** Add `dates` to the manifest at key -> the stored days. Throws after RETRIES lost races; nothing half-written. */
  async function addDays(key, dates) {
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const {manifest, etag} = await read(key);
      const old = manifest && Array.isArray(manifest.days) ? manifest.days : [];
      const days = [...new Set([...old, ...dates])].sort();
      if (manifest && days.length === old.length) return old;
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: `${JSON.stringify({schemaVersion: 1, days})}\n`, ContentType: 'application/json', CacheControl: 'no-cache',
          ...(etag ? {IfMatch: etag} : {IfNoneMatch: '*'}),
        }));
        return days;
      } catch (e) {
        if (!(named(e, 'PreconditionFailed') || status(e) === 412)) throw e;
      }
    }
    throw new Error(`manifest: ${key} lost the write race ${RETRIES + 1} times (412)`);
  }

  return {addDays};
}

module.exports = {makeManifest, RETRIES};
