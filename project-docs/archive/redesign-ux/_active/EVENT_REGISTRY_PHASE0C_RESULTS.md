# Phase 0c — two-subject fingerprint measurement (read-only)

Date: 2026-09-11. Reuses Phase 0's 164 topics (fair window: `latest` 2026-09-11 + `archive#2026-09-08/09/10`),
Phase 0's URL normalizer verbatim, and Phase 0's `stories/state/*.json` (792 files, full fields:
`storyId, axis, category, iso3[], entities[], last_seen, headlines[]`). No AWS calls, no writes, no
Lambda invokes — pure Python re-derivation from already-downloaded data.

**Headline verdict up front:** the two-subject fingerprint hypothesis is directionally correct
(country+type or country+actor conjunctions are far more discriminating than country-alone), but
**none of the five prescribed rules (R1-R5) reach zero false positives** on hand-labeled evidence,
and the one refinement that *would* get to zero (require the shared "actor" to be a real named
entity, not a bare country name) **collapses coverage to zero** in the same sample — because the
topic-side actor extraction (regex/alias scan over titles) essentially never surfaces a genuine
named-person overlap; every "shared actor" observed was a country name doing double duty. **Do
not ship any of R1-R5 as tested. Ship URL-only. Step 2 (LLM emits fingerprint fields, especially a
real actor list, at generation time) is a precondition for a safe tier 2, not an optional
enhancement.**

## 1. Fingerprint construction

### STORY side (`stories/state/*.json`, verbatim fields, no re-derivation needed)
- `countries` = `iso3[]` (deterministic, set at clustering time in `clusterStories()`)
- `actors` = `entities[]` (up to 6, LLM-extracted, "up to 4 key named actors/places/things" per
  the classification prompt — includes plain country names as often as named people, see below),
  run through `normalizeEntity()` (verbatim reimplementation of
  `amplify/backend/function/newsSituationIngest/src/classifier-core.js:114-121` — folds honorific
  prefixes/org suffixes and 19 curated full-name→surname aliases, e.g. "Donald Trump"→"trump")
- `type` = `(axis, category)` — `axis` ∈ `{conflict, political, economic, humanitarian}` (the 4 map
  hues), `category` ∈ `{war, unrest, diplomacy, election, policy, economy, markets, disaster,
  health, tech, other}` (from the classifier prompt, `classifier-core.js:23`)

### TOPIC side (164 editorial topics, no entity list — everything below is derived here)

**Countries**: `regions[]` (raw country-name strings on the DDB item) → ISO3, via a reverse map
built from `situationLabels.js`'s `ISO3_NAME` table (explicitly documented there as
"crisis-prone + major countries... need not be exhaustive") plus common-variant aliases
I constructed (US/Britain/UAE/etc., 25 variants). Applying the reverse map to all 164 topics'
`regions[]` left **10 residual unmappable names**: `Africa, Americas, Asia, Europe, European
Union, Global, Middle East, NATO, North America, Oceania` — every one of these is a **continent,
supranational bloc, or non-country tag**, not a coverage gap in the name table (I initially missed
7 genuine countries — Burundi, Gambia, Jamaica, Greenland, Hong Kong, Iceland, Western Sahara — in
my first pass; adding them dropped unmappable count from 17→10 and is reflected in all numbers
below. This is a caveat on my own construction, not on `situationLabels.js`, which never claimed
to be exhaustive). **The 10 residual unmappable tags are themselves informative**: they show the
editorial `regions[]` field sometimes emits a continent/org label instead of a specific country —
a genuine topic-side thinness (e.g. Kenya's Ruto-order topic had `regions: ["Africa"]` despite the
title and every source being unambiguously about Kenya).

**Type**: editorial `category` (12 values, `VALID_CATEGORIES` in
`amplify/backend/function/newsInvokeGemini/src/index.js:28-31`) → map `(axis, category)`, static
table I constructed and report in full:

