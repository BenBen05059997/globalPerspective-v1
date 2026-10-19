# Situation Backend Audit — full-pipeline verification (2026-09-10)

**Why this exists:** before tuning the feed-quality thresholds (patch slices 4+5), the operator asked
for a full re-read of the situation backend with proof of understanding. Method: four parallel
Sonnet auditors (one per pipeline stage), every claim required either a `file:line` citation or a
live AWS/HTTP observation; conflicting or load-bearing claims re-verified directly against live
data by the orchestrator. Nothing below is asserted from memory or docs alone.

**Scope:** `newsGdacsIngest` → `newsSituationIngest` → `newsSituationTracker` → S3
`globalperspective-world-280362093938` → Cloudflare Worker `/data/*` → `/map` frontend.

---

## 1. The system as it actually runs (all live-verified)

| Component | Schedule (EventBridge, verified) | Live env overrides | Code defaults in force |
|---|---|---|---|
| `newsGdacsIngest` (256MB/120s) | `TriggerGdacsIngest` · rate(20 min) · ENABLED | none | inbox+corpus stable pointers |
| `newsSituationIngest` (512MB/300s) | `TriggerSituationIngest` · rate(1 h) · ENABLED | DeepSeek endpoint + `deepseek-v4-flash` | BATCH=35, MAX_BATCHES=12 (420-article cap), CONCURRENCY=4, MAX_AGE_H=36; persist filter `outlets≥2 ∥ sev≥3`, cap 80 |
| `newsSituationTracker` (512MB/120s) | `TriggerSituationTracker` · rate(30 min) · ENABLED | `DRY_RUN=false`, `SWEEP_MIN=30`, **`CLOSED_KEEP_HOURS=8`** | `CLOSE_AFTER_COOL_CHECKS=3`, `STORY_MAP_MIN_OUTLETS=3`, `STORY_MAP_MIN_SEVERITY=4`, `STORY_MAP_CAP=40`, `GDACS_STALE_MIN=45` |

- The two `situations-core.js` copies (gdacs + tracker) differ **only** by the 2-line shared-module
  header comment in the tracker's copy. No functional drift (diffed 2026-09-10).
- Alarms `situation-tracker-errors` / `situation-tracker-stalled` both exist, both OK, stalled-alarm
  correctly tuned to the real 30-min cadence. All `putMetric` names in code match the live
  `GlobalPerspective/Situations` namespace exactly.
- S3 layout matches design (`situations/state|index|history|archive|inbox`, `world/`, `stories/`,
  `corpus/` + `audit/ predictions/ signals/ shadow/`). `situations/state` (118 objects) is in
  perfect 1:1 correspondence with `situations/index.json` ids — zero orphans.
- Worker `/data/*` has a real prefix allowlist (`world/*.json`, `situations/state/*`,
  `stories/state/*` only) — `situations/index.json`, `corpus/*`, `audit/*` all 404 live;
  `world/latest.member.json` is hard-401 (member auth is a fail-closed stub). IAM reader is scoped
  to the same three prefixes (defense in depth).
- Live bundle at audit time: **118 situations, 100% `news#`, 53 open / 65 closed**; open tiers
  1 high / 35 elevated / 2 moderate / 15 low; 19 of 53 open are single-outlet. GDACS inbox:
  0 Orange/Red events (quiet feed).

## 2. Findings, ranked (each verified live or by file:line)

### F1 — StoryId fragmentation is the root disease (HIGH; live-proven)
`storyId = axis#iso3[0]#slug(entities[0]||category)` per **article-derived** key
(`classifier-core.js:86-88`), with no entity normalization. Live snapshot shows one real event
(Trump/Iran) split across up to **6 storyIds** (`conflict#USA#donald-trump` 5 outlets,
`conflict#USA#trump` 1 outlet, plus `political#USA#{donald-trump,trump,trump-administration}`).
Consequences: outlet corroboration is diluted below thresholds; velocity resets to 1 on every
re-key (prev=null); `spread_new_iso3` re-announces the full country set; the tracker opens a fresh
`news#<id>` situation per fragment while the old one cools→closes. **This, not the close-keep knob,
is why 65 of 118 rows are corpses.** Tracker logs (last 8 sweeps): 6-16 closes *every 30 minutes*;
35-45% of rows change per sweep.

### F2 — Tier has zero corroboration input (HIGH)
`tier = SEV_TIER[story.max_severity]` (`situations-core.js:229`); effective floor for a
**1-outlet** story to reach the map: a single uncalibrated LLM `severity≥4` (map filter
`outlets≥3 ∥ sev≥4`, `tracker/index.js:218`) — and `sev≥3` is enough to be persisted to
`stories/index.json` at all (`ingest/index.js:192`). Live: 60% of persisted stories (48/80) are
single-outlet; 19 single-outlet situations open on the map.

