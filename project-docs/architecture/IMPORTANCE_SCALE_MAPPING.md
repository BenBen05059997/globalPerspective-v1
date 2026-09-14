# Importance-Scale Mapping Study

_Created 2026-09-12. Read-only, code-grounded feasibility study for **WORLD_MODEL.md D2** ("one importance
scale — merge the eight into the canonical tier"). Four Sonnet passes traced every producer, consumer,
prompt definition, and data-availability path for the editorial importance ratings. This is the reference
that any actual deprecation/merge work must be built on; it is not itself a code change._

**Grounded in** (all file:line-verified this date): `newsInvokeGemini/src/index.js`,
`newsPostLinkedin/src/index.js`, `NewsProjectInvokeAgentLambda/src/index.js`, `newsEconomicImpact/src/index.js`,
`newsThreadAnalysis/src/riskDimensions.js`, and the frontend `utils/riskTiers.js`, `utils/composeTopicsLede.js`,
`components/{Home,WorldMapV2,CountryPage,ThreadPage}.jsx`.

---

## TL;DR — the merge is smaller and different than D2 assumed

D2 recorded the expectation that `significance` **and** `urgency` "derive into the tier then get deprecated."
The code says otherwise on two counts:

1. **`urgency` is not the same question as the tier.** Its prompt defines it as *tempo* — how breaking/
   time-sensitive a story is right now — while the tier measures *standing severity*. These are different
   axes (a time-derivative vs. a level). Merging them loses information. **`urgency` should be recorded as a
   fourth honest exception, kept and labeled — not merged.**

2. **The tier is not computable on the surfaces that read `urgency`/`significance`.** The tier is derived
   from a numeric 0-100 risk score (or a 4-axis `dimensions` vector). That score is exclusively a
   **country- and thread-level** construct. The editorial **topic** pipeline never attaches a score — topics
   carry only the two enums. So on Home, the Map halo, and the lede composer, there is **nothing to derive a
   tier from** without new backend work.

Net: the genuinely safe, in-reach part of D2 is **cosmetic and small**. The load-bearing parts each need a
real decision, and one of the two fields (`urgency`) is being reclassified as a keeper, not a casualty.

---

## §1 What the canonical tier actually requires

`utils/riskTiers.js`:

- `tierFromScore(score)` — input is a **numeric 0-100 score**. Bands: `≥75 high`, `≥50 elevated`,
  `≥25 moderate`, else `low`; `null`/NaN → `null`. (L22-30)
- `tierFromLevel(level)` — fallback for a free-form string (`high/critical/severe→high`, `elevated`,
  `moderate/medium`, `low/minimal`). (L35-43)
- `deriveHeadline(record)` / `headlineFromDimensions(dims)` — input is a record carrying a **`dimensions`
  vector over the 4 axes `conflict/political/economic/humanitarian`** (or legacy scalar `riskScore`/
  `riskLevel`). Headline = worst axis, never averaged. (L96-128)

**Every path into a tier needs a `riskScore`, a `dimensions` vector, or (weakest) a `riskLevel` string already
attached to the object.** The `high/medium/low` editorial enums are none of these and are accepted by none of
these functions.

Where scores actually come from: `newsThreadAnalysis/src/riskDimensions.js` (byte-identical copy in
`newsCountryIntelligence`) computes `dimensions` + derived `riskScore`/`riskLevel` — **country- and
thread-level only.** The topic pipeline (`newsInvokeGemini`) never requests or emits a score.

---

## §2 The four editorial ratings — meaning, production, verdict

| Rating | Question it answers | Prompt definition (verbatim source) | Verdict |
|---|---|---|---|
| **`urgency`** (+`urgencyReason`) | **Tempo** — how breaking/time-sensitive *now* | `newsInvokeGemini/src/index.js:646` — `"high" = breaking/escalating in last 24h, "medium" = developing, "low" = background/slow-moving` | **KEEP-AS-EXCEPTION** (4th exception; different axis from severity) |
| **`significance`** | **Importance** — material second-order impact on daily life, across *all* categories | `newsInvokeGemini/src/index.js:617` (rule 8) — "events with second-order effects on how people live, work, eat, move, or breathe… political theater without material consequence is LOW" | **DERIVABLE-WITH-LOSS** — related to the tier's spirit but spans tech/science/business the 4 geopolitical axes don't cover; only real consumer is a backend sort (§3) |
| **`impactScores`** {humanImpact, economicReach, geopolitical} | Causal-explanation sub-scores, 1-10 each | `NewsProjectInvokeAgentLambda/src/index.js:405,411` — key names are the *only* definition; no prose gloss, no clamp/normalization | **KEEP-AS-EXCEPTION** — different scale (1-10 vs 0-100), different axes, ungoverned; on-demand Trace-the-Cause feature only |
| **economic `severity`** (minor/moderate/severe + `severityScore` 0-100) | **Market-disruption magnitude** | `newsEconomicImpact/src/index.js:457` + band clamp L93-97 + evidence downgrade L652-664 | **KEEP-AS-EXCEPTION** (already decided in D2) — most rigorously governed of the four |

Note the asymmetry between the two "soft" enums: `urgency` is validated against `['high','medium','low']`
before acceptance (`index.js:741`); `significance` has **no** membership check — any string the LLM emits
passes through lowercased (`index.js:774`), defaulting to `'medium'`. So `significance` is also the weaker-
calibrated of the two.

---

## §3 Where each field is actually read (consumer map)

### `significance` — backend-only consumer, no frontend data reads
- **Producer:** `newsInvokeGemini/src/index.js:774` → written into every topic in the `TOPICS_DDB_TABLE`
  `topics[]` list.
- **Only real consumer:** `newsPostLinkedin/src/index.js:171-174` — `SIGNIFICANCE_ORDER = {high:0,medium:1,
  low:2}` sorts the post queue; `toPost = sorted.slice(0, remainingSlots)`. This **decides which stories the
  LinkedIn auto-poster posts** when eligible topics exceed daily slots. The `InvokeLinkedIn` schedule is
  **ENABLED** (verified live 2026-09-12) — so this is load-bearing, not dead.
- **Frontend:** zero data reads. The word "significance" appears only as prose copy
  (`SubscribeCard.jsx:27`, `BreakingFeedPage.jsx:104`, `WeeklyBriefPage.jsx:140`).

### `urgency` — frontend-only consumers, no backend reads
- **Producer:** `newsInvokeGemini/src/index.js:775-776`. **Backend consumers:** none.
- **Frontend read sites** (5), with feasibility of showing a tier instead:

| # | Site | Use | Tier computable here? | Why |
|---|---|---|---|---|
| 1 | `composeTopicsLede.js:65-83` | **SORT/SELECT** — `+400` if `urgency==='high'`, picks the single Home/Map lede + sets `reason='urgent'` | **NO** | topic object carries only enums; no score/dimensions (source: `useGeminiTopics`→`newsInvokeGemini`) |
| 2 | `Home.jsx:446` | DISPLAY — "URGENT" pill | **NO** | same topic object |
| 3 | `WorldMapV2.jsx:564-583` | DISPLAY — red urgency-halo ring on country | **NO** | same topic object |
| 4 | `CountryPage.jsx:326-338,391-400,865` | **DERIVE+FILTER+DISPLAY** — per-arc urgency = max of entries; user filter chip (high/med/low); URGENT badge | **PARTIALLY** — a per-arc *thread* tier is already derivable via joined `ta.riskScore` and **already rendered** beside the urgency badge (L875-877). The raw per-*entry* `e.urgency` has nothing to join. | thread-level score exists in scope; per-entry does not |
| 5 | `ThreadPage.jsx:478-479` | DISPLAY — "URGENT" pill from `entries[0].urgency` | **PARTIALLY** — thread tier already exists on the same page from `analysis.riskScore` (rendered L504-507); the individual entry has no score | thread-level score exists in scope; per-entry does not |

### `impactScores`
- Producer `NewsProjectInvokeAgentLambda/src/index.js:405`; displayed as 3 bars in `TraceCauseDisplay.jsx:89-93`;
  no backend consumer, no sort/gate. Isolated to the Trace-the-Cause panel.

---

## §4 What each field's deprecation would actually take

- **`urgency` → KEEP.** Recommendation: stop treating it as a merge target. Record it as the **4th labeled
  exception** (tempo), alongside prediction-probability, breaking-score, and econ-severity. No code change
  needed to keep it; the honest fix is documentation. *If* it later needs a tier companion on CountryPage/
  ThreadPage, sites 4-5 can show the thread tier **next to** urgency (already do), not instead of it.

- **`significance` → one decision, backend-only.** Its sole consumer is the LinkedIn post-ordering sort.
  Because topics carry no score, you **cannot** derive a tier there without new backend work (attaching a
  score to the topic pipeline). Three honest options, cheapest first:
  1. **Leave it** — it's a self-contained editorial-ranking signal for one poster; low harm, no merge.
  2. **Replace the sort key** with an existing signal the poster already has (e.g. join thread `riskScore`
     by `threadId`, like the lede composer joins econ severity) — removes the field, keeps a sensible order.
  3. **Attach a topic-level score** in `newsInvokeGemini` (new backend work) so topics can carry a real tier —
     the only path that makes the topic surfaces (Home/Map/lede) tier-capable too. Biggest, but it's the same
     work D2's topic-level ambitions ultimately require.

- **`impactScores` → KEEP-AS-EXCEPTION** (or retire the whole Trace-the-Cause axis separately). Not part of
  this merge; folding its 1-10 ungoverned axes into the governed tier would import ungoverned data.

- **The genuinely safe, in-reach cosmetic piece:** the "URGENT" pills at sites 2 and 5 and (with a mapping
  choice) the halo at site 3 are boolean `=== 'high'` badges. These are the only spots where a swap is low-
  risk — but per the `urgency`-is-tempo finding above, we likely **don't** want to swap them at all; the pill
  is correctly showing tempo. So the honest conclusion is: **there is very little here that should actually be
  merged right now.**

---

## §5 Reconciliation with WORLD_MODEL.md D2

D2 stands on its core intent (one *severity* scale; classifier severity + GDACS already absorbed; the three
named exceptions kept). This study **refines** it with code evidence:

- **Add a 4th exception:** `urgency` (tempo) joins prediction-probability, breaking-score, and econ-severity as
  a kept, labeled, non-importance measure. It was mis-slotted as a merge candidate.
- **`significance`'s "derive-then-deprecate" is gated on a score that doesn't exist at the topic level.** It is
  not a free consumer-grep deletion; it's a backend-sort decision (§4). Nothing reads it on the frontend, so
  there is no display risk — only the LinkedIn ordering to preserve.
- **The topic surfaces (Home/Map/lede) cannot show the canonical tier at all** until the topic pipeline gains a
  score. This is the same prerequisite as the World Model's convergence build (registry computes the unified
  impact record) — i.e. the topic-level tier is downstream of that work, not a quick win.

**No edit to the binding D2 block has been made here** — this study surfaces the evidence; amending D2 to add the
4th exception is an operator call.

---

## §6 One-line recommendation

The safe read-only check is done and it changed the plan: **don't merge `urgency` (keep it as a 4th tempo
exception), leave `significance` alone until we decide the LinkedIn sort, and treat any topic-level tier as part
of the bigger registry build — not the "easy part."** The truly safe immediate action is documentation (record
the 4th exception), not code.
