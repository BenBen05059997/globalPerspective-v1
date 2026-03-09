# DynamoDB Versioning - Table Structure & Flow

## Current DynamoDB Table (Before Versioning)

### SummarizeAndPredict Table
```
┌─────────────────────────────────┬──────────────┬────────────────────┬─────────────────────┬─────┐
│ PK                              │ SK           │ topicId            │ content             │ ttl │
├─────────────────────────────────┼──────────────┼────────────────────┼─────────────────────┼─────┤
│ TOPIC#Ukraine-War-1             │ SUMMARY      │ Ukraine-War-1      │ "Summary text..."   │ ... │
│ TOPIC#Ukraine-War-1             │ PREDICTION   │ Ukraine-War-1      │ "Prediction text..."│ ... │
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE  │ Ukraine-War-1      │ "Trace cause..."    │ ... │
│ TOPIC#Global-Conflicts-0        │ SUMMARY      │ Global-Conflicts-0 │ "Summary text..."   │ ... │
│ TOPIC#Global-Conflicts-0        │ PREDICTION   │ Global-Conflicts-0 │ "Prediction text..."│ ... │
└─────────────────────────────────┴──────────────┴────────────────────┴─────────────────────┴─────┘
```

**Problem**: When new data is written, old data is deleted immediately → 503 errors during transition

---

## New DynamoDB Table (With Versioning)

### SummarizeAndPredict Table
```
┌─────────────────────────────────┬─────────────────────────┬──────────────┬────────────────────┬─────────────────────┬─────┐
│ PK                              │ SK                      │ version      │ topicId            │ content             │ ttl │
├─────────────────────────────────┼─────────────────────────┼──────────────┼────────────────────┼─────────────────────┼─────┤
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703340000    │ v-1703340000 │ Ukraine-War-1      │ "Old summary..."    │ ... │ ← v1
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703340000 │ v-1703340000 │ Ukraine-War-1      │ "Old prediction..." │ ... │ ← v1
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703340000│ v-1703340000 │ Ukraine-War-1      │ "Old trace..."      │ ... │ ← v1
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703343600    │ v-1703343600 │ Ukraine-War-1      │ "New summary..."    │ ... │ ← v2
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703343600 │ v-1703343600 │ Ukraine-War-1      │ "New prediction..." │ ... │ ← v2
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703343600│ v-1703343600 │ Ukraine-War-1      │ "New trace..."      │ ... │ ← v2
│ META                            │ CURRENT_VERSION         │ -            │ -                  │ -                   │ -   │ ← POINTER
│                                 │                         │              │                    │                     │     │
│ (value field = "v-1703343600")  │                         │              │                    │                     │     │ ← Points to v2
└─────────────────────────────────┴─────────────────────────┴──────────────┴────────────────────┴─────────────────────┴─────┘
```

**Key Difference**:
- Old data (v1) **stays** until after new data (v2) is complete
- Pointer switches atomically from v1 to v2
- **Zero gap** = no 503 errors

---

## The Complete Flow

### Timeline: Hourly Refresh at 14:00

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ TIME: 13:50 - Before Refresh                                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

DynamoDB State:
┌─────────────────────────────────┬─────────────────────────┬──────────────┐
│ PK                              │ SK                      │ version      │
├─────────────────────────────────┼─────────────────────────┼──────────────┤
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703336400    │ v-1703336400 │ ← v1 (13:00 data)
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703336400 │ v-1703336400 │
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703336400│ v-1703336400 │
│ META                            │ CURRENT_VERSION         │ -            │
│ (value = "v-1703336400")        │                         │              │ ← Points to v1
└─────────────────────────────────┴─────────────────────────┴──────────────┘

User Request:
┌──────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend   │─────▶│ Lambda Read  │─────▶│  DynamoDB   │
└──────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            │ 1. Read META/CURRENT_VERSION
                            │◀─────────────────────┘
                            │    returns: "v-1703336400"
                            │
                            │ 2. Read TOPIC#Ukraine-War-1 / SUMMARY#v-1703336400
                            │─────────────────────▶
                            │◀─────────────────────
                            │    returns: "Old summary..."
                            │
                            ▼
                      Returns data to user ✅


┌─────────────────────────────────────────────────────────────────────────────────────┐
│ TIME: 14:00 - Topics Refresh                                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

NewsCache table updated with new topics (same or slightly different)


┌─────────────────────────────────────────────────────────────────────────────────────┐
│ TIME: 14:01 - Generator Lambda Starts                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

Lambda generates versionId: "v-1703340000"

Writes new entries:
┌─────────────────────────────────┬─────────────────────────┬──────────────┐
│ PK                              │ SK                      │ version      │
├─────────────────────────────────┼─────────────────────────┼──────────────┤
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703336400    │ v-1703336400 │ ← v1 STILL EXISTS
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703336400 │ v-1703336400 │
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703336400│ v-1703336400 │
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703340000    │ v-1703340000 │ ← v2 BEING WRITTEN
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703340000 │ v-1703340000 │ ← v2 BEING WRITTEN
│ META                            │ CURRENT_VERSION         │ -            │
│ (value = "v-1703336400")        │                         │              │ ← STILL Points to v1
└─────────────────────────────────┴─────────────────────────┴──────────────┘

User Request during generation:
┌──────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend   │─────▶│ Lambda Read  │─────▶│  DynamoDB   │
└──────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            │ 1. Read META/CURRENT_VERSION
                            │◀─────────────────────┘
                            │    returns: "v-1703336400" (still v1!)
                            │
                            │ 2. Read TOPIC#Ukraine-War-1 / SUMMARY#v-1703336400
                            │─────────────────────▶
                            │◀─────────────────────
                            │    returns: "Old summary..." (v1 data)
                            │
                            ▼
                      Returns old data to user ✅ NO 503 ERROR!


