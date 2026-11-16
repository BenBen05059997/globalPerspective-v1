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

/** The lines of an entries inbox day and how many of them carry the written-late marker (decision 0061). A line that does not parse counts as a line, not as late. */
async function readEntryLines(ports, key) {
  try {
    const r = await ports.readText(key);
    if (!r) return { missing: true };
    const lines = r.text.split('\n').filter((l) => l.trim());
    const late = lines.filter((l) => { try { const o = JSON.parse(l); return Boolean(o && o.writtenLate); } catch { return false; } }).length;
    return { lines: lines.length, late, at: r.at || null };
  } catch (e) { return { error: errText(e) }; }
}

module.exports = { readJson, readLines, readEntryLines, errText };
