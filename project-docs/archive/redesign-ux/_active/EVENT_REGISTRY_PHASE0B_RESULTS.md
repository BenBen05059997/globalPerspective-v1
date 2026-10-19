# Phase 0b — widened-join + feed-alignment measurement (read-only)

Date: 2026-09-11. Region ap-northeast-1. Reuses Phase 0 topics (164, same 4-day fair window:
`latest` 2026-09-11 + `archive#2026-09-08/09/10`) and Phase 0's URL normalizer verbatim.
Corpus: `t3c-measure/corpus/09/{08..11}/*.jsonl`, topped up to 62 hourly files (2026-09-08 12:00
UTC → 2026-09-11 01:00 UTC), 24,515 classified-article lines, 18,943 eligible
(`axis && severity>=2 && iso3.length && latlon`), 3,274 distinct normalized URLs.

Clustering logic replicated exactly from `amplify/backend/function/newsSituationIngest/src/
classifier-core.js` (`clusterStories`, `normalizeEntity`, `slug`) — same eligibility filter, same
key `axis#iso3[0]#slug(normalizeEntity(entities[0])||category)`. Not required()'d directly (pure
Python reimplementation, line-for-line) because the corpus files are plain JSONL, not a Lambda
runtime; the entity-alias table, title-prefix/org-suffix regexes, and slug() were copied verbatim.

## 0. Headline finding

**Widening the join surface is real and large (hypothesis 1, confirmed dominant) — but the naive
way to do it breaks the zero-false-positive property Phase 0 established.** Every variant that
accumulates story-URL sets *across more than a couple hours* reuses generic or prolific-entity
storyId keys for genuinely different events, producing confirmed false links. A narrower,
generic-entity-excluded variant gets the ambiguity down and produces only a modest, safer gain
(34.8% vs. 32.9% baseline) but **still contains one confirmed false positive** in spot-check.
**Recommendation: do not ship any "union corpus URLs by storyId over time" widening as tested.**
Feed alignment (hypothesis 2) is confirmed a minor, secondary cause and also requires an ingest
cost increase that currently has zero headroom.

## 1. Widened join — four variants tested, same 164 topics

| Variant | 0-match | Exactly-1 (unambiguous) | >1 (ambiguous) | False positives found |
|---|---|---|---|---|
| **Baseline (Phase 0, narrow `stories/state/`, 5-headline cap)** | 66 | 54 (32.9%) | 44 (26.8%) | **0** (Phase 0 §4, confirmed) |
| **A. Naive widened** (pool all 62h corpus, cluster once globally, union URLs per storyId) | 19 | 42 (25.6%) | 103 (62.8%) | **Yes — multiple confirmed** (§3) |
| **B. Dedup widened** (A, but one representative classification per URL by modal storyId key, fixes LLM run-to-run churn) | 19 | 109 (66.5%) | 36 (22.0%) | **Yes — confirmed** (§3) |
| **C. "Safe" widened** (B, excluding 177 generic country/demonym-fallback entity keys, 14.5% of storyIds) | 91 | 57 (34.8%) | 16 (9.8%) | **Yes — 1 confirmed even here** (§3) |
| **D. Per-hour replay + time-window join** (cluster each hour independently like production actually does, then union only within ±36h of topic archival) | 19 | 42 (25.6%) | 103 (62.8%) | same as A (see below) |

Variant D — built to test whether the conflation in A/B/C is a pooling artifact — produces
**identical numbers to variant A**. Tightening the window further (±24h/12h/6h/2h) only
partially helps and never gets ambiguity under control:

| Window | 0-match | Exactly-1 | >1 (ambiguous) |
|---|---|---|---|
| ±36h | 19 | 42 (25.6%) | 103 (62.8%) |
| ±24h | 19 | 43 (26.2%) | 102 (62.2%) |
| ±12h | 20 | 45 (27.4%) | 99 (60.4%) |
| ±6h  | 21 | 47 (28.7%) | 96 (58.5%) |
| ±2h  | 26 | 61 (37.2%) | 77 (47.0%) |

