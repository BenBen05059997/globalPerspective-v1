# Live-score severity flags — 2026-09-15

**Provenance:** flagged by Sonnet per `project-docs/architecture/SEVERITY_CODEBOOK.md` incl. §2.5
operator rulings; advisory audit of served scores — no data was modified. Read-only DDB scan of
`SummarizeAndPredict`, region ap-northeast-1, run 2026-09-15.

**Scope:** every `COUNTRY#<name>` / `COUNTRY_INTELLIGENCE` record and every `THREAD#<id>` /
`THREAD_ANALYSIS` record currently carrying a `dimensions` field — i.e. every severity score a
reader can currently see on the live site. Country records are 09-12/09-13 vintage (generation is
paused) but are still what is being served.

---

## 1. Summary

| Metric | Count |
|---|---|
| Records audited | 64 (36 country + 28 thread) |
| Records with ≥1 flag | 51 (26 country + 25 thread) |
| Records with zero flags (clean) | 13 |

**Flags by type**

| Type | Count | Notes |
|---|---|---|
| SCOPE-VIOLATION | 25 | Almost entirely the political axis scoring war/sanctions/diplomatic/alliance content that belongs to conflict or no axis at all (§2.5.1/§2.5.2); one conflict-axis case (a disease outbreak scored as armed conflict) |
| NULL-VIOLATION | 17 | 8 are literal `0` used for "no signal" (should be `null` per §2 — all on thread records); the rest are scored axes whose own `why` text explicitly concedes no institutional signal exists |
| INFLATED | ~19 | Real signal exists but the band is overstated, typically political axis treating ordinary governance friction, disaster-response criticism, or litigation as an institutional-legitimacy crisis |
| DEFLATED | 0 | No cases found where the live score understates the narrative — the bias runs one direction, confirming the 2026-09-15 baseline's finding |

**Flags by axis**

| Axis | Flags |
|---|---|
| Political | ~58 (the overwhelming majority — nearly every record with a `dimensions` field has a political-axis issue) |
| Conflict | 3 (Uganda country: Ebola cited to justify a conflict score; 2 thread `0`-not-`null` cases) |
| Economic | 2 (Venezuela, Australia — both cite *future/speculative* risk, which §2.5.3 rules out of severity) |
| Humanitarian | 2 (thread `0`-not-`null` cases) |

**Records whose reader-facing WORST-AXIS band would drop if corrected: 3 of 64**

| Record | Live worst-axis band | Corrected worst-axis band |
|---|---|---|
| `COUNTRY#France` | Elevated (political 55) | Moderate (~45, via humanitarian/economic) |
| `THREAD#thread-us-senate-confirms-jay-clayton` | High (political 80) | Elevated (~60-74, via humanitarian) |
| `THREAD#thread-uefa-members-agree-to-boycott` | Elevated (political 70) | Moderate (~40, via economic) |

Most other flagged records don't move the reader-facing tier because a different axis (usually
conflict or humanitarian) already legitimately sits in the same or a higher band — the political
score is still wrong and still misrepresents *why* the record is risky, it just isn't currently the
thing keeping the tier where it is. The exceptions above are records where political inflation is
the *only* thing holding up the tier.

---

## 2. Full per-flag list, grouped by record (worst offenders first)

### Top-tier offenders (headline tier would drop, or an exact repeat of an operator-adjudicated case)

