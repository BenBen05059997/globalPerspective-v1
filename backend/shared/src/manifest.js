'use strict';

// A day manifest {schemaVersion:1, days:[sorted unique]}: record/facts/manifest.json (decision 0036 section 1) and each record/notes/<subtype>/manifest.json (0042). Rewritten under If-Match
// through shared s3json (getJsonEtag, putJsonIf); on 412 the object is re-read and the union recomputed, so two writers
// cannot lose a day.
const RETRIES = 5;

function makeManifest(s3json) {
  /** Add `dates` to the manifest at key -> the stored days. Throws after RETRIES lost races; nothing half-written. */
  async function addDays(key, dates) {
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const {obj, etag} = await s3json.getJsonEtag(key);
      const old = obj && Array.isArray(obj.days) ? obj.days : [];
      const days = [...new Set([...old, ...dates])].sort();
      if (obj && days.length === old.length) return old;
      if (await s3json.putJsonIf(key, {schemaVersion: 1, days}, etag)) return days;
    }
    throw new Error(`manifest: ${key} lost the write race ${RETRIES + 1} times (412)`);
  }
  return {addDays};
}

module.exports = {makeManifest, RETRIES};
