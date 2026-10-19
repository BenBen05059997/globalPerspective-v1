# Phase 1c — BACKFILL fingerprint measurement with Sonnet-generated GOOD tags (proxy for Phase 1b production tags)

Date: 2026-09-11. Read-only against AWS (one `aws dynamodb get-item` call for the calibration check).
Reuses Phase 0's 164 fair-window topics + Phase 0c's re-extracted raw fields, Phase 0's URL normalizer,
and Phase 0's `stories/state/*.json` (792 in-window story records). All tagging (both topic side and
story side) was done by 10 parallel Sonnet fork agents reading titles/headlines and applying the exact
Phase 1b production tagging rules (`iso3[1-4]` / `actors[1-3], never a country` /
`event_type ∈ {war,unrest,diplomacy,election,policy,economy,markets,disaster,health,tech,other}`) —
**this is a PROXY for the real `newsInvokeGemini`/`newsSituationIngest` tag emission, not the genuine
production output.** See §5 for how well the proxy calibrates against the ~16 topics that already carry
real production tags today.

**Headline verdict up front:** with GOOD tags (real named actors, not country-names-as-actors), **R3
(≥2 shared countries + ≥1 shared actor, no type) reaches 0 hand-labeled false positives** on the full
29-pair fingerprint-only population (6/6 TRUE), versus Phase 0c's 17% FP floor on thin/derived tags.
Combined URL-tier ∪ R3 = 58/164 (35.4%), 0 confirmed false positives — an incremental +6 topics
(+3.7 points) over the URL-only 31.7% baseline. R1/R2/R4/R5 all still show confirmed false positives,
so **only R3** clears the kill criterion. Calibration against the 9 topics with real live production
tags shows strong iso3 agreement (8/9 exact-set) but only moderate actor-overlap agreement (6/9) and
event_type agreement (7/9) — good enough to call this proxy directionally trustworthy, not a certainty.

## 1. Tagging methodology

- **TOPIC side**: all 164 fair-window topics (`latest` 2026-09-11 + `archive#2026-09-08/09/10`),
  tagged from title + up to 6 source-article titles, split into 2 chunks of 82 and tagged by 2 parallel
  Sonnet fork agents using the verbatim Phase 1b production rules.
- **STORY side**: all 792 stories with `last_seen` inside ±36h of at least one of the 164 topics (this
  turned out to be the *entire* 792-story population — the 5-day archive window and 36h tolerance
  overlap fully), tagged from title + up to 6 headline titles, in 8 chunks of 99, by 8 parallel Sonnet
  fork agents. Story-side agents were told to use the existing derived `iso3[]` only as a *seed/hint*
  and re-derive from headline text under the same no-countries-as-actors rule, so both sides share one
  tagging standard (unlike Phase 0c, where the story side used real classifier output and the topic side
  used a regex reconstruction — an apples-to-oranges comparison that this phase fixes by tagging both
  sides identically).
- Coverage: 164/164 topics and 792/792 stories tagged, zero missing, zero invalid `event_type` values
  (validated programmatically after merge).
- **Rule ladder change vs Phase 0c**: `type_compatible()` is now **exact `event_type` string equality**
  on both sides (both were tagged from the *same* 11-value enum), replacing Phase 0c's coarse
  `editorial-category → map-axis` lookup table (which was flagged there as "4/12 mappings weak"). This
  is itself a real improvement made possible by structured tags — it was a fundamental limitation of the
  thin-tag world.

## 2. Coverage per rule (GOOD tags, standalone, all 164 topics, ties→null, ±36h window)

| Rule | 0-match | Unambiguous (1) | Ambiguous (>1) |
|---|---|---|---|
| R1 country-SET exact + type | 50 (30.5%) | 35 (21.3%) | 79 (48.2%) |
| R2 ≥2 shared countries + type | 89 (54.3%) | 18 (11.0%) | 57 (34.8%) |
| R3 ≥2 shared countries + ≥1 shared actor | 130 (79.3%) | 10 (6.1%) | 24 (14.6%) |
| R4 ≥1 shared country + ≥1 shared actor + type | 113 (68.9%) | 20 (12.2%) | 31 (18.9%) |
| R5 ≥1 shared country + ≥1 shared actor (no type) | 104 (63.4%) | 12 (7.3%) | 48 (29.3%) |

Tier-1 (URL-exact, windowed) sanity check reproduces Phase 0's known **52/164 (31.7%)** exactly.

