# Option B: Versioned Cache - Changes Review

## Overview
This document shows the exact code changes for Option B (versioning) before implementation.

---

## Change 1: NewsProjectInvokeAgentLambda - Generate Version ID

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Location**: Line ~35, at the start of `exports.handler`

**Add this at the very beginning**:
```javascript
exports.handler = async (event) => {
  // NEW: Generate version ID for this generation cycle
  const versionId = `v-${Math.floor(Date.now() / 1000)}`;

  try {
    const payload = parseEvent(event);
    // ... rest of handler
```

---

## Change 2: NewsProjectInvokeAgentLambda - Modify writeCache() to Include Version

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Location**: Line ~340, function `writeCache()`

**BEFORE**:
```javascript
async function writeCache(topic, kind, response, ttlSeconds) {
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
    ttl,
    latencyMs: response.latencyMs,
  };

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: item,
  }));

  console.log(`Cached ${kind} for ${topic.id} via OpenAI`);
  return item;
}
```

**AFTER**:
```javascript
async function writeCache(topic, kind, response, ttlSeconds, versionId) {  // ← Add versionId param
  if (!SUMMARY_TABLE) {
    throw new Error('SUMMARIZE_PREDICT_TABLE env var not set');
  }

  const pk = `${PK_PREFIX}${topic.id}`;
  let skBase = SUMMARY_SK;
  if (kind === 'prediction') skBase = PREDICTION_SK;
  else if (kind === 'trace_cause') skBase = 'TRACE_CAUSE';

  // NEW: Append version to SK
  const sk = `${skBase}#${versionId}`;  // e.g., "SUMMARY#v-1703343600"

  const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

  const item = {
    PK: pk,
    SK: sk,                              // ← Now includes version
    version: versionId,                  // ← NEW: Store version as field too
    topicId: topic.id,
    title: topic.title,
    action: kind,
    content: response.content,
    model: response.modelId,
    provider: 'openai',
    generatedAt: new Date().toISOString(),
    ttl,
    latencyMs: response.latencyMs,
  };

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: item,
  }));

  console.log(`Cached ${kind} for ${topic.id} via OpenAI (version: ${versionId})`);
  return item;
}
```

---

## Change 3: NewsProjectInvokeAgentLambda - Pass Version to writeCache()

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Location**: Line ~228, function `generateAndStore()`

**BEFORE**:
```javascript
async function generateAndStore(topic, kind) {
  let prompt;
  if (kind === 'summary') prompt = buildSummaryPrompt(topic);
  else if (kind === 'trace_cause') prompt = buildTraceCausePrompt(topic);
  else prompt = buildPredictionPrompt(topic);

  const response = await invokeOpenAI(prompt);
  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds);
  return item;
}
```

**AFTER**:
```javascript
async function generateAndStore(topic, kind, versionId) {  // ← Add versionId param
  let prompt;
  if (kind === 'summary') prompt = buildSummaryPrompt(topic);
  else if (kind === 'trace_cause') prompt = buildTraceCausePrompt(topic);
  else prompt = buildPredictionPrompt(topic);

  const response = await invokeOpenAI(prompt);
  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds, versionId);  // ← Pass version
  return item;
}
```

---

## Change 4: NewsProjectInvokeAgentLambda - Pass Version in Loop

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Location**: Line ~56-68, the generation loop

**BEFORE**:
```javascript
const outputs = [];
for (const topic of filteredTopics) {
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
}
```

**AFTER**:
```javascript
const outputs = [];
for (const topic of filteredTopics) {
  if (action === 'summary' || action === 'both') {
    const summary = await generateAndStore(topic, 'summary', versionId);  // ← Pass version
    outputs.push(summary);
  }
  if (action === 'trace_cause' || action === 'both') {                    // ← Also include in 'both'
    const traceCause = await generateAndStore(topic, 'trace_cause', versionId);  // ← Pass version
    outputs.push(traceCause);
  }
  if (action === 'prediction' || action === 'both') {
    const prediction = await generateAndStore(topic, 'prediction', versionId);  // ← Pass version
    outputs.push(prediction);
  }
}
```

---

## Change 5: NewsProjectInvokeAgentLambda - Add Version Pointer Update

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Location**: After the generation loop (line ~70), BEFORE pruning

**ADD THIS NEW FUNCTION** (anywhere after imports, before `exports.handler`):
```javascript
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
  console.log(`✅ Version pointer updated to: ${versionId}`);
}
```

**IN THE HANDLER**, after the loop completes:
```javascript
// After the generation loop
for (const topic of filteredTopics) {
  // ... generation code ...
}

