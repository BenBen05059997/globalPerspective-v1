# Enterprise Feature: Weekly Narrative Analysis

> **LEGACY PLANNING DOC — All features described here are shipped as of 2026-03-18.**
> Phase 0 (data foundation), Phase 1 (narrative threading), and Phase 3 (frontend) are complete.
> Phase 2 (hindsight / framing shift AI) is the only part not yet built.
> For current architecture, see `ARCHITECTURE.md` and `BACKEND_GUIDE.md`.

---

## Overview

Enterprise clients need to track how news narratives evolve across weeks and months -- not just see today's snapshot. The core use case (from client Lori Collins) is geopolitical and economic analysts who track how the same story gets framed differently across outlets over time.

**Key question this feature answers:** When a topic cluster evolves over days/weeks, how did the framing shift over time?

---

## Implementation Status — Last Updated 2026-03-09

### Phase 0: Data Foundation

| Task | Status | Notes |
|------|--------|-------|
| 0.1 Date-partitioned daily archives (`archive#YYYY-MM-DD`) | ✅ Shipped | Written in `NewsProjectInvokeAgentLambda/src/index.js` `buildAndWriteArchive()`. 10 sources per entry. |
| 0.1 Archive TTL | ✅ Fixed | `DAILY_ARCHIVE_TTL_DAYS = 31` (was 7). Enterprise users can now access up to 30 days of history. |
| 0.2 `archive_range` endpoint | ✅ Shipped | In `newsSensitiveData/src/index.js`. Today served from `latest`, past days from `archive#YYYY-MM-DD`. |
| 0.3 API key gating | ✅ Shipped | `MEMBER_API_KEYS` / `ENTERPRISE_API_KEYS` env vars. `resolveTier()` implemented. Member = 7 days, Enterprise = 30 days. |

**Known bugs — both fixed 2026-03-09:**
- ~~`DAILY_ARCHIVE_TTL_DAYS = 7` → now `31`~~
- ~~`OPENAI_MODEL` undefined → now `GROK_MODEL`~~

### Phase 1: Narrative Threading

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Grok prompt enhancement (`continues_topic`) | ✅ Shipped | `readPastArchiveTitles(7)` reads past archives; NARRATIVE CONTINUITY block injected into clustering prompt; `continues_topic` captured in normalized output and flows to staging. |
| 1.2 Keyword Jaccard fallback matching | ✅ Shipped | `computeJaccardScore()` in `NewsProjectInvokeAgentLambda`: 0.5×keyword + 0.3×region + 0.2×category. Threshold 0.4. |
| 1.3 `threadId` assignment in archive entries | ✅ Shipped | `assignThreadId()` checks `continues_topic` first, then Jaccard, then generates `thread-{slug}-{hash}`. Written into both `today-archive` and `archive#YYYY-MM-DD` entries. `search_keywords` also now stored in archive entries for future Jaccard lookups. |
| 1.4 `narrative_thread` endpoint | ✅ Shipped | In `newsSensitiveData`. Member/enterprise key required. Returns all entries matching `threadId` sorted oldest→newest. |

### Phase 2: Hindsight & Framing Shift

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Hindsight AI generation + caching | ❌ Not started | Decision pending: add Grok to `newsSensitiveData` (Option A) or new Lambda (Option B) |
| 2.2 Framing shift analysis | ❌ Not started | Needs Phase 1 thread data first |

### Phase 3: Frontend

| Task | Status | Notes |
|------|--------|-------|
| `/weekly` route | ❌ Not started | |
| `WeeklyTimeline` component | ❌ Not started | |
| `NarrativeThreadView` component | ❌ Not started | |
| `SourceCoverageGrid` component | ❌ Not started | |
| `HindsightModal` component | ❌ Not started | Enterprise only |
| API key entry / localStorage storage | ❌ Not started | |
| `useWeeklyArchive` hook | ❌ Not started | |
| `useNarrativeThread` hook | ❌ Not started | |
| `fetchArchiveRange()` in `restProxy.js` | ❌ Not started | |

---

## Tier Model

