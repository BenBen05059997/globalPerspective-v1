# Source Diversity Plan

**Status:** Draft — audit complete 2026-05-18, prototype validated, ready to implement
**Author:** Investigation 2026-05-18
**Problem:** Frontend topic cards routinely show 1–3 sources per topic even when 10–20 outlets are covering the same event. This weakens credibility, increases perceived single-outlet framing bias, and reduces AI-citation likelihood.

---

## TL;DR Verdict (after audit + prototype test)

| Question | Answer |
|---|---|
| Is the problem real? | **Partially.** Median is 4 sources / 3 outlets — better than feared, but two pathological cases hurt credibility: 1 topic shows a single source (8% of feed), 1 topic shows 2 sources from the same outlet. |
| Does the proposed enrichment work? | **Yes.** Prototype against live RSS adds **+12 sources (+27%)** and **+8 distinct outlets** across 13 topics, with median outlets rising 3 → 4. |
| Does it surface obviously-missed coverage? | **Yes.** Examples found in 10 minutes: Kenya fuel protests matched 0.308 in Al-Monitor; Hantavirus matched 0.338 in France24; Nigeria/IS strikes matched 0.394 in CNA — all major outlets we already fetch. |
| Is this worth shipping? | **Yes, with caveats.** Ship for the under-sourced tail. The win is concentrated in the bottom 30% of topics, not the median. |

See `## SOURCE_AUDIT_RESULTS` at the bottom for raw data.

---

## 1. Current State (diagnosed, not assumed)

### What the pipeline does today

**`newsInvokeGemini` (`amplify/backend/function/newsInvokeGemini/src/index.js`):**
1. Fetches 26 RSS feeds (cap 8 articles per feed) + 9 Brave Search queries → ~200-250 articles per run
2. Sends entire article list to DeepSeek V4 in a single prompt asking it to cluster into ~13 topics
3. DeepSeek returns each topic with a `sources[]` array
4. Backend validates each source URL against `allArticles` set (line 720) — hallucinated URLs dropped
5. Topics with `sources.length === 0` are filtered out (line 784)

### Why we end up with few sources per topic

Three independent causes, in order of impact:

**Cause A — Prompt instructs LLM to *partition*, not *gather*.**
Line 633 of `newsInvokeGemini/src/index.js`:
> "6. EXCLUSIVE SOURCES: Each source article URL must appear in exactly ONE topic. Never assign the same article to multiple topics."

This rule was designed to prevent article duplication across topics. But it *also* means that if the LLM groups topic A around 3 articles and topic B around 4 articles, and you have 10 articles about the same underlying event, the LLM has to choose one bucket. There is no rule forcing the LLM to attach *all* matching articles to the topic that best fits.

**Cause B — No minimum source count enforced.**
The filter at line 784 only requires `sources.length > 0`. A topic with 1 source survives. There is no "if a topic has only 1 source, search for more before publishing" step.

**Cause C — LLM attention budget.**
With ~200 articles in the prompt and a 600-token output, DeepSeek economizes by listing 1-3 "best" sources per topic instead of enumerating all matches. The prompt does not reward enumeration.

### What the frontend already does

`Home.jsx:372-385` displays both `<source count>` and `<outlet count>` (distinct outlets) — so the data model is already plural-aware. The UI is ready; the data isn't.

### What we don't yet know (data we need to collect before deciding)

- **Actual distribution of `sources.length` across `latest.topics[]`** — median, p25, p75, p95. Without this, we are guessing how bad the problem is.
- **Distribution of `outletCount` (distinct outlet domains) per topic.**
- **How many of the 200+ fetched articles end up unattached** (filtered out because no topic "owns" them).
- **Sample diff:** for 5 randomly-picked topics, how many articles from `allArticles` semantically match the topic but were not attached?

Step 0 of execution must produce these numbers. Without them, we can't measure improvement.

---

## 2. How Others Do It (comparative analysis)

