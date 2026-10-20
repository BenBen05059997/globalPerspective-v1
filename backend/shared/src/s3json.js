'use strict';

// s3json — JSON objects in S3 for the record (PLAN_2026-10-20_board.md, Stage 1). UNUSED until the record
// writes; written now so the board and the record share one implementation.
// Rule (rules/DATA_STRATEGY.md §3.4, snapshot + pointer): a snapshot key is written once and never changed
// (putOnce, If-None-Match: *, so a second writer gets false instead of overwriting); the "latest" pointer is the
// only key that is overwritten (putLatest, no-cache so readers see the new pointer at once).
// The client and command constructors are injected, so this file needs no AWS SDK and tests use a fake client.

const status = (e) => (e && e.$metadata && e.$metadata.httpStatusCode) || 0;
const named = (e, ...names) => e && (names.includes(e.name) || names.includes(e.Code) || names.includes(e.code));

function makeS3Json({ client, GetObjectCommand, PutObjectCommand, bucket }) {
  const body = (obj) => `${JSON.stringify(obj)}\n`;

  /** The parsed object at key, or null when there is none. */
  async function getJson(key) {
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const text = typeof res.Body.transformToString === 'function' ? await res.Body.transformToString() : String(res.Body);
      return JSON.parse(text);
    } catch (e) {
      if (named(e, 'NoSuchKey', 'NotFound') || status(e) === 404) return null;
      throw e;
    }
  }

  /** Write a snapshot only if the key is free. true when written, false when it already exists (412). */
  async function putOnce(key, obj) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: body(obj), ContentType: 'application/json', IfNoneMatch: '*',
      }));
      return true;
    } catch (e) {
      if (named(e, 'PreconditionFailed') || status(e) === 412) return false;
      throw e;
    }
  }

  /** Overwrite a "latest" pointer key. */
  async function putLatest(key, obj) {
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body(obj), ContentType: 'application/json', CacheControl: 'no-cache',
    }));
  }

  return { getJson, putOnce, putLatest };
}

module.exports = { makeS3Json };
