# Severity codebook — anchored labeling rubric

**Status:** new, Phase 3 of `ONE_TRUTH_EXECUTION_PLAN.md`.
**Purpose:** give a human labeler a concrete, repeatable standard for scoring the same four risk
axes the generators score, so `quality/severity_agreement.js` can measure model/human agreement.
**The prompt is not touched by this doc.** This is read-only source material quoted from the live
generators, plus an anchored expansion for human labeling. No prompt or rubric change to
`newsCountryIntelligence` or `newsThreadAnalysis` may happen before the Phase 3 baseline
(`quality/calibration/severity-YYYY-MM-DD.md`) exists — see the plan's Step 3.5 hard rule.

---

## 1. Current rubric (baseline) — quoted verbatim from the live prompts

### `newsCountryIntelligence/src/index.js` (~line 487-492)

> 10. "dimensions": Object scoring this country's CURRENT risk across four INDEPENDENT axes. For
> each axis provide {"score": integer 0-100, "why": ONE sentence citing the specific arc/event
> from the data above that justifies the score} — or null when the data gives genuinely no signal
> for that axis. Be sparing: most countries are NOT elevated on all four — use null rather than a
> filler mid-number. Axes:
>    - "conflict": armed violence, military operations, armed-actor intensity
>    - "political": institutional stability, governance, legitimacy, protest/unrest
>    - "economic": financial stress, sanctions, trade/market disruption
>    - "humanitarian": displacement, civilian harm, disaster, aid crisis
> Per-axis calibration: 0-24 = low, 25-49 = moderate, 50-74 = elevated, 75-100 = severe.
> (riskScore and riskLevel are derived from these — do NOT output them separately.)

### `newsThreadAnalysis/src/index.js` (~line 263)

> 8. "dimensions": Object scoring THIS thread's current risk across four INDEPENDENT axes. For
> each axis provide {"score": integer 0-100, "why": ONE sentence citing the specific development
> in this thread that justifies the score} — or null when the thread gives genuinely no signal for
> that axis. Be sparing — use null rather than a filler mid-number. Axes: "conflict" (armed
> violence, military operations, armed-actor intensity), "political" (institutional stability,
> governance, legitimacy, unrest), "economic" (financial stress, sanctions, market disruption),
> "humanitarian" (displacement, civilian harm, disaster). Per-axis calibration: 0-24 = low, 25-49 =
> moderate, 50-74 = elevated, 75-100 = severe. (riskScore is derived from these — do NOT output it
> separately.)

