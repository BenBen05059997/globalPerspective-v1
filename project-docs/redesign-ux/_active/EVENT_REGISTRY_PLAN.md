# Event Registry — one source of truth for "what is happening" (plan)

**Status:** APPROVED-DIRECTION 2026-09-10 (operator: "we should find one source of truth"); no phase built yet.
**Owner docs:** supersedes the "selector consumes `stories/index.json`" remainder of S7·T1 (ledger) — that
idea was the right instinct scoped to the wrong layer; this plan is its correct form. Evidence base:
`SITUATION_BACKEND_AUDIT.md`, `BACKEND_AUDIT_2026-09-10.md` (architecture/), the pins-to-pages
investigation, and the T3c measurement (`T3C_MEASUREMENT_PAIRS.md` — why post-hoc fuzzy matching is banned).

## 1. Problem

The site runs two independent clustering brains over the same news:

| | Map brain | Editorial brain |
|---|---|---|
| Pipeline | `newsSituationIngest` (hourly) → `newsSituationTracker` | `newsInvokeGemini` (4-hourly) → `NewsProjectInvokeAgentLambda` |
| Identity | `storyId = axis#iso3#entity` | `threadId` (title-Jaccard + `continues_topic`) |
| Output | ~80 stories → ~50 situations on `/map` | ~13 topics/cycle → threads, country intel, predictions, briefs |

They share **no IDs**, so a map pin cannot know which thread covers its event
(`situation.threadId` is null everywhere), the two pipelines duplicate RSS fetching and LLM
classification, and any future feature must pick a brain. Post-hoc matching between them is
**unsafe**: T3c measured that title-similarity cannot separate same-event from same-actor pairs
even within one pipeline; a wrong "Full analysis →" link is misinformation.

## 2. Target architecture

**One event identity layer.** The map's `stories/` layer (S3, hourly, already live) becomes the
canonical **event registry**; everything else is a view of it:

```
ingest → EVENT REGISTRY (stories/: clustered events, stable storyIds)
             ├── MAP: projection of ~all significant events (already true today)
             └── EDITORIAL: selection of ~13/cycle for deep treatment
                   → topics carry storyId → threads inherit event identity
                   → tracker stamps situation.threadId for selected events
```

Not one database — DDB stays editorial's store, S3 stays the world store. What unifies is
**event identity**: a topic/thread knows which registry event it covers.

**The deterministic bridge (the unlock):** both pipelines keep **article URLs** from largely the
same 25–27 RSS feeds. A topic's `sources[].url` intersecting a story's `headlines[].url` proves
they cover the same event — an exact join, no fuzzy matching, ~zero false links. This is the key
that the pins-to-pages investigation missed (it compared titles/entities, not URLs).

## 3. Phases (each independently shippable, each gated)