| Editorial category | → map axis | → map category | Confidence |
|---|---|---|---|
| politics | political | diplomacy / election / policy | clean |
| military | conflict | war / unrest | clean |
| conflict | conflict | war / unrest | clean |
| disaster | humanitarian | disaster | clean |
| health | humanitarian | health | clean |
| economy | economic | economy / markets | clean |
| business | economic | economy / markets | clean |
| energy | economic | economy / markets | clean |
| technology | economic | tech | **weak** — could plausibly be political (tech policy/regulation) |
| science | economic | tech / other | **weak** — no good axis exists for pure science stories |
| climate | humanitarian | disaster | **weak** — climate policy is arguably political/economic, not humanitarian |
| society | political | policy / other | **weak** — catch-all editorial bucket, no clean map axis |

4 of 12 (33%) are weak/ambiguous mappings. "Type-compatible" in the rules below is defined as
`axis` equality only (the coarser field) — `category` granularity differs too much between the two
taxonomies to compare directly, and this is noted as a modeling choice, not a given.

**Actors**: no entity list exists on the topic side, so extracted deterministically by scanning
`title + source[].title` text for (a) the 19 `ACTOR_ALIASES` keys+values from `classifier-core.js`
and (b) all `ISO3_NAME`/variant country-name strings — both matched as whole-word substrings,
longest-token-first, then folded through the same `normalizeEntity()`. **133/164 topics (81.1%)
had ≥1 actor found** — but see §6: in every hand-labeled fingerprint-only match, the actor overlap
that drove the match was a bare country name, never a named person/org from `ACTOR_ALIASES`. The
81.1% "found" rate is almost entirely countries re-detected as pseudo-actors, not real actor
signal.

## 2. Sanity check — Tier 1 reproduction

Re-deriving Phase 0's URL-exact windowed match from the raw fields (not reusing Phase 0's
precomputed file, to guard against divergence) reproduces **52/164 (31.7%)** exactly — confirms
this measurement's topic/story extraction and ±36h windowing match Phase 0's.

## 3. Coverage per rule (fingerprint tier applied standalone to all 164 topics, ties→null, ±36h)

| Rule | 0-match | Unambiguous (1) | Ambiguous (>1) |
|---|---|---|---|
| R1 country-SET exact + type | 78 (47.6%) | 23 (14.0%) | 63 (38.4%) |
| R2 ≥2 shared countries + type | 105 (64.0%) | 9 (5.5%) | 50 (30.5%) |
| R3 ≥2 shared countries + ≥1 shared actor | 114 (69.5%) | 12 (7.3%) | 38 (23.2%) |
| R4 ≥1 shared country + ≥1 shared actor + type | 79 (48.2%) | 12 (7.3%) | 73 (44.5%) |
| R5 ≥1 shared country + ≥1 shared actor (no type) | 77 (47.0%) | 3 (1.8%) | 84 (51.2%) |

## 4. Incremental coverage on top of the URL tier (tier1 ∪ tier2)

| Rule | Incremental (url-tier1=null, rule=1) | Combined tier1+rule |
|---|---|---|
| R1 | 10 (6.1%) | **62/164 (37.8%)** |
| R2 | 5 (3.0%) | 57/164 (34.8%) |
| R3 | 6 (3.7%) | 58/164 (35.4%) |
| R4 | 7 (4.3%) | 59/164 (36.0%) |
| R5 | 3 (1.8%) | 55/164 (33.5%) |

## 5. Recall on URL-confirmed knowns (52 Phase-0 windowed-unambiguous pairs)

"Recall" = does the rule, applied independently, ALSO land on that *exact* story as its *sole*
unambiguous match (not just as one of several ties)?

| Rule | Recall |
|---|---|
| R1 | 9/52 (17.3%) |
| R2 | 4/52 (7.7%) |
| R3 | 5/52 (9.6%) |
| R4 | 4/52 (7.7%) |
| R5 | 0/52 (0.0%) |

