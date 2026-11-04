'use strict';

// Write a view only when its content changed (decision 0037 amendment 2026-11-04). <prefix>views/digests.json maps each view path
// (relative to views/) to the md5 of the exact body bytes last written. A missing or unreadable digest file is an empty map, so the
// first run writes everything.
//
// The digest leaves out the view's top-level `builtFrom` (factsThrough, readingsThrough, provisionalThrough): that stamp advances every day
// for every view (factsThrough is the newest fact of the whole record), so hashing it made each nightly run rewrite all ~9,000 files
// (2026-11-04: "9293 of 9293"). A view whose content did not change therefore keeps the stamp of the run that last changed it; its
// content cannot be newer than that, because a fact that would alter it changes the digest and rewrites the view with the new stamp.
// The record-wide freshness is the manifest's, which is written every run.
const crypto = require('crypto');

const DIGESTS_KEY = 'digests.json';

/** The exact bytes s3json.putLatest writes for an object (shared/s3json.js `body`); test/digests.test.js pins the two together. */
const bodyOf = (obj) => `${JSON.stringify(obj)}\n`;
/** The digest of a view: md5 of its body without the top-level builtFrom (see above). The same key order as the body, so equal content gives an equal digest. */
const md5Of = (obj) => {
  const {builtFrom, ...content} = obj;
  return crypto.createHash('md5').update(bodyOf(content)).digest('hex');
};

/** {files, state}: state 'read' when the digest file was there with a files map, else 'missing' (empty map). */
async function readDigests(s3json, prefix) {
  try {
    const d = await s3json.getJson(`${prefix}views/${DIGESTS_KEY}`);
    if (d && d.files && typeof d.files === 'object' && !Array.isArray(d.files)) return {files: d.files, state: 'read'};
  } catch (e) { /* unreadable: treated as missing */ }
  return {files: {}, state: 'missing'};
}

module.exports = {DIGESTS_KEY, bodyOf, md5Of, readDigests};