## 3. Incremental coverage on top of the URL tier (tier1 ∪ rule)

| Rule | Incremental (url-tier1=null, rule=1) | Combined tier1+rule |
|---|---|---|
| R1 | 18 (11.0%) | 70/164 (**42.7%**) |
| R2 | 8 (4.9%) | 60/164 (36.6%) |
| R3 | 6 (3.7%) | 58/164 (**35.4%**) |
| R4 | 11 (6.7%) | 63/164 (38.4%) |
| R5 | 6 (3.7%) | 58/164 (35.4%) |

## 4. Recall on URL-confirmed knowns (52 Phase-0 windowed-unambiguous pairs)

| Rule | Recall |
|---|---|
| R1 | 12/52 (23.1%) |
| R2 | 7/52 (13.5%) |
| R3 | 3/52 (5.8%) |
| R4 | 6/52 (11.5%) |
| R5 | 4/52 (7.7%) |

Modestly higher than Phase 0c across the board (e.g. R1 23.1% vs 17.3%), consistent with better tags,
but still low — most URL-confirmed true pairs still don't happen to satisfy any fingerprint rule
independently. This remains a ceiling on how much of the *known-good* 31.7% the fingerprint tier could
in principle re-derive; it is not required to (fingerprints are additive on top of the URL tier).

## 5. CALIBRATION CHECK — does this Sonnet backfill predict real production tags?

Pulled the live `NewsCache` `id=latest` item (`aws dynamodb get-item --table-name NewsCache --region
ap-northeast-1 --key '{"id":{"S":"latest"}}'`) at measurement time. All 16 current `latest` topics
already carry real production `iso3`/`actors`/`event_type` (Phase 1b tag emission is live). Of those
16, **9 topics are recognizably the same underlying event** as one of the 164-topic backfill sample's
"latest"-dataset topics tagged by the fork agents earlier in this run (the `latest` topic list rotates
continuously, so only overlapping events are comparable — matched by manual title/event identity, not
index position).

| Event | iso3 exact-set match | iso3 any-overlap | event_type match | actor overlap (≥1, case-insens.) |
|---|---|---|---|---|
| Houthis seize Mocha | ✅ | ✅ | ✅ (war=war) | ✅ (Houthis) |
| Israel destroys Hezbollah tunnels | ✅ | ✅ | ✅ (war=war) | ✅ (Hezbollah) |
| Canada–Ukraine defence pact | ✅ | ✅ | ✅ (diplomacy=diplomacy) | ❌ (mine=[], live=[Carney,Zelenskyy]) |
| DR Congo school fire (Bukavu) | ✅ | ✅ | ✅ (disaster=disaster) | ❌ (mine=[], live=[Bukavu officials]) |
| Dutch coach crash, Switzerland | ✅ | ✅ | ✅ (disaster=disaster) | ❌ (mine=[], live=[Swiss police]) |
| Anthropic vs Chinese AI rivals | ❌ (mine missing IRN,RUS) | ✅ | ✅ (tech=tech) | ✅ (Anthropic, DeepSeek) |
| NATO subsea cable sabotage | ✅ | ✅ | ❌ (mine=war, live=other) | ✅ (NATO) |
| Chemours PFAS settlement | ✅ | ✅ | ❌ (mine=policy, live=health) | ✅ (Chemours) |
| Mozambique opposition treason charge | ✅ | ✅ | ✅ (unrest=unrest) | ✅ (Venâncio Mondlane) |

**Agreement rates (n=9): iso3 exact-set 8/9 (88.9%), iso3 any-overlap 9/9 (100%), event_type exact
7/9 (77.8%), actor overlap 6/9 (66.7%).**

Reading the misses: the 3 actor misses are all cases where I (correctly, per the rules) returned `[]`
because the *headline text alone* named no specific actor, while the live production tagger — reading
full source-article content/snippets, not just headlines — surfaced a generic-but-specific actor
("Bukavu officials", "Swiss police", "Mark Carney"/"Volodymyr Zelenskyy" from body text). This is an
artifact of my proxy's more limited input (titles only) understating actor coverage, not a rule
disagreement — it means my headline-only tagging is a **conservative/lower-bound estimate of actor
signal**, so R3/R4/R5's coverage numbers above are plausibly a floor, not a ceiling, on what real tags
would produce. The 2 `event_type` misses (NATO cable: war vs other; Chemours: policy vs health) are
genuine boundary-call disagreements, not systematic bias in either direction.

