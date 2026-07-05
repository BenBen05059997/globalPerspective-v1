# Prediction Methodology v1 — worked example (real data, 2026-07-04)

Companion to `PREDICTION_METHODOLOGY_V1_PLAN.md` §8. Everything in **Inputs** is real production data
fetched 2026-07-04; the **output** is a hand-worked exemplar of what the v1 pipeline should produce
(NOT a live model run — it exists to make the target contract concrete and to exercise the capture gates).

---

## The story (live topic, `latest`)

> **"Ukraine strikes oil and military facilities near Russia's St Petersburg; Russia claims capture of Kostiantynivka"**
> `threadId: thread-ukrainian-drones-strike-st-pet-b69cc4` · category `conflict` · regions Ukraine, Russia · 5 sources

Chosen because it is the **same thread family** as several defective pilot triggers (#27/#42/#44/#45 —
the June St. Petersburg forum strikes), so old-vs-new is a like-for-like comparison.

## Inputs — what v1 gives the model that today's pipeline doesn't

**(A) The 48h snippets (today's ONLY input) — real:**
- [aljazeera.com] Kyiv's drones disrupt St Petersburg internet and flights as Russian strikes halt a gas facility in central Ukraine.
- [aljazeera.com] Russia claims it captured the strategic key Ukrainian city of Kostiantynivka
- [france24.com] Ukraine still controls the strategically important eastern city of Kostiantynivka, President Volodymyr Zelensky and the General Staff said Saturday, rejecting Russian claims…
- [euronews.com] It comes after Moscow launched a massive drone and missile barrage at Kyiv earlier this week, killing at least 30 people and hitting more than 20 sites across the city.
- [npr.org] …Russia has struck Ukraine's capital, killing several people…

**(B) NEW — thread-history digest (1c).** The thread has **44 archived entries over 2026-06-03 → 07-04** that the current prompt never sees. Compact digest (selected real entries):

| Date | Entry |
|---|---|
| 06-03..07 | Ukrainian drones strike St. Petersburg oil terminal + naval base during Putin's economic forum ("unprecedented") |
| 06-10..13 | Strikes spread: Sevastopol, Crimea fuel crisis, Tamanneftegaz terminal; Putin admits economic damage |
| 06-14 | Putin and Zelensky hold separate calls with Trump |
| 06-15 | Russian air attack damages Kyiv Pechersk Lavra, kills 11 |
| 06-18..19 | Ukraine's largest drone attack on Moscow — refinery, "black rain", fuel shortages |
| 06-21..24 | Crimea rail bridge destroyed; Sevastopol power knocked out |
| 06-28..29 | Two more refineries hit; **Putin rejects Turkish ceasefire push**; "difficult period" |
| 07-01..03 | Russia's largest-ever attack on Kyiv (30+ dead); **Crimea declares emergency**; reports of Russia's June advance collapsing |

**(C) NEW — verified premises (1b), from prod `FACTS#Russia` (Wikidata, last updated 2026-07-03):**
> Head of State: **Vladimir Putin** (since 2012-05-07). Head of Government: **Mikhail Mishustin** (since 2020-01-16).
> (Mozambique example: no `FACTS#Mozambique` row exists → the premise gate **skips** — coverage-honest, never guesses.)

**(D) NEW — grounded research pass (1a):** Brave search on the thread keywords instead of
parametric-memory "UPCOMING DEADLINES". (Not simulated here; contract: every deadline named in the
briefing must trace to a search result or snippet.)

## Exemplar v1 output (hand-worked target contract)

```json
{
  "methodologyVersion": 1,
  "generatedAt": "2026-07-04T12:00:00.000Z",
  "scenarios": [
    {
      "label": "Most Likely",
      "probability_range": "55-65%",
      "horizon": "2-4 weeks",
      "rationale": "A month of reciprocal deep-strike escalation (44-entry arc: refineries, Moscow, Crimea fuel crisis, record Kyiv barrages) with Putin rejecting the Turkish ceasefire push on 06-29 — both sides currently gain more from escalation than talks.",
      "triggers": [
        { "text": "Ukraine strikes another Russian oil refinery or fuel terminal, reported by a major outlet, by 2026-07-18", "deadline": "2026-07-18" },
        { "text": "Russia launches another mass drone/missile attack on Kyiv with 20+ deaths by 2026-07-18", "deadline": "2026-07-18" },
        { "text": "Crimea's fuel emergency measures are extended or expanded by 2026-07-25", "deadline": "2026-07-25" }
      ]
    },
    {
      "label": "Optimistic",
      "probability_range": "15-20%",
      "horizon": "4-8 weeks",
      "rationale": "The 06-14 Trump calls show an open mediation channel; Putin's acknowledged 'difficult period' and the fuel crisis raise the cost of continuation.",
      "triggers": [
        { "text": "Direct or externally mediated Russia-Ukraine talks are formally announced by 2026-08-15", "deadline": "2026-08-15" },
        { "text": "An energy-infrastructure ceasefire (both sides pause strikes on energy targets) is announced by 2026-09-01", "deadline": "2026-09-01" }
      ]
    },
    {
      "label": "Pessimistic",
      "probability_range": "20-25%",
      "horizon": "4-8 weeks",
      "rationale": "Russia compensates for its stalling advance (07-03 reports) with strategic-depth escalation; fuel-supply damage forces harder domestic measures.",
      "triggers": [
        { "text": "Russia announces a new mobilization wave or nationwide fuel rationing by 2026-08-15", "deadline": "2026-08-15" }
      ]
    }
  ],
  "winners": ["long-range drone manufacturers", "non-Russian oil exporters"],
  "losers": ["Russian refining sector", "Kyiv civilians", "Black Sea shipping insurers"],
  "capture": { "gates": "v1", "dropped": [] }
}
```

Contract points vs today's output: triggers are **objects with ISO deadlines** (not free text);
every deadline is **after** `generatedAt` and inside the 180d horizon; windows are stamped at their
END; rationales cite the **arc**, not just today's snippet.

## Capture gates — executed (prototype `gates-proto.js`, runnable)

Real defective pilot triggers, validated at their own generation dates:

```
pilot #0  REJECT G2 — deadline 2021-07-31 not after generation 2026-06-05 — retrodiction
pilot #1  REJECT G2 — deadline 2023-07-31 not after generation 2026-06-04 — retrodiction
pilot #2  REJECT G2 — deadline 2026-02-05 not after generation 2026-06-08 — retrodiction  (New START)
pilot #29 REJECT G2 — deadline 2026-06-05 not after generation 2026-06-05 — retrodiction  (window-as-anchor)
pilot #15 REJECT G5 — names "Nyusi" but FACTS#Mozambique verifies Daniel Chapo            (premise, hypothetical coverage)

Exemplar v1 triggers: 6/6 PASS
```

Notes: #1 and #29 would ALSO fail G4 (precedent reference / relative window) if their deadlines were
fixed — the gates are redundant by design. #15's G5 catch is shown with hypothetical FACTS coverage
(no prod row for Mozambique); with no coverage the gate skips rather than guesses.

## What this example proves

1. Every defect class the pilot found is **mechanically rejectable at capture** — before it can ever
   inflate the public record.
2. The v1 inputs (arc + verified facts + grounded search) are **already in production data stores** —
   no new pipelines, just wiring into one Lambda's prompts.
3. The trigger contract (`{text, deadline}` objects, forward-dated, window-end) is what makes the
   downstream strikethrough UI and Brier scoring well-defined.