| Tier | Archive Retention | Features | Access |
|------|------------------|----------|--------|
| **Free** | Today only (24h) | Current sidebar, today's archive | No key required |
| **Member** | 7 days | Weekly timeline, narrative threading | Member API key |
| **Enterprise** | 30 days | Full monthly analysis, hindsight AI, framing shift, export | Enterprise API key |

**Storage strategy:** Backend always stores 31 days (`archive#YYYY-MM-DD` with 31-day TTL). Access is gated by tier. One storage model, three revenue levels. Cost stays flat regardless of how many paying users exist.

---

## Current System Limitations

| What | Current State | Problem |
|------|--------------|---------|
| Archive | Single `today-archive` DynamoDB item | Deleted after 24 hours |
| AI content (summary/prediction/trace_cause) | 1-hour TTL | Gone before next day |
| Topic IDs | Title-based, change with rewording | No way to link same story across days |
| Topic linking | None | Monday's "US tariffs" and Wednesday's "China retaliates" are unrelated |
| Source tracking | Max 3 sources per archived entry | Too few for framing analysis |

---

## Architecture: What Exists Today

### Lambda Functions (All use xAI Grok)

| Lambda | Model | Purpose |
|--------|-------|---------|
| `newsInvokeGemini` (name is misleading) | Grok `grok-4-1-fast-non-reasoning` via OpenAI SDK -> `api.x.ai/v1` | Brave Search + RSS -> Grok clusters articles into topics -> writes `staging` |
| `NewsProjectInvokeAgentLambda` | Grok `grok-4-1-fast-non-reasoning` via direct fetch -> `api.x.ai/v1` | Reads `staging` -> Grok generates summary/prediction/trace_cause -> swaps to `latest` -> writes `today-archive` |
| `newsSensitiveData` | None (read-only proxy) | Serves cached data to frontend via API Gateway |

### DynamoDB Key Patterns

**Topics Table:**

| Key (`id`) | TTL | Purpose |
|------------|-----|---------|
| `staging` | None | Pre-generation topics (overwritten each run) |
| `latest` | None | Active topics served to frontend |
| `today-archive` | 24h | Daily archive, max 50 entries, merged each run |
| `seen-today` | 24h | Dedup fingerprints to avoid repeating topics |

**Summary/Prediction Table:**

| PK | SK | TTL | Purpose |
|----|-----|-----|---------|
| `TOPIC#{topicId}` | `SUMMARY` | 1h | AI summary |
| `TOPIC#{topicId}` | `PREDICTION` | 1h | AI prediction |
| `TOPIC#{topicId}` | `TRACE_CAUSE` | 1h | AI trace cause analysis |

### Pipeline Flow (Hourly via EventBridge)

```
1. newsInvokeGemini
   - Fetches articles from RSS feeds + Brave Search
   - Sends to Grok for clustering into ~13 topics
   - Writes to DynamoDB: id="staging"

2. NewsProjectInvokeAgentLambda
   - Reads "staging" topics
   - For each topic, calls Grok to generate summary, prediction, trace_cause
   - Writes AI content to Summary/Prediction table (1h TTL)
   - Swaps staging -> latest
   - Builds today-archive (copies AI content into archive entries, 24h TTL)
   - Prunes old cache entries

3. newsSensitiveData (on-demand, via API Gateway)
   - Frontend calls with action: topics|summary|prediction|trace_cause|geocode|today
   - Returns cached data from DynamoDB
```

---

## Enterprise Feature: Implementation Plan

### Phase 0: Data Foundation (Must Ship First)

Data must start accumulating before any other feature works. This phase has near-zero cost impact.

#### 0.1 Date-Partitioned Daily Archives

**File:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

Change `buildAndWriteArchive()` to write daily items alongside the existing `today-archive`:

```
Current:  id = "today-archive"         TTL = 24 hours
New:      id = "archive#2026-03-07"    TTL = 31 days
```

- Keep `today-archive` for free tier (backwards compatible)
- Write a parallel `archive#YYYY-MM-DD` item with 31-day TTL
- Increase source cap from 3 to 10 per entry (needed for framing analysis)
- Each daily item holds up to 50 entries with embedded AI content
- Backend always stores 31 days; tier gating happens at the proxy layer

