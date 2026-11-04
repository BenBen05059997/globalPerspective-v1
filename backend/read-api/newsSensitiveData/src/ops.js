'use strict';

// Action `ops`: the operator's money panel (monitoring/ops.json, written hourly by newsHealth). The one action here that IS an
// auth gate: a valid Firebase token whose uid is listed in env OPS_OPERATOR_UIDS (comma-separated; empty or unset = nobody).
// Everyone else gets 403 with a plain error and no S3 read. The pipeline panel is public and does not come through here.
const OPS_KEY = 'monitoring/ops.json';

/** Set of operator uids from the env value; blanks dropped. */
function operatorUids(value) {
  return new Set(String(value || '').split(',').map((s) => s.trim()).filter(Boolean));
}

const forbidden = { statusCode: 403, body: { success: false, error: 'The ops page is not available for this account.' } };

/**
 * authHeader: the request's Authorization header. verify(authHeader) -> token payload or null (shared firebaseAuth).
 * uids: Set of operator uids. read(key) -> the parsed JSON or null when the file is not there yet.
 * Returns { statusCode, body }. A read failure throws (the handler answers 502): it is not the caller's fault.
 */
async function opsReply({ authHeader, verify, uids, read }) {
  if (!uids.size || !authHeader) return forbidden;
  const claims = await verify(authHeader);
  const uid = claims && (claims.user_id || claims.sub);
  if (!uid || !uids.has(uid)) return forbidden;
  return { statusCode: 200, body: { success: true, data: await read(OPS_KEY) } };
}

/** read(key) over the world bucket; the AWS SDK ships with the Lambda runtime. */
function s3JsonReader({ bucket, region }) {
  let client;
  return async function read(key) {
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    client = client || new S3Client({ region });
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return JSON.parse(await res.Body.transformToString());
    } catch (e) {
      if (e && (e.name === 'NoSuchKey' || e.name === 'NotFound' || (e.$metadata && e.$metadata.httpStatusCode === 404))) return null;
      throw e;
    }
  };
}

module.exports = { OPS_KEY, operatorUids, opsReply, s3JsonReader };
