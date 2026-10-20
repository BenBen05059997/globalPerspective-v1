'use strict';

// s3json — JSON objects in S3 for the record (PLAN_2026-10-20_board.md, Stage 1). UNUSED until the record
// writes; written now so the board and the record share one implementation.
// Rule (rules/DATA_STRATEGY.md §3.4, snapshot + pointer): a snapshot key is written once and never changed
// (putOnce, If-None-Match: *, so a second writer gets false instead of overwriting); the "latest" pointer is the
// only key that is overwritten (putLatest, no-cache so readers see the new pointer at once).
// JSONL (the timeline's daily files): getLines reads one JSON object per line with its ETag; appendLines adds events
// by id with a conditional write. S3 supports If-Match on PutObject (conditional writes, 2024+), so two writers
// cannot silently overwrite each other: the loser gets 412, re-reads and retries. Tests use a fake client that
// models ETags and answers 412 to a stale If-Match / If-None-Match.
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

  const lineBody = (events) => events.map((e) => `${JSON.stringify(e)}\n`).join('');

  /** The JSONL object at key -> { lines: [parsed object per non-empty line] ([] when missing), etag (null when missing) }. */
  async function getLines(key) {
    let res;
    try {
      res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    } catch (e) {
      if (named(e, 'NoSuchKey', 'NotFound') || status(e) === 404) return { lines: [], etag: null };
      throw e;
    }
    const text = typeof res.Body.transformToString === 'function' ? await res.Body.transformToString() : String(res.Body);
    const lines = text.split('\n').filter((l) => l.trim()).map((l, i) => {
      try { return JSON.parse(l); } catch (e) { throw new Error(`s3json: ${key} line ${i + 1} is not JSON`); }
    });
    return { lines, etag: res.ETag || null };
  }

  /**
   * Append events (objects with a unique opts.idKey, default 'eventId') to the JSONL object at key, creating it when
   * missing. An incoming event whose id is already stored (or repeated in `events`) is skipped and the stored payload
   * kept; the rest are appended in order. The write is conditional (If-Match: etag, or If-None-Match: * for a new
   * object); on 412 the object is re-read and the append retried, up to opts.retries times (default 3) after the
   * first attempt, then it throws. -> { stored: every event now in the object, appended: n, skipped: n }.
   */
  async function appendLines(key, events, { idKey = 'eventId', retries = 3 } = {}) {
    const incoming = Array.isArray(events) ? events : [];
    incoming.forEach((e) => { if (!e || e[idKey] === undefined || e[idKey] === null || e[idKey] === '') throw new Error(`s3json: appendLines needs a ${idKey} on every event`); });
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const { lines, etag } = await getLines(key);
      const seen = new Set(lines.map((l) => l && l[idKey]));
      const fresh = [];
      for (const e of incoming) { if (!seen.has(e[idKey])) { seen.add(e[idKey]); fresh.push(e); } }
      if (!fresh.length) return { stored: lines, appended: 0, skipped: incoming.length };
      const stored = lines.concat(fresh);
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: lineBody(stored), ContentType: 'application/x-ndjson',
          ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
        }));
        return { stored, appended: fresh.length, skipped: incoming.length - fresh.length };
      } catch (e) {
        if (!(named(e, 'PreconditionFailed') || status(e) === 412)) throw e;
      }
    }
    throw new Error(`s3json: appendLines(${key}) lost the write race ${retries + 1} times (412); nothing was written by this call`);
  }

  return { getJson, putOnce, putLatest, getLines, appendLines };
}

module.exports = { makeS3Json };
