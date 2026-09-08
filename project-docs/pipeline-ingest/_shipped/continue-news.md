# Cache Refresh Implementation Plan

**Problem**: During hourly Lambda refresh (1:00, 2:00, etc.), frontend shows cache errors instead of content

**Solution**: Stale-While-Revalidate (SWR) pattern + timestamp display + background polling

---

## Status (as of 2026-04-27)

| Phase | Item | State |
|-------|------|-------|
| 1.1 | TTL bump | ✅ Shipped — env var unset, code default `9000s` (2.5h) in use (went further than the planned `5400s`) |
| 1.2 | Backend serve-stale (200 + `stale:true`) | ✅ Shipped 2026-04-27 — `readTopicsCache()` now returns `200 / success:true / cached:true / stale:true / asOf:<updatedAt>` instead of `503`. Fresh path also gains `stale:false / asOf` for envelope consistency. |
| 2 | Frontend hook (`isStale`, `updatedAt`, `hasNewData`, 10-min poll) | ✅ Shipped (date unknown — pre-existing in `useGeminiTopics.js`) |
| 3 | Frontend UI (timestamp + banner) | ✅ Shipped (pre-existing) |

**Important historical note:** Phase 1.2 (the backend stale-200 contract) was the missing half. From the time the frontend shipped until 2026-04-27, `useGeminiTopics` had `setIsStale(Boolean(data?.stale))` reading a flag the topics path never set — so the "⚠️ Updated X minutes ago (refreshing...)" indicator was effectively dead code. That asymmetry was hidden by bumping TTL to 9000s, which made stale responses rare. The 2026-04-27 patch closes the contract; the indicator now actually fires.

**Deferred (recommended next):**
- **Hard staleness ceiling** (`STALE_HARD_CEILING_SECONDS`, suggested default `86400`). Without it, a multi-day pipeline outage shows users multi-day-old "Today's Global Topics" with a friendly orange label — a credibility risk for a news product. Below ceiling → 200 + stale flag. Above ceiling → real 503 + alarm.
- **Cross-cutting `asOf` envelope** across all `newsSensitiveData` actions (daily_brief, thread_analysis, country_intelligence, pair_analysis, archive_range), matching the markets-data honesty contract.

**Verification done 2026-04-27:**
- `curl POST /default/proxy {"action":"topics"}` → fresh path: `success:true, stale:false, asOf:<ts>`, 11 topics ✅
- TTL temporarily flipped to `60s` → stale path: `success:true, stale:true, asOf:<ts>`, 11 topics still served ✅
- TTL restored (env var removed, code default `9000s`) ✅

---

## Changes Required

### 1. Backend: Lambda Environment Variable

**File**: AWS Lambda Console → `newsSensitiveData` → Environment Variables

**Change**:

```
TOPICS_CACHE_MAX_AGE_SECONDS: 3600 → 5400
```

**Why**:

- Current: Cache valid for 1 hour (3600s)
- New: Cache valid for 1.5 hours (5400s)
- Gives 30-minute buffer during hourly refresh
- Old cache stays "fresh" while new cache is being generated

---

### 2. Backend: Return Stale Data (Don't Error)

**File**: `amplify/backend/function/newsSensitiveData/src/index.js`

**Location**: Lines ~196-206 in `readTopicsCache()` function

**Current Code**:

```javascript
const isFresh = cacheEntryFresh(Item.updatedAt, TOPICS_MAX_AGE_SECONDS);
if (!isFresh) {
  console.warn("newsSensitiveData topics cache stale", {
    table: TOPICS_TABLE,
    itemId: TOPICS_ITEM_ID,
    updatedAt: Item.updatedAt,
    maxAgeSeconds: TOPICS_MAX_AGE_SECONDS,
  });
  return {
    statusCode: 503, // ❌ Returns error
    body: { success: false, error: "Topics cache stale", data: Item },
  };
}
```

**New Code**:

```javascript
const isFresh = cacheEntryFresh(Item.updatedAt, TOPICS_MAX_AGE_SECONDS);
if (!isFresh) {
  console.warn("newsSensitiveData topics cache stale (serving anyway)", {
    table: TOPICS_TABLE,
    itemId: TOPICS_ITEM_ID,
    updatedAt: Item.updatedAt,
    maxAgeSeconds: TOPICS_MAX_AGE_SECONDS,
  });
  // ✅ Still return data, just mark as stale
  return {
    statusCode: 200,
    body: {
      success: true,
      cached: true,
      stale: true, // NEW: Indicates data is old but usable
      data: Item,
    },
  };
}
```