**Cost impact:** ~15MB additional DynamoDB storage per month. Cost: < $0.01/month.

#### 0.2 Archive Range Endpoint

**File:** `amplify/backend/function/newsSensitiveData/src/index.js`

New action `archive_range`:
- Accepts `days` parameter, capped by tier:
  - Member key: max 7 days
  - Enterprise key: max 30 days
  - No key: rejected (401)
- Fetches daily `archive#YYYY-MM-DD` items via BatchGetItem
- Returns entries grouped by date

```json
POST /proxy
{
  "action": "archive_range",
  "payload": { "days": 7 }
}
```

**Cost impact:** Up to 30 GetItem calls per request. Negligible.

#### 0.3 API Key Gating

**File:** `amplify/backend/function/newsSensitiveData/src/index.js`

New env vars:
- `MEMBER_API_KEYS` -- comma-separated member-tier keys
- `ENTERPRISE_API_KEYS` -- comma-separated enterprise-tier keys

Key is passed in the `x-api-key` request header. Proxy resolves tier:

```
No key          -> free tier  (topics, summary, prediction, trace_cause, geocode, today)
Member key      -> member tier (+ archive_range up to 7 days, narrative_thread)
Enterprise key  -> enterprise tier (+ archive_range up to 30 days, hindsight, framing_shift)
```

Free tier actions remain open with no key required. Unrecognized keys on gated actions return 401.

---

### Phase 1: Narrative Threading (Core Algorithm)

The hardest and most valuable piece. Links related topics across days into narrative threads.

#### 1.1 Grok Prompt Enhancement (Semantic Linking)

**File:** `amplify/backend/function/newsInvokeGemini/src/index.js`

Enhance the Grok clustering prompt (line ~499) to include past week's topic titles:

```
NARRATIVE CONTINUITY:
These topics appeared in previous days. If a new topic is a
continuation or development of a previous topic, include:
  "continues_topic": "the exact previous topic title"

Previous topics:
  - [Mar 5] US Threatens New Tariffs on China
  - [Mar 4] EU Passes Digital Markets Act Amendment
  ...
```

**Requires:** Lambda reads past 7 days of `archive#YYYY-MM-DD` items (7 GetItem calls) to build the list.

**Output schema change:** Add optional `continues_topic` field to each topic object.

**Cost impact:** Same Grok API call, slightly longer prompt (~200 extra tokens). Near zero.

#### 1.2 Keyword Jaccard Matching (Deterministic Fallback)

**File:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

During `buildAndWriteArchive()`, for each new topic:

1. Combine `search_keywords` + title words (stop words removed) into a signature set
2. Compare against all entries from past 7 daily archives
3. Score = weighted Jaccard similarity:
   - Keyword overlap (weight 0.5)
   - Region overlap (weight 0.3)
   - Same category (weight 0.2)
4. If score > 0.4 -> topics are linked

**Cost impact:** Pure computation in Lambda, no API calls.

#### 1.3 Thread ID Assignment

**File:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`

Each archived entry gets a `threadId`:

```javascript
{
  topicId: "us-threatens-tariffs-abc123",
  threadId: "thread-us-china-trade-7f3a",   // shared across days
  continues_topic: "US-China Trade Tensions Escalate",  // from Grok
  // ... rest of entry
}
```

Assignment rules:
- Grok said `continues_topic` -> look up that topic's threadId, inherit it
- Keyword match score > threshold -> inherit highest-scoring match's threadId
- No match -> generate new `thread-{slug}-{short-hash}`

#### 1.4 Narrative Thread Endpoint

**File:** `amplify/backend/function/newsSensitiveData/src/index.js`

New action `narrative_thread`:
- Accepts `threadId`
- Scans past 7 daily archives for entries with matching threadId
- Returns entries sorted by date (narrative timeline)

```json
POST /proxy
{
  "action": "narrative_thread",
  "payload": { "threadId": "thread-us-china-trade-7f3a" }
}
```

---

### Phase 2: Hindsight Analysis (On-Demand AI)

#### 2.1 Hindsight AI Generation

When an enterprise user views a past topic, generate a fresh AI analysis from today's perspective.

**Key decision:** `newsSensitiveData` is currently read-only. Two options:
- **Option A:** Add Grok call directly to `newsSensitiveData` (simpler, breaks read-only principle)
- **Option B:** New dedicated Lambda for on-demand enterprise AI (cleaner separation)

**Prompt receives:**
- Original topic title, sources, regions from the archive
- Original summary/prediction/trace_cause (embedded in archive entry)
- Today's date
- Instruction: "Analyze what happened since this story from {date}"

**Caching:**
- Store result in Summary/Prediction table: `PK: TOPIC#{topicId}  SK: HINDSIGHT#{date}`
- TTL: 24 hours
- Second user requesting same hindsight gets cached version