**Conclusion: the conflation is not a windowing/pooling implementation detail — it is inherent to
the production storyId key** (`axis#iso3[0]#entity-slug`). The key is only a safe, non-conflating
identifier *within a single ~1h ingest run* (avg. 1.4 articles/bucket per hour, confirmed by
replaying `clusterStories()` per-hour on the real corpus — see §2). Any join that needs to recover
more than the ~5 headlines a single run/snapshot retains must accumulate across hours, and the
same key gets silently reassigned to different real-world events over that span — most acutely
for (a) generic entity-fallback keys and (b) prolific specific entities.

## 2. Why the key conflates when accumulated

Per-hour clustering (replaying `clusterStories()` independently on each of the 62 hourly corpus
files, exactly as `newsSituationIngest` does in production) gives:

- **1,220 deduped storyIds** (variant B) from 3,274 distinct URLs.
- **177 (14.5%) use a generic entity fallback** (bare country name / demonym / org term, e.g.
  `uk`, `kenya`, `china`, `gop`, `un` — curated stoplist, not exhaustive). These average **4.6
  articles/storyId (max 48)** vs. **1.5 articles/storyId (max 52 outlier) for specific-entity
  keys** when pooled across the full 62h corpus.
- Per-hour (not pooled), the average bucket size is **1.40 articles/hour** (max 17) — this
  matches production's own hourly `[ingest]` log line (`"stories":80` from ~420 classified
  articles ≈ 5 articles/story on average across ALL buckets that specific run, consistent with
  small per-run buckets). **Confirms the corpus replay is faithful to production behavior.**
- The problem only appears once buckets are accumulated over **more than ~2 hours** — because a
  recurring entity (a country, or a persistently-covered figure) gets independently reclassified
  into the *same* key hour after hour, but the *article* behind that key on hour N need not be
  about the same specific news item as the article on hour N+20.
- Separately: **87.6% of distinct URLs (2,869/3,274) are re-seen across multiple hourly runs**
  (RSS freshness window `MAX_AGE_H=36`), and of those, **37.7% (1,082) get a *different* storyId
  key on different occurrences** — i.e., the LLM classification of the *same article* is not
  stable run-to-run. This is a second, independent source of storyId churn (fixed in variants
  B/C/D by taking the modal key per URL; NOT fixed by windowing).

## 3. False-positive spot-checks (the T3c gate)

**Variant A/B (no generic-key filtering) — 4 confirmed false links found in a 15-item sample of
newly-gained matches** (all verified by tracing the literal shared normalized URL, not just
title similarity):

| Topic | Falsely linked to | Shared URL |
|---|---|---|
| "Algeria Cuts Diplomatic Ties with UAE..." | `political#DZA#algeria` :: "Algeria: Beyond the Fighter Jets — What Algeria's Deployment to Niger Really Signals" | `france24.com/en/africa/20260910-algeria-cuts-diplomatic-ties-...` |
| "Kenya's President Ruto signs four bills..." | `political#KEN#kenya` :: "Kenya moves to register frightened Burundians..." | `allafrica.com/stories/202609080099.html` |
| "Jamaica delegation... slavery reparations petition to King Charles" | `political#GBR#uk` :: "UK to announce trade ban on goods from illegal Israeli settlements" | `aljazeera.com/video/inside-story/2026/9/8/does-the-uk-have-a-legal-obligation...` |
| "China and Qatar strengthen bilateral ties..." | `political#CHN#china` :: "China's highest court sets out new AI red lines..." | `aljazeera.com/features/2026/9/8/china-and-qatar-are-strengthening-bilateral-ties...` |

All four are **generic-entity-fallback keys** (`algeria`, `kenya`, `uk`, `china`) — exactly the
14.5%-of-storyIds bucket identified in §2.

**Variant C ("safe", generic keys excluded) — re-spot-checked 20 newly-gained matches; still 1
confirmed false link**, from a *specific*, non-generic entity that is simply prolific:

| Topic | Falsely linked to | Shared URL |
|---|---|---|
| "Trump posts AI map showing US 'takeover' of North America, Iceland and Caribbean..." | `political#USA#trump` :: "Trump threatens to ban Canadian Bombardier jets from US market" | `france24.com/en/trump-posts-ai-map-showing-us-takeover-of-north-america-iceland-and-caribbean-1` |

