# Weekly Analysis — Known Issues & Improvements

Last updated: 2026-03-17

## Issue 1: Duplicate Topics Within Same Day

**Severity:** Medium
**Affected component:** `newsInvokeGemini` Lambda (topic clustering)
**First observed:** 2026-03-13 archive data

### Problem

The Grok clustering prompt in the first Lambda is allowing near-identical topics through as separate entries on the same day. Examples from Mar 13:

| Topic title | Occurrences |
|---|---|
| Chile's José Antonio Kast inaugurated as first far-right president... | 3x |
| Construction costs surge 50% in Madagascar after Cyclone Gezani... | 3x |
| Neuracle secures China's first approval for implantable brain-computer interface | 3x |

These are not evolving stories — they are the same story counted multiple times in a single pipeline run. This inflates the topic count (50 reported but ~40 unique) and creates noise in the Weekly view.

### Root Cause

The `newsInvokeGemini` Lambda fetches articles from multiple RSS feeds and Brave Search, then sends them to Grok for clustering. The clustering prompt asks Grok to group related articles into topics, but:

1. When the same story appears across many sources with slightly different wording, Grok sometimes creates 2-3 separate topic clusters instead of merging them.
2. There is no post-processing deduplication step after Grok returns its clusters.
3. The `readPastArchiveTitles()` continuity prompt helps avoid cross-day duplicates but does nothing for same-day duplicates.

### Fix Options

**Option A — Post-processing dedup (recommended):**
After Grok returns topic clusters, add a Jaccard similarity pass on the output. If two topics have keyword overlap > 0.6 AND the same primary region, merge them (keep the one with more sources).

**Option B — Strengthen the prompt:**
Add explicit instruction to the Grok clustering prompt: "Never create two topics about the same event. If multiple article clusters describe the same event from different angles, merge them into a single topic."

**Option C — Both A + B:**
Belt and suspenders. Prompt improvement reduces duplicates, post-processing catches any that slip through.

### Location in code

- File: `amplify/backend/function/newsInvokeGemini/src/index.js`
- The clustering happens in the Grok prompt call (search for `clusterTopics` or the system prompt that defines topic schema)
- Post-processing would go after the Grok response is parsed, before writing to DynamoDB

---

## Issue 2: Today's Data Missing ThreadIds and AI Content

**Severity:** Low (expected behavior)
**Affected component:** Pipeline timing + `newsSensitiveData` Lambda

### Problem

Today's topics (served from `latest` in DynamoDB) show 0 threadIds and 0 AI data in the Weekly view until the second Lambda (`NewsProjectInvokeAgentLambda`) runs.

### Root Cause

The pipeline runs in two stages:
1. `newsInvokeGemini` — fetches news, clusters into topics, writes to `staging`
2. `NewsProjectInvokeAgentLambda` — reads `staging`, generates AI content (summary/prediction/trace_cause), assigns threadIds, writes archive, swaps to `latest`

Between stage 1 and stage 2, `latest` has topics but no AI data or threadIds. The Weekly page reads from `latest` for today's data, so it shows incomplete entries during this gap.

Additionally, the `archive_range` endpoint in `newsSensitiveData` was not passing `threadId` or `search_keywords` through for today's entries. **This has been fixed in the code but not yet deployed.**

### Fix

- Deploy the updated `newsSensitiveData` Lambda (includes threadId/search_keywords in today's archive_range entries)
- This is otherwise working as designed — the gap between Lambda 1 and Lambda 2 is expected

---

## Issue 3: Weekly UI Visualization Improvements

**Severity:** Enhancement
**Status:** Mostly resolved (2026-03-14)

### Resolved

1. **Story evolution at a glance** — ✅ TrendBadge (Rising/Stable/Fading/New) on every multi-article card header. Sparkline bar charts show articles/day.

2. **Geographic visualization** — ✅ MiniMap per story card (SVG Equirectangular projection with country dots). Full WeeklyMap page (`/weekly-map`) with thread-colored markers, polylines, and country-based replay animation (thread-level Play Evolution was removed — country replay is more useful).

3. **Trend indicators** — ✅ TrendBadge compares article count in recent half vs older half of date range.

4. **Trending summary** — ✅ "Trending This Week" section with horizontally scrollable cards for rising/new stories. Click opens modal with full thread detail (MiniMap, all entries, AI toolbar toggle).

### Remaining Gaps

- **Cross-story comparison** — Still no side-by-side view for stories sharing regions or sources.
- **Source diversity** — Source coverage matrix not restored. Sources listed per entry but no cross-story analysis.
