'use strict';

// Day-zero rule for readers of the `today-archive` item (Batch 3 / phase A). The item has a 24 h
// notion of freshness but NewsCache TTL is disabled, so during a pipeline stall it keeps serving
// old entries. A reader that stamps every entry of it with today's date then re-dates old stories.
// An entry counts as "today" only if IT was archived today (UTC). An older entry is already in its
// own archive#<day> row (the writer puts every entry in both), so dropping it here loses nothing.
// Byte-identical copy in six Lambdas (scripts/check-shared-sync.mjs guards it). Pure, no deps.

function utcDay(ms) { return new Date(ms).toISOString().slice(0, 10); }

function keepDayZero(entries, nowMs = Date.now()) {
  const today = utcDay(nowMs);
  return (Array.isArray(entries) ? entries : []).filter((e) => {
    const t = Date.parse(e && e.archivedAt);
    return Number.isFinite(t) && utcDay(t) === today;
  });
}

module.exports = { keepDayZero, utcDay };
