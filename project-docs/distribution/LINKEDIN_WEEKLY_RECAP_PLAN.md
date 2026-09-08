# LinkedIn Weekly Recap — Plan (DISCUSSION DRAFT, not built)

**Status:** idea / discussion only — nothing implemented. Captured 2026-06-23.
**Origin:** "use the LinkedIn token to find which post had the most impressions, then repost the best ones on the weekend as a recap."

---

## Concept

A weekend "Week in Review" post on LinkedIn that resurfaces the week's strongest stories — a single recap post linking the top 3–5, posted Sat/Sun when feeds are quieter and evergreen recaps do well.

The content value stands on its own; the only real design question is **how we pick "the best."**

---

## The hard constraint (discovered while grounding this)

We post as a **personal profile** — `author: urn:li:person:${LINKEDIN_PERSON_ID}` (`sMLG9Pk5qY`), scope `w_member_social` (write-only). We are **not** an Organization/Company Page.

Consequences:
- **Impressions are NOT available via API for personal posts.** LinkedIn's analytics endpoints (`organizationalEntityShareStatistics`, etc.) are Organization-only and require the **Community Management API** product + approval (`r_organization_social` / `rw_organization_admin`). A person URN cannot read them. ⇒ The literal "most impressions" metric is **off the table** unless we migrate posting to a Company Page.
- **Engagement (reactions + comments)** via the `socialActions` API on a known post URN is the closest reachable signal — but reading social actions on your own *member* posts can also be restricted. **Must be verified with a spike (Phase 0) before relying on it.**
- **Low absolute traffic** (per `reference_observability_usage`): engagement counts are tiny, so ranking on them is noisy — "top 3" could be 2 vs 1 vs 0 reactions, effectively random and possibly surfacing a weak story.

**Honesty guardrail (non-negotiable, ties to the site's no-fabrication rule):** never label the recap "most viewed / most impressions" unless we have *real* numbers. If we rank by our own signal, call it "this week's highest-signal stories" or "editor's picks" — not a viewership claim.

---

## What we already have (no new capture needed)

`SOCIAL_POSTS_TABLE` rows, written per post by `newsPostLinkedin`:
```
PK: POSTED#{platform}#{fingerprint}
platform, topicTitle, topicId, postId (= LinkedIn post URN), postedAt (ISO), ttl (30d)
```
30-day TTL comfortably covers a 7-day lookback. We have URN + title + date for every post this week — enough to rank and link them.

---

## Ranking signal — tiered (recommended: own-signal first)

1. **Primary — our own `significance.js` score** (already built for breaking-alerts): popularity (`sources.length`) × breadth × max country riskScore × economic magnitude. Deterministic, no API dependency, editorially meaningful, always available. **This is the recommended engine.**
2. **Optional bonus — LinkedIn engagement** (reactions + comments via `socialActions` on each `postId`), *only if Phase 0 proves it's readable*. Use as a tiebreaker / secondary sort, never the sole basis, given the low-count noise.
3. **Never** present own-signal ranking as a viewership metric (see honesty guardrail).

---

## Mechanics (proposed)

- **New dedicated Lambda** `newsWeeklyRecap` (per `feedback_clean_architecture` — prefer new infra over bloating `linkedInAutoPost`). No LLM required; copy can be deterministic, or optionally a short LLM-written intro line later.
- **Schedule:** EventBridge, once weekly — e.g. `cron(0 16 ? * SUN *)` (Sun 16:00 UTC). Tune to best engagement window.
- **Flow:**
  1. Read the week's `SOCIAL_POSTS_TABLE` rows (`platform = LINKEDIN`, `postedAt` within 7d).
  2. Join each `topicId` to its current significance inputs (latest topics / thread / country-intel / economic-impact records) → score.
  3. (Optional) enrich with `socialActions` engagement if Phase 0 succeeded.
  4. Pick top 3–5; dedupe so the same story isn't recapped two weekends running.
  5. Compose ONE recap post — "📊 The week's most significant stories:" + titled links to each story's thread page on the site (drives traffic back, not just to LinkedIn).
  6. Post via the existing `postToLinkedIn` path (reuse the refreshed token). Record a recap marker so it's idempotent.
- **Repost vs digest:** prefer the single synthesized digest post over literally re-sharing N old posts (cleaner, less spammy, avoids the awkward personal-post reshare API).

---

## Phasing

- **Phase 0 — feasibility spike (do first, ~30 min):** with the live token, hit `socialActions` / `reactions` for one stored post URN and confirm what (if anything) comes back for a personal post. Outcome decides whether engagement is even an input. *If it returns nothing → own-signal only, and the "impressions" framing is dead.*
- **Phase 1 — own-signal recap:** build `newsWeeklyRecap` ranking purely by `significance.js`; deterministic copy; dry-run first (mirror the breaking-alert dry-run discipline), human-review before it auto-posts.
- **Phase 2 (optional) — engagement enrichment:** only if Phase 0 passed; add reactions/comments as a tiebreaker; still no "impressions" claim.
- **Phase 3 (optional, bigger) — Company Page migration:** if real impression analytics genuinely matter, the *only* path is posting as an Organization Page (new app product, Community Management API approval, org URN, re-auth). Large scope; separate decision.

---

## Open questions / risks

- **Phase 0 result** — is any engagement readable for personal posts? (Unknown until spiked.)
- **Low-count noise** — is weekly engagement even high enough to rank meaningfully? Likely not yet; own-signal sidesteps this.
- **Cannibalization** — does a recap of links the same audience already saw add value, or feel repetitive? Maybe frame as "if you missed them" + add a one-line "why it mattered" per story (we have that data).
- **Company Page question** — is moving social posting to a Company Page desirable for other reasons (analytics, brand, follower model)? If yes, Phase 3 unlocks impressions *and* this feature properly. If staying personal, accept own-signal ranking permanently.
- **Dedup window** — don't recap a story that was itself last weekend's recap headline.

---

## One-line verdict

Good content idea; the "impressions" engine isn't reachable for a personal profile, so **rank by our own significance signal, label it honestly, post one weekend digest** — and only chase real impressions if we decide to move posting to a Company Page.
