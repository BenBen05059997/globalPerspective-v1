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
