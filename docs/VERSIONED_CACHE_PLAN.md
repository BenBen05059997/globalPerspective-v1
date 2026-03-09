# Option B: Two-Phase Versioned Cache Plan

## Concept Overview

The idea is simple: **never delete old data until new data is 100% complete**.

We achieve this by:
1. Writing new data under a **version tag**
2. Keeping a **pointer** to the "current" version
3. Only updating the pointer **after** all new data is written
4. Old data remains readable until the pointer switches

---

## How It Works (Visual)

```
BEFORE (Current - Broken):
══════════════════════════════════════════════════════════════

Time →   T0          T1          T2          T3          T4
         │           │           │           │           │
         │  Topics   │  Start    │  Prune    │  Finish   │
         │  Refresh  │  Generate │  Old Data │  Generate │
         │           │           │           │           │
         ▼           ▼           ▼           ▼           ▼
Data:   [OLD]      [OLD]       [NONE]      [NONE]     [NEW]
                                  ↑
                            503 ERRORS HERE


AFTER (Versioned - Fixed):
══════════════════════════════════════════════════════════════

Time →   T0          T1          T2          T3          T4
         │           │           │           │           │
         │  Topics   │  Start    │  Writing  │  Switch   │  Prune
         │  Refresh  │  Generate │  v2 Data  │  Pointer  │  v1 Data
         │           │           │           │           │
         ▼           ▼           ▼           ▼           ▼
v1:     [OLD]      [OLD]       [OLD]       [OLD]      [deleted]
v2:      ---        ---        [partial]   [COMPLETE]  [COMPLETE]
Pointer: v1         v1          v1          v2          v2
                                            ↑
                                    ATOMIC SWITCH
                                    (no gap, no 503s)
```

---

## Database Schema Changes

### Current Schema (SummarizeAndPredict Table)

```
PK                                                    SK
─────────────────────────────────────────────────────────────
TOPIC#Global Conflicts Outlook 2025-0                 SUMMARY
TOPIC#Global Conflicts Outlook 2025-0                 PREDICTION
TOPIC#Global Conflicts Outlook 2025-0                 TRACE_CAUSE
TOPIC#Ukraine War-1                                   SUMMARY
TOPIC#Ukraine War-1                                   PREDICTION
...
```

### New Schema (Versioned)

**Option A: Version in PK**
```
PK                                                    SK
─────────────────────────────────────────────────────────────
v#2025-12-23T14:00#TOPIC#Global Conflicts-0           SUMMARY
v#2025-12-23T14:00#TOPIC#Global Conflicts-0           PREDICTION
v#2025-12-23T14:00#TOPIC#Ukraine War-1                SUMMARY
v#2025-12-23T15:00#TOPIC#Global Conflicts-0           SUMMARY    ← new version
v#2025-12-23T15:00#TOPIC#Global Conflicts-0           PREDICTION ← new version
META#CURRENT_VERSION                                  POINTER    ← points to "2025-12-23T15:00"
```

**Option B: Version in SK (Simpler)**
```
PK                                                    SK
─────────────────────────────────────────────────────────────
TOPIC#Global Conflicts-0                              SUMMARY#2025-12-23T14:00
TOPIC#Global Conflicts-0                              SUMMARY#2025-12-23T15:00
TOPIC#Global Conflicts-0                              PREDICTION#2025-12-23T14:00
TOPIC#Global Conflicts-0                              PREDICTION#2025-12-23T15:00
META                                                  CURRENT_VERSION  ← value: "2025-12-23T15:00"
```

**Option C: Separate Version Field (Recommended - Minimal Schema Change)**
```
PK                                                    SK          version
─────────────────────────────────────────────────────────────────────────
TOPIC#Global Conflicts-0                              SUMMARY     2025-12-23T14:00
TOPIC#Global Conflicts-0                              SUMMARY     2025-12-23T15:00
TOPIC#Global Conflicts-0                              PREDICTION  2025-12-23T14:00
TOPIC#Global Conflicts-0                              PREDICTION  2025-12-23T15:00
META                                                  POINTER     (value: "2025-12-23T15:00")
```

Wait - this doesn't work because PK+SK must be unique. Let me revise:

**Recommended: Version as GSI + Keep Simple PK/SK**
```
Primary Table:
PK                                                    SK          version         GSI1PK    GSI1SK
─────────────────────────────────────────────────────────────────────────────────────────────────
TOPIC#Global Conflicts-0                              SUMMARY     2025-12-23T15   VERSION   2025-12-23T15
TOPIC#Global Conflicts-0                              PREDICTION  2025-12-23T15   VERSION   2025-12-23T15
META                                                  POINTER     ---             ---       ---
```

Actually, let's keep it simple. The cleanest approach:

---

## Recommended Approach: Version in SK

### Schema

```
PK                          SK                              Other Fields
────────────────────────────────────────────────────────────────────────
TOPIC#<topicId>             SUMMARY#<version>               content, generatedAt, ttl...
TOPIC#<topicId>             PREDICTION#<version>            content, generatedAt, ttl...
TOPIC#<topicId>             TRACE_CAUSE#<version>           content, generatedAt, ttl...
META                        CURRENT_VERSION                 value: "<version>"
```

