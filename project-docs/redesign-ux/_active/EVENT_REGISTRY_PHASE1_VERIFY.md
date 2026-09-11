# Phase 1 Tier-1 matcher — adversarial verification (2026-09-11, read-only)

## FALSE LINKS FOUND: 0 / 25

## 1. Zero false links (kill criterion)
Fetched `threads/story-map.json` (25 pairs, tier1:25, tier2:0, ambiguous_url:0, ambiguous_r3:0,
stories:917, topics:16). Fetched all 25 `stories/state/<storyId>.json` objects and the `NewsCache`
`staging`/`latest` topic arrays.

- Normalized every `evidence.shared_url` with a faithful Python port of the spec's `normalizeUrl`
  (host-lower, strip `www.`, drop tracking params) and confirmed it appears in the story's
  `headlines[].url` set for **all 25/25 pairs** (naive raw-string substring check initially showed
  6 "misses" — all were tracking-param artifacts, e.g. `?at_medium=RSS&amp;at_campaign=rss` vs
  stored `?amp;at_campaign=rss`; resolved once both sides go through the same normalizer).
- Confirmed the same normalized URL appears in the matched topic's `sources[].url` for all 25/25
  pairs, by content search across the current `latest` topic array (not by trusting the recorded
  `topic_id` label — see note below).
- **Hand-judged same-event Y/N for all 25 pairs by comparing story title vs matched topic title:
  25/25 same real-world event.** Canada/Ukraine defense pact, Iran drone-capture/Hormuz, Hezbollah
  tunnel strike, Houthi Mocha port seizure, Hormuz oil-price spike (x3 story fragments → same
  topic), Swiss coach crash, DRC Bukavu school fire (x3 fragments), HK Tiananmen jailing (x3
  fragments), Mozambique Mondlane treason charge, Uganda Tooro succession (x2 fragments). No
  cross-event conflation found.

**Note (non-blocking, doc-worthy):** `evidence.topic_id`'s trailing `-N` index no longer matches
the topic's current position in `latest`/`staging` (e.g. the Canada pair records `-15`, but Canada
is currently at position `-14`). Verified this is **not** a false link — the topic *title text* is
byte-identical between the map's snapshot and the current DDB item; only the positional suffix
drifted (topics were re-ordered/re-scored across a later step of the same, or a subsequent,
generation cycle after the matcher snapshot was taken). `topic_id` is audit metadata only — it
isn't used to route users to content — so this has no user-facing effect, but if anything ever
keys off that field expecting index-stability, it will point at the wrong topic. Recommend
recording title-only (no positional suffix) or a stable id in a future revision.

## 2. Tracker stamping integrity
`world/latest.json`: 138 total situations, **6 stamped with `threadId`**. All 6 checked:

| situation id | storyId | stamped threadId | in story-map with same threadId? |
|---|---|---|---|
| news#conflict#YEM#houthis | conflict#YEM#houthis | thread-houthi-attacks-on-saudi-arabia-ee3354 | yes |
| news#conflict#ISR#israel-defense-forces | conflict#ISR#israel-defense-forces | thread-at-least-three-killed-in-israe-cd18fd | yes |
| news#humanitarian#COD#disaster | humanitarian#COD#disaster | thread-more-than-20-children-killed-i-4a89b9 | yes |
| news#conflict#ISR#israel | conflict#ISR#israel | thread-at-least-three-killed-in-israe-cd18fd | yes |
| news#political#HKG#hong-kong-alliance | political#HKG#hong-kong-alliance | thread-hong-kong-jails-three-tiananme-8e640e | yes |
| news#conflict#IRN#islamic-revolutionary-guard-corps | conflict#IRN#islamic-revolutionary-guard-corps | thread-south-korea-considers-military-04e04a | yes |

**6/6 stamped situations resolve to a map entry with the identical threadId. No drift/stale latch
observed** (every stamped situation's storyId is currently present in the live map with a matching
threadId — the "latch retains prior value when map entry ages out" path was not exercised in this
snapshot).

## 3. Links resolve to real pages
5 distinct threadIds stamped. For every one, the current `NewsCache` `latest` topics array carries
a topic with that exact `threadId` (title-matched to the same event each time) — so
`readNarrativeThread`'s `latest.topics` branch alone guarantees ≥1 entry per stamped thread; archive
confirms further (`thread-south-korea-considers-military-04e04a` has entries on both 2026-09-08
"South Korea sends fact-finding team to assess Strait of Hormuz conditions" and 2026-09-11 "Iran
Claims Capture of US 'Sail Drone'..." — a genuine multi-day continuing thread about Hormuz tension,
not a mismatch; the slug is just derived from the thread's origin headline and doesn't get renamed
as the story evolves, which is pre-existing `assignThreadId` behavior, not a Phase 1 defect).

**0/5 stamped threadIds have zero entries. No dead "Story arc not found" pages.**