**Why**:

- Frontend receives data even if slightly stale
- Better UX than showing error
- Follows SWR pattern (show stale, revalidate later)

---

### 3. Frontend: Accept Stale Data

**File**: `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js`

**Location**: Lines ~34-47 in `loadTopics()` function

**Current Code**:

```javascript
try {
  const data = await graphqlService.getGeminiTopics(10);
  const list = Array.isArray(data?.topics) ? data.topics : [];
  setTopics(list);
  // ...
} catch (err) {
  if (!hadCachedTopics) {
    setError(err?.message || "Failed to fetch Gemini topics"); // ❌ Shows error
  }
}
```

**New Code**:

```javascript
try {
  const data = await graphqlService.getGeminiTopics(10);
  const list = Array.isArray(data?.topics) ? data.topics : [];
  setTopics(list);

  // ✅ Track stale status and timestamp
  setIsStale(data?.stale || false);
  setUpdatedAt(data?.updatedAt || null);

  // Cache locally
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        topics: list,
        timestamp: Date.now(),
        updatedAt: data?.updatedAt, // NEW: Store backend timestamp
      })
    );
  } catch {}
} catch (err) {
  // Only show error if we have no cached data at all
  if (!hadCachedTopics) {
    setError(err?.message || "Failed to fetch Gemini topics");
  }
  // Otherwise silently fail - user still sees cached data
}
```

**Add to hook's return value**:

```javascript
return {
  topics,
  loading,
  error,
  refetch: loadTopics,
  isStale, // NEW
  updatedAt, // NEW
};
```

**Add state variables**:

```javascript
const [isStale, setIsStale] = useState(false);
const [updatedAt, setUpdatedAt] = useState(null);
```

**Why**:

- Hook now tracks staleness and timestamp
- Components can show appropriate UI
- Graceful degradation (show cached data on error)

---

### 4. Frontend: Add Background Polling

**File**: `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js`

**Add new effect** (after existing `useEffect`):

```javascript
// Background polling to detect new data
useEffect(() => {
  if (!updatedAt) return; // Wait until we have initial data

  const POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes

  const intervalId = setInterval(async () => {
    try {
      // Lightweight check - just get timestamp
      const data = await graphqlService.getGeminiTopics(10);
      const newUpdatedAt = data?.updatedAt;

      if (newUpdatedAt && newUpdatedAt !== updatedAt) {
        console.log("🔔 New topics detected:", {
          old: updatedAt,
          new: newUpdatedAt,
        });
        // Set flag to show "new data available" banner
        setHasNewData(true);
      }
    } catch (err) {
      console.warn("Background poll failed:", err);
      // Silently fail - don't disrupt user
    }
  }, POLL_INTERVAL);

  return () => clearInterval(intervalId);
}, [updatedAt]);
```

**Add state**:

```javascript
const [hasNewData, setHasNewData] = useState(false);
```

**Update return**:

```javascript
return {
  topics,
  loading,
  error,
  refetch: loadTopics,
  isStale,
  updatedAt,
  hasNewData, // NEW
};
```

**Why**:

- Checks for new data every 10 minutes
- Lightweight (same endpoint, minimal overhead)
- Non-blocking (runs in background)
- Enables "New topics available" banner

---

### 5. Frontend: Display Timestamp & Banner

**File**: `global-perspectives-starter/frontend/src/components/Home.jsx`

**Location**: After `const { topics, loading, error, refetch } = useGeminiTopics();`

**Change to**:

```javascript
const { topics, loading, error, refetch, isStale, updatedAt, hasNewData } =
  useGeminiTopics();
```

**Add helper function** (before return statement):

```javascript
// Format timestamp as "X minutes ago"
const getTimeAgo = (isoString) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
};
```

**Add timestamp display** (in the header section, around line 287):