**`THREAD#thread-uefa-members-agree-to-boycott--a56425`** — political 70 (Elevated) → my band: Low (<25)
— **SCOPE-VIOLATION, exact repeat of an already-adjudicated case.** This is the FIFA/UEFA
leadership-crisis thread the operator explicitly ruled "political low, not elevated" in the
2026-09-15 baseline (§2.5.1 worked example #1). It is still live with the same score. Reason: a
sports federation's internal no-confidence/leadership dispute is not a state's institutional
stability. **Also:** conflict = 0 should be `null` (thread contains zero conflict content).
Correcting drops the record's worst-axis tier from **Elevated to Moderate** (via economic 40).

**`COUNTRY#France`** — political 55 (Elevated) → my band: Moderate (~40-45)
— INFLATED. Why-cited facts are a firefighters' strike over funding and a labor dispute over Eiffel
Tower staffing — real but matches the "sustained protests, some arrests, no serious violence" /
fracturing-coalition moderate anchor (§4.2), not a legitimacy crisis. This is the sole axis holding
the record at Elevated; correcting drops the whole record to **Moderate**.

**`THREAD#thread-us-senate-confirms-jay-clayton-ee8346`** — political 80 (High) → my band: Elevated (~65-74)
— INFLATED. Cited facts (falling approval rating, adverse court rulings, a visa-policy loss) are
real institutional friction but not "institutional collapse or a direct challenge to governing
authority" (§4.2 High anchor) — no coup, no government falling, no martial law. Correcting drops
the record's worst-axis tier from **High to Elevated**.

**`COUNTRY#Venezuela`** — political 98 (High, near-ceiling) → my band: Elevated (~60-74)
— INFLATED, largest single-axis point gap found (~25-35 points). Why cites the ICC withdrawal
(a diplomatic/international-legal act, not domestic institutional collapse) and "widely criticized
disaster response" (real, but public anger + blame-deflection is a legitimacy *strain*, not the
§4.2 High anchor of institutional collapse/coup/martial law). **Also:** economic 85 (High) →
my band: Elevated — the why text justifies part of the score on "high probability of new
international sanctions," a future-likelihood claim explicitly excluded from severity scoring by
§2.5.3. Doesn't change the record's worst axis (humanitarian 98, correctly High, is untouched) but
is the single most inflated number in the dataset.