The shared URL genuinely was classified into the `political#USA#trump` bucket in one hourly run —
the URL-level match is technically real — but the storyId's *displayed representative title*
(picked by highest severity across all accumulated occurrences) is a different, unrelated Trump
story. This means even the "safe" filter does not clear the zero-false-positive bar; it only
reduces the rate (1 confirmed / 57 unambiguous safe matches spot-checked ≈ ≤2% in-sample, likely
higher on a full audit, since "prolific but specific" entities were not filtered at all).

**Ambiguous-bucket spot-check (15 sampled, variant A):** decomposed by root cause —
**51/103 (49.5%) are "Type A" — a single URL that itself got inconsistently classified into
multiple storyIds across hourly runs** (the classification-churn issue, §2); **24/103 (23.3%) are
"Type B" — genuinely distinct topic-source URLs each landing in a distinct storyId, i.e. the
same real event legitimately split across registry keys** (the accepted Phase-0 axis-flip
residual, matches Phase 0 §4's finding); **28/103 (27.2%) mixed**. So roughly half of the
widened-join's ambiguity is itself a measurement artifact of naive corpus pooling, not a genuine
Phase-0-style safe ambiguity.

**No exactly-1 (unambiguous) match in any variant was a false positive in Phase 0's own spot-check
of the *narrow* baseline** — that zero-false-positive result stands unchanged; it is specifically
the *widening* mechanism that introduces risk.

## 4. Zero-match decomposition (Task 3, using variant C / "safe" widened join, 91 still-zero topics)

Classified each zero-match topic's source domains against `newsSituationIngest`'s 25 RSS feed
source domains (`bbc.co.uk` aliased to `bbc.com` — same outlet, different URL host observed in
editorial's raw source URLs).

| Bucket | Count | % of zero-match | Meaning |
|---|---|---|---|
| (a) unmatchable-by-construction — ALL sources from map-never-reads feeds | 17 | 18.7% | feed-pool cause |
| (b) ≥1 source from a shared/map-read feed, still no match | 74 | 81.3% | true selection/granularity divergence |

**Feed-pool disjointness (hypothesis 2) explains only ~19% of the remaining gap — the deep cause
(selection/granularity divergence) dominates the residual, consistent with Phase 0's original
finding.**

## 5. Feed-alignment ceiling estimate (Task 4)

- Ceiling = current safe-widened rate + (a)-bucket's share of **all** 164 topics =
  **34.8% + (17/164 = 10.4%) ≈ 45.1%** best case if the 13 editorial-only feeds were added to the
  map ingest and every currently-(a)-bucketed topic became matchable (optimistic upper bound —
  assumes perfect pickup, not measured).

### Ingest cap headroom — none today

CloudWatch `[ingest]` log lines, `newsSituationIngest`, every run in the last 24h
(2026-09-10 13:50 → 2026-09-11 01:50 UTC, 13 consecutive hourly runs sampled):

| Metric | Value (every run, consistently) |
|---|---|
| Fresh articles fetched (25 feeds × ≤30/feed cap) | 438–449 |
| Classified (capped) | **420** (= `MAX_BATCHES_PER_RUN` default 12 × `CLASSIFY_BATCH` default 35) |
| Articles silently dropped by the cap, **already, before any new feeds** | ~20–30/run |
| Stories produced | 80 (every run) |
| Duration | ~36–39s (12 LLM calls) |

**There is zero headroom.** The ingest already over-fetches relative to its classification cap by
~5-7%. Adding the 13 editorial-only feeds (≤30 articles/feed ⇒ up to +390 raw articles/run)
**without raising `MAX_BATCHES_PER_RUN`/`CLASSIFY_BATCH`** would massively increase what the cap
displaces — the new feeds would compete with (and likely crowd out) coverage from the 12 already
oversubscribed feeds, net effect on real map coverage uncertain and possibly negative. Feed
alignment is therefore not a free win: it requires raising `MAX_BATCHES_PER_RUN` (more LLM calls,
more latency, more cost) in the same change, which is outside this read-only measurement's scope
to size further (would need a target total budget, e.g. ~800 articles/run ≈ 23 batches ≈ nearly
double the LLM calls/run).

## 6. Verdict table

| Stage | Unambiguous rate | Ambiguous rate | False positives | Ship? |
|---|---|---|---|---|
| Baseline (Phase 0, narrow join) | 31.7% (windowed) / 32.9% (all-time) | 26.2–26.8% | 0 (confirmed) | Already the accepted floor |
| Widened join, naive/dedup (variants A/B/D, any window 2h–36h) | 25.6–37.2% | 47–63% | **Confirmed, multiple** | **No** |
| Widened join, "safe" (generic-entity keys excluded, variant C) | 34.8% | 9.8% | **Confirmed, 1 (of 57 spot-checked)** | **No** — fails strict zero-FP gate, though close |
| Theoretical post-feed-alignment ceiling (on top of "safe" widened) | ≈45.1% | n/a (not separately measured) | n/a — inherits variant C's residual FP risk | **No** — same FP gate issue, plus requires raising the ingest cap (cost) with zero measured headroom today |

**Which shallow cause dominates:** hypothesis 1 (truncated join surface) is confirmed dominant —
it is worth roughly 3× the raw uplift of hypothesis 2 (feed-pool overlap: +10.4pt ceiling) even
before accounting for feed alignment's ingest-cost prerequisite. But the mechanism that realizes
hypothesis 1's uplift (accumulating story-URL sets across hours under the current storyId key)
is not safe to ship as tested.

**Honest expected Phase-1 coverage:**
- (i) *As-is, with a corpus-widened join*: **not recommended** — every tested widening variant
  produces confirmed false links, violating the plan's zero-false-positive requirement (T3c).
  Ship Phase 1 at the Phase 0 baseline (~32%, narrow `stories/state/` join, 0 false positives) if
  shipping now.
- (ii) *With feed alignment too*: **also not recommended as a next step** — it only raises the
  ceiling by ~10pts on top of an already-unsafe widening mechanism, and has its own unaddressed
  cost prerequisite (zero ingest headroom today; needs `MAX_BATCHES_PER_RUN` raised, i.e. more
  LLM spend/latency, sized separately).

## 7. Recommendation

**Ship Phase 1 on the Phase 0 baseline join (narrow `stories/state/`, ~32%, 0 false positives).**
Do not adopt the corpus-widened join or feed alignment in their tested forms. If the ~13pt+
theoretical uplift from widening is worth pursuing later, the concrete next design step (not
built here, out of scope for this read-only pass) is to fix the *mechanism*, not the window:
match at the literal matched-article level (surface the specific article's own headline/URL that
shares the URL, never the storyId's cached "representative" title, which is what actually goes
stale/conflates), and/or require a same-day/few-hour co-occurrence check before trusting a
widened match as unambiguous. Feed alignment should be scoped together with a `MAX_BATCHES_PER_RUN`
increase (sized against a real per-feed article-volume budget), not on its own.

## Files (read-only measurement outputs)

- `build_widened.py` / `widened_stories.json` — variant A (naive pooled)
- `build_widened_dedup.py` / `widened_dedup_stories.json` — variant B (dedup by modal key/URL)
- `match_widened.py` / `match_widened_results.json` / `summary_widened.json` — variant A match
- `match_dedup_results.json` / `summary_dedup.json` — variant B match
- `match_safe_results.json` / `summary_safe.json` — variant C (generic-entity-excluded) match
- `decompose_ambiguity.py` / `ambiguity_decomposition.json` — Type A/B/mixed ambiguity decomposition
- `build_perhour_replay.py` / `perhour_snapshots.json` — variant D (per-hour faithful replay)
- `match_perhour.py` / `match_perhour_results.json` / `summary_perhour.json` — variant D match + window sweep
- `decomposition_ab_fixed.json` — Task 3 (a)/(b) domain decomposition
- `spotcheck_widened.py` — spot-check sampler
- CloudWatch `[ingest]` log lines pulled live via `aws logs filter-log-events` (not saved to a
  file — see §5 table for the extracted numbers; region ap-northeast-1, log group
  `/aws/lambda/newsSituationIngest`)
