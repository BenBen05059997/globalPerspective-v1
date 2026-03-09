# Cache Transition Fix Plan

## Executive Summary

During the hourly topic refresh cycle, users experience 503 errors because old cached data is deleted before new data is fully generated. This document explains the root cause and proposes a solution.

---

## Problem Statement

**Symptom**: Users see "Cache miss" errors when clicking Summarize/Predict/Trace Cause buttons, especially around the hourly refresh window (X:00 - X:10).

**Impact**: Poor user experience - buttons fail randomly, users must retry.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOURLY REFRESH CYCLE                        │
└─────────────────────────────────────────────────────────────────────┘

Step 1: External trigger refreshes NewsCache table
        ↓
        NewsCache now has NEW topic IDs (titles may change slightly)
        Example: "Global Conflicts 2025-0" → "Global Conflicts Outlook 2025-0"
        ↓
Step 2: NewsProjectInvokeAgentLambda triggered
        ↓
        Reads new topics from NewsCache
        ↓
Step 3: For EACH topic (sequentially):
        ├── Call OpenAI for Summary (~5-10 sec)
        ├── Write Summary to SummarizeAndPredict table
        ├── Call OpenAI for Prediction (~5-10 sec)
        └── Write Prediction to SummarizeAndPredict table

        ⏱️ Total time: 10 topics × 2 calls × ~7 sec = ~2-3 minutes
        ↓
Step 4: pruneObsoleteEntries() runs
        ↓
        DELETES all entries where PK doesn't match new topic IDs
        ↓
Step 5: User requests data via newsSensitiveData Lambda
        ↓
        ❌ Old data: DELETED
        ❌ New data: NOT YET WRITTEN (if generation still in progress)
        ❌ Result: 503 Cache Miss
```

---

## Root Cause Analysis

### Problem 1: Topic IDs Are Unstable

Topic IDs are generated from titles:
```
"Global Conflicts Outlook for 2025: Reshaping World Order" + "-0"
```

If the title changes even slightly between refreshes, the ID changes:
- Old: `Global Conflicts 2025: Year in Review-0`
- New: `Global Conflicts Outlook for 2025: Reshaping World Order-0`

These are **different keys** in DynamoDB, so old data doesn't match.

### Problem 2: Aggressive Pruning

In `NewsProjectInvokeAgentLambda`, after generating new data:

```javascript
// This runs AFTER generation completes
await pruneObsoleteEntries(new Set(topics.map(t => t.id)));
```

This function:
1. Scans the entire SummarizeAndPredict table
2. Finds all entries where PK doesn't match current topic IDs
3. **Deletes them immediately**

### Problem 3: No Overlap Period

There's no window where both old and new data coexist:

```
Timeline:
─────────────────────────────────────────────────────────►
     │                    │                    │
   Old data            Pruning              New data
   exists              happens              complete
     │                    │                    │
     └────────────────────┘                    │
           ↑                                   │
      GAP: No data available                   │
           (503 errors here)                   │
```

### Problem 4: trace_cause Sort Key Bug (Secondary Issue)

In `newsSensitiveData`, the reader uses wrong SK for trace_cause:

```javascript
// Current code (line 244)
const sk = action === 'prediction' ? PREDICTION_SK : SUMMARY_SK;

// When action === 'trace_cause', it falls through to SUMMARY_SK
// But generator writes with SK = 'TRACE_CAUSE'
```

This means trace_cause lookups search for the wrong key.

---

## Proposed Solution: Delayed Pruning with TTL

### Concept

Instead of immediately deleting old entries, let them **expire naturally** via DynamoDB TTL. Only prune entries that are:
1. **Old enough** (> 2 hours) AND
2. **Don't match** current topic IDs

This creates an overlap period where both old and new data exist.

### Why This Works

```
Timeline with fix:
─────────────────────────────────────────────────────────►
     │                    │                    │
   Old data            New data             Old data
   exists              written              expires (TTL)
     │                    │                    │
     └────────────────────┼────────────────────┘
                          │
                    OVERLAP PERIOD
                    (Both exist, no 503s)
