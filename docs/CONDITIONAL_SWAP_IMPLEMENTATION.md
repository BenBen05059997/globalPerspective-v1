# Conditional Swap Implementation Plan

## Current State Analysis

### 1. newsInvokeGemini (Topic Generator)
```javascript
// Line 26: Writes to "latest" directly
const CACHE_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';

// Line 151: Writes topics immediately visible
const item = { id: CACHE_ID, topics, model, limit, updatedAt };
```

**Problem**: Frontend sees new topics immediately, but summaries don't exist yet.

### 2. NewsProjectInvokeAgentLambda (Summary/Prediction Generator)
```javascript
// Line 22: Also reads from "latest"
const TOPICS_ITEM_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';

// Line 136: Reads topics from "latest"
Key: { id: TOPICS_ITEM_ID }

// Line 376-428: Prunes old entries immediately
await pruneObsoleteEntries(new Set(topics.map(t => t.id)));
```

**Problem**: By the time this runs, frontend already sees new topics without data.

### 3. newsSensitiveData (Reader)
```javascript
// Line 9: Reads from "latest"
const TOPICS_ITEM_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';

// Line 272: Fetches topics
Key: { id: TOPICS_ITEM_ID }
```

**No changes needed**: Just keep reading from "latest".

---

## Implementation Plan: Conditional Swap

### Overview

```
BEFORE (Current Flow):
═══════════════════════════════════════════════════════════════════════
newsInvokeGemini → writes "latest" → Frontend sees immediately → ❌ 503
                                              ↑
                                    No summaries yet!

NewsProjectInvokeAgentLambda → generates data → pruneOld → done


AFTER (Conditional Swap):
═══════════════════════════════════════════════════════════════════════
newsInvokeGemini → writes "staging" → Frontend still sees old "latest" ✅
                        ↓
                        (triggers Agent Lambda via EventBridge)
                        ↓
NewsProjectInvokeAgentLambda → reads "staging"
                        ↓
                        generates ALL summaries/predictions
                        ↓
                        copies "staging" → "latest"
                        ↓
                        prunes old data
                        ↓
                        Frontend now sees new "latest" with all data ✅
```

---

## File Changes

### Change 1: newsInvokeGemini - Write to "staging"

**File**: `amplify/backend/function/newsInvokeGemini/src/index.js`

**Lines to change**: 26, 143-167

```javascript
// Line 26: Change default from 'latest' to 'staging'
const CACHE_ID = process.env.TOPICS_CACHE_ITEM_ID || 'staging';  // ← Changed

// Line 143-167: Add generationId and status
async function writeCache({ topics, model, limit }) {
  if (!ddbDoc || !CACHE_TABLE) {
    const reason = !ddbDoc ? 'No DynamoDB client' : 'No TOPICS_DDB_TABLE env';
    console.log(`Skipping cache write: ${reason}`);
    return { cached: false, reason };
  }

  const updatedAt = new Date().toISOString();
  const generationId = `gen-${Date.now()}`;  // ← NEW

  const item = {
    id: CACHE_ID,          // "staging"
    topics,
    model,
    limit,
    updatedAt,
    generationId,          // ← NEW: Track this generation cycle
    status: 'pending',     // ← NEW: Mark as not yet complete
  };

  try {
    console.log(`Attempting DynamoDB cache write: table=${CACHE_TABLE}, id=${CACHE_ID}, generationId=${generationId}`);
    if (usingAwsSdkV3) {
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
    } else {
      await ddbDoc.put({ TableName: CACHE_TABLE, Item: item }).promise();
    }
    console.log(`DynamoDB cache write OK: id=${CACHE_ID}, generationId=${generationId}`);
    return { cached: true, updatedAt, generationId };
  } catch (e) {
    console.error('DynamoDB put error:', e);
    return { cached: false, reason: e.message };
  }
}
```

---

### Change 2: NewsProjectInvokeAgentLambda - Read Staging, Swap After Complete

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Multiple changes needed:**

#### 2.1 Add new constants
```javascript
// After line 22, add:
const STAGING_ITEM_ID = 'staging';
const ACTIVE_ITEM_ID = 'latest';
```

