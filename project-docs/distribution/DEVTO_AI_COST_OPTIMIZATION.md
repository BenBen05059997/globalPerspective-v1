---
title: How I Kept My AI News Platform Under $3/Day With Two Simple Patterns
published: false
description: Using caching and blue-green deployment to keep AI API costs sustainable
tags: ai, aws, optimization, serverless
cover_image:
---

**Running an AI news platform for ~$81/month with two architecture patterns**

When I built my AI news platform, I knew API costs could spiral out of control fast. AI calls aren't cheap, and I wanted this to be sustainable without charging users.

Today, the system runs for **~$81/month** (about $2.70/day) — less than a coffee. It scans global news every hour, generates AI analysis, and serves users instantly.

Here are the two key patterns that make it affordable, with real code from my production system.

---

## What the System Does

My app, [Global Perspectives](https://globalperspective.net), uses AI to:

1. Scan global news every hour and cluster articles into topics
2. Generate summaries for each topic
3. Create predictions (what happens next)
4. Analyze root causes (how we got here)

With xAI Grok pricing at $0.20 per 1M input tokens and $0.50 per 1M output tokens, costs could easily spiral:

**Without optimization:**
- Every user click = AI call
- 10 users clicking "Summarize" on the same topic = 10 identical AI calls
- That's wasteful and expensive

**With optimization:**
- First request generates analysis
- Next 99 requests get cached results
- Massive cost reduction

---

## Pattern 1: Cache Everything with TTL

The biggest cost saver: realizing most AI calls are redundant.

### The Problem

When users request analysis, I was calling the AI every single time:

```
User A clicks "Summarize" → AI call ($$$)
User B clicks "Summarize" (same topic) → AI call again ($$$)
User C clicks "Summarize" (same topic) → AI call again ($$$)
```

News doesn't change every second. Topics stay relevant for hours. Regenerating the same analysis repeatedly is wasteful.

### The Solution

Cache every AI response in DynamoDB with a 1-hour expiration.

Here's the actual code from my Lambda function:

```javascript
// Generate AI analysis and store in cache
async function writeCache(topic, kind, response, ttlSeconds, generationId) {
  const pk = `TOPIC#${topic.id}`;
  const sk = kind === 'summary' ? 'SUMMARY'
           : kind === 'prediction' ? 'PREDICTION'
           : 'TRACE_CAUSE';

  // TTL: cache expires after ttlSeconds
  const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

  const item = {
    PK: pk,
    SK: sk,
    topicId: topic.id,
    title: topic.title,
    action: kind,
    content: response.content,
    model: response.modelId,
    generatedAt: new Date().toISOString(),
    generationId,
    ttl,  // DynamoDB auto-deletes when expired
  };

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: item,
  }));

  return item;
}
```

### How It Works

1. **First request:** AI generates analysis → store in cache with 1-hour TTL
2. **Subsequent requests:** Check cache → return cached result instantly
3. **After 1 hour:** DynamoDB auto-deletes expired items via TTL feature
4. **Next request:** Cache miss → regenerate fresh analysis

### Why 1 Hour?

| TTL | Pros | Cons |
|-----|------|------|
| 15 min | Very fresh | 4x more AI calls |
| 1 hour | Good balance | Slightly stale during fast-moving events |
| 6 hours | Very cheap | Noticeably outdated |

News moves fast, but 1 hour is the sweet spot. Most events don't change dramatically in 60 minutes.

**Result:** First user waits 2-3 seconds for AI. Next 100+ users get instant responses. Cost drops by ~85% for analysis calls.

---

## Pattern 2: Blue-Green Swap to Prevent Race Conditions

This one's subtle but critical. It prevents users from seeing errors during the hourly refresh.

### The Problem I Had

My system refreshes topics every hour:
1. Fetch new news articles
2. Generate new topics with AI
3. Write to database
4. Users see new topics

But there was a race condition:

```
Hourly job starts → Writes new topics to DB
                  ↓
User sees new topic → Clicks "Summarize"
                   ↓
Cache lookup → MISS (analysis not generated yet)
            ↓
AI generates → Takes 3 seconds
            ↓
User sees loading... or worse, an error
```

Even worse: if 10 users clicked during the refresh window, I'd get 10 duplicate AI calls before the cache populated.

### The Solution: Blue-Green Deployment for Data

I borrowed a pattern from application deployment. Instead of updating data in-place, I use two database entries: **staging** and **active**.

Here's the actual code:

```javascript
// After hourly job generates new topics, it writes to "staging"
await writeCache({
  topics: newTopics,
  model: 'grok-4-fast',
  limit: 17
});
// Item ID: "staging" (not visible to users yet)

// Generate all analysis for these topics
for (const topic of newTopics) {
  await generateAndStore(topic, 'summary', generationId);
  await generateAndStore(topic, 'prediction', generationId);
  await generateAndStore(topic, 'trace_cause', generationId);
}

// Only after everything is ready, atomically swap
await swapStagingToActive(stagingItem, generationId);
```

The swap function:

```javascript
async function swapStagingToActive(stagingItem, generationId) {
  // Copy staging data to "active" with new ID
  const activeItem = {
    ...stagingItem,
    id: 'latest',  // Users read from this ID
    status: 'active',
    activatedAt: new Date().toISOString(),
  };

  // Single atomic write
  await ddb.send(new PutCommand({
    TableName: TOPICS_TABLE,
    Item: activeItem,
  }));

  console.log(`Swapped staging -> active (gen: ${generationId})`);
  return true;
}
```

### How It Works

```
Before Swap:
├─ "staging" (new topics + generating analysis) ← Lambda working here
└─ "latest" (old topics, complete analysis) ← Users reading here