**Example:**
```
PK                          SK                              value/content
────────────────────────────────────────────────────────────────────────
TOPIC#Ukraine-War-1         SUMMARY#v-1703340000            "Ukraine summary..."
TOPIC#Ukraine-War-1         SUMMARY#v-1703343600            "Updated summary..."
TOPIC#Ukraine-War-1         PREDICTION#v-1703340000         "Prediction..."
TOPIC#Ukraine-War-1         PREDICTION#v-1703343600         "Updated prediction..."
META                        CURRENT_VERSION                 "v-1703343600"
```

---

## Implementation Steps

### Step 1: Modify NewsProjectInvokeAgentLambda - Write with Version

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

```javascript
// At the start of handler, generate version ID
const versionId = `v-${Math.floor(Date.now() / 1000)}`;

// Modify writeCache() to include version in SK
async function writeCache(topic, kind, response, ttlSeconds, versionId) {
  const pk = `${PK_PREFIX}${topic.id}`;

  // NEW: Include version in SK
  let skBase = SUMMARY_SK;
  if (kind === 'prediction') skBase = PREDICTION_SK;
  else if (kind === 'trace_cause') skBase = 'TRACE_CAUSE';

  const sk = `${skBase}#${versionId}`;  // e.g., "SUMMARY#v-1703343600"

  const item = {
    PK: pk,
    SK: sk,
    version: versionId,  // Also store as field for easy querying
    topicId: topic.id,
    title: topic.title,
    action: kind,
    content: response.content,
    // ... other fields
  };

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: item,
  }));
}
```

### Step 2: Modify NewsProjectInvokeAgentLambda - Update Pointer After All Writes

```javascript
// After ALL topics are processed successfully
async function updateVersionPointer(versionId) {
  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: 'META',
      SK: 'CURRENT_VERSION',
      value: versionId,
      updatedAt: new Date().toISOString(),
    },
  }));
  console.log(`Version pointer updated to: ${versionId}`);
}

// In handler, after the loop completes:
exports.handler = async (event) => {
  const versionId = `v-${Math.floor(Date.now() / 1000)}`;

  // ... generate all summaries/predictions ...

  for (const topic of filteredTopics) {
    if (action === 'summary' || action === 'both') {
      await generateAndStore(topic, 'summary', versionId);
    }
    // ... etc
  }

  // AFTER all writes succeed, update pointer
  await updateVersionPointer(versionId);

  // THEN prune old versions (keep last 2)
  await pruneOldVersions(2);

  return http(200, { success: true, version: versionId });
};
```

### Step 3: Modify NewsProjectInvokeAgentLambda - Prune Old Versions

```javascript
async function pruneOldVersions(keepCount = 2) {
  // 1. Get current version pointer
  const { Item: pointerItem } = await ddb.send(new GetCommand({
    TableName: SUMMARY_TABLE,
    Key: { PK: 'META', SK: 'CURRENT_VERSION' },
  }));
  const currentVersion = pointerItem?.value;

  // 2. Scan for all unique versions
  const versions = new Set();
  let lastKey = undefined;

  do {
    const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand({
      TableName: SUMMARY_TABLE,
      ProjectionExpression: 'version',
      FilterExpression: 'attribute_exists(version)',
      ExclusiveStartKey: lastKey,
    }));

    Items?.forEach(item => {
      if (item.version) versions.add(item.version);
    });
    lastKey = LastEvaluatedKey;
  } while (lastKey);

  // 3. Sort versions, keep newest N
  const sortedVersions = Array.from(versions).sort().reverse();
  const versionsToDelete = sortedVersions.slice(keepCount);

  // 4. Never delete current version
  const safeToDelete = versionsToDelete.filter(v => v !== currentVersion);

  if (safeToDelete.length === 0) return;

  // 5. Delete old version entries
  for (const oldVersion of safeToDelete) {
    // Scan and delete all entries with this version
    let deleteKey = undefined;
    do {
      const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand({
        TableName: SUMMARY_TABLE,
        FilterExpression: 'version = :v',
        ExpressionAttributeValues: { ':v': oldVersion },
        ExclusiveStartKey: deleteKey,
      }));

      if (Items?.length) {
        const chunks = chunkArray(Items, 25);
        for (const chunk of chunks) {
          await ddb.send(new BatchWriteCommand({
            RequestItems: {
              [SUMMARY_TABLE]: chunk.map(item => ({
                DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
              })),
            },
          }));
        }
      }
      deleteKey = LastEvaluatedKey;
    } while (deleteKey);
  }

  console.log(`Pruned ${safeToDelete.length} old versions`);
}
```

### Step 4: Modify newsSensitiveData - Read with Version

**File**: `amplify/backend/function/newsSensitiveData/src/index.js`

```javascript
async function readSummaryPredictionCache(action, topicId) {
  // 1. First, get current version pointer
  const { Item: pointerItem } = await client.send(new GetCommand({
    TableName: SUMMARIZE_PREDICT_TABLE,
    Key: { PK: 'META', SK: 'CURRENT_VERSION' },
  }));

  const currentVersion = pointerItem?.value;
  if (!currentVersion) {
    return {
      statusCode: 503,
      body: { success: false, error: 'No version pointer found' },
    };
  }

  // 2. Build SK with version
  const pk = `${PK_PREFIX}${topicId}`;
  let skBase = action === 'prediction' ? PREDICTION_SK
             : action === 'trace_cause' ? 'TRACE_CAUSE'
             : SUMMARY_SK;

  const sk = `${skBase}#${currentVersion}`;  // e.g., "SUMMARY#v-1703343600"

  // 3. Get the item
  const { Item } = await client.send(new GetCommand({
    TableName: SUMMARIZE_PREDICT_TABLE,
    Key: { PK: pk, SK: sk },
  }));

  if (!Item) {
    // Fallback: try previous version? Or return 503
    return {
      statusCode: 503,
      body: { success: false, error: 'Cache miss', reason: 'MISSING' },
    };
  }

  // 4. Return data
  return {
    statusCode: 200,
    body: {
      success: true,
      cached: true,
      data: normalizeSummaryPrediction(Item),
      version: currentVersion,
    },
  };
}
```

---

## Complete Flow After Implementation

```
Time →   T0              T1              T2              T3              T4
         │               │               │               │               │
         │  Topics       │  Start Gen    │  Finish Gen   │  Update       │  Prune
         │  Refresh      │  (v2)         │  (v2)         │  Pointer→v2   │  v1
         │               │               │               │               │
         ▼               ▼               ▼               ▼               ▼