#### 2.2 Modify loadTopics() to read from staging
```javascript
// Line 129-162: Read from staging instead of latest
async function loadTopics() {
  if (!TOPICS_TABLE) {
    throw new Error('TOPICS_DDB_TABLE env var not set');
  }

  // Read from STAGING
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: STAGING_ITEM_ID },  // ← Changed: Read from "staging"
    }),
  );

  if (!Item || !Array.isArray(Item.topics)) {
    console.warn('No staging topics found, checking active...');
    // Fallback to active if no staging (backwards compatibility)
    const { Item: activeItem } = await ddb.send(
      new GetCommand({
        TableName: TOPICS_TABLE,
        Key: { id: ACTIVE_ITEM_ID },
      }),
    );
    if (!activeItem || !Array.isArray(activeItem.topics)) {
      return { topics: [], generationId: null, item: null };
    }
    return {
      topics: activeItem.topics.map((t, idx) => buildTopic(t, idx)),
      generationId: activeItem.generationId || null,
      item: activeItem,
    };
  }

  return {
    topics: Item.topics.map((t, idx) => buildTopic(t, idx)),
    generationId: Item.generationId || `gen-${Date.now()}`,
    item: Item,
  };
}

function buildTopic(t, idx) {
  const stableId = buildStableTopicId(t, idx);
  const categories = Array.isArray(t.categories)
    ? t.categories
    : t.category
      ? [t.category]
      : [];

  return {
    id: stableId,
    topicId: stableId,
    title: t.title,
    description: t.description || '',
    categories,
    regions: Array.isArray(t.regions) ? t.regions : [],
    primary_location: t.primary_location,
    location_context: t.location_context,
    sources: t.sources || [],
  };
}
```

#### 2.3 Add swap function
```javascript
// Add new function after pruneObsoleteEntries:
async function swapStagingToActive(stagingItem, generationId) {
  if (!TOPICS_TABLE || !stagingItem) {
    console.warn('Cannot swap: missing table or staging item');
    return false;
  }

  try {
    // Copy staging to active with status = 'active'
    const activeItem = {
      ...stagingItem,
      id: ACTIVE_ITEM_ID,        // Change id to "latest"
      status: 'active',          // Mark as active
      activatedAt: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: TOPICS_TABLE,
        Item: activeItem,
      }),
    );

    console.log(`✅ Swapped staging → active (generationId: ${generationId})`);
    return true;
  } catch (err) {
    console.error('Failed to swap staging to active:', err);
    return false;
  }
}
```

#### 2.4 Add generation ID to writeCache
```javascript
// Modify writeCache to include generationId (line 340-374):
async function writeCache(topic, kind, response, ttlSeconds, generationId) {
  if (!SUMMARY_TABLE) {
    throw new Error('SUMMARIZE_PREDICT_TABLE env var not set');
  }

  const pk = `${PK_PREFIX}${topic.id}`;
  let sk = SUMMARY_SK;
  if (kind === 'prediction') sk = PREDICTION_SK;
  else if (kind === 'trace_cause') sk = 'TRACE_CAUSE';
  const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

  const item = {
    PK: pk,
    SK: sk,
    topicId: topic.id,
    title: topic.title,
    action: kind,
    content: response.content,
    model: response.modelId,
    provider: 'openai',
    generatedAt: new Date().toISOString(),
    generationId,              // ← NEW: Tag with generation ID
    ttl,
    latencyMs: response.latencyMs,
  };

  await ddb.send(
    new PutCommand({
      TableName: SUMMARY_TABLE,
      Item: item,
    }),
  );

  console.log(`Cached ${kind} for ${topic.id} (generationId: ${generationId})`);
  return item;
}
```

#### 2.5 Modify generateAndStore to pass generationId
```javascript
// Line 222-232:
async function generateAndStore(topic, kind, generationId) {
  let prompt;
  if (kind === 'summary') prompt = buildSummaryPrompt(topic);
  else if (kind === 'trace_cause') prompt = buildTraceCausePrompt(topic);
  else prompt = buildPredictionPrompt(topic);

  const response = await invokeOpenAI(prompt);
  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds, generationId);
  return item;
}
```

