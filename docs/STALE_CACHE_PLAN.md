# Stale Cache Plan (Topics + Summary/Prediction/Trace Cause)

> **LEGACY PLANNING DOC — Implemented.** Option A (stale-while-revalidate) was chosen.
> `TOPICS_CACHE_MAX_AGE_SECONDS` is set to 9000 (2.5h). Topics return `stale: true` instead of 503.
> `useGeminiTopics` returns `isStale`, `updatedAt`, `hasNewData`. Background polling runs every 10min.
> This document is kept for historical context.

---

## Context
- The frontend reads cached topics and cached AI outputs (summary, prediction, trace cause) from `newsSensitiveData`.
- The generator (`NewsProjectInvokeAgentLambda`) runs after the hourly topics refresh and writes AI outputs to DynamoDB.
- During the 3-5 minute gap, the cache may be missing and the reader returns 503.

## What We Observed
- Topics cache hits while summary/prediction/trace_cause can return:
  - `Cache miss` with `reason: "MISSING"` when the item does not exist yet.
- This is expected if generation has not finished.

## Goal
- Keep serving the previous cached AI outputs until the new generation is fully written.
- Avoid user-facing errors during the regeneration window.

## Current Behavior
- Topics:
  - Stale handling already implemented: returns `200` with `stale: true` instead of `503`.
- Summary/Prediction/Trace Cause:
  - Cache miss returns `503`.
  - No explicit "stale" handling yet.

## Recommended Approaches

### Option A: Minimal Change (Stale When Item Exists)
- If an item exists but is old (based on `generatedAt` or `ttl`), return it with:
  - `stale: true` and `statusCode: 200`.
- If the item is missing, the gap still exists (first-time or not-yet-generated).

### Option B: Two-Phase Versioning (No Partial Updates)
- Write new AI outputs under a new version key (example):
  - `SK = SUMMARY#<version>`
  - `SK = PREDICTION#<version>`
  - `SK = TRACE_CAUSE#<version>`
- After all new items are written, update a "current version" pointer item:
  - Example: `PK = META`, `SK = CURRENT_VERSION`, `value = <version>`
- Reader always uses the pointer version.
- Result: old data stays visible until new version is complete.

### Option C: On-Demand Generation
- If `newsSensitiveData` gets a miss, it can invoke `NewsProjectInvokeAgentLambda`.
- This reduces wait time but adds runtime cost and latency.

## Proposed Next Steps (If We Proceed)
1) Decide approach: Option A (stale per item) or Option B (version pointer).
2) If Option A:
   - Add stale detection in `readSummaryPredictionCache()` based on `ttl` or `generatedAt`.
3) If Option B:
   - Update `NewsProjectInvokeAgentLambda` to write versioned SKs.
   - Add pointer write after generation completes.
   - Update `newsSensitiveData` to read from pointer version.
4) Update UI to display `stale` for AI outputs if desired.

## Notes
- The user prefers stale data over 503 errors.
- A separate DynamoDB table is not necessary if versioning or stale handling is used.