Pointer: v1              v1              v1              v2              v2
         ↓               ↓               ↓               ↓               ↓
Reader   reads v1        reads v1        reads v1        reads v2        reads v2
sees:    [OLD DATA]      [OLD DATA]      [OLD DATA]      [NEW DATA]      [NEW DATA]

v1 data: [exists]        [exists]        [exists]        [exists]        [deleted]
v2 data: [none]          [partial]       [complete]      [complete]      [complete]

                                                         ↑
                                                   ATOMIC SWITCH
                                                   Zero downtime!
```

---

## Pros and Cons

### Pros
- **Zero downtime**: Readers always see complete data (either all v1 or all v2)
- **Atomic switch**: Pointer update is a single DynamoDB write
- **Rollback easy**: Just update pointer back to previous version
- **Audit trail**: Can keep multiple versions for debugging

### Cons
- **More complex**: More code to maintain
- **Storage cost**: Temporarily stores 2x data during transition
- **Schema change**: SK format changes, need migration for existing data
- **Extra read**: Reader must first fetch pointer, then fetch data (2 reads)

---

## Migration Plan for Existing Data

If you have existing data without versions:

### Option 1: Dual-Read (Backwards Compatible)

```javascript
// In reader, try versioned first, fall back to non-versioned
async function readWithFallback(action, topicId) {
  // Try versioned read first
  const versionedResult = await readVersioned(action, topicId);
  if (versionedResult.statusCode === 200) {
    return versionedResult;
  }

  // Fall back to old non-versioned read
  return readLegacy(action, topicId);
}
```

### Option 2: One-Time Migration Script

```javascript
// Run once to add version to existing entries
async function migrateToVersioned() {
  const version = 'v-legacy';

  // Scan all existing entries
  // For each, create new entry with version in SK
  // Set pointer to 'v-legacy'
  // Delete old entries (optional, or let TTL expire)
}
```

---

## Summary: Steps to Implement Version B

| Step | File | Change |
|------|------|--------|
| 1 | `NewsProjectInvokeAgentLambda` | Generate `versionId` at start of handler |
| 2 | `NewsProjectInvokeAgentLambda` | Modify `writeCache()` to include version in SK |
| 3 | `NewsProjectInvokeAgentLambda` | Add `updateVersionPointer()` function |
| 4 | `NewsProjectInvokeAgentLambda` | Call pointer update AFTER all writes complete |
| 5 | `NewsProjectInvokeAgentLambda` | Replace `pruneObsoleteEntries()` with `pruneOldVersions()` |
| 6 | `newsSensitiveData` | Read pointer first, then read data with versioned SK |
| 7 | Migration | Handle existing non-versioned data (dual-read or migrate) |

---

## Recommendation

**For your use case, Option B (Versioning) may be overkill.**

The simpler **delayed pruning** approach (from the previous plan) achieves 90% of the benefit with 10% of the complexity:

| Approach | Complexity | Downtime | Code Changes |
|----------|------------|----------|--------------|
| Delayed Pruning | Low | ~2-3 min (acceptable) | ~20 lines |
| Versioning | High | Zero | ~150 lines |

**Choose Versioning if:**
- You need **zero downtime** (critical production system)
- You want **rollback capability**
- You need **audit trail** of previous versions

**Choose Delayed Pruning if:**
- 2-3 minutes of stale data is acceptable
- You want minimal code changes
- You want faster time to fix