**Cost impact:** 1 Grok API call per topic per day, only when requested. Cached after first request.

#### 2.2 Framing Shift Analysis (Cross-Day Comparison)

The premium feature. Takes an entire narrative thread and analyzes how coverage evolved.

**Prompt receives:**
- All entries in a thread across multiple days
- Source outlets that covered it each day
- Original AI summaries from each day

**Output:**
- How the dominant narrative shifted
- Which outlets led vs followed coverage
- Whether earlier predictions came true
- Signal vs Noise verdict with hindsight

**Cost impact:** 1 Grok call per thread per day, on-demand only, cached 24h.

---

### Phase 3: Frontend

#### 3.1 Routing

New dedicated route for the analytical view, separate from the existing Home page:

```
/           -> Home (today's topics, free tier, unchanged)
/weekly     -> WeeklyTimeline + NarrativeThreadView (member + enterprise, gated)
```

The Home page stays focused on today's news. The `/weekly` route is the analytical tool for paying tiers.

#### 3.2 UX Design: Two-Panel Layout

The `/weekly` page uses a two-panel approach supporting two analyst workflows:

**Scanning mode** (left panel -- WeeklyTimeline):
- Day-by-day topic list, most recent at top
- Each topic card shows a colored thread badge if it belongs to a narrative thread
- Same thread = same badge color (deterministic from threadId hash)
- Topics with no thread appear without a badge (standalone events)

**Investigating mode** (right panel -- NarrativeThreadView):
- Click any thread badge to open the thread's full timeline in the right panel
- Vertical timeline showing each day's entry: title, sources, AI summary
- Highlights which sources joined/left coverage day over day
- Source coverage grid at bottom (which outlets covered which days)
- Action buttons: [View Hindsight Analysis] [Export Thread] (enterprise only)

```
Desktop layout:

┌─ Weekly Timeline ──────────┬─ Thread: US-China Trade ────────┐
│                            │                                  │
│ Mar 7 (Today)              │  Mar 5  ○ US-China Trade         │
│  ● US Raises Tariffs  [tw] │         │ Sources: Reuters, SCMP │
│  ● Ukraine Drone Strike    │         │ Summary: "Tensions..." │
│  ● EU AI Act Begins        │         │                        │
│                            │  Mar 6  ○ China Warns of         │
│ Mar 6                      │         │   Retaliation          │
│  ● China Warns  [tw]      │         │ Sources: SCMP, AJ      │
│  ● Russia Moves Reserves   │         │ + New: Al Jazeera      │
│  ● India GDP Exceeds       │         │                        │
│                            │  Mar 7  ● US Raises Tariffs      │
│ Mar 5                      │           Sources: Reuters, NYT  │
│  ● US-China Trade  [tw]   │           + New: NYT, Bloomberg   │
│  ● Gaza Ceasefire Talks    │                                  │
│                            │  Source Coverage:                 │
│                            │  Reuters    ■ ■ ■ (all 3 days)   │
│                            │  SCMP       ■ ■ . (day 1,2)      │
│                            │  Al Jazeera . ■ . (day 2 only)   │
│                            │  NYT        . . ■ (day 3 only)   │
│                            │                                  │
│                            │  [Hindsight] [Export]             │
└────────────────────────────┴──────────────────────────────────┘

Mobile layout:
  Weekly Timeline (full width) -> click badge -> Thread View (full width, back button)
```

