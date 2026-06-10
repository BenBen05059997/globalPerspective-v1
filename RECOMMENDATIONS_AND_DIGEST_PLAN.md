# Recommendations + Email Digest — Plan

**Status:** APPROVED 2026-06-05
**Target:** Component 1 (engine) first; Components 2–3 follow.

> **Email-provider update (2026-06-10):** the digest will send via **Resend, not SES** — decided while building the breaking-alerts channel (`BREAKING_ALERTS_PLAN.md`), for DX + no sandbox-approval wait. The shared send seam is `newsBreakingAlert/src/sendEmail.js` (provider behind one function). The SES references below (sandbox, production-access) are **superseded** by Resend; the only remaining external step is verifying `globalperspective.net` DNS records in Resend, which any provider needs.
**Marginal infra cost:** ~$1/month (one PAY_PER_REQUEST table, one on-demand Lambda, SES at fractions of a cent/email).

## Why

Two user-facing capabilities the site lacks today:
1. **Recommendations** — help a reader find the next thing worth reading instead of re-scanning the feed.
2. **Email digest** — bring opted-in users back with a periodic summary of what they care about.

Key insight driving the architecture: **the digest and the recommendations are the same engine.** Both answer one question — *"rank these candidate items for this user."* Build the ranking once; render it on-site as a rail and serialize it into an email. Do not build the algorithm twice.

## What we already have (grounded)

- **Content pool with tags, no joins needed:** `TOPICS_DDB_TABLE` → `latest.topics[]`, each topic carrying `category`, `regions[]` (countries), `threadId`, and `sources[]` (source count = a clean popularity proxy).
- **Interest signal:** `GlobalPerspectiveSavedItems` (PK `uid` / SK `{itemType}#{itemId}`, item types `thread|country|daily|pair`, free-form `metadata`, `savedAt`).
- **Identity:** Firebase auth (verified email available from the JWT), `USERS_DDB_TABLE`.
- **No user-facing email exists.** Only operator alerts via the SNS `GlobalPerspectiveAlerts` topic (`newsErrorDigest`, `newsFreshnessMonitor`).

## The engine

A new server-side **`newsRecommend` Lambda** is the single source of truth — *not* a shared JS file. Reason: the digest (Node, batch) and the on-site rail (browser) would each otherwise need a copy of the algorithm plus access to the full content pool. One Lambda = one implementation; the rail fetches it through the REST proxy (`?action=recommend`), and the digest Lambda imports the same `scoreItem()` function in-process.

**Deterministic, content-based, no ML.** At our traffic, collaborative filtering / ML has too little interaction data and would produce noise. Industry's low-scale tier is content-based ranking, which our structured tags support directly.

**Interest profile** (derived from a user's saved items, cached in `NewsUserPrefs.interestProfile`):
```
{ categories: { geopolitics: 3, economy: 1, ... },   // weighted counts
  countries:  { IR: 2, IL: 2, US: 1, ... },
  threads:    [ savedThreadId, ... ] }
```

**Score per candidate topic:**
```
score = wCat     · categoryOverlap(topic, profile)
      + wCountry · regionOverlap(topic, profile)
      + wThread  · threadAffinity(topic, profile)   // same/continuing thread as a saved one
      + wRecency · recencyDecay(topic)
      + wPop     · popularity(topic)                 // = sources.length, normalized
```
- **Exclude** topics whose `threadId` the user already saved (never recommend back what they have).
- **Cold start** (anonymous, or logged-in with zero saves) → `wRecency·recency + wPop·popularity` only = **"Trending today."** Honest, non-personalized — no fabricated affinity ([[feedback-no-misinformation-fallback]]).

Weights live as module constants (tunable), not magic numbers scattered in code.

## Schema (decided: dedicated table)

Reuse `SavedItems` unchanged for the raw signal. Add **one dedicated table** so the email/notification concern stays isolated from the auth table ([[feedback-clean-architecture]]):

### `GlobalPerspectiveUserPrefs` (`USER_PREFS_TABLE`, ap-northeast-1, PAY_PER_REQUEST)
**PK:** `uid` (Firebase UID, String)

| Attr | Type | Purpose |
|------|------|---------|
| `uid` | S (PK) | Firebase uid |
| `email` | S | captured from the JWT at opt-in |
| `digestOptIn` | BOOL | master switch |
| `digestCadence` | S | `weekly` (default) \| `daily` |
| `digestVerified` | BOOL | double opt-in gate — no email sent until `true` |
| `unsubToken` | S | random; powers one-click `List-Unsubscribe` |
| `lastDigestSentAt` | S | ISO; cadence guard / dedupe |
| `interestProfile` | M | cached tag weights, recomputed on save + nightly |
| `updatedAt` | S | ISO |

`interestProfile` is a **cache** of what's derivable from `SavedItems` — stored so the digest cron need not re-scan every user's saves at send time.

## Components (build order)

1. **`newsRecommend` Lambda + `GlobalPerspectiveUserPrefs` table.** `scoreItem()` + interest-profile builder; reads `SavedItems` + `TOPICS latest.topics[]`. Unit-tested scorer. No external dependencies — build first.
2. **On-site rail.** REST proxy `?action=recommend` → `useRecommendations` hook → a "For you" (logged-in) / "Trending" (anonymous) rail. Browser-tested before deploy.
3. **`newsDigestSender` cron + SES.** Imports `scoreItem()`; double opt-in, preference center, one-click `List-Unsubscribe`. **Gated on SES production access.**

## Product knobs (defaults, all reversible)

- **Digest cadence default:** `weekly` (lower fatigue; per-user daily option).
- **Recommendations scope:** personalized for logged-in users; anonymous users get Trending.
- **Sender identity:** `globalperspective.net` (the verified custom domain).

## External dependency to start early

**AWS SES** begins in sandbox (can only send to verified addresses) and needs the sending domain's DNS records (DKIM/SPF/DMARC) plus a **production-access request** before it can reach real inboxes — a multi-day external lead time. Kick this off alongside Component 1 so it's approved by the time Component 3 lands.

## Compliance (Component 3)

- **Double opt-in** — confirmation click sets `digestVerified` before any digest is sent.
- **One-click unsubscribe** — `List-Unsubscribe` + `List-Unsubscribe-Post` headers (now required by Gmail/Yahoo bulk-sender rules), backed by `unsubToken`.
- **Transactional vs digest separation** — a digest unsubscribe must never disable account/transactional email.