### F3 — GDACS vocabulary + fields leak into every cooling news situation (HIGH; user-facing; live-proven)
`coolSituation` is source-agnostic but hardcodes GDACS text and splices `gdacs_level:'Gone'`,
`gdacs_score:null`, `gdacs_date_modified:null` into the evidence object
(`situations-core.js:199-221`); its only call site passes `obs=null` (`tracker/index.js:81`), so
every dropped news situation gets history note **"Event no longer current in GDACS"**. Verified
live on `news#conflict#NGA#nigerian-army` (evidence now contains both `outlets` and `gdacs_*`
keys). Cooling also force-downgrades `tier` to `'low'` regardless of true severity.

### F4 — Escalation flip-flops with no hysteresis (MEDIUM-HIGH)
`escalating = velocity≥1.5 ∥ spread_new_iso3.length>0` (`situations-core.js:231`), both recomputed
upstream each run; `raised` fires every time state crosses back into escalating
(`situations-core.js:251`). Velocity 1→2 outlets reads as 2.0×; a fresh/re-keyed story reports its
entire iso3 list as "spread". Live logs show `raised:4-14` in sweeps with `opened:0`, repeatedly.

### F5 — One-event-one-pin actively KILLS open news situations (MEDIUM)
The merge (`tracker/index.js:249-256`) excludes a humanitarian story sharing a country with a
GDACS observation **this sweep** — which removes an already-open news situation from `presentIds`,
sending it down the cooling→close path while its story is still active. When GDACS later closes,
the suppressed situation resurrects via F6. Suppression should not equal cooling.