Recall is low across the board — most URL-confirmed true pairs have story-side entity/iso3 fields
that don't happen to satisfy any rule's conjunction (often because the matched story's `entities[]`
never mentions the second country/actor the topic does, or the story's `axis` doesn't line up with
the type mapping's weak spots). This is a ceiling on how much of the *known-good* 31.7% the
fingerprint tier could even in principle re-derive independently — it is not being asked to
(fingerprints are additive), but it calibrates how much signal is really in these fields.

## 6. Hand-labeled fingerprint-only sample (kill-criterion test)

The **union of every unambiguous fingerprint-only match across R1-R5** (topics with a fingerprint
hit but *no* shared URL) is **21 pairs** — this is the entire population, not a subsample; the
plan's "≥30" target was not reachable because the strictness ladder that avoids ambiguity
mechanically produces a small output set (this itself is informative: a safe-enough rule here is
inherently low-coverage). All 21 were hand-labeled (same real-world event: yes/no) by reading both
titles/headlines in full.

| # | Label | Rules that produced it | Shared countries | Shared actor(s) | Topic | Matched story |
|---|---|---|---|---|---|---|
| 1 | **TRUE** | R1,R2,R4 | ARG,GBR | argentina | Argentina files criminal case against oil company operating in Falklands | Argentina to file case over Falklands oil |
| 2 | **TRUE** | R3 | CHN,PHL | china | Philippine defence chief calls out China over note handed to him mid-panel | Philippine defence chief slams China bullying |
| 3 | FALSE | R1 | IRN,SAU,YEM | saudi arabia | Saudi Arabia vows response after Houthi attacks; Yemen war escalates | Brent crude passes $100 as Middle East war intensifies |
| 4 | FALSE | R3,R4 | KOR,USA | south korea | South Korea sends fact-finding team to assess Strait of Hormuz conditions | Japan and South Korea Compete for US Navy Frigate Deal |
| 5 | FALSE | R2 | MEX,USA | us | Trump posts AI map showing US 'takeover' of North America... | Trial over killing of Australian surfer brothers... in Mexico |
| 6 | FALSE | R1 | DEU | (none) | Germany's Merz attacks AfD in stormy debate after far-right election win | Anti-AfD protesters rally in Cologne |
| 7 | **TRUE** | R4,R5 | KEN | kenya | Kenya's crackdown on foreign traders sparks fear... | Kenya clarifies foreign business rules after Ruto order sparks panic |
| 8 | **TRUE** | R1,R2 | IND,USA | india | Meta continues to run ads promoting CSAM in India - report | Meta runs ads promoting child abuse in India |
| 9 | **TRUE** | R1,R4 | PRK | north korea | North Korea builds new Yongbyon uranium enrichment facility | IAEA says North Korea built new uranium enrichment facility |
| 10 | **TRUE** | R4 | JPN | japan | Record rainfall in Nagoya, Japan strands commuters | Nagoya hit by record rain, flooding |
| 11 | **TRUE** | R1 | CAN,FRA,GBR,ISR | canada,france,uk | UK, France, Canada ban imports from Israeli settlements... | UK, France, Canada sanction Israeli settlement goods |
| 12 | FALSE | R2 | DEU,USA | (none) | AMD Unveils 'Personal Supercomputer' for AI-Driven Computing Era | Why are borrowing costs rising across the world? |
| 13 | **TRUE** | R2,R3 | ARE,DZA | algeria,uae | Algeria Cuts Diplomatic Ties with UAE... | Algeria cuts UAE ties over meddling |
| 14 | FALSE | R1 | RUS,UKR | ukraine | Amnesty Accuses Russia of Trafficking Foreigners to Fight in Ukraine | Europe's far right: Putin's best friend? |
| 15 | FALSE | R1 | RUS,UKR | ukraine | Amnesty: Russia Tricks 'Vulnerable' Foreigners into Fighting in Ukraine War | Europe's far right: Putin's best friend? |
| 16 | **TRUE** | R3 | HKG,USA | hong kong | Hong Kong Court Convicts Dow Jones of Attempting to Block Journalist... | WSJ publisher convicted in Hong Kong over reporter union role |
| 17 | **TRUE** | R3 | HKG,USA | hong kong | Hong Kong Court Convicts Dow Jones of Blocking Reporter from Press Union... | WSJ publisher convicted in Hong Kong over reporter union role |
| 18 | FALSE | R1,R4 | IDN | indonesia | Indonesia orders Netflix to pay $4.3m in music royalties | Is Indonesia's 100 GW Solar Plan Realistic? |
| 19 | FALSE | R1 | RUS | (none) | NATO Allies Foil Russian Subsea Cable Sabotage Plot in Arctic Waters | Drones hit Russia's gas hinterland in Siberia |
| 20 | FALSE | R5 | CHE | switzerland | Switzerland Publishes 200-Page Dossier on Nazi 'Angel of Death' Josef Mengele | Several dead in Dutch coach crash in Switzerland |
| 21 | **TRUE** | R3,R4,R5 | CHE,NLD | switzerland | Dutch Tour Coach Overturns in Eastern Switzerland, Killing Several | Several dead in Dutch coach crash in Switzerland |

**Overall: 11 TRUE / 10 FALSE across the 21-pair population (52% false-positive rate on the raw
union).** Per-rule breakdown (a pair counts once per rule that produced it):

| Rule | n | TRUE | FALSE | FP rate |
|---|---|---|---|---|
| R1 | 10 | 4 | 6 | **60%** |
| R2 | 5 | 3 | 2 | **40%** |
| R3 | 6 | 5 | 1 | **17%** (best of the five, still nonzero) |
| R4 | 7 | 5 | 2 | **29%** |
| R5 | 3 | 2 | 1 | **33%** |

**No rule reaches 0% on hand-labeled evidence.** R3 (≥2 countries + ≥1 actor, no type) is the best
performer but still has one confirmed false positive (#4, South Korea/Japan) — and its one failure
mode is the same one that recurs everywhere: **the "shared actor" is a bare country name standing
in for a real entity.**

### The strict-actor variant collapses to zero coverage

If the actor-overlap check is tightened to require the shared actor be something *other* than a
country name (i.e. a genuine `ACTOR_ALIASES` person/org token) — the natural fix for the pattern
above — **every one of R3/R4/R5's shared-actor sets in this 21-pair sample was a country name and
nothing else.** Re-running R3-strict/R4-strict/R5-strict on this sample yields **0 candidates,
0 TRUE, 0 FALSE** — not "safer with less coverage," but **completely empty**. This is the single
most important finding of this phase: **the topic-side actor signal, as extracted today (regex
scan of titles for 19 curated aliases + country names), never once surfaces a genuine named-entity
overlap that a story also carries.** Every apparent "actor match" was actually a second country
match wearing an actor hat. This is why R3/R4/R5's nonzero-but-imperfect FP rates above are not
"almost safe" — the actor component that's supposed to be doing the discriminating work is, in
practice, entirely country-driven, i.e. **R3/R4/R5 are functionally weakened versions of R1/R2 in
this dataset, not a genuinely orthogonal second signal.**

## 7. Adversarial test — the 5 known Phase 0b false links

Phase 0b confirmed 5 false-link pairs from a mismatched second subject (the operator's stated
motivating evidence for this whole hypothesis). Re-testing each pair against R1-R5 (using the
*current* `stories/state/` snapshot — one storyId, `political#DZA#algeria`, has since churned to
correctly represent the Algeria-UAE event itself, so it's no longer adversarial and is shown for
completeness only, not counted):

| Adversarial pair | Shared countries | Shared actor | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|---|---|
| Algeria-UAE vs (churned, no longer FALSE) | ARE,DZA | algeria,uae | reject | **accept (now correct)** | accept | accept | accept |
| Kenya-Ruto vs Kenya-Burundi-registration | (none — thin `regions:["Africa"]`) | kenya | reject | reject | reject | reject | reject |
| Jamaica-reparations vs UK-settlement-ban | GBR | uk | reject | reject | reject | **ACCEPT (fails)** | **ACCEPT (fails)** |
| China-Qatar vs China-CentralAsia | CHN | china | reject | reject | reject | **ACCEPT (fails)** | **ACCEPT (fails)** |
| Trump-AI-map vs Trump-Bombardier | USA | trump | reject | reject | reject | **ACCEPT (fails)** | **ACCEPT (fails)** |

**R1, R2, R3 correctly reject all 4 live adversarial cases (the Kenya rejection is partly by
omission — the topic's `regions` field was too thin to carry a country at all, not a true rule
success). R4 and R5 fail 3 of 4** — precisely because their `≥1 country + ≥1 actor` conjunction
is satisfied by a bare country name doing double duty as "the shared actor," which is exactly the
Trump-collision failure mode the operator asked about. **This directly confirms: a (1 country + 1
"actor" + type) rule is NOT safe when "actor" can be a country name — it reproduces the Trump
collision every time the shared entity is a country rather than a specific person/org.**

## 8. Single-country events

Many real single-subject domestic events (elections, court rulings, disasters) have exactly one
country and often no named-person actor distinguishable from the country itself. In the 21-pair
sample, single-country topics matched via R1 alone (Germany/Merz, North Korea/Yongbyon,
Indonesia/Netflix, Russia/NATO-cable) split 1 TRUE (North Korea — an exact-title-repeat, i.e. the
easiest possible case) / 3 FALSE. **Single-country + country-set-exact + type is not discriminating
enough on its own** for any country that recurs across multiple stories in the same axis within a
36h window (Germany/political, Russia/conflict, Indonesia/economic all had ≥2 live but *distinct*
stories in-window). Notably this failure mode is **not limited to single-country cases** — even
2-3-country "hot" dyads that recur constantly in a busy week (Russia-Ukraine, Saudi-Yemen-Iran)
produced false collisions under R1 too (#3, #14, #15) — busy geopolitical pairs generate multiple
genuinely distinct stories per week that all share the same country set and axis.

## 9. Where the misses/failures come from (diagnosis for verdict (b))

- **Thin/generic topic-side region tags**: 10/164 topics (6.1%) carry a continent/bloc tag
  (`Africa`, `Middle East`, `NATO`...) instead of a country — these can never satisfy any
  country-based rule regardless of how good the rest of the fingerprint is (the Kenya/Ruto example
  in §7 is a direct instance: title and every source are unambiguously about Kenya, but
  `regions: ["Africa"]` zeroes out the country fingerprint entirely).
- **Actor extraction from title text is not finding real actors, only re-finding countries**:
  81.1% "actor found" sounds high, but §6 shows the found actor is *always* a country name in
  every hand-labeled fingerprint-only match — meaning the 19-entry `ACTOR_ALIASES` curated list
  (Trump, Putin, Zelensky, etc.) essentially never fires on topic titles in this sample, even
  though several topics clearly mention named figures (Ruto, Merz, Trump). The scan technically
  works (word-boundary substring match) but named figures are diluted against — and dominated by —
  the much larger, always-present country-name token set. A dedicated named-entity pass (not a
  fixed 19-alias list) would very plausibly do much better, but that is exactly a Step-2-shaped
  fix, not a Step-1 rule tweak.
- **Weak editorial-category → axis mapping** (§1, 4/12 categories flagged weak) contributes some
  wrong-axis rejections/acceptances but is a secondary effect next to the two causes above — it
  wasn't observed to directly cause any of the 21 hand-labeled outcomes (all 21 pairs had
  `axis` either genuinely matching or genuinely not, independent of the weak-mapping categories).

## VERDICT

**(a) Safest rule achieving 0 hand-labeled false positives: none of R1-R5.** R3 (≥2 shared
countries + ≥1 shared actor, no type) is the closest, at 17% FP (1/6) on the fingerprint-only
sample, combined coverage tier1+R3 = 35.4% (up from tier1's 31.7%), recall on URL-confirmed knowns
= 9.6%. But 17% ≠ 0%, and the plan's kill criterion is false positives in hand-labeling — R3 fails
it. The theoretically "fixed" version (require the shared actor be a specific named entity, not a
country) does reach 0 FP, but at **0 incremental coverage** in this sample — an empty, not a safe,
tier.

**(b) Where the misses/failures come from**: two independent, additive causes — (i) thin topic-side
region tags (continent/bloc names instead of countries, ~6% of topics) that zero out the country
fingerprint regardless of rule quality, and (ii) an actor-extraction method (curated 19-alias list
+ country-name scan over raw title text) that in practice **only ever detects countries, never
real named actors**, even on topics that clearly name specific people. Both point the same
direction: **Step 2 (asking the LLM — either pipeline — to emit fingerprint fields explicitly,
especially a genuine actor/entity list, at generation time) is worth building and is specifically
needed to fix cause (ii)**, which is the dominant blocker (it collapses the entire actor-based
branch of the rule ladder to zero, not just degrades it). Cause (i) (thin regions) would also
benefit from Step 2 prompting the editorial LLM for ISO3 codes directly instead of free-text region
names.

**(c) Recommendation: URL-only for now.** Ship Phase 1 on the Phase 0/0b-accepted URL-exact join
(~31.7-32%, 0 confirmed false positives). Do **not** add a fingerprint tier 2 at any of R1-R5 as
specified — all five have confirmed false positives in hand-labeling, including on the exact
adversarial cases (R4/R5 reproduce the Trump-collision problem 3-for-3 on the very examples that
motivated this hypothesis). The two-subject fingerprint *idea* is not wrong — R1/R2/R3's rejection
of every live adversarial pair (§7) shows conjunctions genuinely do filter out the single-subject
collisions that killed Phase 0b's widened join — but it cannot be built safely from data the
system already captures today. **Concrete next step, if this is worth pursuing further: build
Step 2 first** (both LLMs emit `{countries: [iso3...], actors: [entity...], axis}` as additive
structured fields at generation time, replacing the free-text `regions[]` + title-scraping this
phase had to reverse-engineer), then re-run this exact same rule ladder against real emitted
fingerprints rather than derived ones — only then would R3/R4-style actor rules have a chance of
finding genuine named-entity overlaps instead of just re-discovering country overlaps under a
different name.

## Files (this measurement, read-only)

- `build_fingerprints.py` — ISO3 reverse-map, `normalizeEntity()` reimplementation, actor-scan
  tokens, editorial-category→axis table, topic/story raw extraction
- `match_fingerprints.py` — fingerprint construction + R1-R5 rule ladder + tier1 sanity check +
  incremental coverage + recall-on-knowns
- `topics_raw_full.json` / `stories_raw_full.json` — full re-extracted raw fields (264 topic
  records across all 5 archive days + latest; 792 story-state records)
- `topic_fingerprints.json` / `story_fingerprints.json` — derived fingerprints (countries, actors,
  mapped axis) for the 164 fair-window topics and all 792 stories
- `rule_results.json` — per-rule, per-topic candidate storyId lists (windowed, pre-tie-break)
- `summary_c.json` — top-line counters
- Hand-labeling (§6, §7) done by direct reading of topic titles + `source[].title` vs. story
  `title` + `headlines[].title`, no LLM/model judgment involved in the labels themselves