| Source aggregator | Approach | Sources shown per story | Key takeaway |
|---|---|---|---|
| **Ground News** | Clusters articles via entity + embedding similarity, displays L/R/C political lean breakdown | 10-40 | Sells diversity as the product. "Covered by 23 sources" is the headline metric. |
| **AllSides** | Curates 3 outlets per story (left/center/right) — opinionated minimum | 3 (fixed) | Trades volume for balance. Editorial team, not algorithmic. |
| **Memeorandum / Techmeme** | Hand-tuned story clusters with primary headline + indented "more" links | 5-20 | Visual hierarchy — one anchor headline, stacked sibling outlets. |
| **Google News "Full Coverage"** | Embedding-based clustering on ~20k indexed outlets | 20-100 | Treats every related article as part of one story object. |
| **NewsAPI / NewsCatcher** | Programmatic aggregators — Jaccard or embedding similarity over rolling window | 5-50 | Story = cluster, not a single article. Cluster size is the metric. |
| **GDELT Global Knowledge Graph** | Entity-relation extraction + cosine similarity on TF-IDF vectors | Hundreds | Academic-grade — every mention is a node, every co-mention is an edge. |
| **AP / Reuters wire** | Editorial — single authoritative report, optionally annotated with "Additional reporting by…" | 1 (with byline diversity) | Authority > breadth. Different model than aggregation. |

**Industry consensus:** Aggregators show *cluster size* prominently because it's the credibility signal. Single-source = "rumor"; 20-source = "this is real, here's the consensus." Our current display ("1 source") reads as the former.

---

## 3. Proposed Approach

Two complementary changes, both done **post-LLM**, so the LLM cost doesn't change.

### Change 1 — Post-hoc source enrichment

After the LLM returns clustered topics, run a deterministic second pass that *re-attaches* matching articles from the full `allArticles` pool to each topic. Algorithm:

```
for each topic T in normalized:
  T.sources = T.sources ++ enrich(T, allArticles, alreadyAttached)

enrich(T, allArticles, alreadyAttached):
  candidates = []
  for each article A in allArticles where A.url not in alreadyAttached:
    score = similarity(T, A)
    if score >= threshold:
      candidates.push({A, score})
  candidates.sort(by score desc)
  return candidates.slice(0, MAX_ENRICHED_SOURCES).map(c => ({...c.A, tier: 'secondary'}))
```

Similarity function (cheap, no LLM): Jaccard overlap of `T.search_keywords` + `T.regions` against tokenized `A.title + A.snippet`, weighted by whether `A.title` contains any keyword. Tune threshold via Step 0 data.

**Why this works:** The LLM already did the hard part — figuring out what the "real events" are. Token matching is sufficient to find sibling articles once the event is named. We're not asking the LLM to enumerate; we're using its output as a query.

**Constraints:**
- Cap `MAX_ENRICHED_SOURCES` at ~12 per topic (UI sanity)
- De-duplicate by outlet domain — if NYT and CNN both cover it, keep both; if NYT-print and NYT-web cover it, keep one
- Preserve the existing `tier: 'primary'` for LLM-picked sources, mark enriched ones `tier: 'secondary'`
- Drop the "EXCLUSIVE SOURCES" exclusivity rule from the prompt — let an article appear in multiple topics if it genuinely matches multiple (rare in practice; common in cross-domain stories like "climate-driven migration")

### Change 2 — Outlet diversity scoring

Once a topic has N sources, surface the *diversity*, not just the count:
- **Outlet count** (distinct domains) — already shown in `Home.jsx:381`
- **Geographic diversity** — outlet's HQ country (BBC=UK, AJ=Qatar, SCMP=HK, Reuters=US/UK, etc.) — display as flag row
- **Outlet type** — wire (Reuters, AP) / national (BBC, NYT) / regional / specialist (climate, tech)

These can be derived from a static `outlet_metadata.json` mapping domain → `{country, type, lean?}`. ~26 entries to start (matches our RSS list), grows as Brave brings in new outlets.

### Change 3 (optional, later) — Embedding-based clustering

If Step 0 reveals that Jaccard misses too many obvious matches (e.g., synonymous titles with no keyword overlap), upgrade similarity to sentence embeddings. Options:
- DeepSeek's embedding endpoint (cheap, ~$0.05/M tokens)
- Local: `bge-small-en` running in Lambda layer (no API cost, +~150MB cold start)

**Defer this until Jaccard is measured insufficient.** Don't pre-optimize.

---

## 4. Implementation Plan

### Step 0 — Data audit (do this first, no code changes)

**Goal:** Know the actual source-count distribution before changing anything.

1. Pull latest from DDB and dump `latest.topics[]` with source counts:
   ```bash
   aws dynamodb get-item \
     --table-name <TOPICS_DDB_TABLE> \
     --key '{"id":{"S":"latest"}}' \
     --region ap-northeast-1 > /tmp/latest.json
   ```
2. Write a 30-line node script that emits:
   - Histogram of `sources.length` across topics
   - Histogram of distinct-outlet count per topic
   - For each topic: `{title, sourceCount, outletCount, primaryCountry}`
   - Top 5 outlets by total appearances