```

---

## Implementation Plan

### Change 1: NewsProjectInvokeAgentLambda - Delayed Pruning

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Current** `pruneObsoleteEntries()`:
```javascript
async function pruneObsoleteEntries(validTopicIds) {
  // Deletes ALL entries not matching current topic IDs
  // Problem: Deletes entries that are still useful during transition
}
```

**Proposed** `pruneObsoleteEntries()`:
```javascript
async function pruneObsoleteEntries(validTopicIds) {
  const MIN_AGE_FOR_PRUNE_SECONDS = 2 * 60 * 60; // 2 hours
  const now = Math.floor(Date.now() / 1000);

  // ... scan table ...

  for (const item of Items) {
    const pk = item?.PK;
    const generatedAt = item?.generatedAt;

    // Only delete if:
    // 1. PK doesn't match current topics AND
    // 2. Entry is older than 2 hours
    if (pk && pk.startsWith(PK_PREFIX) && !validPkSet.has(pk)) {
      const ageSeconds = generatedAt
        ? (now - Math.floor(new Date(generatedAt).getTime() / 1000))
        : Infinity;

      if (ageSeconds > MIN_AGE_FOR_PRUNE_SECONDS) {
        keysToDelete.push({ PK: pk, SK: item.SK });
      }
    }
  }
}
```

**Why**: Old entries stay alive for 2 hours even if topic IDs change. Users always have data to see.

### Change 2: newsSensitiveData - Fix trace_cause Sort Key

**File**: `amplify/backend/function/newsSensitiveData/src/index.js`

**Current** (line ~244):
```javascript
const sk = action === 'prediction' ? PREDICTION_SK : SUMMARY_SK;
```

**Proposed**:
```javascript
const sk = action === 'prediction' ? PREDICTION_SK
         : action === 'trace_cause' ? 'TRACE_CAUSE'
         : SUMMARY_SK;
```

**Why**: trace_cause lookups should search for SK='TRACE_CAUSE', not SK='SUMMARY'.

### Change 3: NewsProjectInvokeAgentLambda - Include trace_cause in Default Generation

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Current** (lines ~57-68):
```javascript
if (action === 'summary' || action === 'both') {
  const summary = await generateAndStore(topic, 'summary');
  outputs.push(summary);
}
if (action === 'trace_cause') {
  const traceCause = await generateAndStore(topic, 'trace_cause');
  outputs.push(traceCause);
}
if (action === 'prediction' || action === 'both') {
  const prediction = await generateAndStore(topic, 'prediction');
  outputs.push(prediction);
}
```

**Proposed**:
```javascript
if (action === 'summary' || action === 'both' || action === 'all') {
  const summary = await generateAndStore(topic, 'summary');
  outputs.push(summary);
}
if (action === 'trace_cause' || action === 'both' || action === 'all') {
  const traceCause = await generateAndStore(topic, 'trace_cause');
  outputs.push(traceCause);
}
if (action === 'prediction' || action === 'both' || action === 'all') {
  const prediction = await generateAndStore(topic, 'prediction');
  outputs.push(prediction);
}
```

**Why**: Currently `trace_cause` is never generated during the hourly `'both'` run. Including it ensures data exists.

**Alternative**: Change the scheduled invocation to use `action: 'all'` instead of `action: 'both'`.

---

## Files to Modify

| File | Change | Risk |
|------|--------|------|
| `NewsProjectInvokeAgentLambda/src/index.js` | Delayed pruning (2hr minimum age) | Low |
| `NewsProjectInvokeAgentLambda/src/index.js` | Include trace_cause in 'both' action | Low |
| `newsSensitiveData/src/index.js` | Fix trace_cause sort key | Low |

---

## Testing Checklist

- [ ] Generate summaries for all topics
- [ ] Generate predictions for all topics
- [ ] Generate trace_cause for all topics
- [ ] Old entries survive for 2 hours after topic refresh
- [ ] New entries are written correctly
- [ ] No 503 errors during refresh window
- [ ] Trace cause button works correctly
- [ ] Old entries eventually get cleaned up (after 2+ hours)

---

## Rollback Plan

If issues occur:
1. Revert code changes via `git revert`
2. Redeploy Lambda functions
3. Old behavior restored (aggressive pruning)

---

## Alternative Approaches Considered

### Option A: Versioned Writes (More Complex)

Write all entries with a version tag, maintain a "current version" pointer, switch atomically after all writes complete.

**Pros**: Atomic switch, no partial data
**Cons**: More complex, requires schema changes, pointer management

**Decision**: Overkill for this use case. Delayed pruning is simpler and sufficient.

### Option B: On-Demand Generation

If cache miss, invoke generator Lambda to create data on the fly.

**Pros**: Always returns data
**Cons**: High latency (10+ seconds), increased costs, timeout risks

**Decision**: Poor UX due to latency. Not recommended.

### Option C: Duplicate Tables (Blue/Green)

Maintain two tables, write to inactive one, swap pointers.

**Pros**: Zero-downtime switch
**Cons**: Double storage cost, complex pointer management

**Decision**: Overkill for this use case.

---

## Conclusion

The proposed solution (delayed pruning + trace_cause fixes) is:
- **Simple**: Minimal code changes
- **Safe**: Only affects pruning logic, not write logic
- **Effective**: Creates overlap period where both old and new data exist
- **Low Risk**: Easy to rollback if issues occur

The 2-hour minimum age for pruning ensures users always have data to view, even during the generation window.