**Data flow for today's column:**
- `archive_range` endpoint includes today
- For today's date, backend returns data from `latest` (current active topics)
- For past dates, backend returns data from `archive#YYYY-MM-DD` items
- Result: unified 7-day or 30-day view with no gaps or duplication

#### 3.3 Service Layer

**Files:**
- `global-perspectives-starter/frontend/src/services/restProxy.js` -- add `fetchArchiveRange()`, `fetchNarrativeThread()`, `fetchHindsight()`
- `global-perspectives-starter/frontend/src/utils/graphqlService.js` -- add `getArchiveRange()`, `getNarrativeThread()`, `getHindsight()`

#### 3.4 Hooks

**New files:**
- `src/hooks/useWeeklyArchive.js` -- fetch + cache archive range data (7 or 30 days by tier)
- `src/hooks/useNarrativeThread.js` -- fetch thread timeline by threadId

#### 3.5 Components

**New files:**
- `src/components/WeeklyTimeline.jsx` -- left panel, day-by-day topic list with thread badges
- `src/components/ThreadBadge.jsx` -- colored pill showing thread name, clickable
- `src/components/NarrativeThreadView.jsx` -- right panel, vertical timeline of one thread's evolution
- `src/components/SourceCoverageGrid.jsx` -- table showing which outlets covered a topic on which days
- `src/components/HindsightModal.jsx` -- on-demand AI hindsight analysis (enterprise only)

#### 3.6 Tier Gate (Frontend)

- API key stored in localStorage or entered via a settings/login screen
- `/weekly` route checks for valid key on mount; redirects or shows upgrade prompt if missing
- Member key: sees 7-day timeline, thread badges, narrative thread view
- Enterprise key: sees 30-day timeline, hindsight AI, export, source diversity panel
- Key passed in `x-api-key` header on all paid API calls

---

## Cost Analysis

### Storage (DynamoDB)

| Item | Size | Retention | Monthly Cost |
|------|------|-----------|-------------|
| 31 daily archives (50 entries x ~10KB each) | ~15MB | Rolling 31 days | < $0.01 |
| Hindsight cache items | ~2KB each | 24h TTL | < $0.01 |
| Thread metadata | Embedded in archive entries | 31 days | $0.00 |
| **Total storage delta** | | | **< $0.02/mo** |

Note: Backend stores 31 days for all tiers. Access is gated by API key tier, not by what is stored. Adding more paying members does not increase storage cost.

### API Calls (Grok / xAI)

| Call | When | Frequency | Cost |
|------|------|-----------|------|
| Clustering (existing) | Every pipeline run | ~24/day | Already paid |
| Clustering with past titles (longer prompt) | Every pipeline run | ~24/day | ~$0.01/day extra |
| Hindsight analysis | On-demand click | Per user request | ~$0.002/call |
| Framing shift analysis | On-demand click | Per thread request | ~$0.005/call |

### DynamoDB Reads

| Operation | Calls | Frequency | Cost |
|-----------|-------|-----------|------|
| Read 7 daily archives (clustering) | 7 GetItem | Per pipeline run | < $0.01/day |
| Read 7 daily archives (week_archive) | 7 GetItem | Per user request | < $0.001/call |
| Read thread entries | 7 GetItem | Per user request | < $0.001/call |

**Bottom line:** < $1/month additional infrastructure cost. Enterprise revenue should far exceed this.

---

## Implementation Priority