```javascript
<div className="text-center mb-8">
  <h1 className="mb-4">Today's Global Topics</h1>
  <p style={{ fontSize: "1.1rem", maxWidth: "600px", margin: "0 auto" }}>
    Trending topics from around the world, organized by region
  </p>

  {/* NEW: Timestamp display */}
  {updatedAt && (
    <p
      style={{
        fontSize: "0.9rem",
        color: isStale ? "#ff9800" : "#666",
        marginTop: "0.5rem",
      }}
    >
      {isStale && "⚠️ "}
      Updated {getTimeAgo(updatedAt)}
      {isStale && " (refreshing...)"}
    </p>
  )}

  {/* NEW: "New data available" banner */}
  {hasNewData && (
    <div
      style={{
        marginTop: "1rem",
        padding: "0.75rem 1rem",
        backgroundColor: "#4caf50",
        color: "white",
        borderRadius: "4px",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <span>🆕 New topics available</span>
      <button
        onClick={() => {
          refetch();
          setHasNewData(false); // Clear banner after refresh
        }}
        style={{
          padding: "0.25rem 0.75rem",
          backgroundColor: "white",
          color: "#4caf50",
          border: "none",
          borderRadius: "3px",
          cursor: "pointer",
          fontWeight: "600",
        }}
      >
        Refresh
      </button>
    </div>
  )}
</div>
```

**Why**:

- Users see data freshness ("Updated 47 minutes ago")
- Stale data gets warning indicator
- "New data available" prompts user to refresh
- Better UX than silent failures

---

## Implementation Steps

### Phase 1: Backend (5 minutes)

1. **AWS Console → Lambda → newsSensitiveData**

   - Configuration → Environment variables
   - Edit: `TOPICS_CACHE_MAX_AGE_SECONDS` = `5400`
   - Save

2. **Edit `newsSensitiveData/src/index.js`**
   - Find `readTopicsCache()` function
   - Change error return to success + stale flag
   - Deploy Lambda

**Test**: Frontend should no longer see "cache stale" errors

---

### Phase 2: Frontend Hook (10 minutes)

1. **Edit `useGeminiTopics.js`**
   - Add `isStale`, `updatedAt`, `hasNewData` state
   - Update error handling (accept stale data)
   - Add background polling effect
   - Update return value

**Test**: Console should log "🔔 New topics detected" when new data available

---

### Phase 3: Frontend UI (10 minutes)

1. **Edit `Home.jsx`**
   - Destructure new values from hook
   - Add `getTimeAgo()` helper
   - Add timestamp display
   - Add "New data available" banner

**Test**: UI should show "Updated X minutes ago" and refresh banner

---

## Files Summary

| File                             | Lines Changed | Complexity |
| -------------------------------- | ------------- | ---------- |
| Lambda env var                   | 1 line        | Easy       |
| `newsSensitiveData/src/index.js` | ~10 lines     | Easy       |
| `useGeminiTopics.js`             | ~40 lines     | Medium     |
| `Home.jsx`                       | ~50 lines     | Easy       |

**Total**: ~100 lines of code across 3 files + 1 config change

---

## Testing Checklist

- [ ] Backend returns data even when cache > 1 hour old
- [ ] Frontend shows timestamp "Updated X minutes ago"
- [ ] Stale data shows warning indicator
- [ ] Background polling runs every 10 minutes
- [ ] "New data available" banner appears when detected
- [ ] Clicking "Refresh" fetches new data
- [ ] No errors during Lambda refresh window (1:00-1:05)

---

## Rollback Plan

If issues occur:

1. **Revert Lambda env var**: `TOPICS_CACHE_MAX_AGE_SECONDS` back to `3600`
2. **Revert code changes**: `git revert <commit-hash>`
3. **Emergency**: Keep env var at 5400, just remove frontend changes (users see old behavior but no errors)

---

## Benefits After Implementation

✅ **No more errors** during Lambda refresh
✅ **Users always see content** (even if slightly stale)
✅ **Fresh data within 10 minutes** of being available
✅ **Clear communication** via timestamps
✅ **User control** via refresh button
✅ **Graceful degradation** (works offline with cached data)

---

## Alternative: Quick Fix (If Time Constrained)

If you only want to fix the errors quickly, just do:

1. **Change env var**: `TOPICS_CACHE_MAX_AGE_SECONDS` = `5400`
2. **Change Lambda code**: Return 200 instead of 503 for stale cache

This alone eliminates errors. The rest (polling, UI) are UX enhancements.