After Swap:
├─ "staging" (ready for next cycle)
└─ "latest" (new topics, complete analysis) ← Users now see this
```

Users always read from the "latest" item. The swap happens in milliseconds. No partial data. No race conditions.

**Result:** Zero 503 errors during refresh. Users never see incomplete data. Eliminated duplicate AI calls from race conditions.

---

## The Architecture in Action

Here's how both patterns work together:

```
┌─────────────────── HOURLY JOB ───────────────────┐
│                                                   │
│  1. Fetch news from Brave Search                 │
│  2. Cluster into topics (AI)                     │
│  3. Write to "staging" in DynamoDB               │
│  4. Generate ALL analysis (summary/predict/trace)│
│  5. Store in cache (1-hour TTL)                  │
│  6. Atomic swap: staging → "latest"              │
│                                                   │
└───────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────── USER REQUEST ─────────────────┐
│                                                   │
│  1. User clicks "Summarize"                      │
│  2. Lambda checks cache                          │
│     ├─ HIT: Return cached result (instant)       │
│     └─ MISS: Generate + cache (2-3 seconds)      │
│                                                   │
└───────────────────────────────────────────────────┘
```

**Key benefits:**
- Users always see complete data (blue-green swap)
- 95%+ of requests hit cache (1-hour TTL)
- Zero errors during hourly refresh
- Predictable, sustainable costs

---

## The Actual Monthly Costs

Here's my real cost breakdown:

| Service | Monthly Cost (CAD) | Notes |
|---------|-------------------|-------|
| Brave Search API | ~$20 | ~18 queries/hour, 720 total/month |
| xAI Grok (topics) | ~$14 | 1 call/hour for clustering |
| xAI Grok (analysis) | ~$21 | Summaries, predictions, trace |
| AWS Lambda | ~$10 | Serverless, pay per execution |
| AWS DynamoDB | ~$10 | Cache storage + reads |
| GitHub Pro | ~$6 | Hosting frontend |
| **Total** | **~$81/month** | **$2.70/day** |

The key insight: **caching reduces AI calls by 85-90%**. Without caching, the xAI Grok costs alone would be $200-300/month.

---

## What I Learned

### 1. Most AI Calls Are Redundant

The same analysis gets requested over and over. Cache aggressively. A 1-hour TTL for news analysis is perfectly reasonable.

### 2. Race Conditions Cost Money

When 10 users click the same button simultaneously before the cache populates, you pay for 10 identical AI calls. Blue-green deployment prevents this.

### 3. DynamoDB TTL Is Free

DynamoDB automatically deletes expired items based on the `ttl` field. No cleanup Lambda needed. No extra cost.

### 4. Serverless Scales to Zero

AWS Lambda only charges for execution time. During quiet hours (2-6am), costs approach zero. Traditional servers burn money 24/7.

### 5. Measure Everything

I log every AI call with token counts and latency. CloudWatch helps me spot cost spikes immediately.

```javascript
console.log(JSON.stringify({
  action: 'ai_call',
  model: 'grok-4-fast',
  topicId: topic.id,
  latencyMs: response.latencyMs,
  cached: false
}));
```

---

## What I'd Do Differently

These patterns work well, but there's room for improvement:

1. **Batch API calls** - Currently I make 3 separate calls (summary, prediction, trace). Could combine into one prompt with structured JSON output.

2. **Pre-generate everything** - Right now, analysis is generated on-demand during the hourly job. Could pre-generate all 3 types for all topics to eliminate cache misses entirely.

3. **Smart retry logic** - No exponential backoff yet. If an AI call fails, it just fails. Could add retries with fallback to stale cache.

4. **Use cheaper models for simple tasks** - Using Grok 4 Fast for everything. Could use a smaller/cheaper model for simple summaries.

But honestly? These two patterns got costs under control. The rest is optimization for optimization's sake.

---

## Conclusion

Running AI in production doesn't have to break the bank.

The key insight: **AI is expensive when it's doing redundant work.**

Two simple patterns keep my costs sustainable:

1. **Cache everything** - 1-hour TTL, DynamoDB auto-cleanup
2. **Blue-green swap** - Prevent race conditions during refresh

My system processes global news from 10+ regions every hour, generates AI analysis for every topic, and serves users instantly — all for **$2.70/day**.

That's less than a coffee. That's sustainable. And it required zero compromise on quality.

---

**Try it live:** [globalperspective.net](https://globalperspective.net)

**Support the mobile app:** Kickstarter campaign coming soon

---

*If this helped, follow me for more posts on building AI products that don't burn money.*

---

## TL;DR

- Running an AI news platform for ~$81/month ($2.70/day)
- Two key patterns:
  1. **Aggressive caching** - 1-hour TTL in DynamoDB, reduces AI calls by 85-90%
  2. **Blue-green data swap** - Prevents race conditions and duplicate AI calls during hourly refresh
- Serverless architecture (AWS Lambda) scales to zero during quiet hours
- Could optimize further (batching, pre-generation, retries) but these two patterns got costs under control
- Real code examples from production Lambda functions included