**`THREAD#thread-four-palestinians-and-two-isra-645ff1`** — political 85 (High) → my band: null or Low
— SCOPE-VIOLATION, clean double-stamp. Every cited fact (Al-Aqsa prayer access, settlement
re-establishment, a minister's incitement, "nightly killings" rhetoric) is occupation/conflict
conduct already scored at conflict = 80. §2.5.2 explicitly bars re-scoring the same war content
into political. Doesn't change the worst axis (conflict 80 is independently High) but is one of the
cleanest violations in the set.

**`THREAD#thread-us-and-iran-trade-strikes-in-g-aaa65e`** — political 80 (High) → my band: null
— SCOPE-VIOLATION. Every cited fact (stalled peace talks, Trump's Hormuz-annexation rhetoric,
Iran's rejection of US demands, warnings to Gulf states) is interstate diplomacy/war conduct
already captured by conflict = 85. No domestic-institutional fact for any specific polity is cited.

**`COUNTRY#Israel`** — political 85 (High) → my band: null
— SCOPE-VIOLATION. Every cited fact (Turkey's Interpol request, Western sanctions/trade bans,
US rejecting an Israeli proposal) is *international pressure on* Israel — the exact pattern §2.5.1
rules out ("international pressure... is not political risk"). No domestic Israeli
institutional-legitimacy fact (coalition collapse, mass domestic protest, etc.) is cited.

### Clear SCOPE-VIOLATIONS (political axis scoring diplomacy/war/alliance content)

- **`COUNTRY#Japan`** pol 55→null: Yasukuni Shrine visit "straining institutional diplomacy" is foreign relations, not Japan's own institutions (§2.5.1).
- **`COUNTRY#Yemen`** pol 68→null: why explicitly cites Houthi *military* pressure and US-Iran/Saudi dynamics — a war story double-stamped into political per §2.5.2.
- **`COUNTRY#South Korea`** pol 45→low/null: bulk of the why is Yasukuni/China diplomatic friction; domestic component (pushback on a peace proposal) is thin.
- **`COUNTRY#Canada`** pol 55→low: this IS the operator's own worked example (§2.5.1 #3, "external pressure is not internal instability") — Trump's annexation-map rhetoric and the US-Canada trade war are exactly the excluded pattern. Live score is unchanged since the ruling.
- **`COUNTRY#North Korea`** pol 55→null: "competing diplomatic tracks" (Trump summit push, Russia bridge) is foreign-policy activity, not domestic institutional instability.
- **`COUNTRY#Morocco`** pol 45→null: score is justified purely by "straining diplomatic relations between Morocco and Spain" — interstate friction, not domestic crisis.
- **`COUNTRY#Global`** pol 45→low: same FIFA/Infantino leadership dispute as the UEFA thread above — a sports-federation crisis, ruled low by the operator, still scored moderate here.
- **`COUNTRY#Middle East`** pol 68→null: why cites IAEA inspections and "US domestic political pressure over diesel prices" — an international-governance dispute and a thin economic-adjacent claim, no domestic-institutional fact for any named polity.
- **`COUNTRY#Palestine`** pol 70→moderate: why leans on "Kushner-Hamas diplomatic track and European sanctions," both external; some genuine PA-governance-fragmentation signal exists but doesn't support Elevated on its own.
- **`COUNTRY#Uganda`** conflict 35→null (different axis, same species of error): why cites the Ebola outbreak status as a *conflict*-axis justification. A disease outbreak is not armed violence; this belongs to humanitarian (already scored 65), not conflict.
- **`THREAD#thread-trump-says-iran-shot-down-us-a-7ed4a3`** pol 60→null: "unraveling ceasefire" and Doha talks are the war's diplomacy, already captured by conflict 75.
- **`THREAD#thread-north-korea-fires-ballistic-mi-0a0152`** pol 60→null: Trump's unilateral scaling-back of joint drills with Seoul is alliance management, not either country's domestic instability.
- **`THREAD#thread-nepal-flood-disaster-hundreds--be260e`** pol 60→null: a national day of mourning, demands for international climate compensation, and China's opacity about its own casualties are not Nepal's institutional instability.
- **`THREAD#thread-russian-missile-strike-kills-1-a524d2`** pol 70→null: Poland/NATO's reaction to a stray missile is the war's fallout, already at conflict 90.
- **`THREAD#thread-trump-envoys-witkoff-and-kushn-4fd28e`** pol 65→null: US-Russia-Ukraine shuttle diplomacy is not any one country's domestic instability.
- **`THREAD#thread-ukrainian-drones-strike-st-pet-b69cc4`** pol 65→null: NATO air-defense diplomacy around the war, already at conflict 90.
- **`THREAD#thread-thousands-of-migrants-swim-fro-d0a8f5`** pol 70→null/low: a Spain-Italy border-control spat and "EU divisions" are interstate friction, not one country's institutional collapse.
- **`THREAD#thread-us-diesel-prices-hit-all-time--0fefc7`** pol 70→null: Iran's naval threats toward Gulf states are war/diplomacy content, already at conflict 90.
- **`THREAD#thread-france-bans-israeli-minister-s-7759f6`** pol 65→null: US policy guidance to Israel on Gaza reconstruction is diplomacy about the war, already at conflict 90/humanitarian 95.
- **`THREAD#thread-trump-administration-to-ban-ne-8e044c`** pol 65→null: AI-safety meetings, a lawsuit, and export-control policy are government *functioning*, not institutional instability — also conflict = 0 should be `null` (no conflict content at all in this thread).

### Clear NULL-VIOLATIONS (score assigned where the record's own `why` text, or the narrative, gives no signal)

- **`COUNTRY#Saudi Arabia`** pol 45 — the `why` field literally states the defence pact "does not indicate domestic institutional instability," then scores 45 anyway. Should be `null`.
- **`COUNTRY#Democratic Republic of the Congo`** pol 45 — `why` states "no direct political instability is reported in the coverage," then scores 45. Should be `null`.
- **`COUNTRY#Oman`** pol 35 — `why` states "Oman's domestic political stability remains intact," then scores 35 for its mediator role (which is diplomacy, not instability). Should be `null`.
- **`COUNTRY#Australia`** pol 25 — `why` states the new centrist party "signals political realignment but no institutional instability," then scores 25. Should be `null`.
- **`THREAD#thread-super-typhoon-bavi-approaches--8f05c6`** pol 55 — `why` explicitly says government coordination shows "significant political attention... but not instability," then scores 55 (Elevated boundary). Should be `null`. Also conflict = 0 should be `null` (no conflict content).
- **`THREAD#thread-wildfires-in-france-and-spain--2d942e`** pol 50 — `why` says crisis-cabinet meetings show "government engagement and concern, but not instability," then scores 50. Should be `null`.
- **`THREAD#thread-johnson-johnson-offers-up-to-5-2f2417`** pol 60 — courts and legislatures processing corporate lawsuits/fines is the system functioning as designed, not institutional instability. Should be `null` or Low.
- **`THREAD#thread-us-judge-strikes-down-trump-po-4f91a6`** conflict = 0 and humanitarian = 0 — both `why` fields state plainly there is no signal ("no reports of..."). Textbook §2 null-rule violation: should be `null`, not `0`.
- **`THREAD#thread-anthropic-files-for-us-ipo-pla-417c5a`** conflict = 0, humanitarian = 0 (same pattern — both `why` fields say "no [X] reported"). Also political = 40 is thin (AI export-policy shifts + a personal crypto-earnings story, no institutional-crisis fact) — should be `null` or Low.
- **`THREAD#thread-two-major-earthquakes-in-venez-5a7954`** conflict = 0 — `why` says "no armed violence... mentioned." Should be `null`.

### INFLATED (real signal, band overstated)

- **`COUNTRY#Iran`** pol 85→~65-74: genuine domestic signal (internal factional fighting over war strategy under a new, injured Supreme Leader) supports Elevated, not High — no institutional collapse is described.
- **`COUNTRY#Germany`** pol 70→~35-45: an AfD state-election win and inter-party sniping is the §4.2 Moderate anchor ("fracturing coalition"), not a legitimacy crisis.
- **`COUNTRY#South Africa`** pol 55→~35-40: the police-corruption scandal is real domestic signal but modest; the "diplomatic rows with African neighbors" half of the justification is external and shouldn't count.
- **`COUNTRY#United Kingdom`** pol 62→~35-45: a funding scandal for an opposition party, one bill's defeat, and protests is Moderate-anchor material, not Elevated.
- **`COUNTRY#Ukraine`** pol 78→~65-74: a corruption probe and a PM succession are real but don't reach "institutional collapse."
- **`COUNTRY#Europe`** pol 58→~35-45: an election result "signaling realignment" plus a stable government's "longevity" (which is the opposite of instability) is thin support for Elevated.
- **`COUNTRY#Americas`** pol 60→~35-45: a Supreme Court appeal on voting procedure is real; a "US dissent on a UN world map vote" cited as institutional-stress evidence is not a signal at all.
- **`COUNTRY#Africa`** pol 55→~35-45: Gambia's blackout protests are real domestic signal but modest; Kenya's routine bill-signing and a UN map vote add no weight.
- **`COUNTRY#US`** pol 70→~45-49: falling approval and adverse court rulings are real but Moderate-anchor ("meaningful institutional strain without a legitimacy crisis"), not Elevated.
- **`COUNTRY#Oman`** conflict 72→~50-55: Oman is the mediator/adjacent party, not a combatant; "adjacent to active conflict" doesn't reach the Elevated/High anchors of sustained fighting or state-on-state engagement involving Oman itself.
- **`COUNTRY#Australia`** economic 50→~20-25: the why cites a $26B *export windfall* (positive) offset by "potential" bird-flu trade disruption — a future-hypothetical, excluded by §2.5.3; net signal is closer to Low.
- **`THREAD#thread-el-nino-turbocharging-climate--5547ec`** pol 65→~35-45: criticism of France's heatwave-housing policy and AC-shortage scuffles is Moderate-anchor material.
- **`THREAD#thread-ebola-outbreak-in-drc-is-faste-f8f31c`** pol 65→~35-45: a healthcare-worker pay strike is real institutional strain but Moderate, not Elevated.
- **`THREAD#thread-us-and-iran-exchange-strikes-i-19ebab`** pol 70→~35-49: Beirut protests and questions about Lebanon's enforcement capacity are a real but modest signal, entangled with war content already scored at conflict 90.
- **`THREAD#thread-two-major-earthquakes-in-venez-5a7954`** pol 75→~50-65: public anger and blame-deflection over disaster response is real (Elevated-anchor "legitimacy crisis" material) but doesn't reach the High-anchor "institutional collapse" bar. Notably, the country-level Venezuela record scores the *same underlying facts* at 98 — a ~25-point internal inconsistency between two records describing the identical event.
- **`THREAD#thread-us-judge-orders-meta-pay-56-fa7b45`** pol 60→~35-45: reduced civil-rights enforcement is a real, legitimate political-axis signal, but immigration-policy news and a tech trial pad the score past what the domestic-institutional fact alone supports.

### Milder / partial flags (noted, lower confidence)

- **`COUNTRY#Turkey`** pol 55: the PKK peace-process law is real domestic signal; the Interpol/Netanyahu half of the justification is external and shouldn't count toward the score, though the domestic component alone may still support a Moderate-to-Elevated score.
- **`COUNTRY#China`** pol 70: Hong Kong NSL sentencing is legitimate domestic-institutional signal (Beijing's own control mechanism); Taiwan-visit diplomatic protests are external padding, but the domestic component is substantial enough that this is a lower-confidence flag than the others above.
- **`COUNTRY#Asia`** and **`COUNTRY#Palestine`**: aggregate/regional records blend several countries' domestic and external signals; flagged above where the padding is clear-cut, otherwise left unflagged given the compounding uncertainty of scoring a multi-country rollup.

---

## 3. Most misleading currently-served tiers (top 10)

Ranked by how much the record's political-axis score misrepresents the story even where it doesn't
(yet) flip the headline tier, plus the 3 records where it does:

1. **`THREAD#thread-uefa-members-agree-to-boycott--a56425`** — Elevated tier is *entirely* an unfixed repeat of an operator-adjudicated FIFA/UEFA scope error; corrected tier is Moderate.
2. **`COUNTRY#Venezuela`** — political scored 98/100 (near the ceiling of the entire scale) for an ICC withdrawal + criticized disaster response; no coup, no institutional collapse. Largest raw point-inflation found.
3. **`COUNTRY#France`** — Elevated tier rests entirely on a firefighters' pay strike; corrected tier is Moderate.
4. **`THREAD#thread-us-senate-confirms-jay-clayton-ee8346`** — High tier rests entirely on an approval-rating drop and court losses; corrected tier is Elevated.
5. **`COUNTRY#Israel`** — political scored 85/100 (High) built entirely from *other countries'* sanctions/Interpol actions against it — the clearest textbook §2.5.1 violation in the country set.
6. **`THREAD#thread-four-palestinians-and-two-isra-645ff1`** — political 85/100, a clean double-stamp of conflict content already scored 80.
7. **`THREAD#thread-us-and-iran-trade-strikes-in-g-aaa65e`** — political 80/100, entirely interstate diplomacy/war rhetoric already scored at conflict 85.
8. **`COUNTRY#Canada`** — the operator's own named example, still live unchanged at political 55 (Elevated) months after the ruling.
9. **`COUNTRY#Saudi Arabia`** / **`COUNTRY#Oman`** / **`COUNTRY#Democratic Republic of the Congo`** / **`COUNTRY#Australia`** — four records whose own `why` text states there is no institutional-instability signal, yet each still carries a nonzero political score.
10. **`THREAD#thread-trump-administration-to-ban-ne-8e044c`** — political 65/100 built from AI-safety meetings and a lawsuit (government functioning normally), plus a conflict=0 that should be null.

---

**Net finding:** the political axis is functioning as a de facto "this story involves government,
diplomacy, or a lawsuit" catch-all rather than the domestic-institutional-stability axis the
codebook and the operator's own §2.5.1 rulings define. This is the same defect the 2026-09-15
baseline identified (FIFA, Canada, and the general political-axis pattern) — it is unresolved in
the live data three months later, consistent with generation being paused. The null rule (§2) is
also violated in a recurring, mechanical way: several thread records use `0` where the record's own
`why` text says "no signal," and several country/thread records score a nonzero political value
while their own `why` text explicitly concedes no domestic-institutional fact exists.