#### 2.6 Modify pruneObsoleteEntries to use generationId
```javascript
// Line 376-428: Keep current generation, delete old ones
async function pruneObsoleteEntries(currentGenerationId) {
  if (!SUMMARY_TABLE || !currentGenerationId) {
    return;
  }

  let lastEvaluatedKey = undefined;
  const keysToDelete = [];

  do {
    const { Items, LastEvaluatedKey } = await ddb.send(
      new ScanCommand({
        TableName: SUMMARY_TABLE,
        ProjectionExpression: 'PK, SK, generationId',
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    if (Array.isArray(Items)) {
      for (const item of Items) {
        const pk = item?.PK;
        const itemGenId = item?.generationId;

        // Delete if:
        // 1. Has a generationId AND
        // 2. generationId is different from current
        if (typeof pk === 'string' &&
            pk.startsWith(PK_PREFIX) &&
            itemGenId &&
            itemGenId !== currentGenerationId) {
          keysToDelete.push({ PK: pk, SK: item.SK });
        }
      }
    }

    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);

  if (!keysToDelete.length) {
    console.info('No obsolete entries to prune');
    return;
  }

  console.info(`Pruning ${keysToDelete.length} entries from old generations`);

  const chunks = [];
  for (let i = 0; i < keysToDelete.length; i += 25) {
    chunks.push(keysToDelete.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [SUMMARY_TABLE]: chunk.map(key => ({
            DeleteRequest: { Key: key },
          })),
        },
      }),
    );
  }
}
```

#### 2.7 Update handler to use new flow
```javascript
// Line 35-84: Complete handler rewrite
exports.handler = async (event) => {
  try {
    const payload = parseEvent(event);
    const { action, topicId, readOnly } = normalizeAction(payload);

    // Load topics from STAGING
    const { topics, generationId, item: stagingItem } = await loadTopics();

    if (!topics.length) {
      return http(503, { error: 'Topics cache empty or stale' });
    }

    const filteredTopics = topicId ? topics.filter(t => topicMatches(t, topicId)) : topics;
    if (!filteredTopics.length) {
      return http(404, { error: `No topic found for "${topicId}"` });
    }

    if (readOnly) {
      const results = await Promise.all(filteredTopics.map(topic => readCache(topic, action)));
      return http(200, { cached: true, results });
    }

    console.log(`Starting generation for ${filteredTopics.length} topics (generationId: ${generationId})`);

    // Generate ALL summaries/predictions
    const outputs = [];
    for (const topic of filteredTopics) {
      if (action === 'summary' || action === 'both') {
        const summary = await generateAndStore(topic, 'summary', generationId);
        outputs.push(summary);
      }
      if (action === 'trace_cause' || action === 'both') {  // ← Include trace_cause in 'both'
        const traceCause = await generateAndStore(topic, 'trace_cause', generationId);
        outputs.push(traceCause);
      }
      if (action === 'prediction' || action === 'both') {
        const prediction = await generateAndStore(topic, 'prediction', generationId);
        outputs.push(prediction);
      }
    }

    console.log(`Generation complete: ${outputs.length} items (generationId: ${generationId})`);

    // SWAP: Copy staging → active
    const swapped = await swapStagingToActive(stagingItem, generationId);

    // CLEANUP: Prune old generation entries
    if (!readOnly && CACHE_CLEANUP_ENABLED && swapped) {
      try {
        await pruneObsoleteEntries(generationId);
      } catch (cleanupErr) {
        console.warn('Cache cleanup encountered an issue:', cleanupErr);
      }
    }

    return http(200, {
      success: true,
      generated: outputs.length,
      generationId,
      swapped,
      items: outputs,
    });
  } catch (err) {
    console.error('NewsProjectInvokeAgentLambda error:', err);
    return http(500, { error: err.message || String(err) });
  }
};
```

---

### Change 3: newsSensitiveData - Fix trace_cause SK (Minor)

**File**: `amplify/backend/function/newsSensitiveData/src/index.js`

**Line 329**: Fix trace_cause sort key

```javascript
// Line 329: Add trace_cause handling
const sk = action === 'prediction' ? PREDICTION_SK
         : action === 'trace_cause' ? 'TRACE_CAUSE'
         : SUMMARY_SK;
```

**Note**: The reader doesn't need to change how it reads topics - it still reads from "latest", which will only be updated after all data is generated.

