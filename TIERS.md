# Global Perspectives — Tier Design

**Last updated: 2026-03-20**
**Status: Member tier fully shipped. Enterprise is planned but not yet built.**

---

## Overview

Three tiers: Free (public), Member ($15/mo), Enterprise (TBD).

The core product is free. Member unlocks historical narrative intelligence. Enterprise unlocks the pipeline itself — custom feeds, private source analysis, and deep cross-reference intelligence.

---

## Free

**Who it's for:** Anyone. The default experience.

**What they get:**
- Today's ~13 topics, refreshed hourly
- AI Summary, Prediction, Trace Cause per topic
- Interactive world map with spider web connections
- 24-hour archive of earlier topics
- Narrative thread IDs visible on topics (no history)

**Gate:** None. No API key required.

---

## Member — $15/mo

**Who it's for:** Individuals who want to track how stories evolve over time — professionals, researchers, globally-minded readers.

**What they get (on top of Free):**
- **7-day archive** via `archive_range` action
- **Weekly narrative view** (`/weekly`) — stories grouped by thread, trend badges (Rising/Stable/Fading/New), sparkline charts
- **Weekly map** (`/weekly-map`) — thread-colored markers, date playback animation
- **Narrative thread detail** via `narrative_thread` action — full entry history for any thread
- **Thread intelligence** — story arc, trajectory, root cause chain across the thread's lifetime
- **Trending section** — rising and new stories with modal detail view

**Gate:** Firebase Auth magic link → JWT verified in Lambda → tier looked up in DDB Users table. ✅ **Shipped.**

**Tier detection:** Frontend requests 30 days, infers tier from how many days come back (≤7 = member).

---

## Enterprise — Pricing TBD

**Who it's for:** Organizations — policy shops, PR firms, consultancies, research teams, newsrooms — that need intelligence connected to their own data, not just a read-only view of the public feed.

### Core differentiation from Member

Enterprise is not "member with more days." The fundamental difference: **member reads our pipeline's output; enterprise feeds into the pipeline**.

### Feature set

**1. More history**
- 30-day archive (vs 7 days member) — currently the same cap; 90+ days is a future differentiator once enough archive data accumulates

**2. Custom source feeds**
The pipeline currently runs fixed RSS feeds (BBC, Al Jazeera, France24, SCMP, etc.) with `TOPICS_LIMIT=13`. Enterprise customers configure what the pipeline watches:
- Add their own RSS feeds or data sources to the ingestion run
- Focus the feed on specific regions, industries, or topic categories
- Get a pipeline run tuned to their intelligence needs, not the general global feed

**3. Document upload + cross-reference analysis**
The most differentiated capability. Enterprise uploads an internal document — analyst memo, field report, client brief, internal assessment — and the platform:
1. Runs the same SUMMARY/PREDICTION/TRACE_CAUSE Grok analysis on it
2. Cross-references it against existing narrative threads using the Jaccard similarity logic that already powers threading
3. Returns: "your document connects to these threads we've been tracking for X days — here's how the public narrative supports or contradicts your assessment"

This turns the platform from "read our news analysis" into "enrich your own intelligence with what we know."

**4. Deep thread analysis**
Right now TRACE_CAUSE runs per topic at `MAX_TOKENS=600`. Enterprise gets a full thread-level analysis — all entries in a thread (up to 90 days) fed into Grok in a single call:
- True narrative arc: how the story evolved entry by entry
- Actor tracking: what each country/organization did across the full timeline
- Forward analysis: what comes next given the full arc, not just the latest entry
- Substantially richer than per-topic snippets

**5. Team seats + org management**
- Multi-seat access under one enterprise account (3–5 seats)
- Admin can provision/revoke individual seat keys
- Usage visible at org level

**6. Webhook / push delivery**
- "Notify me when thread X gets a new entry"
- "Alert me when Asia conflict topics spike this week"
- Pushes to Slack, Teams, or email — enterprise intelligence embedded in existing workflow

---

## What Enterprise is NOT (yet)

Items that are standard in other enterprise intelligence products but not in scope for v1:
- SSO/SAML
- Audit logs
- Annual contract / invoice billing / MSA
- SLA with uptime credits
- White-label / embed
- SOC 2 / DPA / compliance documentation

These matter for procurement at large organizations but require significant non-technical work. Address when a specific enterprise customer requires it.

---

## Technical gaps to build for Enterprise