┌─────────────────────────────────────────────────────────────────────────────────────┐
│ TIME: 14:05 - All v2 Data Written, Pointer Updates                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘

Lambda writes ALL entries for all topics, then updates pointer:

┌─────────────────────────────────┬─────────────────────────┬──────────────┐
│ PK                              │ SK                      │ version      │
├─────────────────────────────────┼─────────────────────────┼──────────────┤
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703336400    │ v-1703336400 │ ← v1 STILL EXISTS
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703336400 │ v-1703336400 │
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703336400│ v-1703336400 │
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703340000    │ v-1703340000 │ ← v2 COMPLETE
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703340000 │ v-1703340000 │ ← v2 COMPLETE
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703340000│ v-1703340000 │ ← v2 COMPLETE
│ META                            │ CURRENT_VERSION         │ -            │
│ (value = "v-1703340000")        │                         │              │ ← NOW Points to v2! ⚡
└─────────────────────────────────┴─────────────────────────┴──────────────┘

                              ↑
                    ATOMIC SWITCH HAPPENS HERE!
                    (Single DynamoDB write)

User Request after pointer update:
┌──────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend   │─────▶│ Lambda Read  │─────▶│  DynamoDB   │
└──────────────┘      └──────────────┘      └─────────────┘
                            │                      │
                            │ 1. Read META/CURRENT_VERSION
                            │◀─────────────────────┘
                            │    returns: "v-1703340000" (now v2!)
                            │
                            │ 2. Read TOPIC#Ukraine-War-1 / SUMMARY#v-1703340000
                            │─────────────────────▶
                            │◀─────────────────────
                            │    returns: "New summary..." (v2 data)
                            │
                            ▼
                      Returns new data to user ✅


┌─────────────────────────────────────────────────────────────────────────────────────┐
│ TIME: 14:06 - Cleanup Old Versions                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘

Lambda runs pruneOldVersions(keepCount=2):
- Scans all entries, finds versions: [v-1703340000, v-1703336400, v-1703333600, ...]
- Sorts newest first: [v-1703340000, v-1703336400, v-1703333600, ...]
- Keeps newest 2: [v-1703340000, v-1703336400]
- Deletes: [v-1703333600, ...]  (versions from 2+ hours ago)

Final DynamoDB State:
┌─────────────────────────────────┬─────────────────────────┬──────────────┐
│ PK                              │ SK                      │ version      │
├─────────────────────────────────┼─────────────────────────┼──────────────┤
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703336400    │ v-1703336400 │ ← v1 (13:00) kept
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703336400 │ v-1703336400 │
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703336400│ v-1703336400 │
│ TOPIC#Ukraine-War-1             │ SUMMARY#v-1703340000    │ v-1703340000 │ ← v2 (14:00) active
│ TOPIC#Ukraine-War-1             │ PREDICTION#v-1703340000 │ v-1703340000 │
│ TOPIC#Ukraine-War-1             │ TRACE_CAUSE#v-1703340000│ v-1703340000 │
│ META                            │ CURRENT_VERSION         │ -            │
│ (value = "v-1703340000")        │                         │              │ ← Points to v2
└─────────────────────────────────┴─────────────────────────┴──────────────┘

Old versions (v-1703333600 and older) deleted ✅
```

---

## Key Insights

### 1. **Two Versions Coexist**
At 14:01-14:05, both v1 and v2 data exist in the table:
```
v1: TOPIC#Ukraine-War-1 / SUMMARY#v-1703336400  ← Old, still readable
v2: TOPIC#Ukraine-War-1 / SUMMARY#v-1703340000  ← New, being written
```

### 2. **Pointer Controls Visibility**
```
Before switch: META/CURRENT_VERSION = "v-1703336400" → Users see v1
After switch:  META/CURRENT_VERSION = "v-1703340000" → Users see v2
```

### 3. **Atomic Switch**
The pointer update is a **single DynamoDB write**:
```javascript
PutCommand({
  TableName: 'SummarizeAndPredict',
  Item: {
    PK: 'META',
    SK: 'CURRENT_VERSION',
    value: 'v-1703340000'  // ← Changes instantly
  }
})
```

### 4. **Cleanup Keeps Last 2**
```
After 15:00 refresh:
  v3 (15:00) - active
  v2 (14:00) - kept (safety)
  v1 (13:00) - deleted
```

---

## Storage Impact

### Example with 10 topics × 3 actions = 30 entries per version

```
┌─────────────────────┬────────────────┬──────────────────┐
│ Time                │ Versions Kept  │ Total Entries    │
├─────────────────────┼────────────────┼──────────────────┤
│ 13:00 (after gen)   │ v1             │ 30               │
│ 14:00 (after gen)   │ v1, v2         │ 60               │
│ 14:06 (after prune) │ v1, v2         │ 60               │
│ 15:00 (after gen)   │ v2, v3         │ 90 (temporary)   │
│ 15:06 (after prune) │ v2, v3         │ 60 (v1 deleted)  │
└─────────────────────┴────────────────┴──────────────────┘
```

**Steady state**: Always 2 versions = 2× storage
**Peak during generation**: Briefly 3× storage

---

## Summary

| Aspect | How It Works |
|--------|--------------|
| **Write** | Append version to SK: `SUMMARY#v-1703340000` |
| **Read** | Fetch `META/CURRENT_VERSION` first, then query with versioned SK |
| **Switch** | Update `META/CURRENT_VERSION` value (atomic) |
| **Cleanup** | Keep last 2 versions, delete older |
| **Downtime** | **Zero** - users always read from pointer version |

**The DynamoDB table doesn't change structure - only the data format inside it.**