---

## DynamoDB Table State During Refresh

```
BEFORE REFRESH (14:00):
═══════════════════════════════════════════════════════════════════════

NewsCache:
┌──────────┬────────────────┬──────────────┬───────────────┐
│ id       │ topics         │ status       │ generationId  │
├──────────┼────────────────┼──────────────┼───────────────┤
│ latest   │ [old topics]   │ active       │ gen-1703336400│ ← Users see this
│ staging  │ (empty/old)    │ -            │ -             │
└──────────┴────────────────┴──────────────┴───────────────┘

SummarizeAndPredict:
┌─────────────────────┬──────────┬───────────────┐
│ PK                  │ SK       │ generationId  │
├─────────────────────┼──────────┼───────────────┤
│ TOPIC#old-topic-1   │ SUMMARY  │ gen-1703336400│
│ TOPIC#old-topic-1   │ PREDICTION│ gen-1703336400│
│ TOPIC#old-topic-2   │ SUMMARY  │ gen-1703336400│
└─────────────────────┴──────────┴───────────────┘


DURING GENERATION (14:01-14:05):
═══════════════════════════════════════════════════════════════════════

NewsCache:
┌──────────┬────────────────┬──────────────┬───────────────┐
│ id       │ topics         │ status       │ generationId  │
├──────────┼────────────────┼──────────────┼───────────────┤
│ latest   │ [old topics]   │ active       │ gen-1703336400│ ← Users STILL see this
│ staging  │ [new topics]   │ pending      │ gen-1703340000│ ← Being processed
└──────────┴────────────────┴──────────────┴───────────────┘

SummarizeAndPredict:
┌─────────────────────┬──────────┬───────────────┐
│ PK                  │ SK       │ generationId  │
├─────────────────────┼──────────┼───────────────┤
│ TOPIC#old-topic-1   │ SUMMARY  │ gen-1703336400│ ← Old data still readable
│ TOPIC#old-topic-1   │ PREDICTION│ gen-1703336400│
│ TOPIC#new-topic-1   │ SUMMARY  │ gen-1703340000│ ← New data being written
│ TOPIC#new-topic-1   │ PREDICTION│ gen-1703340000│
└─────────────────────┴──────────┴───────────────┘


AFTER SWAP (14:05+):
═══════════════════════════════════════════════════════════════════════

NewsCache:
┌──────────┬────────────────┬──────────────┬───────────────┐
│ id       │ topics         │ status       │ generationId  │
├──────────┼────────────────┼──────────────┼───────────────┤
│ latest   │ [new topics]   │ active       │ gen-1703340000│ ← Users NOW see new
│ staging  │ [new topics]   │ pending      │ gen-1703340000│ ← Same as latest
└──────────┴────────────────┴──────────────┴───────────────┘

SummarizeAndPredict:
┌─────────────────────┬──────────┬───────────────┐
│ PK                  │ SK       │ generationId  │
├─────────────────────┼──────────┼───────────────┤
│ TOPIC#new-topic-1   │ SUMMARY  │ gen-1703340000│ ← Only new data remains
│ TOPIC#new-topic-1   │ PREDICTION│ gen-1703340000│
│ TOPIC#new-topic-2   │ SUMMARY  │ gen-1703340000│
└─────────────────────┴──────────┴───────────────┘

Old data (gen-1703336400) deleted by pruneObsoleteEntries()
```

---

## Summary of Changes

| File | Changes | Lines Affected |
|------|---------|----------------|
| `newsInvokeGemini/src/index.js` | Write to "staging", add generationId & status | ~20 lines |
| `NewsProjectInvokeAgentLambda/src/index.js` | Read staging, swap after complete, prune by generationId | ~100 lines |
| `newsSensitiveData/src/index.js` | Fix trace_cause SK | ~3 lines |

---

## Benefits

1. **Zero 503 errors** - Users always see complete data
2. **Atomic swap** - Staging → Latest is a single write
3. **Clean separation** - Old data cleaned up by generationId
4. **Backwards compatible** - Falls back if no staging exists
5. **Debuggable** - generationId tracks which data belongs together

---

## Ready to Implement?

Would you like me to apply these changes to the Lambda files now?