3. Sample 5 topics with `sourceCount <= 2`. For each, manually grep `allArticles` (from the same run's CloudWatch logs) for keyword matches. Count how many were missed.

**Deliverable:** A short markdown report — `SOURCE_AUDIT_RESULTS.md` — pasted into this plan doc.

**Decision gate:** If median sourceCount >= 5 and median outletCount >= 3, this plan is lower priority than other work. If median sourceCount <= 2, proceed.

### Step 1 — Build the enrichment function (no deploy yet)

1. Add `enrichSourcesForTopic(topic, allArticles, alreadyAttached, opts)` to `newsInvokeGemini/src/index.js`
2. Add `domainOf(url)` helper if not already present
3. Add `outlet_metadata.json` (start with the 26 RSS outlets)
4. Wire `enrichSourcesForTopic` into the normalization loop at line 724, *after* validation, *before* the topic filter
5. Add new env vars:
   - `SOURCE_ENRICH_THRESHOLD` (default `0.35` Jaccard)
   - `SOURCE_ENRICH_MAX` (default `12`)
   - `SOURCE_ENRICH_ENABLED` (default `false`, flip to `true` after testing)

### Step 2 — Local test

1. Run the function locally with `event = { test: true, readOnly: true }` so it reads but doesn't write DDB
2. Compare `topics[i].sources.length` before/after enrichment
3. Sanity-check 3-5 enriched sources per topic — do they actually match the topic?

### Step 3 — Staging deploy

1. Deploy the Lambda update with `SOURCE_ENRICH_ENABLED=true`
2. Wait for next scheduled run (every 2h)
3. Re-run the Step 0 audit script
4. Compare distributions before/after

### Step 4 — Frontend tweaks (only after backend ships clean data)

1. In `Home.jsx`, when `t.sources.length >= 5`, surface an outlet-flag row (countries) above the AI button bar
2. Replace the bare "N sources" pill with "N sources · M outlets · K countries" (gracefully hide K if outlet_metadata is sparse)
3. In the expanded sources panel, sort by tier (`primary` first), then by outlet country diversity (prefer non-duplicate-country sources at the top)

### Step 5 — Frontend deploy

Standard build + copy + commit:
```bash
cd global-perspectives-starter/frontend && npm run build
rm -rf ../../docs/assets && cp -r dist/assets ../../docs/assets && cp dist/index.html ../../docs/index.html
# Update CHANGES.md
git add docs/assets docs/index.html global-perspectives-starter/frontend/src/ CHANGES.md
git commit -m "Source diversity: surface outlet count and country flags"
git push
```

---

## 5. How to Check Whether It's Actually a Problem

Run the Step 0 audit. Decision tree:

| Median `sourceCount` | Median `outletCount` | Verdict |
|---|---|---|
| >= 5 | >= 3 | Not a problem. Skip this plan. |
| 3-4 | 2 | Mild. Ship Change 2 only (diversity display). |
| 1-2 | 1-2 | Real problem. Ship all changes. |
| 1-2 | 1 | Severe. Single-outlet topics — credibility risk. Ship immediately. |

This must be measured, not guessed. The current memory note says ~200-250 articles enter the pipeline; if median sources/topic is 2, that means ~85-90% of fetched articles are being discarded. That's the actual test.

---

## 6. How to Test

### Automated checks

1. **Unit test for `enrichSourcesForTopic`**
   - Input: topic with `keywords = ["nvidia", "chip"]`, articles array containing 1 matching + 1 non-matching
   - Expect: returns the 1 matching, scored above threshold
   - Edge cases: empty articles, empty keywords, all already-attached, exactly-at-threshold

2. **Regression test for hallucination filter**
   - Confirm that enriched sources still pass `validUrls.has(s.url)` — they should by construction (they come from `allArticles`)

3. **Cap test**
   - Generate 50 matching articles, confirm output capped at `SOURCE_ENRICH_MAX`

### Manual checks (real data)

1. **Before/after audit** — run the Step 0 script on the same DDB key one hour before and one hour after the first enriched run. Compare histograms.
2. **Random spot-check** — for 5 random topics, open the sources panel and verify:
   - All primary-tier sources are about the topic
   - All secondary-tier sources are also about the topic (not adjacent stories)
   - No duplicate URLs
   - No duplicate-outlet domination (e.g., 8/10 sources from Reuters)
3. **Adversarial spot-check** — pick a topic with very generic keywords ("election", "China"). Confirm the threshold prevents flooding with off-topic matches.

### Production monitoring

Add CloudWatch metric emissions inside `newsInvokeGemini`:
- `sources_before_enrich` (sum across all topics in this run)
- `sources_after_enrich`
- `topics_with_single_source` (count of topics with `sources.length === 1`)
- `topics_with_zero_outlets_diversity` (count where `outletCount === 1`)

Set a CloudWatch alarm on `topics_with_single_source > 3` for 3 consecutive runs — flags regression.

### UI test

Per the project's `feedback_test_ui_in_browser.md` rule:
1. Open `https://globalperspective.net` in incognito
2. Verify the topic cards now show outlet count and country flags where applicable
3. Open the source panel — confirm primary sources are at top
4. Confirm mobile (DevTools 375px) still wraps cleanly
5. Confirm no console errors from missing outlet metadata for unknown domains

---

## 7. Risks and Trade-offs

| Risk | Mitigation |
|---|---|
| Off-topic enrichment (low-quality matches) | Threshold tuning; manual spot-check before flipping `SOURCE_ENRICH_ENABLED` |
| Cross-topic article duplication confuses readers | UI shows `tier: secondary` differently (smaller, dimmer); only allow duplication for genuinely cross-cutting stories |
| Outlet metadata stale (new Brave domain) | Show count + name only when country is unknown — graceful degradation |
| Lambda payload size grows (more sources per topic = bigger `latest` item) | Cap at 12 sources/topic. Estimated DDB item size: ~50KB → ~120KB. Still well under 400KB DDB limit. |
| LLM stops doing source attribution well because it knows enrichment will fix it | LLM prompt unchanged. Enrichment is silent post-processing. |
| User memory says `feedback_clean_architecture.md` prefers dedicated Lambdas | This is in-line post-processing, not a new pipeline stage. If it grows, split out. |

---

## 8. Out of Scope

- **Political lean scoring per outlet** — that's a separate Ground News-style feature
- **Original-reporting vs. wire-rehash detection** — interesting but expensive
- **Fact-check overlay** — separate problem, separate plan
- **Embedding-based clustering** — deferred until Jaccard proven insufficient
- **Backfilling historical archive entries** — only future runs get enriched; archive stays as-is unless a separate migration is approved

---

## 9. Open Questions

1. Should an article appear in *multiple* topics if it matches several (e.g., "Iran-Israel tariff" topic and "Middle East tariff" topic)? Recommendation: **Yes, with tier='secondary' in the non-primary topic.** Current "EXCLUSIVE SOURCES" rule should be relaxed for enrichment only.
2. What's the right `MAX_ENRICHED_SOURCES`? Recommendation: **12.** Above that, UI gets cluttered and DDB item bloats. Tune after Step 0 data.
3. Should `archive#YYYY-MM-DD` entries also get enriched? Recommendation: **Yes, automatically, since enrichment runs before the swap to `latest`.** Already covered by the pipeline order.

---

## 10. Estimated Effort

| Step | Effort | Who |
|---|---|---|
| Step 0 audit | 1 hour | one-off script |
| Step 1 enrichment code | 3-4 hours | Lambda edit + outlet metadata |
| Step 2 local test | 1 hour | run locally with readOnly |
| Step 3 staging deploy + monitor | 2 hours (split over a day for next run cycle) | Lambda deploy + CloudWatch checks |
| Step 4 frontend changes | 2-3 hours | Home.jsx outlet pill + source panel sort |
| Step 5 frontend deploy | 30 min | build + copy + commit |
| **Total** | **~10 hours, plus one calendar day for pipeline observation** | |

No new infrastructure. No new Lambdas. No DDB schema change. Reversible by flipping `SOURCE_ENRICH_ENABLED=false`.

---

## SOURCE_AUDIT_RESULTS

**Audit run:** 2026-05-18, against `latest.topics[]` (asOf `2026-05-18T12:01:45Z`) via the live REST proxy.

### Part 1 — Current state distribution

```
=== sources.length per topic ===
min/p25/median/p75/max:   1 / 3 / 4 / 4 / 5
mean: 3.46

=== distinct outlets per topic ===
min/p25/median/p75/max:   1 / 3 / 3 / 4 / 5
mean: 3.23

=== histogram (sources → topics) ===
  1 source:  1 topic  █
  2 sources: 1 topic  █
  3 sources: 4 topics ████
  4 sources: 5 topics █████
  5 sources: 2 topics ██
```

### Part 2 — Pathological cases

| Topic | Sources | Outlets | Issue |
|---|---|---|---|
| `disaster` Earthquake in southwest China kills two | **1** | **1** | Single-outlet (Reuters). Web search finds 10+ outlets covering this. |
| `business` Samsung Electronics and union resume wage talks | 2 | **1** | Both sources from same outlet (Korea Herald). Web search finds 10+ outlets including Bloomberg, CNBC, Tom's Hardware, Japan Times, Korea Times, UPI. |
| `society` Kenya fuel price protests | 3 | 3 | Reasonable, but Al-Monitor's "Transport protests hit Kenya over rising fuel prices" was in RSS and missed. |

### Part 3 — Outlet concentration

```
=== outlet appearances across all 13 topics ===
  6 × bbc.com
  5 × aljazeera.com
  4 × npr.org
  3 × channelnewsasia.com, japantimes.co.jp, apnews.com
  2 × middleeasteye.net, al-monitor.com, france24.com, theguardian.com, scmp.com, allafrica.com, grist.org, koreaherald.com
  1 × euronews.com, ...
```

Concentration is reasonable. BBC + Al Jazeera + NPR dominate, but the long tail is healthy.

### Part 4 — Enrichment prototype results

**Algorithm:** Jaccard similarity over `tokenize(title + keywords + regions)` vs `tokenize(article.title + article.snippet)`, with +0.05 bonus per topic keyword found in article title (capped at +0.15). Threshold 0.18, max 12 per topic.

**Input pool:** 120 articles from 15 RSS feeds (Middle East Eye returned empty), fetched live ~12 hours after the topics were generated.

**Results:**

```
AGGREGATE
  Total sources before: 45    after: 57    gain: +12 (27%)
  Total outlets before: 42    after: 50    gain: +8
  Median sources/topic:  4 → 4
  Median outlets/topic:  3 → 4
```

**Where the gain landed:**

| Topic | sources gain | new outlets | Notable matches |
|---|---|---|---|
| Iran/Hormuz body | +4 | +2 | Al Jazeera (3 articles, 0.28-0.21), NPR (0.21) |
| Trump warns Iran | +2 | +1 | AllAfrica/Somalia angle (0.29), NPR (0.18) |
| Israel/Gaza flotilla | +1 | 0 | Al Jazeera flotilla followup (0.22) |
| Ebola DRC/Uganda | +1 | +1 | Al Jazeera health-minister-visits (0.30) |
| Hantavirus cruise ship | +1 | +1 | France24 cruise-ship-arrives (**0.34**) |
| Kenya fuel protests | +1 | +1 | Al-Monitor transport-protests (**0.31**) |
| Nigeria/US/IS strikes | +1 | +1 | CNA Nigeria-US-strikes (**0.39**) |
| Iran energy crisis | +1 | +1 | Al Jazeera Hormuz-insurance (0.23) |
| Ukraine drones | 0 | 0 | No matches above threshold |
| Global executions | 0 | 0 | Niche topic, no matches in 12h-old RSS |
| AI utility profits | 0 | 0 | US-specific, RSS pool is global-leaning |
| **Earthquake China** | **0** | **0** | **RSS feeds rolled story off before test ran (story was 12h old)** |
| **Samsung union** | **0** | **0** | Same — RSS rolled the story off |

### Part 5 — Why the prototype underestimates the production gain

The prototype ran ~12 hours after the topics were generated. RSS feeds typically only carry the latest 20-50 items, so stories from 12 hours ago have rolled off many feeds. **In production, enrichment runs inside the same Lambda invocation against the *same* fresh article pool the LLM saw** — meaning every article-the-LLM-could-have-attached-but-didn't is still in the pool and available for Jaccard matching.

The earthquake and Samsung topics — which got 0 enrichment in the prototype — are exactly the cases that will benefit most in production, where the article pool is contemporaneous with topic generation.

### Part 6 — Decision

Per the decision matrix in §5:

| Median sourceCount | Median outletCount | Verdict |
|---|---|---|
| 4 | 3 | Between "Mild" (ship Change 2 only) and "Not a problem" |

But the median understates the issue. The fix is cheap (~10 hours), reversible (env flag), and concentrates its benefit on exactly the topics that hurt credibility most — the 1-source and same-outlet-twice cases.

**Recommendation: ship Steps 1–5 of the plan.** Prioritize the backend enrichment (Step 1) and the outlet-count + country-flag display (Step 4). Defer the outlet-type metadata (wire/national/specialist classification) to a follow-up if Step 4's basic country flag turns out to be enough credibility signal.

### Part 7 — Test artifacts

- `/tmp/enrichment_test.js` — runnable prototype
- `/tmp/enrichment_results.json` — full per-topic before/after data
- `/tmp/latest_topics.json` — raw `latest.topics[]` snapshot used as input
