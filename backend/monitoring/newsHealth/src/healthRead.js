'use strict';

// Reading S3 objects through the readText port for health.js and heal.js. A key that does not exist is { missing: true }; any other
// failure is { error } (never thrown, never turned into a value).
const errText = (e) => String((e && e.message) || e).slice(0, 200);

async function readJson(ports, key) {
  try {
    const r = await ports.readText(key);
    if (!r) return { missing: true };
    return { json: JSON.parse(r.text), at: r.at || null };
  } catch (e) { return { error: errText(e) }; }
}

async function readLines(ports, key) {
  try {
    const r = await ports.readText(key);
    if (!r) return { missing: true };
    return { lines: r.text.split('\n').filter((l) => l.trim()).length, at: r.at || null };
  } catch (e) { return { error: errText(e) }; }
}

module.exports = { readJson, readLines, errText };