Both generators score the same four axes on the same 0-100 scale with the same four band cutoffs
(low/moderate/elevated/severe — this codebook uses "high" as a synonym for the prompts' "severe"
to match the plan's band naming; they are the same band). The country prompt calls the band
"severe," the thread prompt also calls it "severe" — this codebook's "high" label is purely this
doc's naming choice for the 75-100 band, not a rubric change.

---

## 2. The null rule (read this before labeling anything)

**No signal on an axis → the axis is `null`. Never `0`.**

`0` is a real, meaningful score reserved for an axis that was actively considered and found to
have zero risk signal *despite the record discussing that domain* (rare — e.g. a political-stability
piece that explicitly notes an election passed peacefully with no unrest). `null` means the record
gives no basis to score the axis at all — it wasn't discussed, or there isn't enough information.

This is the single most common labeling error: labelers default to `0` for "didn't come up" when
it should be `null`. If you catch yourself writing `0` because nothing in the narrative addresses
that axis, write `null` instead.

**Worst-axis-wins:** a record's overall severity is its *highest-scored* non-null axis, not an
average and not a sum. A record with conflict=90, political=null, economic=10, humanitarian=null
is a "high" record overall (driven by conflict), not a moderate one.

---

## 3. Bands (identical across axes and record types)

| Band | Range |
|---|---|
| Low | 0-24 |
| Moderate | 25-49 |
| Elevated | 50-74 |
| High (generator calls this "severe") | 75-100 |

---

## 4. Anchored worked examples, per axis, per band

Each anchor is a concrete situation type, phrased the way this site's coverage actually reads
(country/thread risk narratives — conflict zones, sanctions regimes, protest waves, disasters),
not an abstract description. Use these as calibration points: if the record you're labeling is
"about as bad as" or "worse/better than" an anchor, that tells you the band.

### 4.1 Conflict — armed violence, military operations, armed-actor intensity

- **Low (0-24):** Military posturing or routine defense-budget/procurement news with no active
  hostilities (e.g. a joint military exercise announced, a new arms deal signed, border patrols at
  normal tempo). A ceasefire holding for months with only sporadic, unconfirmed, low-casualty
  incidents.
- **Moderate (25-49):** Localized skirmishes or a single confirmed clash with limited casualties
  and no territorial change (e.g. a border exchange of fire killing a handful of soldiers; a
  militant attack on an isolated outpost). Renewed but still low-intensity insurgent activity after
  a quiet period.
- **Elevated (50-74):** Sustained fighting in a defined area with meaningful casualties and some
  territorial or strategic effect (e.g. an offensive that captures a district and kills dozens;
  repeated missile/drone exchanges between two states short of full mobilization; a militant group
  seizing and holding a town for days).
- **High (75-100):** Large-scale, ongoing armed conflict with mass casualties, major territorial
  shifts, or direct state-on-state engagement (e.g. an armored offensive across a front line with
  hundreds of casualties reported; a state conducting sustained airstrikes on another state's
  territory; a coup accompanied by armed clashes in the capital).

### 4.2 Political — institutional stability, governance, legitimacy, protest/unrest

- **Low (0-24):** Normal democratic or governance friction (e.g. a contested but orderly
  parliamentary vote; a minor cabinet reshuffle; a peaceful, permitted protest with no clashes).
- **Moderate (25-49):** Meaningful institutional strain without a legitimacy crisis (e.g. a no-confidence
  motion that fails but reveals a fracturing coalition; sustained protests with some arrests but no
  serious violence; a court ruling against the government that it initially resists but ultimately
  complies with).
- **Elevated (50-74):** A real legitimacy or governance crisis (e.g. mass protests met with tear
  gas and mass arrests over several days; a president facing an active impeachment vote with
  uncertain outcome; a disputed election result with credible fraud allegations and street
  mobilization).
- **High (75-100):** Institutional collapse or a direct challenge to the state's governing
  authority (e.g. a coup attempt, a government falling to a no-confidence vote amid unrest, martial
  law declared, a ruling party's legitimacy openly rejected by a mass, sustained uprising).

### 4.3 Economic — financial stress, sanctions, trade/market disruption

- **Low (0-24):** Routine economic data or policy news with no disruption signal (e.g. a
  central-bank rate held steady as expected; a trade agreement signed with modest, incremental
  terms; a quarterly GDP print roughly matching forecasts).
- **Moderate (25-49):** A real but contained economic shock (e.g. a currency down several percent
  in a week on a single piece of news; a new tariff round on a specific sector; a credit-rating
  outlook (not rating) cut).
- **Elevated (50-74):** Broad-based financial stress or a significant sanctions/trade action with
  cross-sector effect (e.g. a major sovereign credit downgrade; sweeping new sanctions cutting off
  a country's banks from SWIFT-adjacent systems; a currency in double-digit weekly decline
  triggering central-bank intervention).
- **High (75-100):** Systemic financial crisis or severe, broad economic disruption (e.g. a
  sovereign default or imminent default; a full trade blockade choking a major export route (e.g. a
  strait closure spiking oil past a shock threshold); hyperinflation-level currency collapse; a
  banking-system run requiring emergency state intervention).

### 4.4 Humanitarian — displacement, civilian harm, disaster, aid crisis

- **Low (0-24):** Localized, contained hardship with adequate response capacity (e.g. a small flood
  displacing a few hundred people with local aid coverage adequate; isolated civilian casualties in
  an otherwise low-conflict area).
- **Moderate (25-49):** A real but geographically or numerically contained humanitarian event
  (e.g. a few thousand displaced by fighting or a storm with aid access still functioning; a
  disease outbreak in one region with a managed public-health response).
- **Elevated (50-74):** Large-scale displacement or aid access genuinely impaired (e.g. tens of
  thousands displaced by fighting or a natural disaster; aid convoys blocked or attacked; a famine
  warning issued for a specific region; cross-border refugee flows straining a neighboring
  country).
- **High (75-100):** Mass-casualty or mass-displacement crisis with aid access severely restricted
  or a declared famine/atrocity (e.g. hundreds of thousands to millions displaced; a besieged
  population with blocked humanitarian corridors; credible reports of mass civilian killings or a
  formally declared famine).

---

## 5. Labeling instructions for the operator (Step 3.4)

1. Open `quality/severity_gold_set.json`. For each record, read only the `narrative` block (do
   **not** look at `model_dimensions` first — it is placed last in each JSON object specifically so
   you can label blind. This is a **soft blind, not a real one**: you authored/reviewed the
   generator prompts and can likely recognize the model's own phrasing style if you read closely,
   so treat this as a discipline aid, not a guarantee of independence — note in your own labeling
   if you find yourself anchoring on recalled model output).
2. For each of the four axes (conflict, political, economic, humanitarian), decide: does this
   record's narrative give you enough signal to score the axis at all?
   - If no → `gold.<axis> = null`. Do not write `0` (see §2 above).
   - If yes → assign an integer 0-100 using the band anchors in §4 as calibration points, and
     write one sentence in `gold_why.<axis>` naming the specific fact in the narrative that
     justifies the score (mirrors the generator's own `why` field format).
3. Do not compute or write an overall score — the agreement script derives worst-axis-wins itself
   from your four per-axis labels.
4. When done, every `gold` object in the file should have either an integer or `null` for all four
   axes (no leftover `null` placeholders you simply skipped over without considering — a considered
   `null` and an unconsidered blank look identical in JSON, so work the whole file in one sitting if
   possible).
5. Only after every record is labeled, run `node quality/severity_agreement.js` (Step 3.5). The
   script refuses to run on an incomplete file.