### Phase 0 — Measure the URL-overlap rate (read-only) — ✅ DONE 2026-09-11 (results: `EVENT_REGISTRY_PHASE0_RESULTS.md`)
Measured (4-day window 09-08→09-11, 164 topics; topics = DDB `NewsCache` id=`latest`/`archive#`, `sources[].url`; stories = `stories/state/*.json` headline URLs):
- **Unambiguous exact-URL match rate: 31.7%** (windowed ±36h) / 32.9% (all-stories) — **below the ~50% rough gate.**
- **Zero false positives** (26/26 sampled exactly-1 matches were genuinely the same event) — the deterministic no-false-link property holds perfectly. This is the property that mattered most (T3c's ban on wrong links).
- Ambiguity (>1 story) 26.2% — 15/15 sampled were the SAME event split across the accepted axis-flip residual → correctly resolve to "no link" (ties → null). Not a defect.
- **Root cause of the shortfall is structural, not fixable by normalization:** the two pipelines diverge on *which events they select* (only 13 of 26/25 RSS feeds shared); Google-News URL-wrapping is negligible (topics 0%, stories 1.7%), and only 4.5% of zero-match topics would even fuzzy-match by title — so the gap is real event-selection divergence, exactly what Phase 2 (shared ingest) fixes.
- Matches skew to the topics worth linking (75% of matched topics are `significance:high` vs 33% of unmatched).
**Gate verdict: MISSED the 50% bar (32%), but the bridge is SAFE and the coverage it does give is the high-value slice.** Decision is now the operator's — see "Phase 0 → Phase 1 decision" below. Do NOT auto-proceed on a missed gate.

**Phase 0b addendum (2026-09-11, `EVENT_REGISTRY_PHASE0B_RESULTS.md`) — the widened-join test FAILED the safety gate.** Hypothesis confirmed but unusable: widening the story-side join from 5 retained headlines to full corpus URL sets can roughly double the raw match rate (to ~35-37%), **but every widening mechanism tested produced confirmed FALSE links** (e.g. "Algeria cuts UAE ties" bucketed with an unrelated Algeria-Niger story). Root cause: the storyId key (`axis#iso3#entity`) is only collision-free **within a single hourly ingest run** — accumulating URLs across hours silently reuses the same key for different real events (worst for generic-entity keys, 14.5% of ids). Per the T3c rule (any false link ⇒ reject), the widened join is DEAD as tested. Also measured: **feed alignment buys little** — 81.3% of unmatched topics have shared-feed sources and still don't match (true selection divergence, the by-design cause), ceiling only ~45%, and the map ingest has **zero cap headroom** (438-449 fetched vs 420 classified every run) so new feeds displace coverage. Net: **the Phase 0 baseline (~32%, 0 false positives) is the only safe bridge that exists today**; the deep residual belongs to Phase 2.

**Phase 0c addendum (2026-09-11, `EVENT_REGISTRY_PHASE0C_RESULTS.md`) — two-subject FINGERPRINT matching tested (operator's tag idea).** The conjunction concept is VALIDATED (the strict rules R1-R3 correctly reject every known adversarial false pair — mismatched-second-subject was indeed the failure mode), **but no rule reaches 0 false positives on today's data** (best 17% FP): the topic side has **no genuine actor signal** — every observed "shared actor" was a country name doing double duty; requiring a real named entity collapses coverage to zero. Also fixed en route: 7 real omissions found in the name→iso3 map. **Conclusion: structured tag EMISSION at generation time (both LLMs output subject_a/subject_b/event_type from a controlled vocabulary — real ISO3s + a genuine actor list) is a PRECONDITION for a safe fingerprint tier, not an enhancement.** New optional task **Phase 1b — tag emission**: additive prompt/schema fields on `newsSituationIngest` (already emits most of it) + `newsInvokeGemini` (needs actors + iso3); forward-only (old data stays thin); re-measure the fingerprint tier after ~a week of tagged data. Until then the URL bridge is the only safe linkage.

### Phase 1b — TAG EMISSION — ✅ DONE + DEPLOYED + VERIFIED 2026-09-11 (commit after `54e30ca`)
Three Lambdas deployed (patch-zip discipline — all drift preserved): `newsSituationIngest` (clean baseline), `NewsProjectInvokeAgentLambda-dev` (patched deployed index.js, kept its `grok-4-1-fast-non-reasoning` GROK_MODEL fallback), `newsInvokeGemini-dev` (16MB patch-zip, kept its grok MODEL_NAME + node_modules). **Verified live end-to-end:**
- **Selector emits the fingerprint** → `staging` topics carry `iso3`/`actors`/`event_type` with GENUINE named actors, zero countries (e.g. Houthis / Israel Defense Forces+Hezbollah / Iran's Revolutionary Guard+US military; iso3 like [ISR,LBN]; event_type `war`). The country-name-drop validation works.
- **Carry-through holds** → the same fields survive to `latest`/active AND to `archive#<today>` (16/16 of this run's entries carry them; older pre-deploy entries correctly lack them).
- **Classifier fix is dramatic** → fresh corpus entities are **0.0% country names (was 21.7%)** and **87.6% of articles now carry ≥1 genuine named actor** (was ~30%). Both sides of the fingerprint now have real actor signal — exactly what Phase 0c said was the precondition.
- **Re-key ripple** (entities[0] changed → story keys shifted): one supervised tracker sweep folded it (opened 24 / cooled 28 / closed 11); map healthy after (68 open, tiers 1H/18E/47M/2L, lede ok, not stale). Settles over the next scheduled sweeps.
Behaviour otherwise unchanged (fields are additive; selection + summaries same). `max_tokens` 8192→12000 shipped.
**NEXT (the gated payoff):** let ~1 week of tagged data accumulate, then re-run the Phase 0c fingerprint measurement on REAL tags. The fingerprint linking tier ships ONLY at **zero hand-labeled false links** + meaningful coverage over the URL tier's 31.7%. Until then no tag-based linking is live.

--- (original spec retained below for reference) ---
### Phase 1b — TAG EMISSION (operator-chosen route 2026-09-11: "tag route first"; recon GO — spec below)
Recon evidence: `EVENT_REGISTRY_TAGRECON.md` (field-plumbing whitelists, token headroom, map-side actor quality, deploy state — all verified 2026-09-11).

**Goal:** both LLM passes emit a structured event fingerprint — `iso3[]` (1-4 country codes), `actors[]` (1-3 named people/orgs, full proper names, NEVER countries/places/abstractions), `event_type` (the map classifier's existing category enum = the ONE shared vocabulary) — additively: zero change to what gets selected or how summaries read.

**Exact change set (from recon, file:line):**
1. `newsInvokeGemini/src/index.js` — (a) prompt topic schema (~:638-650): add the 3 fields with the controlled-vocabulary rules spelled out; (b) staging-write whitelist (:738-758): pass the 3 fields through WITH validation (iso3 → uppercase `/^[A-Z]{3}$/` filter, max 4; actors → strings ≤60 chars, max 3, drop any that equal a country name; event_type → enum check, else `other`); (c) `max_tokens` :683 → **12000** (truncation already fires ~5% of runs at 8192; tags add ~260 tokens).
2. `NewsProjectInvokeAgentLambda/src/index.js` — `buildTopic()` (:269-294) and `buildArchiveEntry()` (:910-924): pass the 3 fields through (else archive/active drop them). Swap + proxy + frontend are pass-through (verified).
3. `newsSituationIngest/src/classifier-core.js` — tighten the entities instruction: "up to 4 SPECIFIC named actors — people, organizations, or groups (e.g. 'Donald Trump', 'IAEA', 'Hezbollah'); NEVER a country, city, place, or abstract noun (countries belong in iso3)". Corpus measured 21.7% of entities are bare country names and only ~38% of the rest genuine actors — this is the fix.

**Accepted caveat:** change 3 alters `entities[0]` → story keys shift → a one-time re-key ripple (slice-5 pattern, self-heals within the 8h closed-keep window; actor-based keys are better keys).

**Deploy plan (3 Lambdas, per-deploy yes, standing discipline):** `newsSituationIngest` = clean baseline (byte-identical to repo, verified) → straight zip. `NewsProjectInvokeAgentLambda-dev` = small src zip (index.js+lib.js+package.json, no node_modules — G6-deploy pattern); zip-diff first. `newsInvokeGemini-dev` = patch-the-deployed-zip (~16MB, HAS node_modules; known single-line MODEL_NAME drift — preserve the deployed grok default exactly as the S7 deploy did). Verify: invoke selector once (S7-precedented), confirm the 3 fields in the `staging` item; after the next agent cycle confirm `latest` + `archive#` carry them; next hourly ingest run → spot-check corpus entities are now actor-quality.

**Success gate (pre-committed, no grading on a curve):** after ~1 week of tagged data, re-run the Phase 0c fingerprint measurement on REAL tags. The fingerprint tier ships ONLY at **zero hand-labeled false links** and meaningful incremental coverage over the URL tier's 31.7%. Until then, no linking goes live from tags.

**Parked behind this (operator's ordering):** the URL bridge (Phase 1) — joins the eventual linking deploy; the `/map` footer-fix deploy — rides any frontend build; Phase 2 unchanged.

**Phase 0 → Phase 1 decision (operator, pending):**
- **Ship Phase 1 now @ ~32%:** a third of significant situations get a real "Full analysis →" link immediately, safe (no false links), cheap, additive/reversible, and it makes the home-swap front door richer. Cost: 68% keep the panel (fine), and some of the bridge is superseded when Phase 2 lands.
- **Defer to Phase 2:** shared ingest makes linkage exact-by-construction (~100% for selected events) and fixes the measured root cause — but Phase 2 is the big shadow-gated spine change, not imminent, so pins stay panel-only until then.
- Lean: ship Phase 1 now (concrete pre-swap win, throwaway cost is small), unless the operator wants to hold all linkage for the Phase-2 rework.

### Phase 1 — The bridge: topics gain `storyId`; situations gain `threadId` (small, additive)
- `NewsProjectInvokeAgentLambda` (or a small post-step): after topics are generated, compute each
  topic's `storyId` by URL-overlap against `stories/index.json`; store it on the topic record
  (null when no unambiguous match). Optionally the selector LLM also *proposes* a storyId with
  the registry as prompt context — but the URL check is the authority; an LLM proposal without
  URL support is discarded (T3c rule: never fabricate a link).
- Thread linkage: the topic already gains `threadId` in the same Lambda — persist the
  (storyId ↔ threadId) pairs to a small S3 object (e.g. `threads/story-map.json`, sole writer).
- `newsSituationTracker`: read `threads/story-map.json` each sweep; stamp `situation.threadId`
  when its storyId (or a pass-2-normalized alias of it) appears. Frontend needs **zero changes**
  — `SituationHome.jsx` already renders "Full analysis →" when threadId is present, and the
  footer fix (2026-09-10) already hides the dead-end otherwise.
- Blast radius: additive fields + one small S3 object; no selection-behavior change; rollback =
  stop writing the map file (tracker falls back to null threadId).
- Verify: for a week, spot-check every stamped link opens the right thread; count links/day.

### Phase 2 — One ingest: selector consumes the registry (the spine change; LATER, shadow-gated)
`newsInvokeGemini` drops its own RSS fetch and selects from the registry's clusters (top-N with
outlet counts/severity as candidates). Kills the duplicate RSS+classification spend (~12 LLM
calls/hour saved) and makes storyId linkage exact-by-construction.
**Hard gate:** a full **shadow week** (the repo's proven pattern — tracker DRY_RUN, breaking
dry-run): run new-input selection in parallel, write to a shadow key, diff chosen topics vs live
daily; flip only if editorial quality holds (category balance, significance, no coverage
regressions vs the impact-audit's miss list). Never flip on vibes. Rollback = restore prior zip.

### Phase 3 — Riders (with whichever phase touches the file anyway)
`captureIngestion` records full article list to its own S3 object + `corpusKey` pointer
(audit-fidelity; confirmed isolated); `continues_topic` inherits storyId; ARCHITECTURE.md
data-flow diagram gains the registry.

## 3.5 Storage decision (operator-confirmed 2026-09-11)

- **Tag DATA** stays where each pipeline already writes: editorial `iso3`/`actors`/`event_type` on topic records in **DDB `NewsCache`**; map `entities`/`iso3` in **S3** (`corpus/`, `stories/`). Two stores, because the two pipelines already write to two stores — no move needed (live since Phase 1b).
- **The LINK MAP** (the matcher's output: storyId ↔ threadId pairs) lives in **S3** `threads/story-map.json`, one writer; the **tracker reads it each sweep and stamps `situation.threadId`** into `world/latest.json` → reaches the frontend via the existing Worker `/data/*` (the situation bundle already carries a `threadId` slot). S3 (not DDB) because the whole situation world is S3-backed, one-writer-per-prefix (DATA_STRATEGY). The matcher needs no DB of its own — it reads DDB `NewsCache:latest` + S3 `stories/`, writes the one S3 file.
- **Deferred:** mirroring editorial fingerprints INTO the S3 registry (so `stories/` is the single place) is coupled to the NewsCache→S3 migration (S8·T6, last) — NOT done now; the matcher is unaffected when that day comes.

## 4. Honest limits / non-goals

- **Coverage stays scarce by design:** editorial picks ~13 of ~80 events; most pins will never
  have a thread. The detail panel remains their destination (it is a real page — metrics,
  evidence, headlines, history). This plan fixes *identity*, not coverage.
- **Registry identity residuals leak upward:** the accepted axis-flip fragmentation (T3c) means
  one real event can be 2-3 registry entries; a topic URL-matches one of them, its siblings stay
  threadless. Livable; revisit only if visible.
- **GDACS situations stay threadless** (official-report link instead) — by design.
- Not in scope: merging DDB into S3, changing threadId semantics, any home-swap coupling (S6 is
  independent and sequenced last per operator).

## 5. Order & gates summary

Phase 0 (read-only measure) → operator sees numbers → Phase 1 (additive bridge; per-deploy yes;
zip-diff `NewsProjectInvokeAgentLambda-dev` — repo≠deployed history!) → observe a week →
Phase 2 as its own later project behind a shadow week → Phase 3 rides along.
Standing constraints apply throughout: diff deployed zips first, bare single `aws` commands,
merge-don't-clobber env, no CI, docs-in-same-commit.