| Feature | What needs to be built |
|---------|----------------------|
| Custom source feeds | Per-org feed config stored in DDB; newsInvokeGemini reads org config on run |
| Document upload + analysis | New ingestion Lambda; S3 for doc storage; Grok analysis + Jaccard cross-ref against archive |
| Deep thread analysis | New action in newsSensitiveData; read all thread entries, single Grok call with full context |
| Team seats / org management | Org table in DDB; admin endpoint for key provisioning/revocation |
| Webhook delivery | New Lambda triggered on archive write; per-org alert config |
| 90-day archive | Increase `ENTERPRISE_MAX_DAYS` from 30 → 90; verify DDB archive entries exist that far back |

---

---

## Auth + Payment Architecture

### Stack

| Concern | Service | Why |
|---------|---------|-----|
| Identity / auth | Firebase Auth | Magic link built-in, free tier, Admin SDK works in Lambda, user dashboard |
| User + tier storage | DynamoDB (new Users table) | Already in stack, single source of truth for tier |
| Payments + billing | Stripe | Checkout, subscriptions, Customer Portal, webhooks |
| Frontend auth state | Firebase JS SDK + AuthContext | Wraps entire React app, user available everywhere |

### DynamoDB Users Table (new)

```
PK: uid (Firebase uid)
─────────────────────────────────────────
uid               string   Firebase user ID
email             string   User email
tier              string   'free' | 'member' | 'enterprise'
stripeCustomerId  string   Stripe customer ID
subscriptionId    string   Stripe subscription ID
subscriptionStatus string  'active' | 'canceled' | 'past_due'
createdAt         string   ISO timestamp
updatedAt         string   ISO timestamp
```

### Magic Link Sign-In Flow

```
1. User visits /weekly or /signin
2. Frontend: sendSignInLinkToEmail(email) → Firebase sends magic link
3. User clicks link in email → redirected to /auth/callback
4. Frontend: signInWithEmailLink() → Firebase returns ID token
5. ID token stored in Firebase session (automatic)
6. Every API call: Authorization: Bearer <firebase-id-token>
7. Lambda: firebase-admin.auth().verifyIdToken(token) → { uid, email }
8. Lambda: DDB lookup by uid → get tier
9. tier === 'member' → serve data / tier === 'free' → 401 + upgrade signal
```

### Payment + Upgrade Flow

```
1. User clicks "Get Member — $15/mo" on /pricing
2. Stripe Checkout opens (email pre-filled from Firebase Auth)
3. Payment succeeds → Stripe webhook fires to new webhook Lambda
4. Webhook Lambda: writes { uid, tier: 'member', stripeCustomerId, subscriptionId } to DDB Users
5. User redirected to /upgrade/success
6. Next API call → Lambda sees tier=member → access granted
```

### Stripe Failure / Cancellation

```
Stripe webhook: customer.subscription.deleted
  → Lambda updates DDB: tier = 'free', subscriptionStatus = 'canceled'
  → User's next API call → 401 + re-upgrade prompt
```

---

## Member Build Plan — COMPLETED ✅

All phases shipped as of 2026-03-18.

| Phase | Status |
|-------|--------|
| Phase 1 — Firebase project, DDB Users table, `newsStripeWebhook` Lambda, Stripe portal action | ✅ Done |
| Phase 2 — `AuthContext.jsx`, `/signin`, `/auth/callback`, Firebase JWT in `restProxy.js`, auth-aware `Layout.jsx` | ✅ Done |
| Phase 3 — `/pricing`, `/upgrade/success`, `/account` pages + routes | ✅ Done |
| Phase 4 — Thread intelligence, country intelligence, weekly + map + country pages | ✅ Done |
| Phase 5 — Auth migration (Firebase JWT replaces static API keys) | ✅ Done |

---

## Pages Summary

| Route | Who sees it | Purpose |
|-------|------------|---------|
| `/pricing` | Everyone | Tier comparison + upgrade CTA |
| `/signin` | Unauthenticated | Email input for magic link |
| `/auth/callback` | Firebase redirect | Completes magic link sign-in |
| `/account` | Signed-in users | Tier status, billing management, sign out |
| `/upgrade/success` | Post-payment | Confirms access, onboards to Member |

---

## Tier comparison

| Capability | Free | Member | Enterprise |
|-----------|------|--------|------------|
| Daily topics + AI analysis | ✅ | ✅ | ✅ |
| Interactive map | ✅ | ✅ | ✅ |
| Archive history | — | 7 days | 30 days |
| Weekly narrative view | — | ✅ | ✅ |
| Narrative thread detail | — | ✅ | ✅ |
| Thread intelligence (arc, trajectory) | — | ✅ | ✅ |
| Custom source feeds | — | — | ✅ |
| Document upload + cross-reference | — | — | ✅ |
| Deep thread analysis (full arc) | — | — | ✅ |
| Team seats + org management | — | — | ✅ |
| Webhook / push alerts | — | — | ✅ |
| Seats | 1 | 1 | 3–5 |