**Interpretation**: iso3 is highly reliable (this backfill is a strong proxy for country tags).
`event_type` is decent but not perfect (~78%) — expect some real R1/R2/R4 rejections/acceptances to
flip either direction once real tags are used. Actor overlap is the weakest link (~67%, likely
undercounted due to headline-only input) — meaning **R3's true zero-FP result may understate real
coverage** (more actor overlaps would exist with full-article tagging) but the qualitative
zero-FP-on-real-actors finding should hold, since production tagging follows the identical
"never a country" rule that is what eliminated Phase 0c's bare-country-actor failure mode.

## 6. Hand-labeled fingerprint-only sample (kill-criterion test) — all 29 pairs, full population

The union of every unambiguous fingerprint-only match (fingerprint hit, no shared URL) across R1-R5 is
**29 pairs** (up from Phase 0c's 21, because more topics get fingerprint hits with real actor signal).
All 29 hand-labeled by reading topic title+source-titles vs. story title+headlines in full.

| # | Label | Rules | Shared countries | Shared actor(s) | Topic | Matched story |
|---|---|---|---|---|---|---|
| 1 | FALSE | R1 | SYR | — | Europe's Asylum Requests Drop to Five-Year Low in First Half of 2026 | Kurdish YPJ women fighters face exclusion from Syria's new army |
| 2 | FALSE | R1 | GBR,ISR | — | UK to announce trade ban on goods made in Israeli West Bank settlements | UN expert Francesca Albanese calls for 'true paradigm shift' as Miliband resets policy on Israel |
| 3 | TRUE | R1,R4,R5 | BRA | lula | Brazil marks Independence Day with tight presidential race between Bolsonaro and Lula | Lula's strategy for fourth Brazil presidency |
| 4 | FALSE | R1 | NPL | — | Nepal cracks down on online abuse of flood survivors | Nepal demands climate justice after deadly floods |
| 5 | TRUE | R1 | CAN,FRA,GBR,ISR | — | UK to announce trade ban... (variant A) | UK, France, Canada sanction Israeli settlement goods |
| 6 | TRUE | R1 | IDN | — | Indonesia reopens airports after Anak Krakatau eruption forces closures | Indonesia knew a volcano was erupting. Could it have prepared better? |
| 7 | TRUE | R1 | CAN,FRA,GBR,ISR | — | UK, France, Canada impose trade bans... (variant B) | UK, France, Canada sanction Israeli settlement goods |
| 8 | TRUE | R1,R2 | CHN,PHL | — | Philippine defence chief calls out China over note handed to him mid-panel | Philippine defence chief slams China bullying |
| 9 | TRUE | R1 | CAN,FRA,GBR,ISR | — | UK, France, Canada ban imports... (variant C) | UK, France, Canada sanction Israeli settlement goods |
| 10 | TRUE | R1,R4,R5 | PRK | iaea | North Korea builds new Yongbyon uranium enrichment facility, IAEA says | IAEA says North Korea built new uranium enrichment facility |
| 11 | TRUE | R1,R2,R4 | FIN,USA | google | Google to invest $15 billion in AI infrastructure in Finland | Google invests $15B in AI, nuclear power in Finland |
| 12 | TRUE | R1 | CAN,FRA,GBR,ISR | — | UK, France, Canada ban imports... (variant D) | UK, France, Canada sanction Israeli settlement goods |
| 13 | TRUE | R1,R2,R4 | CHN,USA | huawei | Huawei racketeering conspiracy trial opens in New York | Huawei racketeering trial enters second day |
| 14 | TRUE | R1,R2 | ARE,DZA | — | Algeria Cuts Diplomatic Ties with UAE Over 'Provocative and Hostile Actions' | Algeria cuts UAE ties over meddling |
| 15 | FALSE | R1 | USA | — | Nasdaq to Invest $100 Million in Kraken Parent to Deepen Tokenization Push | Wall Street falls as crude tops $101 |
| 16 | FALSE | R1 | CHN | — | EU Commission Prepares Import Overhaul to Crack Down on Illegal Chinese Products | China signals social stability push with new party body |
| 17 | FALSE | R1 | RUS | — | NATO Allies Foil Russian Subsea Cable Sabotage Plot in Arctic Waters (variant A, R1-only) | Drones hit Russia's gas hinterland in Siberia |
| 18 | TRUE | R1 | USA | — | US Existing Home Sales Fall to Weakest Pace in Over a Year | US existing home sales hit weakest pace in over a year (exact repeat) |
| 19 | TRUE | R2,R3,R4 | GBR,NOR,RUS | nato | NATO Allies Foil Russian Subsea Cable Sabotage Plot in Arctic Waters (today) | NATO says it halted Russian undersea cable sabotage drill |
| 20 | FALSE | R2 | CHN,NPL | — | Nepal identifies flood victims as questions grow over China's reporting of deaths | Another Australian found safe after Nepal-Tibet floods |
| 21 | TRUE | R2,R3,R4 | GBR,NOR,RUS | nato | NATO Allies Foil Russian Subsea Cable Sabotage Plot (0910, variant B) | NATO says it halted Russian undersea cable sabotage drill |
| 22 | TRUE | R2,R3,R4 | GBR,NOR,RUS | nato | NATO Allies Foil Russian Subsea Cable Sabotage Plot (0910, variant C) | NATO says it halted Russian undersea cable sabotage drill |
| 23 | TRUE | R3,R4,R5 | CAN,USA | chrystia freeland | Canada imposes retaliatory tariffs on nearly $20bn of US goods as trade war escalates | Freeland Watches US-Canada Trade War |
| 24 | TRUE | R3,R5 | HKG,USA | dow jones | Hong Kong Court Convicts Dow Jones of Attempting to Block Journalist from Union Role | WSJ publisher Dow Jones convicted in Hong Kong union case |
| 25 | TRUE | R3,R5 | HKG,USA | dow jones | Hong Kong Court Convicts Dow Jones of Blocking Reporter from Press Union Leadership Role | WSJ publisher Dow Jones convicted in Hong Kong union case |
| 26 | TRUE | R4 | IND | meta | Meta continues to run ads promoting CSAM in India - report | Meta runs ads promoting child abuse material in India (exact repeat) |
| 27 | FALSE | R4 | DEU | friedrich merz | Germany's Merz attacks AfD in stormy debate after far-right election win | Macron and Merz's losing strategies against the far right |
| 28 | TRUE | R4 | RUS | nato | NATO Allies Foil Russian Subsea Cable Sabotage Plot (0910, variant D, R4-only) | NATO says it halted Russian undersea cable sabotage drill |
| 29 | FALSE | R5 | KEN | william ruto | Kenya's President Ruto signs four bills into law on finance and trust administration | Kenya: Joho, Sudi Deliver Ruto's Message to Samia After Husband's Death |

**Overall: 20 TRUE / 9 FALSE across the 29-pair population (31% false-positive rate on the raw union) —
down from Phase 0c's 52%.** Per-rule breakdown (a pair counts once per rule that produced it):

| Rule | n | TRUE | FALSE | FP rate | (Phase 0c FP rate) |
|---|---|---|---|---|---|
| R1 | 18 | 12 | 6 | 33.3% | 60% |
| R2 | 8 | 7 | 1 | 12.5% | 40% |
| R3 | 6 | 6 | 0 | **0.0%** | 17% (best of five, still nonzero) |
| R4 | 11 | 10 | 1 | 9.1% | 29% |
| R5 | 6 | 5 | 1 | 16.7% | 33% |

**R3 (≥2 shared countries + ≥1 shared actor, no type requirement) is the only rule that reaches 0%
false positives** — all 6 of its fingerprint-only matches (NATO subsea cable ×3 variants, Freeland/trade
war, Dow Jones/Hong Kong ×2) are genuine same-event links, each anchored by a real named actor (NATO,
Chrystia Freeland, Dow Jones) rather than a bare country name standing in for one. This is exactly the
fix Phase 0c predicted: **with genuine named-actor tags, the actor-overlap rules stop being "weakened
versions of R1/R2" and start doing real discriminating work.**

R1's remaining 33% FP rate confirms Phase 0c's other finding still holds even with good tags:
**country-set-exact + type alone is not sufficient** — busy country pairs/singles (Israel/Gaza-adjacent
diplomacy topics recurring across days, NATO-Russia stories, Nepal floods, US markets) still produce
multiple genuinely distinct same-country-same-type stories within a 36h window that collide under R1.
Good tags fixed the *actor* signal; they did not fix R1's structural country-and-type-alone weakness
(which was never blamed on tag quality in Phase 0c — it's a rule-design issue, not a data issue).

## 7. Adversarial retest — known collision patterns, re-tested against GOOD tags

Re-tested every Phase 0b/0c adversarial pair that could still be located in this snapshot (some, like
the exact "Algeria vs Niger" and "Trump-AI-map vs Trump-Bombardier" pairs, are from an older/different
corpus snapshot and no longer exist verbatim in the current 5-day window — noted as not reproducible,
not as passing).

| Adversarial pair | Shared countries | Shared actor | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|---|---|
| Jamaica reparations-petition topic vs "UK, France, Canada sanction Israeli settlement goods" story (shares GBR only, the Phase 0c "Jamaica-reparations vs UK-settlement-ban" collision) | GBR | none (mine: no country-as-actor) | reject | reject | reject | reject | reject |
| "Trump posts AI map..." topic vs "Trump offers $5,000 to every American..." story (the classic single-shared-actor-different-event Trump collision) | USA only (topic also has ISL, no overlap) | **Donald Trump** (real named actor, both sides) | reject (sets unequal) | reject (<2 shared) | reject (<2 shared) | **reject** (event_type diplomacy ≠ election — type gate saves it) | **ACCEPT (fails)** |
| "China and Qatar strengthen bilateral ties" topic vs "China's Unity Through Erasure Should Worry Central Asia" story (Phase 0c "China-Qatar vs China-CentralAsia" collision) | CHN only | none (mine: no country-as-actor) | reject | reject | reject | reject | reject |

**With GOOD tags, R1/R2/R3 correctly reject every adversarial case that could be reproduced, and — new
this phase — R4 ALSO now correctly rejects the Trump collision**, because `event_type` is now an exact
match on a shared 11-value vocabulary (diplomacy ≠ election) rather than Phase 0c's coarse axis mapping
that let two different-but-axis-adjacent categories slip through. **Only R5 (the no-type-gate rule)
still reproduces the Trump collision** — confirming Phase 0c's finding that a bare
`country + actor` conjunction without a type gate is not safe, but showing that **adding the type gate
(R4) now works as intended once actors are genuine**, unlike Phase 0c where R4 failed on this same case
because the actor signal was fake (a country pretending to be an actor) and the axis mapping was too
coarse to catch the mismatch.

## 8. COMBINED TIER: URL-exact ∪ best zero-FP fingerprint rule (R3)

- URL-exact tier (Phase 0, unchanged): 52/164 (31.7%), 0 confirmed FP.
- R3 fingerprint-only incremental (this phase, GOOD tags): +6/164 (+3.7 pts), 0 confirmed FP (6/6
  hand-labeled TRUE).
- **Combined URL ∪ R3: 58/164 (35.4%), still 0 confirmed false positives** — the union is safe because
  R3 was only applied to topics with `url_tier1 == null` (no double-counting/conflict), and R3's FP rate
  independently measured at 0% on its own fingerprint-only population.

For comparison, the incremental coverage of the other 4 rules if the FP bar were relaxed: R1 would add
+18 (but at 33% FP), R4 +11 (9% FP), R2 +8 (13% FP), R5 +6 (17% FP) — all rejected by the 0-FP gate.

## 9. VERDICT

**(a) Does any fingerprint rule reach 0 hand-labeled FP with good tags?** **Yes — R3** (≥2 shared
countries + ≥1 shared actor, actor required to be a genuine named entity under the "never a country"
tagging rule, no type gate needed). This is a qualitative change from Phase 0c's 17% floor (best rule,
still nonzero) — confirming Phase 0c's own diagnosis that the actor-extraction method, not the rule
concept, was the blocker. Incremental coverage over the 31.7% URL tier: **+6/164 (+3.7 points)**.
**Combined tier1 ∪ R3 total: 58/164 (35.4%)**, still 0 confirmed FP. As a secondary finding: R4 (the
type-gated actor rule) also now correctly rejects the Trump-collision adversarial case that it failed on
in Phase 0c (§7), though it still has 1 confirmed FP (9.1%) in the general hand-labeled sample (#27,
Germany/Merz), so R4 does **not** clear the 0-FP bar on the full population even though it behaves
correctly on the specific adversarial regression tests — R3 remains the only rule that is both
adversarial-safe and 0-FP on the general sample.

**(b) Calibration agreement rate — how trustworthy is this backfill as a predictor of the real
production-tag result?** Measured against the 9 `latest`-topic events that already carry real
production tags: **iso3 exact-set 88.9% (8/9)**, **iso3 any-overlap 100% (9/9)**, **event_type exact
77.8% (7/9)**, **actor overlap 66.7% (6/9)**. Country tagging is highly reliable; event_type is decent;
actor tagging is the weakest link, and specifically **weak in the conservative direction** — my
headline-only proxy under-detects actors that production catches from full article bodies, meaning R3's
true real-world coverage is more likely to be *higher* than measured here than lower. Net: **this proxy
is a promising but not certain predictor** — high confidence on the country dimension that dominates R1/
R2, moderate confidence on the actor dimension that R3 depends on.

**(c) Recommendation: confirm on ~1 week of real production tags before shipping, but this is a clear
PASS, not a dead end.** This Sonnet-tagged backfill is a **PROXY**, and per the pre-committed framing:
a PASS here means "promising, confirm on real tags" — not "ship immediately on backfilled data." The
concrete recommendation:

1. **Do not ship a fingerprint tier from this backfilled measurement alone.** It is LLM-simulated data,
   not the real deployed classifier's output, and the calibration check (§5) shows real disagreement on
   the actor dimension specifically — the dimension R3 depends on most.
2. **Let the ~1 week of real Phase 1b tagged production data accumulate** (per the plan's original
   gate), then re-run this exact same R1-R5 ladder + hand-labeling protocol against genuine
   `newsInvokeGemini`/`newsSituationIngest` output. If R3's 0-FP result reproduces on real tags at
   comparable or better coverage (it plausibly will be *higher* coverage given §5's finding that this
   proxy under-detects actors), **ship the URL ∪ R3 combined tier** — a safe, if modest, ~35%+ linking
   improvement over URL-only.
3. If real-tag R3 shows any confirmed false positive, treat it the same as Phase 0c treated R3's 17%: a
   near-miss, not a total failure — but do not ship, and consider a stricter actor-normalization pass
   (case/synonym folding across storyId churn, per the widened-join caution in Phase 0b) before
   retrying.
4. This is explicitly **not a "dead" verdict** — unlike Phase 0c, where R1-R5 all failed regardless of
   which tags were used, this phase demonstrates the two-subject fingerprint concept **does work exactly
   as hypothesized once real named-actor tags exist**, and Phase 1b already deployed the tag emission
   needed to test it for real. The only reason not to ship today is that today's tags in this
   measurement are a Sonnet proxy, not the actual deployed classifier's output — a confirmability gap,
   not a design flaw.

## Files (this measurement)

- `extract_condensed.py` — builds condensed topic/story JSON (title + up to 6 related headlines) for
  tagging, reusing Phase 0c's raw re-extraction.
- `topics_chunk_{0,1}.json`, `stories_chunk_{0-7}.json` — input chunks handed to 10 parallel Sonnet fork
  agents (2 topic-taggers @ 82 items, 8 story-taggers @ 99 items).
- `topics_tags_{0,1}.json`, `stories_tags_{0-7}.json` — raw per-chunk tagger output.
- `topic_tags_merged.json` (164 entries), `story_tags_merged.json` (792 entries) — merged + validated
  (100% coverage, 100% valid `event_type` enum values).
- `build_and_match.py` — builds GOOD-tag fingerprints, reruns URL-tier1 sanity check, runs the R1-R5
  ladder with exact `event_type` equality, computes incremental coverage + recall-on-knowns, extracts
  the fingerprint-only union for hand-labeling.
- `handlabel_worksheet.json` — the 29 fingerprint-only pairs with topic/story titles, shared
  countries/actors, and rule provenance (hand-labeled in §6 above).
- `summary_d.json`, `rule_results_d.json`, `topic_fingerprints_d.json`, `story_fingerprints_d.json` —
  derived outputs.
- `latest_live.json` — raw `aws dynamodb get-item` pull of `NewsCache#latest` (real production tags,
  read-only, used only for §5's calibration check).
- `live_latest_topics_tagged.json` — the 16 live topics' real `iso3`/`actors`/`event_type`, extracted
  from `latest_live.json`.
- Hand-labeling (§6, §7) done by direct reading of topic titles + source titles vs. story titles +
  headlines, no LLM/model judgment beyond the tagging step itself feeding into deterministic rule logic.
