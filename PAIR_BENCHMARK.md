# Pair Intelligence Benchmark
## Phase 1.2 — Target Output for AI Evaluation

**Written:** 2026-04-12
**Revised:** 2026-04-17 (corrected factual errors about war start date and Khamenei succession via live web search)
**Data window:** 2026-03-07 to 2026-04-12 (36 days) — but war actually started 2026-02-28 (pre-data-window)
**Archive entries scanned:** full NewsCache archive, supplemented with live web search

This document is the quality gate for Phase 1.6. Grok output that does not match or beat these benchmarks in specificity, structure, and analytical depth fails the gate. No frontend work begins until this bar is cleared.

---

## 1. Methodology

### What this document is
Two hand-written intelligence briefs — one for a data-rich pair (Iran×Israel, 119 raw entries / 73 deduplicated events) and one for a medium-density pair (US×China, 43 raw / 20 deduplicated). These represent the **ideal published output** a reader should see on the /explore page.

### What this document is NOT
- Not a JSON schema spec (the Lambda's JSON fields should conform to whatever structure produces the best brief, not the other way around)
- Not a comprehensive war diary (the timeline selects pivotal shifts, not every event)
- Not a fact-checked intelligence product (the underlying data is AI-generated news summaries from RSS feeds — some events may be inaccurate)

### How to use it
1. Run the Lambda against the same data window
2. Compare Grok output field-by-field against the benchmark using the scoring rubric (Section 5)
3. If 3+ fields fail, iterate the prompt and re-run
4. If after 5 iterations the output still fails, reconsider the prompt architecture

### Why two benchmarks
- **Iran×Israel** tests: active war, overwhelming data volume, event deduplication, military/nuclear escalation, multi-actor tracking, ceasefire dynamics
- **US×China** tests: non-kinetic rivalry, multiple issue domains (trade, tech, geopolitics), indirect entanglement via third-party conflicts (Iran war), summit diplomacy, how to handle a relationship where most entries are about different sub-topics rather than one continuous story

---

## 2. Data Audit — Iran × Israel

**Raw entries:** 119
**Distinct events (after deduplication):** 73
**Date range:** 2026-03-07 to 2026-04-12
**Source outlets represented:** Al Jazeera, France24, BBC, SCMP, Japan Times, Asia Times, Euronews, Middle East Eye, NPR, Channel News Asia, Bangkok Post, Al-Monitor

### Data window limitation

**IMPORTANT:** Our archive begins on March 7, 2026 — but the war started on **February 28, 2026** with a joint US-Israeli airstrike on Iranian leadership and military targets. Verified via live web search across NPR, Al Jazeera, CNN, NBC, and multiple other outlets. The archive entries from Mar 7 onward already reference "Iran war continues" because the opening week of the war predates our data collection. Any analysis must acknowledge this limitation and use external references (not the first archive entry) to identify the conflict's true starting point.

### Confidence assessment of key claims

| Claim | Source count | Confidence |
|---|---|---|
| War started Feb 28, 2026 with joint US-Israeli airstrike | Web search: NPR, Al Jazeera, CNN, NBC, Fox, JPost, Wikipedia | HIGH — multiple independent international outlets |
| Khamenei killed Feb 28, 2026 in airstrike on his compound | Web search: Iranian state media confirmed Mar 1; Trump + Netanyahu publicly confirmed | HIGH — Iranian state confirmation |
| Mojtaba Khamenei appointed Supreme Leader by Assembly of Experts | Web search: confirmed Mar 8, 2026 | HIGH — succession process completed |
| US is co-belligerent (joint strikes since Feb 28) | 3+ sources (BBC, France24, AJ) in archive + web search confirmation | HIGH |
| Fuel site strikes kill 1,255 civilians (Mar 9) | 1 archive source (AJ) | MEDIUM — single archive source, specific number |
| Larijani + Soleimani killed (Mar 17) | 3 sources (AJ, SCMP, France24) | HIGH |
| Khatib killed, confirmed by President Pezeshkian (Mar 18) | 4 sources (AJ, SCMP, France24, Japan Times) | HIGH — official Iranian confirmation |
| South Pars struck, oil $110 (Mar 18) | 1 (AJ) | MEDIUM |
| Natanz nuclear facility struck (Mar 21) | 2 sources (AJ, France24) | HIGH |
| Iran claims 2 US warplanes downed (Apr 4) | 6 sources (BBC, AJ, France24, Asia Times, Japan Times, NPR) | HIGH for claim; actual event unverified |
| Pakistan-mediated ceasefire (Apr 8) | 4 sources (Asia Times, Japan Times, AJ, SCMP) | HIGH |
| Iran re-closes Hormuz same day (Apr 8) | 2 sources (Euronews, Asia Times) | MEDIUM-HIGH |
| 3 supertankers exit Hormuz (Apr 12) | 2 sources (AJ, France24) | HIGH |

### War phases (derived from event clustering + external grounding)

**Phase 0 — War start (Feb 28 – Mar 6, PRE-DATA-WINDOW):** Joint US-Israeli airstrike on Iranian leadership compound Feb 28 kills Supreme Leader Ali Khamenei along with his daughter, granddaughter, son-in-law, and daughter-in-law. Iranian state media confirms Mar 1; Iran announces 40 days of mourning and 7 days of public holiday. Mojtaba Khamenei appointed Supreme Leader by Assembly of Experts on Mar 8. **This phase is not in our archive — verified via external web search only.**

**Phase 1 — First archive visibility (Mar 7-9):** Archive opens with Israel striking Tehran/Isfahan military targets. US already conducting joint strikes (Tehran oil depots Mar 8). Fuel site strikes kill 1,255 mostly civilians (Mar 9). The "Iran war continues" framing in early entries confirms this is mid-conflict, not the beginning.

**Phase 2 — Decapitation campaign + Hormuz closure (Mar 10-20):** Iran retaliates with missiles on central Israel (Mar 10). Israel expands to Beirut targeting IRGC Quds Force (Mar 11). US destroys 16 mine-laying vessels in Hormuz (Mar 11). Hormuz reaches zero commercial crossings (Mar 16). Israel assassinates Larijani + Soleimani (Mar 17), Khatib (Mar 18), IRGC spokesperson Naini (Mar 20). South Pars gas field struck — oil to $110 (Mar 18). Iran hits Qatar's Ras Laffan LNG in retaliation (Mar 19). Netanyahu claims enrichment capacity destroyed (Mar 19).

**Phase 3 — Nuclear escalation (Mar 21-22):** US-Israel strike Natanz nuclear facility (Mar 21). Iran hits Dimona nuclear town (Mar 21-22). Trump issues 48-hour ultimatum to reopen Hormuz or face strikes on Bushehr (Mar 22).

**Phase 4 — Attrition + diplomatic fracture (Mar 24 - Apr 7):** Daily missile exchanges. Iran rejects US 15-point peace plan (Mar 25). IRGC naval commander Tangsiri killed (Mar 26). Civilian toll nears 2,000 (Mar 27). UNDP estimates $194bn cost to Arab countries (Mar 31). UK convenes 40-country Hormuz talks **excluding the US** (Apr 1-2). Trump primetime speech: continued strikes, no ceasefire (Apr 2). Iran claims 2 US warplanes downed (Apr 4). Hezbollah + Houthis join coordinated strike on Israel (Apr 6). Tehran synagogue destroyed (Apr 7).

**Phase 5 — Fragile ceasefire (Apr 8-present):** Pakistan-mediated 2-week ceasefire announced (Apr 8). Iran re-closes Hormuz hours later citing Israeli strikes on Lebanon as breach (Apr 8). Pope Leo XIV condemns war in Easter address (Apr 11-12). Three supertankers exit Hormuz (Apr 12) — first cargo movement in weeks.

---

## 3. Benchmark A: Iran × Israel (Dense Pair, Active War)

### pairTitle

"US-Backed Israel and Iran in Active War Under Fragile Ceasefire"

### currentState

As of April 12, 2026, Israel and Iran are on day 44 of active military hostilities that began with the February 28 joint US-Israeli airstrike on the Supreme Leader's compound. Both sides are operating under a two-week ceasefire brokered by Pakistan and announced April 8. The agreement is already under strain: Iran re-closed the Strait of Hormuz hours after the ceasefire was declared, citing Israeli strikes on Lebanon as a breach of terms. Three oil supertankers exited the strait on April 12 — the first commercial movement in weeks — but Hormuz has not formally normalized. **[FACT: supertankers exited Apr 12 per AJ and France24. ASSESSMENT: the ceasefire is holding on the direct Iran-Israel axis but Israeli operations in Lebanon continue, which is the tripwire Iran cited for re-closing Hormuz.]**

The United States has been a direct co-belligerent from day one (February 28), conducting joint strikes on the Khamenei compound, Tehran oil depots (Mar 8), Natanz nuclear facility (Mar 21), and Iranian naval assets. US forces destroyed 16 Iranian mine-laying vessels in the Strait of Hormuz (Mar 11) and deployed 3,500+ additional troops including the USS Tripoli amphibious assault ship. Trump delivered a primetime address on April 2 explicitly promising continued aggressive strikes, then reversed course by endorsing the Pakistan-mediated ceasefire on April 8. **[FACT: US co-belligerency confirmed by web search — NPR, Al Jazeera, CNN, NBC. ASSESSMENT: the April 2-to-April 8 reversal from "continued strikes" to ceasefire endorsement is the sharpest US policy pivot in the war — it may reflect either genuine strategic shift or tactical pause driven by the JASSM-ER stockpile depletion reported April 7.]**

Iran's leadership has been reconstituted under **Mojtaba Khamenei**, appointed Supreme Leader by the Assembly of Experts on March 8 following the killing of his father Ayatollah Ali Khamenei on February 28. Iran is also operating without at least four senior security/intelligence officials: security chief Ali Larijani and Basij commander Gholamreza Soleimani were killed March 17 (3 sources); Intelligence Minister Esmail Khatib was killed March 18, confirmed by President Pezeshkian (4 sources); IRGC spokesperson Ali Naini was killed March 20; IRGC naval commander Alireza Tangsiri was killed March 26. Despite this command attrition, Iran has maintained missile capability throughout: strikes on Tel Aviv, Haifa, Dimona, Bnei Brak, Beersheba, and Ramat Hovav continued through April 8. Hezbollah and Houthis joined a coordinated strike on Israel on April 6, indicating Iran's proxy network remains partially operational. **[FACT: Mojtaba Khamenei succession confirmed via web search (Wikipedia, Al Jazeera). ASSESSMENT: Mojtaba Khamenei's authority is not yet tested — his relationship with the IRGC and the Assembly of Experts will determine whether Iran can negotiate a post-ceasefire settlement, and this is the single most important unknown shaping the next 60 days.]**

### timeline

| # | Date | Headline | Significance |
|---|---|---|---|
| 1 | Feb 28 | Joint US-Israeli airstrike kills Supreme Leader Khamenei | War begins. US enters as co-belligerent from day one. Iran loses its constitutionally irreplaceable decision-maker along with four family members. |
| 2 | Mar 8 | Mojtaba Khamenei appointed Supreme Leader by Assembly of Experts | Iran's constitutional succession crisis resolved within 8 days. Mojtaba — son of Ali Khamenei, long-rumored successor — assumes leadership under wartime conditions. His authority is untested. |
| 3 | Mar 16 | Strait of Hormuz records zero commercial crossings | Iran's primary economic leverage activated. Global energy supply disrupted at its most critical chokepoint — 20% of world oil transits Hormuz. |
| 4 | Mar 17-18 | Israel kills Larijani, Soleimani, Khatib in 48 hours; South Pars struck | Three senior officials assassinated in two days gutted Iran's security/intelligence command below the Supreme Leader tier. South Pars strike extended war to Qatar (Iran retaliated on Ras Laffan), dragging Gulf states in. |
| 5 | Mar 21 | US-Israel strike Natanz nuclear facility | The threshold crossing that the nonproliferation regime had spent two decades trying to prevent. Iran retaliated by hitting Dimona. Mutual nuclear infrastructure targeting. |
| 6 | Apr 2 | Trump primetime: "continued strikes"; UK convenes 40-country Hormuz talks excluding US | US confirmed no near-term exit strategy. Simultaneously, allied diplomatic structure fractured — UK-led talks explicitly excluded Washington, the first organized Western opposition to US war posture. |
| 7 | Apr 6-8 | Proxies join + Pakistan-mediated ceasefire + Iran re-closes Hormuz | Hezbollah and Houthis joined coordinated strike on Israel Apr 6, expanding to multi-front conflict. Two days later Pakistan brokered ceasefire, which Iran immediately stressed by re-closing Hormuz after Israeli Lebanon strikes — ceasefire and its first breach in 48 hours. |

### trajectory

**Scenario 1 — Ceasefire collapses within 14 days, war resumes (confidence: MEDIUM-HIGH).** Timeframe: by April 22. The trigger is most likely an Israeli operation in Lebanon, not an Iranian provocation — consistent with the April 8 pattern where Israel's Lebanon strikes caused Iran to re-close Hormuz. Netanyahu's coalition (Ben-Gvir, Smotrich) has a structural interest in continued military operations; a full Lebanon ceasefire is politically untenable for them. If Israel strikes Hezbollah targets, Iran cites breach, Hormuz re-closes, oil spikes above $120, and the diplomatic framework collapses. The US would need to either restrain Israel (unlikely given Trump's track record) or re-enter as a belligerent, further isolating Washington from the UK-led Hormuz coalition.

**Scenario 2 — Fragile ceasefire holds, slowly consolidates into extended pause (confidence: MEDIUM).** Timeframe: ceasefire renewed for 30 days by late April. Pakistan's mediation succeeds because both sides have exhausted specific objectives: Israel has degraded Iran's nuclear infrastructure and command structure; Iran has demonstrated retaliatory reach (Dimona, Tel Aviv, Haifa) and economic leverage (Hormuz). Pezeshkian's government — which confirmed the ceasefire publicly — is the actor with the strongest incentive for a face-saving off-ramp while the IRGC is degraded. The decision point is whether Netanyahu allows Pezeshkian to claim a domestic "win" without another Lebanon escalation. US exhaustion of JASSM-ER stockpile (reported Apr 7) creates a material constraint on US ability to resume operations at March intensity.

**Scenario 3 — Iran suspends IAEA inspections of surviving nuclear sites (confidence: LOW-MEDIUM).** Timeframe: within 60 days (by June 12). Following Natanz strike, interim Iranian leadership faces hardliner pressure to respond with a nuclear posture shift. Full NPT withdrawal is historically inconsistent with Iranian behavior (they use NPT status as a bargaining chip). IAEA inspection suspension is the highest-cost reversible signal available. This scenario accelerates if the ceasefire collapses AND Israel strikes Fordow.

### rootDriver

**Layer 1 — Immediate trigger:** The February 28, 2026 joint US-Israeli airstrike on Supreme Leader Ali Khamenei's compound — killing Khamenei along with his daughter, granddaughter, son-in-law, and daughter-in-law — initiated the war. This was not a strike on a nuclear facility or military target; it was a decapitation strike on the head of state of a nuclear-threshold adversary. US co-belligerency from day one converted what could have been a bilateral exchange into a state-level war involving a nuclear-armed partner providing strike coordination, naval enforcement, and logistics. The follow-on campaign targeting senior IRGC and intelligence leadership (five officials in March) was designed to prevent Iranian strategic coherence — but Mojtaba Khamenei's March 8 succession restored the constitutional chain of command within 8 days, partially negating this objective.

**Layer 2 — Medium-term condition:** Iran's deterrence posture collapsed after the April 2024 bilateral exchange, in which both sides conducted restraint-limited strikes without full escalation. Iran concluded Israel would show restraint against proxy deterrence; Israel concluded Iran's air defenses were penetrable and US political constraints were loosening under Trump. The proxy architecture (Hezbollah, Houthis, Iraqi militia) that was Iran's strategic depth was progressively attrited through 2024-2025, reducing the cost Iran could impose below the threshold that would deter a direct Israeli campaign.

**Layer 3 — Structural antagonism (1979-present):** Iran's state ideology designates Israel's existence as illegitimate. Israel's security doctrine requires that no regional power acquire nuclear capability that threatens its existence. These are not negotiating positions — they are foundational commitments neither government can abandon without regime-threatening domestic consequences. The current war has temporarily degraded Iran's capacity but has not altered the structural conflict. Any settlement that does not address Iran's nuclear reconstitution capability and Israel's commitment to preemptive denial will reproduce the same escalation cycle within 5-10 years. The Pakistan-mediated ceasefire addresses the shooting; it does not address the structure.

### predictions

| # | Claim | Timeframe | Confidence | Mechanism |
|---|---|---|---|---|
| 1 | The April 8 ceasefire will not survive its two-week term; Israel will conduct at least one strike on Hezbollah targets in Lebanon before April 22 | By April 22 | MEDIUM-HIGH (Netanyahu coalition dynamics) | Ben-Gvir and Smotrich pressure Netanyahu to resume Lebanon operations; a Hezbollah rocket on northern Israel — likely regardless of the Iran ceasefire — triggers Israeli response; Iran cites breach |
| 2 | Oil will remain above $100/barrel through end of April regardless of ceasefire status | Through April 30 | HIGH (structural supply disruption) | South Pars strikes reduced Iranian gas output; Hormuz only partially reopened; $194bn Arab-country damage means supply-chain disruption is structural, not just a fear premium |
| 3 | Mojtaba Khamenei will consolidate authority over IRGC and Assembly of Experts within 60 days — measured by him (not Pezeshkian) making the next major public statement on ceasefire or nuclear posture | By June 16 | MEDIUM (succession installed but authority untested) | Iran's constitutional system puts the Supreme Leader above the president on national security; Mojtaba needs IRGC backing but was installed rapidly under wartime conditions; if Pezeshkian continues to be the primary public face on ceasefire issues, it signals Mojtaba's authority is weaker than his father's and Iran's negotiating posture is unsettled |
| 4 | Pakistan will fail to secure a ceasefire extension and will reduce its mediator role by mid-May | By May 15 | LOW-MEDIUM (Pakistan lacks US backing) | If Israel resumes Lebanon operations and the US does not restrain Netanyahu, Pakistan cannot deliver compliance; domestic politics (army-ISI dominance, IMF dependency) make sustained high-profile mediation unsustainable without results |
| 5 | The US will not resume strikes at March intensity even if the ceasefire collapses, due to JASSM-ER stockpile depletion | Within 60 days | MEDIUM (material constraint) | JASSM-ER diversion to Iran war reported Apr 7; reconstitution timelines for precision munitions are measured in months, not weeks; this limits US operational tempo independent of political will |

### watchItems

| Actor | Indicator | Why |
|---|---|---|
| Mojtaba Khamenei | First major public address or fatwa on the war / ceasefire / nuclear posture | Installed Mar 8 under wartime conditions; his first substantive public intervention will reveal whether he has actual authority or is a figurehead while Pezeshkian and the IRGC negotiate bilaterally |
| Netanyahu coalition (Ben-Gvir, Smotrich) | Public statements demanding Lebanon operations resume, or threats to collapse government | These ministers are the primary constraint on Israeli ceasefire compliance; coalition threats signal imminent breach |
| Strait of Hormuz commercial traffic | Daily crossing count returning toward pre-war baseline (~60 vessels/day) | Three supertankers on Apr 12 is far below normal; sustained double-digit daily traffic = genuine ceasefire, not performative |
| IAEA Board of Governors | Emergency session called; Iranian IAEA access status changes | Signals Iran has moved to nuclear posture shift; triggers EU/UK sanctions escalation mechanism |
| Pezeshkian government | Official public statement proposing ceasefire extension or direct talks | Most pragmatic actor in Tehran; public de-escalation from his office (not IRGC) = civilian government retains leverage |
| US JASSM-ER production line (Lockheed Martin) | DOD emergency production orders or supplemental appropriations requests | Signals whether US can materially sustain resumed operations; absence = US is constrained regardless of rhetoric |

---

## 4. Benchmark B: US × China (Medium Pair, Rivalry/Competition)

**Raw entries:** 43 | **Distinct events:** 20 | **Date range:** 2026-03-12 to 2026-04-12

### Data audit

Unlike Iran×Israel (one continuous war story), the US-China data splits into **four parallel sub-domains**:

1. **Trade/summit diplomacy** (8 events): Section 301 investigations → Paris trade talks → Trump demands China send warships to Hormuz → Xi summit delayed → rescheduled for May 14-15
2. **Technology competition** (4 events): AI chip smuggling charges, AI policy framework, FCC China telecom crackdown, DUV lithography access bill
3. **Iran war entanglement** (5 events): Trump demands China send warships to Hormuz, China ignores, China-Pakistan mediation pledge, Russia-China UNSC veto on Hormuz, US diverts JASSM-ER stockpile risking China deterrence
4. **Geopolitical maneuvering** (3 events): US assesses no Taiwan attack in 2027, China R&D spending overtakes US, China-Russia-Cuba solidarity

This is a fundamentally different analytical challenge than Iran×Israel. The AI must synthesize across sub-domains, not narrate a single escalation arc.

### pairTitle

"US-China Rivalry Reshaped by Iran War as Tech Competition Accelerates"

### currentState

As of April 12, 2026, the US-China relationship is being reshaped by two concurrent dynamics: the Iran war's indirect effects on bilateral diplomacy, and an accelerating technology competition that is advancing independently of the war.

The Iran war has injected the US-China relationship with new friction and new interdependence simultaneously. Trump's March 16 demand that China send warships to secure the Strait of Hormuz was a radical departure from decades of US policy keeping China out of Middle East security operations. China ignored the demand and called for de-escalation (Mar 17), but the episode revealed that the US — stretched by its Iran co-belligerency — needs Chinese cooperation on energy security in a way it never has before. Trump delayed the Xi summit over this dispute, then rescheduled it for May 14-15 (confirmed Mar 26). Meanwhile, China pledged "strategic coordination" with Pakistan on Iran mediation (Mar 31), and Russia-China jointly vetoed a UNSC Hormuz resolution (Apr 7) — positioning Beijing as simultaneously a mediator partner and a blocker of US-led multilateral frameworks. **[FACT: summit confirmed for May 14-15 per 2 sources. ASSESSMENT: the Hormuz warship demand was either a genuine attempt to entangle China in Middle East security or a deliberate provocation to justify summit delay — either way, it redrew the boundary of what the US asks from China.]**

On the technology front, the competition is intensifying on a separate track from the war. The US filed Section 301 trade investigations against China and 15 other economies (Mar 12). Three men were charged with smuggling billions in AI chips to China (Mar 20). The FCC deepened its crackdown on Chinese telecoms, risking their exit from the US market (Apr 10). Bipartisan lawmakers introduced legislation to block China's access to DUV lithography equipment, parts, and maintenance (Apr 10-11) — extending the semiconductor chokepoint strategy from EUV to the less advanced DUV tier. Meanwhile, China's R&D spending overtook the US ($1.03T vs $1.01T per OECD, reported Apr 6), and Chinese battery makers announced 600+ GWh of new energy storage capacity (Apr 9). **[FACT: R&D overtake per OECD, 3 sources. ASSESSMENT: the DUV bill is the most significant new escalation — EUV restrictions were expected, but extending to DUV signals intent to constrain China's entire mature-node semiconductor capacity, not just cutting-edge chips.]**

The single most strategically significant data point may be the one that received the least attention: a US intelligence assessment that China is "not planning a Taiwan attack in 2027" and seeks "control without force" (Mar 18, 2 sources). If accurate, this recalibrates the primary strategic risk in the relationship — the Taiwan timeline may be longer than Washington's planning assumption, which affects everything from AUKUS deployments to semiconductor stockpiling.

### timeline

| # | Date | Headline | Significance |
|---|---|---|---|
| 1 | Mar 12 | US launches Section 301 investigations against China and 15 others | Trade offensive broadened beyond bilateral tariffs to formal investigative framework. Signals sustained legal-bureaucratic pressure independent of summit diplomacy. |
| 2 | Mar 16-17 | Trump demands China send warships to Hormuz; China refuses | US asked China to do something unprecedented in the bilateral relationship: participate in Middle East security operations. China's refusal, framed as "de-escalation," established that Beijing will not be drawn into US military operations even at a strategic chokepoint. |
| 3 | Mar 18 | US assesses China not planning Taiwan attack in 2027 | Quietly the most important intelligence data point in 36 days. If accurate, recalibrates the strategic planning timeline driving AUKUS, chip stockpiling, and US force posture in the Pacific. |
| 4 | Mar 26 | Xi-Trump summit confirmed for May 14-15 | After weeks of cancellation threats, both sides committed to a date. The summit's success or failure will set the tone for the remainder of 2026 bilateral relations. |
| 5 | Apr 6-7 | China R&D overtakes US; Russia-China veto UNSC Hormuz resolution | Quantitative milestone in tech competition + diplomatic signal that China will block US-led multilateral pressure on Iran. These are unrelated events but together show China competing and opposing the US on two distinct fronts simultaneously. |
| 6 | Apr 10-11 | DUV lithography bill + FCC telecom crackdown | Tech decoupling extended from cutting-edge (EUV) to mature (DUV) semiconductor equipment. FCC action risks Chinese telecom exit from US market entirely. This is a qualitative escalation in the scope of tech restrictions. |

### trajectory

**Scenario 1 — May summit produces a limited deal; structural competition continues (confidence: MEDIUM-HIGH).** Both sides need the summit to succeed for domestic reasons: Trump wants a "win" amid the Iran war; Xi wants stability for internal economic restructuring. Most likely outcome is a narrow agreement on tariff pauses or specific trade irritants, with no movement on tech restrictions, Taiwan, or Hormuz. The DUV lithography bill and FCC actions will proceed regardless of summit outcomes because they have bipartisan congressional support independent of executive diplomacy.

**Scenario 2 — Summit collapses over Hormuz/Iran linkage (confidence: LOW-MEDIUM).** If the Iran ceasefire collapses before May 14 and the US needs Chinese Hormuz cooperation, Trump may again condition the summit on Chinese military participation. China will refuse again. In this scenario, the summit is indefinitely postponed, tech restrictions accelerate without diplomatic counterbalance, and the China-Pakistan-Russia alignment on Iran hardens into a formal opposing bloc.

**Scenario 3 — Tech competition drives a discrete decoupling event in semiconductors (confidence: MEDIUM).** The DUV bill, if enacted, would force ASML and Tokyo Electron to choose between US and Chinese markets. This is the scenario where tech competition produces a structural rupture rather than incremental friction. Timeframe: legislative action within 6 months.

### rootDriver

**Layer 1 — Immediate friction:** The Iran war has simultaneously made the US more dependent on Chinese energy cooperation (Hormuz) and more opposed to Chinese diplomatic positioning (UNSC veto, Pakistan mediation). Trump's demand for Chinese warships in the Gulf was the first time the US explicitly asked China to participate in Middle East security — and was refused. The summit delay was the direct consequence.

**Layer 2 — Medium-term condition:** US tech restriction policy has been escalating on a bipartisan, largely autopilot trajectory since 2022 (CHIPS Act → EUV restrictions → entity list expansion → DUV bill). Each restriction triggers Chinese self-sufficiency investment (R&D spending overtake, battery capacity buildout), which triggers further US concern, creating a self-reinforcing escalation cycle that operates independently of summit diplomacy or presidential relationships.

**Layer 3 — Structural competition:** The US and China are the world's two largest economies competing for dominance in AI, semiconductors, and energy technology. Neither country's political system can accept permanent second-place status in these domains. This is not a negotiable dispute — it is a structural condition that will persist regardless of which leaders are in power, what summits produce, or how the Iran war resolves.

### predictions

| # | Claim | Timeframe | Confidence | Mechanism |
|---|---|---|---|---|
| 1 | The May 14-15 Xi-Trump summit will occur as scheduled and produce a narrow trade agreement but no movement on tech restrictions | By May 16 | MEDIUM-HIGH (both sides need optics) | Trump wants a "deal" headline amid Iran war fatigue; Xi wants stability for economic restructuring; but DUV bill has bipartisan congressional support independent of executive action |
| 2 | The DUV lithography bill will advance past committee within 6 months | By October 2026 | MEDIUM (bipartisan support + industry lobbying counterpressure) | ASML and Tokyo Electron will lobby against it; but the bill's sponsors include members from both parties, and the semiconductor security framing has been politically durable |
| 3 | China will announce at least one major semiconductor self-sufficiency milestone by Q3 2026 | By September 2026 | HIGH (investment trajectory) | China's R&D spending overtook the US; 600+ GWh battery announcements show the investment machine is running; SMIC and CXMT are the firms most likely to claim process-node breakthroughs |
| 4 | US will not divert additional Pacific-theater assets to Iran if ceasefire collapses, to avoid further weakening China deterrence posture | Within 60 days | MEDIUM (strategic constraint) | JASSM-ER diversion already reported; US Pacific Command will resist further drawdowns given the Taiwan intelligence assessment |

### watchItems

| Actor | Indicator | Why |
|---|---|---|
| ASML (Netherlands) | Public response to DUV bill; any preemptive China service contract changes | ASML's compliance decisions determine whether tech decoupling is gradual (service contracts wind down) or abrupt (immediate DUV access cutoff) |
| US Pacific Command | Force posture changes; carrier group redeployments from Pacific to Middle East | Signals whether Iran war is consuming China-deterrence resources; absence of redeployment signals the Pacific is being protected |
| Xi Jinping public statements | Any pre-summit reference to Hormuz, Iran mediation, or "multipolar order" framing | Xi's framing of China's Iran role will reveal whether Beijing sees itself as mediator (bridging) or counterbalance (opposing US) |
| SMIC / CXMT | Process-node announcements or ASML equipment order disclosures | Leading indicators of Chinese semiconductor self-sufficiency progress, which determines the long-run effectiveness of US tech restrictions |

---

## 5. Scoring Rubric

Each output field is scored PASS / MARGINAL / FAIL. Three or more FAILs across any benchmark = prompt iteration required.

### pairTitle
- **PASS:** 6-10 words, no colons, captures the current operative relationship state (not just "tensions"), names both actors or the relationship dynamic
- **MARGINAL:** Correct but generic ("Iran-Israel Tensions Rise")
- **FAIL:** Clickbait, vague, or mischaracterizes the situation ("Could This Be the Start of WWIII?")

### currentState
- **PASS:** 2-3 paragraphs. Names specific dates and actors. Distinguishes FACT from ASSESSMENT on at least one non-obvious claim. States current intensity level directly. Mentions the most recent development in the data window.
- **MARGINAL:** Covers the situation but uses hedge language ("tensions could rise", "casualties have been reported") instead of specific claims. Missing FACT/ASSESSMENT labels.
- **FAIL:** Reads like a Wikipedia summary or AP dispatch. No dates. No named actors below head-of-state level. Uses phrases like "the situation remains fluid" or "both sides have suffered losses."

### timeline
- **PASS:** 5-7 entries. Each has a specific date, a headline ≤12 words, and a 1-2 sentence significance statement explaining what threshold was crossed or what option was opened/closed.
- **MARGINAL:** Correct dates but significance statements are descriptive rather than analytical ("fighting continued" instead of "crossed the threshold from bilateral exchange to US co-belligerency").
- **FAIL:** Fewer than 5 entries. Dates are wrong or missing. Significance is just a restatement of the headline. Events are listed chronologically without explaining WHY each was pivotal.

### trajectory
- **PASS:** 2-3 scenarios, each with: (a) a label (most likely first), (b) a specific timeframe, (c) a confidence level (HIGH/MEDIUM/LOW) with stated reason, (d) the named actor whose decision drives it, (e) a specific trigger event, (f) downstream effect.
- **MARGINAL:** Scenarios are present but lack specific timeframes or confidence levels. "Various outcomes are possible" language.
- **FAIL:** Single scenario, or no scenarios. Uses phrases like "the situation could go either way" or "much depends on future developments." No named decision-makers.

### rootDriver
- **PASS:** 2+ paragraphs with three explicit layers: immediate trigger → medium-term enabling condition → long-run structural factor. Each layer names specific actors, events, or structural dynamics.
- **MARGINAL:** Two layers present (immediate + structural) but missing the medium-term condition that connects them.
- **FAIL:** Just restates recent events. No structural analysis. "The conflict has deep historical roots" without naming what those roots are.

### predictions
- **PASS:** 4-5 predictions. Each has: (a) a specific falsifiable claim, (b) a concrete timeframe, (c) a confidence level with parenthetical reasoning, (d) a mechanism naming the actor and the causal chain.
- **MARGINAL:** Predictions are present but mechanisms are vague ("if the situation escalates") or timeframes are absent.
- **FAIL:** Predictions are hedged to be unfalsifiable ("tensions may rise or fall"). No mechanisms. Fewer than 3 predictions.

### watchItems
- **PASS:** 4-6 items. Each names a specific actor/institution, a concrete observable indicator, and explains what it signals for the relationship.
- **MARGINAL:** Actors are named but indicators are vague ("watch for changes in rhetoric").
- **FAIL:** Generic items ("watch the Middle East", "monitor US-China relations"). No specific indicators.

---

## 6. Anti-Patterns

These are concrete examples of what Grok will probably produce wrong on its first attempts. Use these to diagnose prompt failures.

### Anti-pattern 1: Wikipedia Voice
**Bad:** "The Iran-Israel conflict has a long and complex history, with tensions dating back to the 1979 Islamic Revolution. In recent months, military hostilities have escalated significantly."
**Why it fails:** No dates, no named actors, no specific claims. Reads like background material, not intelligence analysis. The reader already knows there's a conflict — they want to know what happened THIS WEEK.
**Fix:** Force the prompt to start from the most recent event and work backward, not from historical context forward.

### Anti-pattern 2: Hedge Soup
**Bad:** "Tensions could potentially rise if either side escalates further. The situation remains fluid and much depends on the decisions of key actors."
**Why it fails:** Every word is designed to be unfalsifiable. "Could potentially" is meaningless. "Remains fluid" is content-free. "Key actors" without naming them is lazy.
**Fix:** Prompt must explicitly prohibit hedge phrases. Require named actors + specific timeframes + confidence labels.

### Anti-pattern 3: Symmetric False Balance
**Bad:** "Both sides have suffered significant losses. Iran has faced devastating airstrikes while Israel has endured missile attacks."
**Why it fails:** Treats an asymmetric situation as symmetric. The data shows Israel conducted a systematic decapitation campaign killing five senior officials; Iran launched missile attacks causing limited casualties. These are not equivalent. False symmetry obscures the actual dynamic.
**Fix:** Prompt should instruct the AI to describe what each side DID, not what each side "experienced."

### Anti-pattern 4: Vague Predictions
**Bad prediction:** "The ceasefire could hold or collapse depending on various factors."
**Why it fails:** Not falsifiable. No timeframe. No mechanism. No confidence level. This is the prediction equivalent of saying nothing.
**Good prediction:** "The April 8 ceasefire will not survive its two-week term; Israel will conduct at least one strike on Hezbollah targets in Lebanon before April 22."

### Anti-pattern 5: Generic Watch Items
**Bad:** "Watch for further escalation in the region."
**Why it fails:** Not actionable. No specific actor, no specific indicator, no explanation of what it signals.
**Good:** "Iran Assembly of Experts — Official session convened, quorum confirmed — Signals succession process has begun; hardliner vs. pragmatist outcome defines Iran's posture for months."

### Anti-pattern 6: Repeating Events as Analysis
**Bad trajectory:** "The conflict has seen airstrikes, missile attacks, and diplomatic efforts. Future developments will depend on whether these continue."
**Why it fails:** This is a summary of what happened, not an analysis of where things are heading. The reader can get event summaries from any news site — they come to this platform for forward-looking assessment.
**Fix:** Prompt must require named scenarios with decision-makers, triggers, and downstream effects.

### Anti-pattern 7: Missing the Structural Question
**Bad rootDriver:** "The immediate cause was Israeli airstrikes on Tehran on March 7, which triggered Iranian retaliation."
**Why it fails:** Only covers Layer 1 (the trigger). Missing the medium-term condition that made escalation possible (deterrence collapse after April 2024 exchange) and the long-run structural antagonism (incompatible security doctrines since 1979). Without these layers, the analysis implies the conflict is situational — just stop the airstrikes and it resolves — rather than structural.
**Fix:** Prompt must explicitly request three layers and penalize one-layer answers.

### Anti-pattern 8: Sub-Domain Blindness (US×China specific)
**Bad:** Treating US-China as if all 20 events are part of one story. They're not — trade, tech, Hormuz, and geopolitics are four parallel tracks. An analysis that narrates them sequentially misses the structural point: these tracks are INDEPENDENTLY escalating and interact in non-obvious ways (e.g., Iran war depletes JASSM-ER stockpile → weakens China deterrence → changes Taiwan calculus).
**Fix:** For non-war pairs, the prompt should instruct the AI to identify sub-domains and analyze how they interact, not just list events chronologically.

---

## 7. Lambda Schema Implications

Based on the benchmarks above, the Lambda's JSON output schema should include these fields:

```json
{
  "pairTitle": "string (6-10 words)",
  "currentState": "string (2-3 paragraphs, FACT/ASSESSMENT labeled)",
  "timeline": [
    { "date": "YYYY-MM-DD", "headline": "string (≤12 words)", "significance": "string (1-2 sentences)" }
  ],
  "trajectory": "string (2-3 paragraphs with labeled scenarios)",
  "rootDriver": "string (2+ paragraphs, three layers)",
  "predictions": [
    { "claim": "string (falsifiable)", "timeframe": "string", "confidence": "HIGH|MEDIUM|LOW (reason)", "mechanism": "string" }
  ],
  "watchItems": [
    { "actor": "string", "indicator": "string", "why": "string" }
  ]
}
```

This matches the Lambda already written in `amplify/backend/function/newsPairIntelligence/src/index.js`. The prompt in that Lambda should be updated to reflect the rubric and anti-patterns documented here before running Phase 1.4 test pairs.