| Priority | Feature | Tier | Reason |
|----------|---------|------|--------|
| **P0** | Date-partitioned daily archives, 31-day TTL (0.1) | All | Data must accumulate; ship immediately |
| **P0** | API key gating -- free/member/enterprise (0.3) | All | Cannot expose paid features without access control |
| **P1** | Grok prompt enhancement for `continues_topic` (1.1) | All | Core narrative linking, zero extra cost |
| **P1** | Keyword Jaccard fallback + threadId assignment (1.2, 1.3) | All | Ensures reliable linking even when Grok misses |
| **P1** | `archive_range` endpoint -- 7-day cap for member (0.2) | Member | API before UI |
| **P1** | Narrative thread endpoint (1.4) | Member | API before UI |
| **P2** | Weekly timeline + narrative thread UI | Member | Makes the data visible |
| **P2** | `archive_range` -- 30-day cap for enterprise (0.2) | Enterprise | Extend same endpoint |
| **P2** | Hindsight AI (2.1) | Enterprise | High perceived value, on-demand cost |
| **P2** | Source diversity panel (frontend) | Enterprise | Visual proof of multi-lens coverage |
| **P3** | Monthly timeline UI + export | Enterprise | Needs 30 days of data first |
| **P3** | Framing shift AI (2.2) | Enterprise | Killer feature, needs 1+ week of threaded data |
| **P4** | Custom topic watchlist | Enterprise | Differentiator, but complex |

**Recommended rollout:**
1. Ship P0 immediately so data starts accumulating (31-day TTL from day one)
2. Build P1 during the first week while data collects -- members can access 7 days
3. P2 frontend + hindsight once threads are populating -- enterprise unlocks full 30 days
4. P3 framing shift and monthly view once there is enough historical data

---

## Files to Modify

| File | Changes |
|------|---------|
| **Backend** | |
| `amplify/backend/function/newsInvokeGemini/src/index.js` | Read past archives, add to Grok prompt, capture `continues_topic` |
| `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` | Write `archive#YYYY-MM-DD`, keyword matching, threadId assignment |
| `amplify/backend/function/newsSensitiveData/src/index.js` | New actions: `archive_range`, `narrative_thread`, `hindsight`; tier gating via `x-api-key` |
| **Frontend -- Services** | |
| `global-perspectives-starter/frontend/src/services/restProxy.js` | Add `fetchArchiveRange()`, `fetchNarrativeThread()`, `fetchHindsight()` |
| `global-perspectives-starter/frontend/src/utils/graphqlService.js` | Add `getArchiveRange()`, `getNarrativeThread()`, `getHindsight()` |
| **Frontend -- Hooks** | |
| `global-perspectives-starter/frontend/src/hooks/useWeeklyArchive.js` | New hook: fetch + cache archive range |
| `global-perspectives-starter/frontend/src/hooks/useNarrativeThread.js` | New hook: fetch thread timeline by threadId |
| **Frontend -- Components** | |
| `global-perspectives-starter/frontend/src/App.jsx` | Add `/weekly` route |
| `global-perspectives-starter/frontend/src/components/WeeklyTimeline.jsx` | Left panel: day-by-day topics with thread badges |
| `global-perspectives-starter/frontend/src/components/ThreadBadge.jsx` | Colored pill for thread identity, clickable |
| `global-perspectives-starter/frontend/src/components/NarrativeThreadView.jsx` | Right panel: thread evolution timeline + source coverage grid |
| `global-perspectives-starter/frontend/src/components/SourceCoverageGrid.jsx` | Table: outlets x days coverage matrix |
| `global-perspectives-starter/frontend/src/components/HindsightModal.jsx` | On-demand AI hindsight analysis (enterprise) |

---

## Open Questions

1. **Hindsight Lambda:** Should we add Grok calls to `newsSensitiveData` (simpler) or create a new dedicated Lambda (cleaner, keeps proxy read-only)?
2. **Membership pricing model:** Per-seat? Per-API-key? Monthly subscription? What is the price point for member vs enterprise?
3. **API key management:** How are keys issued and rotated? Manual for now (env var list), or a proper key management system later?
4. **Thread merging:** What happens if two threads are later discovered to be the same narrative? Do we merge threadIds?
5. **Multi-language:** The `feature/multi-language` branch adds EN/JA/ZH support. Should archived entries store multilingual AI content too, or English only?
6. **Historical backfill:** Once the feature ships, the first ~30 days will have no threads. Should we run a one-time backfill job on existing data?
7. ~~**Member UI:** Does the weekly timeline live on the main site (gated by key) or a separate enterprise dashboard?~~ **DECIDED:** Dedicated `/weekly` route on the same site, gated by API key. Home page (`/`) stays free tier and unchanged.
