# Atomic Swap Strategies for Cache Refresh

## The Problem

We need to ensure that:
1. Users always see **complete data** (topics + summaries/predictions)
2. No partial states during refresh window
3. Old data stays visible until new data is **fully ready**

---

## Industry Patterns

### Pattern 1: Blue-Green Deployment (Netflix, Amazon)

**How Netflix does content catalog updates:**

```
┌─────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER / POINTER                  │
│                         points to: BLUE                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌─────────────┐                 ┌─────────────┐
       │    BLUE     │                 │   GREEN     │
       │  (active)   │                 │ (standby)   │
       │             │                 │             │
       │ Old Topics  │                 │ New Topics  │
       │ Old Data    │                 │ New Data    │
       └─────────────┘                 └─────────────┘

After GREEN is fully populated:
- Switch pointer: BLUE → GREEN
- BLUE becomes standby for next refresh
```

**Applied to your system:**
```
NewsCache:
  id: "blue"  ← current (pointer points here)
  id: "green" ← staging (being populated)

After generation complete:
  Update pointer: "blue" → "green"
  Next cycle: "green" → "blue" (swap roles)
```

**Pros:**
- Simple mental model
- Instant switch (single write)
- Easy rollback (just switch pointer back)

**Cons:**
- 2x storage during transition
- Need to track which is active

---

### Pattern 2: Immutable Versioning (Spotify, Stripe)

**How Spotify handles playlist/catalog updates:**

```
Version 1 (current):
┌─────────────────────────────────────────┐
│ topics_v1703340000                      │
│ summaries_v1703340000                   │
│ POINTER → v1703340000                   │
└─────────────────────────────────────────┘

Version 2 being written:
┌─────────────────────────────────────────┐
│ topics_v1703343600     ← new            │
│ summaries_v1703343600  ← new            │
│ POINTER → v1703340000  ← still points to v1
└─────────────────────────────────────────┘

After v2 complete:
┌─────────────────────────────────────────┐
│ POINTER → v1703343600  ← switched!      │
│ v1 data deleted after grace period      │
└─────────────────────────────────────────┘
```

**Applied to your system:**
```
NewsCache:
  id: "latest"
  value: { version: "v-1703343600", topics: [...] }

SummarizeAndPredict:
  PK: "META", SK: "CURRENT_VERSION", value: "v-1703343600"
  PK: "TOPIC#xyz", SK: "SUMMARY#v-1703343600", content: "..."
```

**Pros:**
- Audit trail (can see all versions)
- Easy rollback to any version
- No "swap" needed - just update pointer

**Cons:**
- More storage (multiple versions)
- Cleanup logic needed

---

### Pattern 3: Shadow Tables (Facebook, Instagram)

**How Facebook handles feed updates:**

```
Production Table (users read from):
┌─────────────────────────────────────────┐
│ NewsCache_Production                    │
│   id: "latest" → old topics             │
└─────────────────────────────────────────┘

Shadow Table (being written to):
┌─────────────────────────────────────────┐
│ NewsCache_Shadow                        │
│   id: "latest" → new topics             │
│   (+ all new summaries)                 │
└─────────────────────────────────────────┘

Swap = Rename tables:
  NewsCache_Production → NewsCache_Old
  NewsCache_Shadow → NewsCache_Production
  NewsCache_Old → NewsCache_Shadow (for next cycle)
```

**Applied to your system:**
- Would need two DynamoDB tables
- Swap by updating which table Lambda reads from

**Pros:**
- Complete isolation during generation
- Zero read impact during writes

**Cons:**
- DynamoDB doesn't support table rename
- More infrastructure complexity
- Would need to swap at application level

---

### Pattern 4: Transaction Log (Kafka-style, LinkedIn)

**How LinkedIn handles activity feed:**

