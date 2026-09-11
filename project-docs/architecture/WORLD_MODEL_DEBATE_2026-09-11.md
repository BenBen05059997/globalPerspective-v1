# World Model debate — three adversarial positions (2026-09-11)

Three Sonnet advocates argued the operator-review items of WORLD_MODEL.md (the lossy-five mapping, the deprecation calls, gap expectations, the front-page consequence). Synthesis + decisions live in the ledger/plan; these are the full position papers.

---
# THE UNIFIER — position paper

**Stance:** One ontology. One entity — the EVENT (WORLD_MODEL.md §1). Situation and thread are
two lifecycle *aspects* of the same thing, not two content classes. The site's identity is
world-impact events, full stop. Every proposal to add a second class ("developments"), a fourth
type system, or a ninth scale is a violation of §7's guardrail law until proven the existing model
truly cannot stretch to cover it.

---

## Q1 — The Lossy Five: PRUNE the quota, force-map the taxonomy, don't invent a lane

The operator already made this call on 2026-06-24 (`IMPACT_FIRST_REDESIGN_PLAN.md` §0): "we never
actually defined what impacts the world... hard quotas optimize for variety, not impact." Science,
climate, society, technology, energy are lossy against `{axis, event_type}` for exactly the reason
the quota system existed — they were never impact categories, they were *coverage-diversity
categories* invented to satisfy "must include climate/science/society/energy/business" (§0). The
12-category editorial list is not a taxonomy that happens to have five hard cases; it is the fossil
record of the mission the operator explicitly overturned. VERIFY §C confirms the count (12) and the
lossiness, but it does not say the fix is a new axis — it says these are ambiguous *editorial
display labels*, and WORLD_MODEL.md §3 already resolves this as a display-mapping problem, not an
ontology problem.

So, concretely, per the five:

- **science** → `other`/`economic` (WORLD_MODEL table). No event override rule proposed "because
  there is genuinely no signal to key one on" — that is the correct, honest answer for a story that
  is, in `event_type` terms, not really an *event* at all (a discovery is not a happening with an
  actor and a place the way a war or an election is). I'd go one step further than the draft: this
  is the strongest PRUNE candidate. If a science story doesn't clear the impact rubric (reach ×
  severity × irreversibility × novelty, §4) on its own, it shouldn't run *because* the quota says
  every batch needs one — it should run only when it's actually a world-impact event (a
  pandemic-relevant finding, a climate-tipping-point paper). Fewer, better science stories, chosen
  by the same rubric as everything else, not a reserved seat.
- **climate** → cleanly resolves to `disaster`/`humanitarian` when acute (a heatwave, a flood
  attributed to climate), or `policy`/`political` when it's COP/legislation (WORLD_MODEL's override
  rule). This is not lossy at all once you stop treating "climate" as a genre and start asking
  "is this a disaster or a policy fight" — which is exactly what `event_type` already
  distinguishes for every other domain.
- **society** → `unrest`/`political` when there's an unrest signal, `other`/`humanitarian`
  otherwise. Same move: "society" was never a real category, it was a bucket for "we don't know
  where this goes," and the axis+event_type system forces the honest answer.
- **technology** → `tech`/`economic` by default, `other`/`conflict` when it's state-vs-state
  (export controls, cyberwar). The residual ambiguity here is real but small — most tech coverage
  *is* economic (a chip export ban, an AI regulation) and the override rule catches the geopolitical
  slice.
- **energy** → `economy`/`economic` by default, `war`/`conflict` when energy is the lever (a
  pipeline attack, an embargo). Same pattern.

**The actual argument against the Pluralist here:** none of these five needed a second content
class to resolve. Every one of them resolved to an *existing* axis/event_type combination once you
stopped asking "what genre is this" and started asking "what kind of event is this and what does it
do to people." A Pluralist who wants "developments" as a second class for science/tech/society is
solving the wrong problem — they're preserving the quota-driven genre system under a new name
instead of admitting the genre system was the mistake. The 12-category quota is not evidence that
two content classes are needed; it's evidence that *variety-for-its-own-sake* was smuggled in as a
selection criterion, and the impact-driven decision already killed that. Reviving it as "developments"
just gives the quota system a permanent home instead of finishing its removal.

**Where I'd concede ground:** `science` really is the one item that resists the "it's secretly an
event" reframe cleanly — a peer-reviewed finding is genuinely a different kind of thing from "Iran
launches missiles." I don't think that earns it a second *content class* (the site's identity stays
event-first), but it may earn it a *stricter bar*, not a new lane: science stories run only when
they clear the impact rubric as a real-world event (a vaccine rollout, a discovered pathogen), not
as "an interesting paper." That's a threshold change, not an ontology change.

## Q2 — Deprecations: maximal unification, minimal survivors

WORLD_MODEL §4's deprecation table already does the hard work; my position is to push it further
than VERIFY strictly requires, because "unconfirmed" should default to *fold it in* not *keep it
around out of caution*.

- **Editorial significance (h/m/l) and urgency (h/m/l):** VERIFY §B found **no confirmed frontend
  consumer** for either. My position: this is not "DERIVE-THEN-DEPRECATE pending a grep," it's
  **DEPRECATE NOW, backfill the grep as due diligence, not as a gate.** A field with zero found
  consumers that duplicates a canonical scale that already exists (tier) is exactly the kind of
  drift §7 warns about — every day it survives is a day someone might build a *second* consumer
  against it, doubling the migration cost later. The burden of proof should be on "why does this
  still need to exist," not "prove no one uses it." I'd set a date, not a "next touch."
- **Breaking-alert float score:** I concede this survives, but I want to be precise about *why*,
  because a sloppy Unifier would try to collapse it into tier and break the alert gate. It survives
  because it's not a second *importance scale* — WORLD_MODEL is exactly right that it's a
  **decision gate**, a downstream combiner of the canonical inputs (capped riskScore + velocity +
  outlets + econ magnitude). The ontology has one entity and one display scale; it is allowed to
  have decision *thresholds* computed over that scale's inputs. A thermostat isn't a second
  temperature scale.