// NEW: Update version pointer AFTER all writes succeed
if (!readOnly) {
  await updateVersionPointer(versionId);
}

// THEN run pruning
if (!readOnly && CACHE_CLEANUP_ENABLED) {
  try {
    await pruneOldVersions(2);  // ← Changed from pruneObsoleteEntries
  } catch (cleanupErr) {
    console.warn('Cache cleanup encountered an issue:', cleanupErr);
  }
}
```

---

## Change 6: NewsProjectInvokeAgentLambda - Replace pruneObsoleteEntries() with pruneOldVersions()

**File**: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

**Location**: Replace entire `pruneObsoleteEntries()` function (line ~376)

**DELETE**:
```javascript
async function pruneObsoleteEntries(validTopicIds) {
  // ... entire old function ...
}
```

**REPLACE WITH**:
```javascript
async function pruneOldVersions(keepCount = 2) {
  if (!SUMMARY_TABLE) return;

  try {
    // 1. Get current version pointer
    const { Item: pointerItem } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: 'META', SK: 'CURRENT_VERSION' },
    }));
    const currentVersion = pointerItem?.value;

    if (!currentVersion) {
      console.warn('No version pointer found, skipping cleanup');
      return;
    }

    // 2. Collect all unique versions
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

    // 3. Sort versions (newest first), keep the newest N
    const sortedVersions = Array.from(versions).sort().reverse();
    const versionsToDelete = sortedVersions.slice(keepCount);

    // 4. NEVER delete current version (safety check)
    const safeToDelete = versionsToDelete.filter(v => v !== currentVersion);

    if (safeToDelete.length === 0) {
      console.info('No old versions to prune');
      return;
    }

    console.info(`Pruning ${safeToDelete.length} old versions (keeping ${keepCount} newest)`);

    // 5. Delete entries for each old version
    for (const oldVersion of safeToDelete) {
      let deleteKey = undefined;
      const keysToDelete = [];

      do {
        const { Items, LastEvaluatedKey } = await ddb.send(new ScanCommand({
          TableName: SUMMARY_TABLE,
          FilterExpression: 'version = :v',
          ExpressionAttributeValues: { ':v': oldVersion },
          ProjectionExpression: 'PK, SK',
          ExclusiveStartKey: deleteKey,
        }));

        if (Items?.length) {
          Items.forEach(item => {
            keysToDelete.push({ PK: item.PK, SK: item.SK });
          });
        }
        deleteKey = LastEvaluatedKey;
      } while (deleteKey);

      // Batch delete in chunks of 25
      const chunks = [];
      for (let i = 0; i < keysToDelete.length; i += 25) {
        chunks.push(keysToDelete.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        await ddb.send(new BatchWriteCommand({
          RequestItems: {
            [SUMMARY_TABLE]: chunk.map(key => ({
              DeleteRequest: { Key: key },
            })),
          },
        }));
      }

      console.info(`Pruned version ${oldVersion} (${keysToDelete.length} entries)`);
    }
  } catch (err) {
    console.error('Error pruning old versions:', err);
    throw err;
  }
}
```

---

## Change 7: newsSensitiveData - Read Version Pointer First

**File**: `amplify/backend/function/newsSensitiveData/src/index.js`

**Location**: Replace entire `readSummaryPredictionCache()` function (line ~228)

**DELETE**:
```javascript
async function readSummaryPredictionCache(action, topicId) {
  // ... entire old function ...
}
```

**REPLACE WITH**:
```javascript
async function readSummaryPredictionCache(action, topicId) {
  if (!SUMMARIZE_PREDICT_TABLE) {
    console.error('newsSensitiveData summary/prediction misconfiguration: missing SUMMARIZE_PREDICT_TABLE');
    return {
      statusCode: 500,
      body: { success: false, error: 'Summarize/Prediction table not configured' },
    };
  }

  const client = getDynamoClient();

  try {
    // STEP 1: Get current version pointer
    const { Item: pointerItem } = await client.send(new GetCommand({
      TableName: SUMMARIZE_PREDICT_TABLE,
      Key: { PK: 'META', SK: 'CURRENT_VERSION' },
    }));

    const currentVersion = pointerItem?.value;

    if (!currentVersion) {
      console.warn('newsSensitiveData no version pointer found');
      return {
        statusCode: 503,
        body: { success: false, error: 'No version pointer', reason: 'NO_POINTER' },
      };
    }

    // STEP 2: Build SK with version
    const pk = `${PK_PREFIX}${topicId}`;
    let skBase = action === 'prediction' ? PREDICTION_SK
               : action === 'trace_cause' ? 'TRACE_CAUSE'
               : SUMMARY_SK;

    const sk = `${skBase}#${currentVersion}`;  // e.g., "SUMMARY#v-1703343600"

    console.info('newsSensitiveData summary/prediction lookup', {
      action,
      requestTopicId: topicId,
      pk,
      sk,
      version: currentVersion,
      table: SUMMARIZE_PREDICT_TABLE,
    });

    // STEP 3: Get the item
    const { Item } = await client.send(new GetCommand({
      TableName: SUMMARIZE_PREDICT_TABLE,
      Key: { PK: pk, SK: sk },
      ConsistentRead: true,
    }));

    if (!Item) {
      console.warn('newsSensitiveData summary/prediction cache miss', {
        table: SUMMARIZE_PREDICT_TABLE,
        pk,
        sk,
        version: currentVersion,
        note: 'No item found for current version',
      });
      return {
        statusCode: 503,
        body: { success: false, error: 'Cache miss', reason: 'MISSING' },
      };
    }

    const normalized = normalizeSummaryPrediction(Item);

    console.info('newsSensitiveData summary/prediction cache hit', {
      action,
      table: SUMMARIZE_PREDICT_TABLE,
      pk,
      sk,
      version: currentVersion,
      generatedAt: Item.generatedAt,
      ttl: Item.ttl,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        cached: true,
        data: normalized,
        version: currentVersion,
        stale: summaryPredictionFresh(Item) ? false : true,
      },
    };
  } catch (err) {
    console.error('Summary/Prediction cache error:', err);
    return {
      statusCode: 500,
      body: { success: false, error: 'Failed to read summary/prediction cache' },
    };
  }
}
```

---

## Summary of Changes

| File | Lines Changed | What |
|------|---------------|------|
| `NewsProjectInvokeAgentLambda` | ~35 | Generate versionId |
| `NewsProjectInvokeAgentLambda` | ~56-68 | Pass versionId in loop, include trace_cause in 'both' |
| `NewsProjectInvokeAgentLambda` | ~228 | Add versionId param to generateAndStore() |
| `NewsProjectInvokeAgentLambda` | ~340 | Modify writeCache() to write version in SK |
| `NewsProjectInvokeAgentLambda` | NEW | Add updateVersionPointer() function |
| `NewsProjectInvokeAgentLambda` | ~70 | Call updateVersionPointer() after generation |
| `NewsProjectInvokeAgentLambda` | ~376 | Replace pruneObsoleteEntries() with pruneOldVersions() |
| `newsSensitiveData` | ~228 | Replace readSummaryPredictionCache() with versioned read |

---

## What Will Happen

After deployment:
1. Next hourly run will create entries with version (e.g., `SUMMARY#v-1703343600`)
2. Pointer will be created at `META/CURRENT_VERSION`
3. Reader will fetch pointer first, then read data with that version
4. Old versions will be kept until pruning (keeps last 2 versions)
5. **Zero downtime** during transitions

---

## Do you want me to proceed with these changes?

Reply "yes" to implement, or let me know if you want any modifications first.
