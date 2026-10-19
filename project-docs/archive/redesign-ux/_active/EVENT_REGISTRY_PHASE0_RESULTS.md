# Phase 0 — URL-overlap bridge measurement (read-only)

Date: 2026-09-11. Region ap-northeast-1. Table `NewsCache` (env `TOPICS_DDB_TABLE` on both
`newsInvokeGemini-dev` and `NewsProjectInvokeAgentLambda-dev`). S3 bucket
`globalperspective-world-280362093938`.

## 0. Schema confirmed (read-only source review)

- **Current topics** = DDB item `id = "latest"` in `NewsCache`, written by
  `NewsProjectInvokeAgentLambda/src/index.js:swapStagingToActive()` (copies the `staging` item
  written by `newsInvokeGemini` verbatim, `status: "active"`). Topic schema:
  `{id, title, category, search_keywords, regions, sources:[{url,title,source,age,snippet,tier}],
  significance, urgency, ...}` (`newsInvokeGemini/src/index.js:735-753`).
- **Archive** = two parallel DDB items per day, both include `sources` (URLs), both written by
  `buildAndWriteArchive()`:
  - `id = "today-archive"` — 24h TTL, sources capped at 3/topic (free tier).
  - `id = "archive#YYYY-MM-DD"` — 7-day TTL, sources capped at 10/topic (paid tier) — **this is
    what Phase 0 pulled** (`amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js:
    910-923, 1108-1136`).
- **Map stories** = S3 `stories/index.json` (80 current stories, top-3 headlines each) and
  `stories/state/*.json` (792 files — every storyId ever created, up to 5 headlines +
  `last_seen`; most are single-headline one-offs). Phase 0 used `stories/state/` per the plan
  (fuller).

Pulled: `latest` (14 topics) + `archive#2026-09-06..10` (50 entries/day) = 264 topic-records;
`stories/state/` (792 files, 968 URLs) + `stories/index.json` (80 stories, 121 URLs).

## 1. URL normalization rules

- Lowercase host, strip leading `www.`
- Strip scheme, strip trailing slash on path, drop fragment (`urlparse` naturally discards
  scheme/fragment for the join key)
- Strip tracking query params: `utm_*`, `at_*`, `cmpid*`, `icid*`, `ito*`, `smid*`, `ncid*`
  (prefix match) plus exact-match `fbclid, gclid, ocid, spm, ref, cmp, src, mc_cid, mc_eid,
  guccounter, guce_referrer, guce_referrer_sig, taid, campaign_id, partner, cid, sfnsn`
- Remaining non-tracking query params are kept and sorted (join key = `host + path [+ ?kept-qs]`)

### Google-News-wrapped fraction (blind spot — no redirect-following, just counted)

| Side | Total URLs | GNews-wrapped (`news.google.com/rss/articles/...`) | Fraction |
|---|---|---|---|
| Topics (`latest`) | 35 | 0 | 0.0% |
| Topics (archive, 5 days combined) | 591 | 0 | 0.0% |
| Stories (`stories/state/`) | 968 | 16 | 1.7% |
| Stories (`stories/index.json`) | 121 | 3 | 2.5% |

**Why the asymmetry:** `newsInvokeGemini`'s 26-feed `RSS_FEEDS` list (editorial pipeline)
contains **no** Google News feed — every feed is a direct publisher RSS, so its article URLs are
never wrapped. `newsSituationIngest`'s 25-feed list (map pipeline) includes one Google News query
feed (`Reuters(GN)` → `news.google.com/rss/search?q=when:24h+world...`), which is the source of
the map side's small (1.7–2.5%) wrapped fraction. **Conclusion: Google-News wrapping is not a
meaningful blind spot for this bridge** — it affects <2% of one side's URLs and 0% of the other.

## 2. Feed-list overlap