- **Economic-impact severity (minor/mod/severe + score):** survives for now, but I'd resist the
  "KEEP-AS-IS, revisit later" complacency VERIFY's caution invites. Structurally it's the same
  shape as riskTiers (score + band) — VERIFY §B says so directly. The stated reason to keep it
  separate (a downgrade state machine — thin winners/losers, low-confidence clamps) is a *state
  machine*, not a *scale*; nothing stops the state machine from continuing to run and simply
  reporting its output onto the shared 25/50/75 bands instead of maintaining independent
  thresholds. I'd mark this DERIVE-ON-NEXT-TOUCH, not KEEP-AS-IS-INDEFINITELY — the current
  wording gives it a permanent pass it hasn't earned.
- **Prediction probabilities and quality-judge scores:** these genuinely survive permanently, and I
  don't contest it — they answer different questions (likelihood; analysis quality) than "how much
  does this event matter." §5's three-way separation (importance / confidence / likelihood) is
  correct and is not itself a plurality of content classes — it's one entity carrying three
  different *kinds of claims about itself*, which is what any real entity does (a person has a
  weight and also a credit score; that's not two people).

**What I will not concede:** the Pluralist will likely point at breaking-alert and econ-severity
surviving and say "see, plurality is already here." No — surviving *scales* under one entity is not
the same as surviving *entities*. WORLD_MODEL's whole argument is that scales can differ while the
thing being scaled stays singular. That distinction is the crux of this whole debate and it's worth
naming explicitly against both other stances: Pluralist conflates "this needs its own number" with
"this needs its own noun."

## Q3 — Gaps: launch on corroboration × severity × spread, with an honest, narrow claim

Yes, it can launch — but only if the operator's own stated bar (§4's "measured > counted > judged,
never invent a fourth tier") is honored, which means being explicit about what's missing rather
than quietly substituting.

What's real today, per VERIFY §E and WORLD_MODEL §4/§8:
- **Corroboration** (outlets) and **spread** (countries) are universal counts, already computed,
  always available.
- **Severity** is measured for two domains only: disaster (GDACS alert level — but **not**
  affected population, confirmed absent, not a parsing bug, the feed doesn't carry it) and economy
  (newsEconomicImpact's own severity). For conflict/humanitarian, the two hardest and arguably most
  morally urgent domains, there is **no measured severity input at all** — fatalities are zero
  hits everywhere in the ingest, ACLED was evaluated and dropped for licensing, and the designated
  fill (ReliefWeb + INFORM) is open but **not yet wired**.

**Honest expectation the operator should hold:** an impact ranking launched today is really an
**outlet-count/spread/GDACS-tier ranking with an economic-severity boost where available and a
loud gap where the domain is conflict or humanitarian.** That is not nothing — outlets+spread is a
legitimate "counted" tier per the marking law, one step down from "measured," and it is *strictly
better* than the pre-redesign vibes-based selector VERIFY and IMPACT_FIRST both diagnosed. But it
will systematically **underrank quiet, high-fatality conflicts and humanitarian crises relative to
loud, well-covered ones** — the exact failure mode the operator's own impact-driven decision
("what materially changes lives, even if underreported," IMPACT_FIRST §3) was written to fix. A
famine with 10 outlets covering it will look smaller than a policy spat with 40, even if the famine
is killing more people. Shipping without ReliefWeb/INFORM wired means shipping the aperture-widening
half of the impact-driven decision but not the actual reweighting half.

The unifier's answer to "should we launch anyway": **yes, but label it.** Render "no data" for
fatalities/population, per §8's explicit instruction ("must render 'no data' ... never a judged
substitute presented as measured"), and don't market the ranking as "impact" without a footnote
that conflict/humanitarian severity is not yet measured. This is a scope-honesty problem, not a
launch-blocker — the ontology doesn't need ReliefWeb wired to be internally consistent; it needs
ReliefWeb wired to make its impact *claim* true. Ship the entity model now; ship the marketing claim
"we rank by real-world impact" only once §8's known gaps close.

## Q4 — How we show it: the map/registry front page IS the front page, non-geo becomes rarer and stricter, not gone

Under one ontology, the post-home-swap front page is a straightforward consequence of §1+§8: the
event registry (the `stories/` layer, already live, already ~50-80 situations wide per
`SituationHome`) is the single feed of "what is happening," and the front page renders the highest-
impact slice of it — a 2.5D globe/map hero per `MAP_HOME_SITUATION_PLAN.md`'s locked design
(hue=crisis type, GDACS+breaking openers), with severity-ranked situations as the primary list, and
editorial's ~13/cycle deep-dive threads appearing as **annotations on top of registry events**
(the "Full analysis →" link, threadId-stamped) rather than a separate, second front page. This
matches what `EVENT_REGISTRY_PLAN.md` already targets architecturally: "MAP: projection of ~all
significant events... EDITORIAL: selection of ~13/cycle for deep treatment" — one registry, two
views of depth, not two content classes.

**What happens to non-geo coverage** (science, market structure pieces, quality-judge-flagged
analysis, prediction accountability): it doesn't vanish, but it does two things a Pluralist would
resist:
1. It gets **re-tested against the impact rubric** before it earns a card at all (Q1) — no more
   automatic quota seat.
2. What survives renders as **a secondary rail or dedicated route, not the hero**, exactly the
   shape `SYSTEM_USAGE_2026-09-11.md` already documents today: `/economy`, `/track-record`,
   `/weekly` all already exist as separate routes serving separate reader intents (instrument-level
   economic detail, forecast accountability) *without* needing to be the map's hero. This is not a
   demotion invented for this debate — the current architecture (V1/V4/V5 in SYSTEM_USAGE) already
   treats these as satellite pages around the editorial/map core, and that pattern generalizes
   cleanly post-swap: **the map is the front door; everything else is a room down the hall,
   reachable by a real link (threadId/storyId), never a second front door.**

**The strongest objection, taken seriously: doesn't a pure-crisis map read as grim and narrow?**
This is my honest concession point, not a dodge. A map hero hued by "crisis type" (per the locked
design) *will* skew toward conflict/disaster if severity ranking is the sort key, and a reader who
opens the site every day to a globe of red dots will plausibly bounce, exactly the kind of narrowing
a Visitor-First advocate would flag as a retention risk, not just an aesthetic one. Three honest
responses, not a full rebuttal:
- The axis system is already 4-wide (conflict/political/economic/humanitarian), not
  crisis-only — a quiet diplomatic breakthrough or a market-moving policy event renders as a
  differently-hued pin, not absent. "Crisis map" undersells what the axis taxonomy already covers;
  it's an *events* map, and events include elections, diplomacy, and markets, not only disasters.
- Severity-ranking for the top-of-fold slice doesn't mean the *only* slice is top severity — the
  registry is ~50-80 wide; a "browse all" or lower-severity tier stays reachable without becoming
  the hero, the same way a newspaper's front page leads with the biggest story without deleting the
  rest of the paper.
- But: I will not pretend "impact-driven, even if underreported" and "not grim" are free to have
  together. Optimizing purely for reach×severity×irreversibility, by construction, favors bad news
  over good, because irreversible material harm is disproportionately bad news. If the operator
  wants the front page to feel less grim, that is a **presentation-layer curation choice** (§4:
  "apply diversity/variety as a presentation layer, never as a filter that distorts the impact
  ranking" — IMPACT_FIRST §2.3) layered on top of the one true ranking, not evidence that a second,
  softer content class is needed underneath it. I'd rather concede "the hero needs deliberate tonal
  curation" than concede "therefore we need two entities."

---

## Strongest points (2)

1. **The 12-category quota was the actual mistake, and the operator already ruled on it.** This
   isn't a philosophical unification preference — it's citing the operator's own 2026-06-24
   decision (IMPACT_FIRST §0/§3) that quota-driven variety was diagnosed as the root-cause failure
   mode of the *old* system. A second content class for "developments" would resurrect exactly the
   mechanism the operator already killed, under a new name.
2. **Scale plurality ≠ entity plurality, and VERIFY itself draws this line.** Breaking-alert score
   and econ-severity surviving as separate *scales* is not evidence for the Pluralist's separate
   *content class* — WORLD_MODEL and VERIFY both frame these as downstream combiners/state
   machines over the one canonical entity+tier, never as a second thing being described. This
   directly defangs the most tempting Pluralist evidence (multiple scores) before it's used to argue
   for multiple ontologies.

## Weakest point (honest)

The Q1 "force-map, stricter bar" answer for science leaves a real seam: unlike a war or an election,
a scientific finding often has no place, no actor in the ordinary sense, and no start/end — it
strains the EVENT definition in §1 ("something that happened... with a place, one or more actors,
and a type") more than any other category. I'm resolving that by raising the bar rather than
building a lane, but I can't claim this is a clean fit; it's the one spot where "force it into the
existing model" costs real precision rather than just costing convenience.

## What I'd concede in a compromise

I'd concede a **presentation-layer distinction between acute and standing coverage** — e.g., a
visually distinct treatment (not a separate entity, not a separate ID space, not a separate
taxonomy) for content that is by nature a slow-moving standing analysis (a country risk profile, a
market structure piece, a prediction-accountability page) versus an acute, dated happening. This
can be built entirely as a *rendering* choice on the one EVENT/registry model — a "standing" flag or
simply "no active situation" state — without adding a second identity root, a second type system, or
a second ranking. What I will not concede is a second content *class* with its own selection logic,
its own taxonomy, or its own front-page real estate independent of the impact ranking — that
reopens exactly the two-brains problem `EVENT_REGISTRY_PLAN.md` §1 diagnosed as the current
architecture's core defect ("the site runs two independent clustering brains over the same news").

---
# THE PLURALIST — position paper

Stance: the honest ontology is TWO content classes. **EVENTS** (geo-anchored: place + actor(s) +
type, map-shaped, the "situation" world already built in WORLD_MODEL.md §1-2) and
**DEVELOPMENTS** (non-geo: science, tech, climate-policy, society — things that materially change
lives without being pinnable to a place-and-actor). Forcing DEVELOPMENTS through the EVENT
taxonomy (§3's lossy-five table) makes the ontology lie about what these stories are. Name the
second class; give it its own honest treatment. Don't force-map, don't prune.

---

## Q1 — The lossy five: membership test, landing zone, impact marks, and the fragmentation charge

**Membership test for EVENT:** geo-anchorable (a `iso3[]` you'd put a pin on) AND actor-bearing (a
state, insurgent group, company, government body that *did* something). This is exactly
WORLD_MODEL §1's definition — "something that happened or is happening in the world, with a
place, one or more actors, and a type" — and it is *already* the map/situation pipeline's own
self-definition, not something I'm inventing. A war, an election, a disaster, a policy fight: all
pin-drop, all actor-driven. `storyId = axis#iso3#slug(entity)` **literally encodes this test in
the identity key** — the entity field IS the actor, iso3 IS the place. You cannot construct a
`storyId` for a story that has neither. That is not an accident of implementation; it's the
system telling you what an EVENT is.

**Membership test for DEVELOPMENT:** materially changes lives (IMPACT_FIRST §3 "second-order
effects on how people live/work/eat/move/breathe" — note this phrase governs the *whole*
selection, not just the geo half) but fails one or both of geo-anchor / actor-bearing. A
CRISPR breakthrough, a battery-density curve, a birth-rate trend, a social-media-and-teen-mental-
health finding: these change lives at civilizational scale and have **no single place and no
adversarial actor** — they're diffuse causes with diffuse effects. Pinning "CRISPR gene-editing
breakthrough" to a country is either arbitrary (the lab's HQ?) or worse, implies the story is
*about* that country, which it isn't.

**Where the lossy five land, precisely:**
- `science` → **DEVELOPMENT**, always. WORLD_MODEL's own table admits "no clean event_type match
  at all... no signal to key an override on" — that isn't a mapping gap, that's the model
  reporting a category error. A thing with zero signal for *either* axis of your type system is
  not a malformed instance of your one class; it's a member of a different class.
- `climate` → **split**, correctly, by the override rule already drafted in §3's table: acute
  disaster (flood, wildfire, cyclone) → EVENT (it has a place and often GDACS backing); climate
  *policy/science* (a COP summit outcome, an emissions-trajectory report, an IPCC finding) →
  DEVELOPMENT. WORLD_MODEL's own override language ("if the story is policy-flavored... "; "if no
  unrest signal...") is *already doing my class-split for me* — it just doesn't have a name for
  the branch it's routing to.
- `society` → mostly **DEVELOPMENT** (demographics, culture, technology-and-society) with an EVENT
  carve-out for actor-bearing unrest (which the table already routes to `unrest`).
- `technology` → mostly **DEVELOPMENT** (a chip advance, an AI capability jump) with an EVENT
  carve-out for state-vs-state tech conflict (export controls, cyberwar — again, the table already
  has this exact override).
- `energy` → mostly **DEVELOPMENT** (a battery/grid/renewables trend) with an EVENT carve-out where
  energy is a conflict lever (pipeline attack, embargo — again, already in the table).

Notice: **I am not asking WORLD_MODEL to change its override rules.** Every override in the §3
table already IS the EVENT/DEVELOPMENT split, encoded as ad-hoc exceptions with no name. My
proposal is to name what's already there, not invent new logic.

**Impact marks for DEVELOPMENTS — same law, different reach definition, not a new tier system.**
§4's law is "measured > counted > judged" — that's a *preference ordering* for evidence quality,
not a geography-specific instrument. It transfers cleanly:
- *measured*: a DEVELOPMENT often has better measured inputs than a geo EVENT does — a battery
  energy-density curve, a vaccine efficacy percentage, a GDP-share-of-R&D figure, are *numbers
  from an authoritative source*, exactly IMPACT_FIRST's top tier. This is not a weaker case for
  developments; in the science/tech domain the "measured" tier is often *more* available than
  fatalities-in-a-warzone.
- *counted*: outlets/velocity transfer as-is — a DEVELOPMENT still gets covered by N outlets over
  M days, still has a countable "how many countries' scientific/policy bodies reacted."
- *judged*: the existing `reach/severity/irreversibility/novelty` rubric (already live as QA-judge
  tags per `newsImpactAudit/src/index.js:74`, VERIFY §E) is **domain-neutral by construction** —
  "irreversibility" and "novelty" apply *better* to a DEVELOPMENT (a one-way technological or
  biological threshold) than to a war (which has a front line, not an irreversibility axis in the
  same sense). This rubric is IMPACT_FIRST's own general-purpose fallback for "politics/tech/
  science/other" (§3.5's typed-input table, row 5) — DEVELOPMENTS just *are* that row, formalized
  with a name instead of left as the residual bucket.

The only real difference: **"reach" means something different.** For an EVENT, reach = countries/
population geographically affected. For a DEVELOPMENT, reach = population *materially affected by
the change* regardless of geography (everyone using lithium batteries; every parent of a
teenager; every wheat farmer if the trend is a yield-improving cultivar). Same word, same law,
different scope of what's countable — this is a *reach definition*, not a second impact-mark
system. One `evidence{}` shape (§5) still holds it.

**The fragmentation charge, answered head-on.** The UNIFIER will say: a second class is exactly
the fragmentation §7's guardrail law exists to kill — "no new ID spaces, no new scales, no new
taxonomies." Three responses:

1. **§7's law is about *identity roots, importance scales, and type-classification systems* — not
   about content classes.** DEVELOPMENTS use the *same* `topicId`/`threadId` root (§2), the *same*
   tier vocabulary (§4, low/moderate/elevated/high), and the *same* `event_type` enum extended by
   nothing (a DEVELOPMENT is still tagged `tech`/`other`/`economy` etc. — I am not asking for a
   12th `event_type`). What I'm proposing is a **membership flag on top of the existing
   axis+event_type pair** — literally one boolean or one derived predicate (`has_geo_actor`), not
   a new ID, not a new scale, not a new taxonomy. Zero new ID spaces. Zero new scales. This
   *satisfies* §7, it doesn't violate it.
2. **The fragmentation §7 is actually policing is *accidental* multiplicity** — five independent
   IDs nobody meant to create, eight scales that grew organically with no shared law. A
   *principled, declared, two-value* content-class split is the opposite of that: it's naming a
   distinction the data (VERIFY's own "no clean match," WORLD_MODEL's own override rules) is
   already making implicitly and inconsistently. The alternative — pretending `science` has a
   place and an actor — is the actual fragmentation, because it forces five different downstream
   consumers (map pin logic, `axis` hue, the override table, any future geo-filter) to each
   independently reinvent an ad-hoc "well, unless it's science" exception. Naming the class once
   collapses five silent exceptions into one flag.
3. **The test for "principled boundary vs new mess" is whether the boundary is checkable and
   stable.** Geo-anchorable + actor-bearing is checkable today, from data the classifier already
   emits (`iso3[]`, `actors[]`, the Phase 1b fingerprint per WORLD_MODEL §2 — *already shipped
   2026-09-11*). I'm not asking for new inference; I'm asking to threshold a field that already
   exists on every story (empty `iso3[]`/`actors[]` after Phase 1b tagging = DEVELOPMENT,
   non-empty = EVENT). That's about as cheap and stable a boundary as this system has.

## Q2 — Deprecations under two classes

- **Significance/urgency (h/m/l):** WORLD_MODEL already flags these DERIVE-THEN-DEPRECATE
  (unconfirmed frontend consumer, VERIFY §B). Under my model they don't need to survive as a
  separate scale at all — for EVENTS they fold into situation tier as WORLD_MODEL proposes; for
  DEVELOPMENTS, "significance" **is** the reach/severity/irreversibility/novelty judged score,
  which already exists and already needs a home. So: confirm-no-consumer-then-drop, same as
  WORLD_MODEL says, but the destination for DEVELOPMENTS is named (the rubric tier) rather than
  left implicit.
- **Econ severity:** unaffected — economy is usually EVENT-shaped when it's about a country/market
  shock (has actors: a central bank, a government, a company) and stays on `newsEconomicImpact`'s
  own KEEP-AS-IS scale exactly as WORLD_MODEL specifies. Where an econ story is genuinely
  non-geo (a multi-decade productivity trend, an economic-model debate) it's a DEVELOPMENT and
  takes the rubric path. No change to the deprecation table's economic row.
- **Breaking score:** stays KEEP-AS-IS, unchanged, for the reason WORLD_MODEL gives (decision
  gate, finer granularity than 4 buckets). One caution: breaking-alert eligibility today is tuned
  on EVENT-shaped inputs (velocity, country-risk, econ magnitude) — a DEVELOPMENT breaking (a
  sudden regulatory reversal, a landmark study retraction) should still be alert-eligible, so the
  gate's composite needs to accept a DEVELOPMENT's judged-rubric score as an alternative input
  alongside riskScore, not be silently blind to non-geo spikes. That's a wiring note, not a new
  scale.

## Q3 — Gaps/expectations

Same operator choice WORLD_MODEL frames for population/fatalities (§8 "Known gaps"), extended:
**launch a DEVELOPMENTS impact ranking now, on the counts+rubric we already have** (outlets,
velocity, countries-reacting, the QA rubric already live in `newsImpactAudit`), rather than wait
on wiring anything new. Unlike the EVENT side's population/fatalities gap — which requires new
external feeds (ReliefWeb/INFORM, "open, no key, not yet wired," §8) — the DEVELOPMENT side's
inputs are **already in production today**, just not yet promoted from QA-only to registry-wide
(VERIFY §E's "positive finding," explicitly flagged as adoptable). This is the cheaper of the two
gaps to close, not the more expensive one — a UNIFIER or VISITOR-FIRST advocate who assumes
"second class = more infra debt" has the sequencing backwards. What the operator should expect:
launch is judged-tier-only at first (no "measured" inputs exist yet for most DEVELOPMENT domains
the way GDACS gives EVENTS a measured number) — label it honestly as `judged`, same as
WORLD_MODEL insists for EVENTS' known gaps ("must render 'no data,' never a judged substitute
presented as measured" — inverted here: a judged DEVELOPMENT score must never be *dressed up* as
measured either).

## Q4 — How we show it

**Map leads for EVENTS. A dedicated, named DEVELOPMENTS section — not a rail, not a stray
badge — leads the non-map content.** Concretely, post-home-swap:

- `/map` (SituationHome) stays exactly what it is: the EVENT surface, pins + tier + situation FSM.
  DEVELOPMENTS do not appear on the map, ever — putting a pin on "CRISPR breakthrough" is the
  ontology lie I'm arguing against, and a rail *bolted onto* the map implies the wrong thing too
  (that developments are geo-events with degraded location data, not a different kind of thing).
- Home (`/`) hierarchy: **EVENTS lead** (the existing deterministic lede band + per-region topic
  cards, unchanged) because that's where visitor attention and the map-as-home programme already
  point, and because EVENTS are what's *urgent* (situation FSM: emerging/escalating). Below that,
  a **named "Developments" section** (not a rail — a rail reads as secondary/decorative, the way
  the Economy right-rail is decoration to the main econ content per SYSTEM_USAGE; this deserves a
  first-class band because it's a *different subject*, not a footnote to the events above it),
  ranked internally by the rubric tier, same visual tier language (low/moderate/elevated/high) so
  it doesn't feel like a foreign visual system.
- Which leads overall: **EVENTS**, honestly, because urgency (a live situation FSM) is a
  legitimate reason for primacy that has nothing to do with whether the ontology should exist —
  I'm arguing for naming DEVELOPMENTS, not for co-equal billing. A pluralist ontology does not
  require a pluralist layout.

**The "two of everything" objection, met directly.** It is *not* two rankings and two displays in
the expensive sense — it is **one tier vocabulary (§4, unchanged), one identity family (§2,
unchanged), one evidence shape (§5, unchanged), one extra boolean-ish classification pass**
(geo-anchorable check, cheap, already answerable from Phase 1b fingerprint fields) **and one extra
section on Home** (a band, not a page, not a nav item, not a new Lambda). Compare that cost to the
UNIFIER's alternative: keeping the five lossy categories silently miscoded as EVENTS forever,
which is not zero-maintenance either — it's deferred maintenance, paid every time an operator
notices a science story with a nonsensical `iso3` tag, or every time a future geo-filter/map-
overlay feature has to special-case "oh, but ignore rows where the country is meaningless." I'm
not proposing new infrastructure; I'm proposing to *stop hiding* a distinction the data already
makes and route it through one new predicate instead of five silent per-category hacks.

---

## Two strongest points
1. **The system already draws my boundary; I'm only naming it.** Every "lossy" mapping in
   WORLD_MODEL §3 already carries an override rule that is, functionally, "except when it's
   actually geo/actor-shaped, then treat it as an EVENT" — climate, society, technology, energy
   all get this exact carve-out in the existing table. That is empirical evidence the two-class
   split is not my invention but a description of what the classifier's own authors already
   concluded, unlabeled.
2. **§7's guardrail law is satisfied, not violated.** No new ID, no new scale, no new taxonomy —
   just a predicate over fields (`iso3[]`, `actors[]`) that already exist post-Phase-1b. The
   UNIFIER's fragmentation charge conflates "a second content class" with "a second piece of
   infrastructure"; they're not the same thing, and WORLD_MODEL's own law is about the latter.

## One honest weakest point
`science` has, per VERIFY's own text, "no signal to key an override on" — meaning my clean
"geo-anchorable AND actor-bearing" test degenerates to "always DEVELOPMENT" for that one category
with no empirical validation step (unlike climate/society/tech/energy, which at least have a
stated override condition I can point to as evidence the split is real and checkable both ways).
For `science` I'm asserting the boundary rather than demonstrating it from an existing exception —
that's the softest joint in Q1.

## What I'd concede in a compromise
I would drop the demand for a **named, separately-labeled Home section** and accept
DEVELOPMENTS surfacing as **tagged cards inside the existing per-region topic-card layout**,
distinguished only by a badge/icon (not a geography), if the operator judges a whole new Home
band too much surface-area change this cycle — provided the *backend* classification (the
geo-anchorable predicate, the rubric-reach redefinition) still ships, because that's where the
ontology honesty actually lives; the display treatment is negotiable, the underlying two-class
labeling is not.

---
# VISITOR-FIRST — advocate paper

Stance: reason from reader value and product differentiation first; the ontology (WORLD_MODEL.md's
two-axis type system, the deprecation table) is a *consequence* of what the front door needs to
show, not a constraint the display must honor. Grounded in IMPACT_FIRST_REDESIGN_PLAN.md's own
words: the product is "not just another Bloomberg firehose" — a **differentiated position**, sold
on impact-intelligence, not on being comprehensive. SYSTEM_USAGE_2026-09-11.md is the fact that
should discipline both other advocates: ~zero subscribers, low traffic, `/spider-demo` and `/daily`
are orphans nobody uses, the breaking-alert bell is the one thing confirmed "ACTIVE" with real
data flowing to every visitor. This is an audience problem wearing a data-model costume.

---

## Q1 — The lossy five: does the reader need science/tech/climate/society from THIS site?

Answer per category, from reader value, not taxonomy neatness:

- **science** → **No.** A reader who wants science news has The Verge, Ars Technica, Nature News,
  a hundred better-resourced options with actual science desks. This site's classifier maps it to
  `event_type: other`, `axis: economic` "none proposed — genuinely no signal to key an override
  on" (WORLD_MODEL.md §3) — the ontology itself is telling us there is no impact signal here. If
  the taxonomy can't even locate why a science story matters, the reader has even less reason to
  come here for it. **Cut from the differentiated surface; keep only if it happens to score high
  on the impact rubric (a fusion breakthrough with geopolitical export-control implications, say —
  which is then a `tech`/`economic` story, not a `science` one).**

- **technology** → **Conditional yes, but only the impact-intelligence slice.** Export controls,
  chip war, cyberwar, platform-regulation fights that move markets or states — that's exactly the
  override rule WORLD_MODEL.md already proposes ("state-vs-state → `other`/`conflict`"). Generic
  product-launch tech news: no reader comes to a global-risk site for that, and we have no
  differentiation to offer over The Information or Stratechery. **Keep the impact-flavored slice,
  discard the rest — which the existing override rule already does for us.**

- **climate** → **Yes, but as disaster/humanitarian, not as a "climate beat."** A reader tracking
  global risk cares about a flood, a drought, a COP negotiation that produces or blocks binding
  policy — i.e., exactly the disaster/policy split WORLD_MODEL.md's override rule already encodes.
  Standalone "climate science" content (a study, a temperature record) has no home here; a reader
  gets that from dedicated climate press. **Keep, but only the event-shaped, impact-scored
  instances — which again is what the table already produces.**

- **society** → **Mostly no.** "Demographics, culture" (the override's own fallback bucket) is not
  why an analyst-leaning reader opens this site. The unrest-flavored half is already `axis:
  political` and shows up as conflict/instability coverage anyway — it doesn't need a `society`
  label to be visible, it needs to be correctly typed as unrest. **The residual (non-unrest)
  half: cut.**

- **energy** → **Yes, unconditionally** — this is the cleanest of the five because energy IS an
  impact lever (embargoes, pipeline attacks, price shocks cascading into the economic axis) and
  the override rule already routes the conflict-flavored case correctly. A reader watching the
  world for material risk explicitly wants oil/gas/shipping disruption; it's already slated for
  the "Systemic dock" in MAP_HOME_SITUATION_PLAN.md line 198 (rates/oil/shipping/export rules).
  **Keep fully — no override needed, this is core, not a lossy edge case.**

**What this implies for the mapping question:** don't argue about whether `science` "maps cleanly"
to an axis — argue about whether it survives editorial selection at all. The reader-value answer
converges with WORLD_MODEL.md's own honest admission (no override signal for `science`) far more
than it converges with a taxonomist's instinct to find a home for every category. Three of five
(science, most of society, generic tech) should mostly not exist as standalone content on this
site regardless of what axis they'd be filed under — that's a **selection/display** verdict
(IMPACT_FIRST §2's "rank purely by impact, diversity as presentation only"), and it makes the
mapping question almost moot: you don't need a principled home for content you're not going to
show. The two (energy, climate-as-disaster) that do survive already have exact, unambiguous
mappings on the existing table. **This is my strongest argument against the Pluralist**: don't
build a second "editorial-content" ontology class to dignify five categories, three of which a
reader-value lens says shouldn't be prominent content anyway.

## Q2 — Deprecations: what does a reader ever see or feel?

Argue from display truth, not taxonomy purity — a scale nobody sees and no decision needs is dead
regardless of which pipeline emits it.

- **Situation tier (low/mod/elevated/high) and riskScore/riskTiers** — reader sees this constantly:
  tier chips on the map's bottom strip, risk badges on CountryPage/ThreadPage (11 frontend files
  per WORLD_MODEL.md §4). **Alive, keep, this is the one true display scale — no argument.**
- **GDACS Red/Orange/Green** — reader sees the *fact* (an alert triggered a dot on the map) but
  never the raw code; it's already folded before render. Correctly dead as a surfaced scale,
  correctly alive as an audit trail. No objection.
- **Editorial significance/urgency (h/m/l)** — WORLD_MODEL.md's own table says "no confirmed
  frontend consumer found." From the reader's chair this is easy: **it doesn't exist.** A reader
  cannot feel a scale that never rendered. Kill it. This is not even a hard call; it's the cleanest
  deprecation on the table and I'd stop debating it.
- **Breaking-alert float score** — the reader-facing artifact is the **bell** — SYSTEM_USAGE
  confirms this is the one thing in the whole V7-adjacent surface marked "ACTIVE" with 36 real
  alerts reaching every visitor, unauthenticated. That's a real, felt, gating decision ("did I get
  pinged or not") — keep exactly as WORLD_MODEL.md says (KEEP-AS-IS, a decision gate, not a display
  scale).
- **Economic-impact severity band** — rendered directly on `EconomicImpact` UI, a reader sees
  "severe"/"moderate" plain language. Felt. Keep, but flag: SYSTEM_USAGE's V-something note about
  the Today/This-week toggle having "wildly different" underlying freshness is a bigger reader-
  trust problem than the severity band's scale-alignment is. Fix the trust gap before fussing over
  whether the band's thresholds match riskTiers' 25/50/75.
- **Prediction probabilities, quality-judge axes** — reader sees prediction bands on
  `/track-record`/`ThreadForecast` (felt, keep as a separate axis — agree with WORLD_MODEL.md,
  this genuinely is a different question, "how likely" not "how much"). Quality-judge scores:
  reader never sees them (QA-gate only) — irrelevant to the display debate either way, no need to
  litigate.

**The reader-value verdict, compressed:** two scales are real because a reader can point at the
pixel that encodes them (tier chips, the bell); one is a corpse with no pixel (editorial sig/
urgency — kill outright, no phased "derive-then-deprecate," there is nothing to derive from); the
rest earn their keep by answering a different question than "how important," not by having their
own taxonomy branch. **This is a case FOR the Unifier's instinct to prune** — I'd go further than
WORLD_MODEL.md's cautious "derive-then-deprecate, on next touch" and just cut editorial sig/urgency
now, because a reader-facing audit found zero consumers, and every week that dead field keeps
getting written is a week `newsInvokeGemini` spends serializing output nobody's building UI on.

## Q3 — Gaps/expectations: is a corroboration×severity×spread ranking honest enough to SHOW?

Yes — with the right label, and the honesty is a labeling problem, not a "wait for better data"
problem. A reader who opens the map is not asking "how many people died," they're asking "what
should I be watching right now, and how sure is the site that this matters." Corroboration
(outlets) × spread (countries) × severity-where-measured is a legitimate proxy for *that* question
even before population/fatality data lands — provided the UI never dresses the proxy up as the
thing it's a proxy for.

**What makes it honest:** MAP_HOME_SITUATION_PLAN.md already prescribes exactly this discipline —
"UI shows the evidence ('spreading to 3 new countries since yesterday'), never the number" (line
160), and the S4.5 legibility pass explicitly requires "Deterministic UN/EU alert — no AI analysis
at Orange level" instead of a blank "not generated," plain-language states (New/Getting worse/
Ongoing/Easing/Ended), and an explicit coverage note. That is the correct answer to this question
and it was reached by people thinking about the *reader*, not the ontology — which is exactly my
point: the honesty fix is a display/copy decision (label evidence as evidence, state coverage
gaps out loud), not a decision about whether GDACS-population and event_type live in the same
table or different ones.

**What would mislead:** showing a bare number or a five-star-style score with no evidence string
attached — a reader has no way to tell "3 outlets, spreading" from "1 outlet's headline restated
three times." The current WORLD_MODEL.md marking law (measured > counted > judged, §4) plus the
evidence-string requirement is the right bar; a reader-value lens doesn't ask for a different bar,
it asks that the bar actually gets enforced in the rendered copy, every time, not just where it's
convenient.

**What the operator should EXPECT the visible difference to be:** modest, and mostly in *trust
signaling*, not in which events appear. The set of "important" events surfaced by a corroboration/
spread ranking will look very similar, day to day, to what a competent human editor would already
pick — the difference a reader will actually notice is (a) the site now says out loud when it's
guessing vs. citing a UN feed, which no competitor bothers to do, and (b) coverage of underreported
crises (the "quiet flood" case IMPACT_FIRST_REDESIGN_PLAN.md §3.5 explicitly designed for) that a
Western-RSS-only competitor would miss entirely. That second one is the actual differentiation
payoff — the operator should watch for whether *that* class of story starts appearing, not whether
the tier badges get more "accurate" in some abstract sense.

## Q4 — How we show: the concrete front page (my core question)

I extend the already-approved MAP_HOME_SITUATION_PLAN.md layout (line 198), I do not reinvent it.
The plan is good and under-credited in this debate — my job is to say what a reader actually needs
from each band, using the Q1/Q2 answers to decide what's IN.

**First screen (0-3 seconds, no scroll):**
1. **Floating top bar** — brand, one freshness stamp ("● Updated 14:00 UTC · next ~18:00"), 7-day
   scrubber. One honesty claim, not two competing ones (S4.5 already flags "reconcile with the app
   header strip" — do this, it's a reader-trust bug today, not a nice-to-have).
2. **Hero: 2.5D tilted world**, hue = axis (conflict/political/economic/humanitarian — the FOUR
   axes, not the twelve editorial categories), height = severity, ripple = escalating, spread arcs
   to newly-affected countries. An empty dark world when nothing's critical is the honest "nothing
   critical" state (plan's own words) — a reader should be able to tell in one glance "is anything
   on fire right now," which no competitor's homepage answers this directly.
3. **Bottom strip: "N situations being watched"** — ranked rows, tier chip + plain-language state
   (New/Getting worse/Ongoing/Easing/Ended, per S4.5) + one evidence line + age. This is where Q3's
   honesty discipline lives in the UI: every row's number is backed by a sentence.

**Where depth lives:** click a situation → globe fly-to (per the plan) → the situation's own detail
surface, which is where ThreadPage/CountryPage-grade depth (root-cause chain, watch questions,
drift/"what changed," causal web) belongs. The home page's job is triage, not analysis — the
analyst-depth principle (`feedback_audience_depth`) applies to the *drill-down*, not to the hero.
A hero screen that tries to be deep is a hero screen that fails its 3-second job.

**Systemic dock** (per the plan, unchanged): rates/oil/shipping/export rules — this is where
**energy** survives from my Q1 answer, correctly, as a non-geo band that IS impact-intelligence
(a market/policy signal), not "energy news."

**Where non-geo content lives if it survives Q1:** almost nowhere as standalone content, and that's
the point. Climate survives only as disaster/policy dots ON the map (it's geo — a flood has a
location). Energy survives in the Systemic dock. Tech survives only when it clears the impact bar,
in which case it's just another dot or dock entry, typed correctly. Science and generic society
content: **do not get a below-the-fold section either.** Giving them a dedicated "editorial extras"
zone below the fold to preserve variety is exactly the diversity-quota failure mode
IMPACT_FIRST_REDESIGN_PLAN.md's root-cause section already diagnosed and rejected ("optimize for
variety, not impact"). The old Home.jsx lede/topic-list/trust-strip content stays below the fold
per the plan (line 198) as the editorial thread coverage — but it should inherit the same impact
ranking, not a category quota, and the five lossy categories should mostly just be thin there too.

**Addressing the objection — "you're optimizing for a phantom audience":** partially fair, and I'll
concede where. But the objection cuts against MORE elaborate ontology work harder than it cuts
against this design. A phantom audience is exactly why you should NOT invest in taxonomy branches
for content classes (science, society) that even a phantom-audience guess says aren't the draw —
that's low-regret pruning either way. It's also why the home-page swap itself is comparatively
low-risk to ship now: SYSTEM_USAGE_2026-09-11.md shows the *existing* home page's differentiated
content (drift corrections, thread analysis) already reaches real visitors when it's on a page
that's linked at all (contrast with `/spider-demo` and `/daily`, dead purely from lack of a nav
path, not from lack of quality). The map-as-home swap's actual bet is not "readers want maps" in
the abstract, it's "put the differentiated content where traffic already lands (`/`) instead of
leaving it orphaned two clicks deep" — that's a distribution fix, not a taste bet, and distribution
fixes are exactly what an audience-less site should be testing first. Where I can't fully answer
the objection: I don't have click-through or session data on `/` today to know if the *current*
lede band converts attention into deeper reads at all — the reader-value case for the map hero
specifically (vs. keeping the lede band on top) is argued from design principles and the operator's
prior sign-off, not from A/B evidence, because none exists yet.

---

## 2 strongest points

1. **Q1's convergence**: reader-value reasoning and the ontology's own honest gaps (no override
   signal for `science`) land in the same place almost exactly — which means the "lossy five"
   fight is mostly moot once you ask "would a reader come here for this," and neither the Unifier
   nor the Pluralist needs to build machinery for content that shouldn't be prominent regardless.
2. **The audience-vs-ontology reframe**: SYSTEM_USAGE_2026-09-11.md shows the site's actual
   distribution failures are navigation/linking bugs (`/spider-demo`, `/daily` orphaned by missing
   nav, not by data-model gaps) and a trust-signaling bug (two conflicting freshness claims, an
   undisclosed Today/This-week staleness gap) — cheaper, higher-leverage fixes than any ontology
   rework, and squarely in "what does the reader see" territory that this debate's other two
   stances mostly skip past.

## 1 honest weakest point

My Q4 design is argued from principles (the approved plan, the audience-depth memory, the
impact-first mission doc) and from the operator's prior sign-off on the plan — not from any
usage/funnel evidence that a map hero specifically outperforms the current lede-band-first layout
for this audience. Given the traffic is near-zero, I don't actually know what "the reader" wants
empirically; I'm extending an approved design intent, which is a reasonable but not airtight
stand-in for real reader-value data.

## What I'd concede in a compromise

I'd concede that **energy and climate-as-hazard need a real home in whatever type system ships** —
I'm not arguing they're display-only afterthoughts, and if the Pluralist wants a light "systemic/
non-geo" tag distinct from "situation" for the Systemic dock's own bookkeeping (so oil-price and
shipping entries have a clean foreign key the same way disaster/conflict dots do), I don't object,
provided it's a **display-routing tag, not a new identity root or a new importance scale** — i.e.
it must still resolve to one of the four `axis` values and the canonical tier, per WORLD_MODEL.md
§7's guardrail. What I won't concede is dignifying `science`/generic `society`/generic `tech` with
their own ongoing content commitment on the front door — that's a reader-value loss with no
offsetting differentiation gain, regardless of which side of the ontology fight it's filed under.