### F6 — Closed situations resurrect wrongly (MEDIUM)
`buildStorySituation` never checks `prev.state==='closed'`: a reappearing storyId within the keep
window jumps straight to `peak` (never re-`emerging`), inherits the original stale `opened_at`
(up to ~8h old), and may register `change:'unchanged'` — no "reopened" signal exists.
(`situations-core.js:249-262`.) `cooling_checks` does reset correctly on reappearance (base object
doesn't spread `...prev`) — that specific premature-close worry is disproven.

### F7 — `coverage_ratio` is consumed but never emitted (MEDIUM; live-proven)
`SituationHome.jsx:55` reads `ev.coverage_ratio` — no such field exists anywhere in the tracker
output; the regex fallback only matches when `velocity≥1.5` was templated into `what_changed`. So
long-running steady situations show **"new"** in the vs-prior cell — verified live on
`news#conflict#IRN#iran` (`check_count:64`, shows as new). One-line fix at
`situations-core.js:246`.

### F8 — `stale` flag ignores the news source (MEDIUM)
`computeStale` checks `sources.gdacs` only (`tracker/index.js:141-146`); a dead news pipeline with
a live GDACS poller keeps `stale:false`. The client's independent 90-min `asOf` guard
(`useWorld.js:44`) covers both sources, limiting real exposure — but the backend flag alone lies.

### F9 — Ingest is silently truncating at its 420-article cap (MEDIUM)
Live: `437 fresh articles → classified 420 in 12 LLM calls` — 17 dropped with **no log line**
(`ingest/index.js:171`). Volume (415-437/h) already brushes the ceiling; a major breaking hour
would silently discard the most articles exactly when counts matter most.

### F10 — `kind` (event/analysis/commentary) is classified then discarded (MEDIUM)
The LLM labels every article, but `clusterStories` never filters on it and the tracker never reads
it (grep: zero matches). Op-ed waves count as coverage acceleration.

### F11 — Unbounded S3 growth in two prefixes (LOW-MEDIUM)
`situations/history/` and `situations/archive/` have IA transitions but **no expiration** — unlike
every sibling prefix (world/corpus/stories/signals/audit all expire). ~48 history objects/day and
one archive object per closed situation, forever. Cheap today, unbounded by design gap.

### F12 — Ghost focus on closed rows (LOW)
`SituationMap3D.jsx` filters pins by `state!=='closed'` (line ~103) but the focus/overlay path
doesn't (line ~112): deep-linking a closed-but-kept id flies the camera and draws the
affected-fill/arcs over an empty spot. Detail panel correctly shows "Ended".

### F13 — Dead payload + duplicated derivations (LOW, drift risk)
`lede` and `ranked` are emitted but the frontend recomputes both client-side with not-quite-identical
logic (`SituationHome.jsx:71-78,113` vs `deriveRanked`/`deriveLede`); `affected_names`,
`spread_arcs`, `_counts`, `systemic` emitted and unused. Backend tuning of lede/rank silently does
nothing for users.

### F14 — Small config/doc drift (LOW)
Tracker header comment says "rate(10 minutes)" — real cadence 30 min. `SWEEP_MIN` only feeds the
displayed `next_expected_at`, not any real cadence. Worker overrides S3's `max-age=60` with its own
`s-maxage=300, SWR 600` — one of the two numbers is dead. Ingest feed labeled `Reuters(GN)` is
actually a generic Google News world query, and all its articles count as one outlet
(`news.google.com`) — an *under*count, protective direction.

### Explicitly disproven / confirmed-safe
- No orphaned state objects; index↔state writes are ordered so a partial failure can't produce a
  referenced-but-missing id (`tracker/index.js:263-264`).
- No literal storyId collisions; gdacs#/news# namespaces disjoint; no third tier-assignment path —
  **a corroboration cap in `buildStorySituation` provably cannot touch GDACS tiers**.
- Green GDACS events structurally cannot open situations (filtered at the opener,
  `gdacsIngest/index.js:86`); the `lowered Orange→Green` branch in `buildSituation` is dead code
  (Green never reaches the tracker).
- GDACS outage ⇒ situations **freeze** (stable pointer re-read as unchanged), not spuriously cool;
  only the world-level `stale` banner warns.
- The inbox `processed/` machinery is intentional scaffolding for future per-event openers (no
  writer exists; lifecycle rule pre-provisioned); currently dead by design.
- No LLM batch failures in the sampled 24h; `Promise.allSettled` used correctly; S3 404/403
  handled. Worker allowlist + scoped IAM both hold live.

## 3. What this changes about the slice 4+5 plan

The original slice-5 framing ("add a corroboration cap, maybe tighten the OR-filter, shorten
closed-keep") treated symptoms. The audit shows the noise has **one dominant cause (F1, storyId
instability)** and several amplifiers. Revised candidate work, in causal order:

1. **Stabilize story identity (ingest)** — normalize entity slugs (alias folding, e.g.
   drop honorifics/first names; prefer the most-common entity across the cluster, not per-article
   first), and/or merge stories sharing ≥1 iso3 + similar entity within an axis pair. Biggest
   single win: fixes corroboration dilution, velocity resets, spread re-announcement, churn, and
   most of the 65 corpses at once.
2. **Corroboration cap on tier (tracker, `buildStorySituation`)** — 1 outlet→moderate max,
   2→elevated max, ≥3→high allowed; GDACS exempt (proven disjoint). Keep the map-filter OR.
3. **Make cooling source-aware (tracker, `coolSituation`)** — news situations cool with news
   vocabulary ("Coverage ended" / "No longer in active coverage"), no `gdacs_*` splicing; keep the
   pre-cool tier visible (grey-out conveys ended-ness; don't force `low`).
4. **Escalation hysteresis** — require velocity≥1.5 with prev outlets≥2 (kills the 1→2 = 2.0×
   trigger), ignore `spread_new_iso3` when `prev` was null, and add a cooldown (no re-`raised`
   within N sweeps).
5. **Suppression ≠ cooling** — one-event-one-pin skip should mark the news situation as merged
   (or count it present), not push it into the close path.
6. **Reopen handling** — `prev.state==='closed'` ⇒ fresh `opened_at`, state `emerging`,
   change `'opened'` (or an explicit `reopened`).
7. **Slice 4 fields** — emit `coverage_ratio` (= velocity) in evidence (frontend already reads it;
   fixes F7 immediately) and `tier_changed_at` (stamp when tier ≠ prev.tier in both builders; add
   to `summarize()`); frontend consumes at `SituationHome.jsx:55` and the `newIds` memo.
8. **Ops hygiene** (env/lifecycle only, no code): lifecycle expirations for `situations/history/`
   (~90d) + `archive/` (~365d); log the drop count at the 420 cap (one line) and consider
   MAX_BATCHES 12→14; `stale` to consider `sources.news`; fix the 10-min header comment.

Items 1-6 all live in the two Lambdas already scheduled for the slice-5 patch (`newsSituationIngest`
+ `newsSituationTracker`/shared core); 7 is slice 4 riding along; 8 is env/console work under
standing auth. Frontend changes needed only for slice-4 consumption and F12's ghost focus.

**Nothing here is implemented yet — all pending operator threshold/scope decisions.**

Constraints that still bind: `situations-core.js` byte-identical in both dirs; re-diff deployed
zips before editing; bare single `aws` commands; deploys per-step gated.
