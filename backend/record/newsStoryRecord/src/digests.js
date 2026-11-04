'use strict';

// Write a view only when its content changed (decision 0037 amendment 2026-11-04). <prefix>views/digests.json maps each view path
// (relative to views/) to the md5 of the exact body bytes last written. A missing or unreadable digest file is an empty map, so the
// first run writes everything.
const crypto = require('crypto');

const DIGESTS_KEY = 'digests.json';

/** The exact bytes s3json.putLatest writes for an object (shared/s3json.js `body`); test/digests.test.js pins the two together. */
const bodyOf = (obj) => `${JSON.stringify(obj)}\n`;
const md5Of = (obj) => crypto.createHash('md5').update(bodyOf(obj)).digest('hex');

/** {files, state}: state 'read' when the digest file was there with a files map, else 'missing' (empty map). */
async function readDigests(s3json, prefix) {
  try {
    const d = await s3json.getJson(`${prefix}views/${DIGESTS_KEY}`);
    if (d && d.files && typeof d.files === 'object' && !Array.isArray(d.files)) return {files: d.files, state: 'read'};
  } catch (e) { /* unreadable: treated as missing */ }
  return {files: {}, state: 'missing'};
}

module.exports = {DIGESTS_KEY, bodyOf, md5Of, readDigests};
