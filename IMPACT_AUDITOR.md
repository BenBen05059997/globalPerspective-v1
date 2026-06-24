# Impact Auditor — design + first real run

The auditor from `IMPACT_VALIDATION_METHODOLOGY.md`, made concrete and run on a real captured
cycle. It reads a `GlobalPerspectiveIngestCapture` row (what the selector **saw** vs **chose**)
and catches **high-impact events the selector MISSED** — the invisible false-negative.

## The impact rubric (also the draft "common impact scale")
Judge IMPACT, not loudness/coverage. Each dimension 0–5, grounded only in the article's own
title/snippet (no invented facts):
- **REACH** — how many people / countries materially affected
- **SEVERITY** — stakes: lives, economic scale, rights/sovereignty
- **IRREVERSIBILITY** — crosses a threshold that can't be undone (deaths, war, coup, default, collapse)
- **NOVELTY** — a genuine discontinuity, vs routine / ongoing / opinion / explainer

High-impact = high REACH+SEVERITY, especially irreversible discontinuities. This is the seed of
the cross-domain 0–100 scale (normalize reach×severity, lift for irreversibility/novelty).

## The three checks
1. **MISSED (the point):** scan the full input pool; list HIGH-impact events the selector did
   NOT choose, ranked, with the standout dimension. Ignore real noise (sports, human-interest,
   opinion/explainers).
2. **QUESTIONABLE PICKS:** chosen events that are actually low-impact (loud/routine).
3. **VERDICT:** did it capture the highest-impact events + the dominant failure pattern.

## Status — DEPLOYED 2026-06-24
Scheduled Lambda **`newsImpactAudit`** (DeepSeek, operator's choice — prompt primed to hunt the
known atrocity/Africa blind spot to offset same-model correlation). **`TriggerImpactAudit`
cron(0 9 * * ? *)** audits the latest `GlobalPerspectiveIngestCapture` row daily → writes the
verdict to **`GlobalPerspectiveImpactAudit`** (the metric) → **SNS-alerts** the operator
(`GlobalPerspectiveAlerts`) when misses ≥ `MISS_ALERT_THRESHOLD` (=2). **It does NOT modify the
live feed — measure + alert only.** Auto-correction is a later, gated step.

First live run (DeepSeek on the 179→16 cycle): **verdict `weak`, 6 missed** — matched the Claude
prototype (Sudan atrocity, Ghana flood) + more (Nigeria ISIS-financier sanctions, SE-Asia haze).
Pattern: *"Under-coverage of African crises and environmental disasters; over-selection of US
domestic politics and routine economic news."* Confirms same-model auditing works with the primed
prompt.

---

## First run — capture cycle 2026-06-24T14:21Z (179 seen → 16 chosen)

**It works, and it found real, serious misses.** The selector's 16 picks were *mostly* sound
(Iran–US deal, Ukraine/Crimea strike, Gaza expulsion, Ebola case, Europe heatwave deaths, Taiwan-
Strait carrier, NK navy, ISIS leader killed) — **but it has a systematic blind spot.**

### Top MISSED (false negatives)
1. **Sudan / Darfur — a mass-atrocity blind spot.** **THREE** Sudan articles in the input
   (alleged genocide + UK prioritising UAE arms ties over averting it; refugees deported back into
   the war; army absorbing Darfur paramilitaries) → **ZERO chosen.** Highest severity/irreversibility
   on the board, dropped entirely.
2. **Ghana flood — 1,700+ displaced** → dropped, while the (well-covered, rich-country) European
   heatwave was kept. Under-covered-region disaster bias.
3. **UK PM resignation (Starmer) + succession** → dropped, while a **NYC municipal primary** and a
   **Peru squeaker** were kept. A G7 nuclear power's head of government resigning is a bigger
   discontinuity than a city primary.
4. **EU scaling back Ukraine's accession timetable** (sovereignty/geopolitics) → dropped for a
   tactical Crimea power-outage item.
- Honorable mentions: Libya migrant violence + EU complicity; Montreal mass shooting (3 dead, hard
  but localized); US weaponising food aid.

### QUESTIONABLE picks (loud but low-impact)
- **NYC Democratic primary** — municipal, low global reach (the weakest pick).
- **EU €8B tax *proposal*** — a proposal, not enacted; routine.
- **China detains 2 Japanese over rare-earth goods** — two individuals; tiny reach alone.
- Iran/US deal **over-represented** (~3 angles) — reasonable as the day's top story, but it crowded
  out Sudan + Europe-political events.

### VERDICT
> *"Decent, with ~4 notable misses. Systematically weak on Africa and under-amplified
> atrocity/displacement events. The clearest evidence: three Sudan/Darfur articles (incl. alleged
> genocide) and a Ghana flood displacing 1,700+ — all dropped — while a NYC primary and an €8B EU
> tax proposal were surfaced. The pipeline ranks on loudness/coverage-density, exactly the failure
> mode it was told to avoid."*

**Auditor's recommendation:** a **severity-floor override** that force-considers
mass-atrocity / mass-displacement / coup / genocide regardless of how loudly it's covered.

## Why this matters
This is the impact-first thesis **proven on live data, not argued in the abstract.** The selector
dropped an alleged genocide and a flood-displacement event while keeping a city primary — precisely
the loudness-over-impact bias the redesign targets. And the auditor caught it automatically. The
direct-impact feeds (GDACS would have flagged the Ghana flood; ACLED the Sudan violence) plus this
auditor are exactly the fix.