## 4. No regressions in the generation cycle
`NewsProjectInvokeAgentLambda-dev` — 3 most recent invocations at time of check (07:22, 07:23,
07:26 UTC; these were the deploy/verification burst, current wall clock 07:53 UTC, next Scheduler
fire not due until ~08:05 so no cron cycle has been skipped):
- 07:22:36 — `[matcher] story-map build failed (non-fatal): ... not authorized to perform:
  s3:ListBucket ...` — generation continued: `Today archive written: 16 new + 34 existing`,
  `Daily archive written`. **No throw, no impact.**
- 07:23:36 — same non-fatal IAM-denied warning, generation again completed normally.
- 07:26:22 — **success**: `[matcher] wrote threads/story-map.json: 25 pairs (...r3=false)`, followed
  by normal archive writes. This independently reproduces the spec's claim that the IAM fix landed
  between the 07:23 and 07:25 invocations and that failure isolation held throughout.
- No errors, no timeouts (durations 58s–72s, well under any Lambda limit) in any of the sampled runs.

`newsSituationTracker` — 3 most recent sweeps (07:44:03, ~07:27, ~07:00 UTC): each logs a single
clean `[tracker] {"ok":true,"mode":"live",...}` result line, no errors, ~4.3–5s duration each.

## 5. IAM least-privilege sanity
`newsprojectLambdaRole1fd679db-dev` / `matcher-s3-access`: exactly 3 statements —
`s3:GetObject` on `stories/state/*`, `s3:ListBucket` on the bucket condition-scoped to
`stories/state/*` prefix, `s3:PutObject` scoped to the single key `threads/story-map.json`. No
`s3:*`, no bucket-wide write, no delete.

`newsSituationTracker-role` / `newsSituationTracker-pol`: pre-existing statements (Logs,
`ReadWriteState` on situations/world/shadow/stories prefixes, `ListBucketScoped`, `Metrics`) all
intact and unchanged, **plus** one new statement `ReadStoryMap` — `s3:GetObject` only, scoped to
exactly `threads/story-map.json`. No write/delete granted on `threads/*`.

## 6. Drift/consistency
- `situations-core.js`: `newsGdacsIngest` (canonical, no header) vs `newsSituationTracker` (has the
  2-line "⚠️ SHARED MODULE" header) — diffed with the tracker's header stripped: **byte-identical**.
- `GROK_MODEL` env var is present and explicitly set on the deployed
  `NewsProjectInvokeAgentLambda-dev` config (value not printed per instructions); source fallback
  default (used only if the env var were unset) is `deepseek-v4-flash` per
  `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js:15` — consistent with the
  known repo-wide "GROK_* names, non-Grok values" convention (memory:
  feedback_misleading_grok_naming.md). This is unrelated to Phase 1 correctness; noted per the
  check's request.
- `ENABLE_R3_TIER` is **not present** in the deployed function's environment variables (confirmed
  via `get-function-configuration` — full var name list checked, absent). `story-map.json` shows
  `"r3_enabled": false`, `"tier2": 0`, `"ambiguous_r3": 0`. R3 is off, consistent.

## 7. Edge/coverage sanity
- Of the 25 Tier-1 pairs, **5 point to storyIds that are NOT currently open situations** in
  `world/latest.json` (`economic#YEM#houthis`, `humanitarian#CHE#disaster`,
  `humanitarian#CHE#swiss-alps`, `political#MOZ#ven-ncio-mondlane`,
  `political#UGA#oyo-nyimba-kabamba-iguru-rukidi-iv`) — harmless stale pairs per the spec (the
  situation tracker's 138-entry open set doesn't include these storyIds, but the map entries
  themselves are still individually correct as verified in §1).
- Coverage: **16/16 (100%) of current topics carry a `threadId`** (pre-existing assignment, not
  Phase 1's concern); of those, **9 distinct topics are referenced by at least one Tier-1 pair**,
  i.e. **9/16 ≈ 56% topic-level match coverage** this cycle — noticeably above the ~32% baseline
  from Phase 0/1c. With only 16 topics in this snapshot, each topic is ~6.25 percentage points, so
  a small sample easily swings the rate this far from a longer-run average; not itself concerning
  since §1 independently hand-verified zero false positives among the actual matches. Raw
  pairs/stories ratio is 25/917 ≈ 2.7% (not the right denominator for the ~32% baseline, which was
  defined topic-side per Phase 0's methodology).

## Verdict: **GO**

Zero false links across all 25 Tier-1 pairs (URL-normalized both sides, plus independent hand
title-comparison). All 6 tracker-stamped situations resolve to identical, currently-live map
entries. All 5 distinct stamped threadIds have real content-bearing pages (no dead links). Recent
generation and tracker runs are clean, with the one interesting artifact being direct, in-production
confirmation of the non-fatal IAM-failure isolation the spec claimed. IAM grants are tightly scoped
on both roles. R3 is verifiably off. The one documentation nit (`topic_id` positional-suffix drift
in the evidence field) is cosmetic/audit-only and does not affect correctness or user-facing links —
flagging as a nit, not a blocker.