```
Write Path:
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│ Producer │ ──▶ │ Transaction  │ ──▶ │   Consumer  │
│ (Gemini) │     │    Log       │     │ (Materialze)│
└──────────┘     └──────────────┘     └─────────────┘
                       │
                       ▼
              Batch: [topic1, topic2, ...]
              Commit marker: "batch complete"

Read Path:
- Only read materialized view
- Materialized view only updates after commit marker
```

**Applied to your system:**
- Write all topics + summaries to a "pending" state
- After all written, commit the batch
- Reader only sees committed data

**Pros:**
- Exactly-once semantics
- Perfect consistency

**Cons:**
- Overkill for your use case
- Requires additional infrastructure (SQS/Kinesis)

---

### Pattern 5: Conditional Swap (Simple - Recommended)

**How smaller systems handle this:**

```
Step 1: newsInvokeGemini runs
        ↓
        Writes to NewsCache with:
        {
          id: "staging",
          topics: [...],
          status: "pending",
          generationId: "gen-123"
        }

Step 2: NewsProjectInvokeAgentLambda runs
        ↓
        Reads staging topics
        Generates all summaries/predictions
        Tags each with generationId: "gen-123"
        ↓
        After ALL done, updates:
        {
          id: "staging",
          status: "complete"
        }

Step 3: Swap (can be same Lambda or separate)
        ↓
        Check: staging.status === "complete"?
        If yes:
          - Copy staging → latest
          - Delete old summaries (where generationId !== "gen-123")
```

**DynamoDB Implementation:**
```
NewsCache:
┌──────────┬───────────────┬────────────────┬─────────────┐
│ id       │ topics        │ status         │ generationId│
├──────────┼───────────────┼────────────────┼─────────────┤
│ latest   │ [old topics]  │ active         │ gen-122     │ ← users see this
│ staging  │ [new topics]  │ pending/complete│ gen-123    │ ← being prepared
└──────────┴───────────────┴────────────────┴─────────────┘

SummarizeAndPredict:
┌─────────────────────┬──────────┬─────────────┐
│ PK                  │ SK       │ generationId│
├─────────────────────┼──────────┼─────────────┤
│ TOPIC#old-topic     │ SUMMARY  │ gen-122     │ ← old
│ TOPIC#new-topic     │ SUMMARY  │ gen-123     │ ← new
└─────────────────────┴──────────┴─────────────┘
```

**Pros:**
- Simple to implement
- Uses existing tables
- Clear status tracking
- Easy to debug

**Cons:**
- Extra field (generationId) needed
- Cleanup logic required

---

## Comparison Table

| Pattern | Complexity | Storage | Rollback | Best For |
|---------|------------|---------|----------|----------|
| Blue-Green | Low | 2x | Easy | Simple swaps |
| Immutable Versioning | Medium | 2-3x | Easy | Audit needs |
| Shadow Tables | High | 2x | Medium | Large scale |
| Transaction Log | High | Variable | Complex | Event-driven |
| **Conditional Swap** | **Low** | **~1.5x** | **Easy** | **Your case** |

---

## My Recommendation: Conditional Swap (Pattern 5)

**Why:**
1. **Simplest to implement** - minimal code changes
2. **Uses existing tables** - no new infrastructure
3. **Clear state machine** - pending → complete → active
4. **Easy debugging** - can see status in DynamoDB

**Implementation Summary:**

```
newsInvokeGemini:
  - Write topics to NewsCache with id="staging", status="pending"
  - Include generationId (timestamp-based)

NewsProjectInvokeAgentLambda:
  - Read from staging
  - Generate all summaries/predictions
  - Tag with same generationId
  - After ALL complete: update staging.status = "complete"
  - Perform swap: copy staging → latest
  - Cleanup: delete old generation data

newsSensitiveData:
  - No changes! Still reads from id="latest"
```

---

## Next Steps

1. **Choose a pattern** (I recommend Pattern 5: Conditional Swap)
2. **I'll draft the implementation** for both Lambdas
3. **Review and deploy**

**Which pattern do you prefer?**