- `newsInvokeGemini` (editorial): 26 feeds / 26 distinct domains
- `newsSituationIngest` (map): 25 feeds / 25 distinct domains
- **Shared domains: 13** — `abc.net.au, al-monitor.com, aljazeera.com, allafrica.com, bbc.com,
  channelnewsasia.com, dw.com, france24.com, middleeasteye.net, npr.org, scmp.com,
  thediplomat.com, theguardian.com`
- Editorial-only (13): arstechnica.com, asia.nikkei.com, asiatimes.com, bangkokpost.com, cbc.ca,
  dailymaverick.co.za, dawn.com, euronews.com, grist.org, insideclimatenews.org, japantimes.co.jp,
  technologyreview.com, theeastafrican.co.ke
- Map-only (12): africanews.com, alarabiya.net, batimes.com.ar, dailysabah.com, jpost.com,
  kyivindependent.com, lemonde.fr, mercopress.com, news.google.com, rappler.com,
  themoscowtimes.com, timesofindia.indiatimes.com

~50% domain overlap. This caps the theoretical ceiling of URL-exact matching: an event covered
only by editorial-only or map-only-side outlets can never produce a shared URL even if both
pipelines picked it up (they'd cite different-but-related articles).

## 3. Core number — unambiguous URL-match rate

Restricted to the window where `stories/state/` actually has coverage (`last_seen` spans
2026-09-08 → 2026-09-11 only; **archive#2026-09-06 and archive#2026-09-07 have no fair
story-side comparison set and are reported separately, excluded from the average**).

| Dataset | Topics | 0-match | Exactly-1 (windowed ±36h) | >1 (ambiguous, windowed) |
|---|---|---|---|---|
| latest (2026-09-11) | 14 | 6 | 3 (21.4%) | 5 (35.7%) |
| archive#2026-09-10 | 50 | 18 | 15 (30.0%) | 17 (34.0%) |
| archive#2026-09-09 | 50 | 17 | 18 (36.0%) | 15 (30.0%) |
| archive#2026-09-08 | 50 | 28 | 16 (32.0%) | 6 (12.0%) |
| **Total (4 days)** | **164** | **69** | **52 (31.7%)** | **43 (26.2%)** |

All-stories (no time window) result is nearly identical (32.9% / 26.8%) — the 36h window is not
the binding constraint; windowed vs unwindowed differ by only 1-2 topics per day.

Excluded-for-reference (no fair story-side data, reported not averaged):
- archive#2026-09-07: 50 topics, 0-match=43, exactly-1=7 (14.0%, windowed) / 10 (20.0%, all-stories), 0 ambiguous
- archive#2026-09-06: 50 topics, 0-match=50, exactly-1=0 (0%) — `stories/state/` has zero
  coverage this far back (last_seen floor is 09-08), so this day is pure noise, not signal.

**Unambiguous-match rate (multi-day, fair window): 31.7%** — below the plan's ~50% rough gate.
**Ambiguity rate: 26.2%** of topics tie to >1 story (handled as "no link" per plan, not a false
positive risk — see §4).

## 4. Ambiguity + false-positive spot-check

- **Exactly-1 matches (26 sampled, all datasets):** 100% were genuinely the same event on manual
  title comparison (e.g. "UAE Pledges €40 Billion Investment in Germany..." ↔ "UAE to invest 40
  billion euros in Germany"; "Hungary expels 10 Russian diplomats..." ↔ same). **Zero false
  positives observed** — URL-exact matching does not false-positive, confirming the plan's premise.
- **>1 matches (15 sampled):** every case examined was the *same* real-world event split across
  multiple registry storyIds by the accepted axis-flip residual (T3c) — e.g. "UK bans goods from
  Israeli settlements" appears as both `political#GBR#united-kingdom` and `conflict#GBR#uk`
  (identical headline, two axes); "Canada's retaliatory tariffs" appears as `economic#CAN#canada`,
  `economic#CAN#carney`, `economic#CAN#chrystia-freeland` (three entity-scoped stories for one
  event). **This is exactly the expected/accepted ambiguity mode** (§4 "Honest limits" in the
  plan) — ties → no link is the safe, correct behavior, not a bug to fix.

## 5. URL-vs-title coverage gap (context only, not a recommendation to use fuzzy matching)

Of the 69 zero-URL-match topics (the 4-day fair window, `stories/state/`, no window
restriction): only **3 (4.5%)** would match a story by title-token Jaccard ≥ 0.5. Examples that
would fuzzy-match: "North Korea builds new Yongbyon uranium enrichment facility, IAEA says" ↔
"IAEA says North Korea built new uranium enrichment facility" (0.70); "Four Renoir paintings
stolen from French museum in heist" ↔ "Renoir paintings stolen from French museum" (0.71).

**Interpretation:** the URL-match gap is *not* primarily a URL-normalization/wrapping artifact
that fuzzy matching would recover (only 4.5% recoverable) — most 0-match topics (95.5%) are
topics the map pipeline's ~80-story registry simply never independently surfaced as a distinct
story at all (different outlet mix, or below the map's cluster/severity threshold), a genuine
coverage gap, not a matching-technique gap. Fuzzy matching stays banned per T3c regardless.

## 6. Do matched topics skew significant?

Small sample (`latest`, 14 topics, only dataset with a `significance` field):
- **Matched (≥1 story, 8 topics):** 6/8 (75%) are `significance: high`
- **Unmatched (0 matches, 6 topics):** 2/6 (33%) are `significance: high`

Directionally, URL-matched topics skew toward the higher-significance/breaking events (Houthis
seizing Mokha, Israel-Hezbollah tunnel strike, Anthropic/DeepSeek routing accusation, UAE-Germany
investment) — exactly the topics worth a "Full analysis →" thread link. Sample is too small
(n=14) to be conclusive but directionally supports the bridge being useful where it does connect.

## VERDICT

**Below gate, but close and explicable — not a dead end.**

- Multi-day unambiguous-match rate = **31.7%** (windowed) / **32.9%** (all-stories), vs. the
  plan's rough ≥50% bar. **Does not clear the stated gate as measured.**
- The shortfall is *not* attributable to a fixable technical defect: Google-News wrapping is a
  <2% blind spot (not the cause); URL normalization looks adequate (windowed ≈ all-stories, so
  the ±36h choice isn't costing matches); the ambiguity that does occur (26.2%) is 100%
  same-event/registry-fragmentation, never a false link — the deterministic property (exact
  matches never lie) holds.
- The real ceiling is **event-selection divergence**: only 13/26-25 feed domains are shared
  between the two pipelines (~50%), and 95.5% of unmatched topics have no fuzzy-title match
  either — meaning the map's ~80-story registry and editorial's ~13/cycle selection are simply
  choosing different specific articles/events at the margin, not failing to normalize the same
  ones.
- **Recommendation:** Phase 1 is still worth building, but set expectations at ~30-35% link
  coverage among topics rather than ~50%+, OR revisit after Phase 2 (shared ingest) which the
  plan already identifies as the fix for this exact divergence — Phase 2 makes storyId linkage
  "exact-by-construction," which directly attacks the root cause found here (feed/selection
  divergence, not normalization). Given the zero-false-positive result and that matches skew
  toward significant events, Phase 1's low blast radius (additive field, null when no
  unambiguous match) makes it low-risk to ship at ~32% coverage while Phase 2 is scoped
  separately — the operator should decide whether 32% link coverage is "useful enough" now or
  whether to wait for Phase 2's expected improvement.

## Files (this measurement, read-only)

- `analyze.py`, `match.py`, `spotcheck.py`, `jaccard_gap.py` — measurement scripts
- `latest.json`, `archive_2026-09-0{6,7,8,9,10}.json` — raw DDB gets
- `stories-index.json`, `stories-state/*.json` (792 files) — raw S3 pulls
- `topics_extracted.json`, `stories_extracted.json`, `match_results.json`, `feed_overlap.json` —
  derived data
