# Economic Disruption — Verification Plan

**Status:** Draft 2026-05-23. To be executed via repeated `/loop` runs until every check is green, then re-run after every deploy that touches `newsEconomicImpact`, `newsEconomicQuality`, the three economic hooks, or any page that imports `SeverityBadge` / `MechanismCard` / `DisruptionRow` / `DisruptionPreview` / `QualityFlag`.

**Sister docs:** `ECONOMIC_DISRUPTION.md` (concept) · `ECONOMIC_DISRUPTION_PLAN.md` (build plan) · `ECONOMIC_DISRUPTION_QUALITY_PLAN.md` (Layers A/B/C/D/E quality stack) · `ECONOMIC_DISRUPTION_WIRING_PLAN.md` (UI wiring batches).

---

## 0. Why this plan exists

The Economic Disruption layer is now cross-cutting: 8 pages, 5 atoms, 3 hooks, 2 Lambdas, 1 DDB table, and 3 REST actions. Bugs at any single layer silently corrupt the user experience — a missing field on the Lambda side becomes a blank chip in the UI; a stale localStorage cache hides a deploy regression for 30 minutes; an LLM that quietly stops emitting inline citations passes Phase A but produces noise in the Economy tab.

This document defines the **end-to-end correctness contract** for the Economic Disruption layer and the **verification loop** to enforce it. We treat this as an executable spec: every check has a command (or a click) and a pass criterion.

## 0a. Initial findings (snapshot 2026-05-23, before fixing anything)

These were uncovered while writing this plan and seed the first loop iteration:

1. **Phase A inline-citation rule is silently failing for every record.** All 26 active `hasImpact:true` records lack the required `[topic-xxx]` inline citation in the `mechanism` field. The consistency-check flags it (`mechanism_missing_inline_citation` appears in `qualityFlags`) but the record still publishes. The LLM is not honoring rule 6 of `buildPrompt()`. → Root cause must be diagnosed (prompt drift, model swap, JSON-mode strip) and fixed.
2. **Phase B judge has produced zero results.** `quality_judged_at` is absent on all 26 records; `is_low_quality` is never set. Either the EventBridge `cron(0 8)` has not fired successfully, or the Gemini call is 429-ing every run (free-tier quota exhaustion is the known failure mode), or the IAM/log path is still broken. → Check CloudWatch logs for `newsEconomicQuality`, verify last successful run, confirm DDB write happens.
3. **WeeklyPage is no longer in the surface.** The `ECONOMIC_DISRUPTION.md` per-page surface map still lists `WeeklyPage` with a `SeverityBadge`. P0.4 of the wiring sprint removed it. → Doc must be corrected (or the chip re-added if the removal was wrong).
4. **Only 5 distinct days of records.** Date range 2026-05-19 → 2026-05-23. The cron has been running, but with only ~5 records/day and 7 tombstones across the window. Below the 30-day target needed to unblock Phase D backtest. → Tracked separately; not a verification failure, but the dashboard must show coverage explicitly.
5. **Severity distribution is heavily moderate.** 22 moderate / 2 minor / 2 severe out of 26. Either Phase A's `thin_winners_losers` downgrade is correctly pulling severes toward moderate, or the LLM is calibrating-low. → Add a check that flags ≥30-day windows where severity distribution drifts ≥2σ from the running mean.

---

## 1. Scope — what's in this verification system

| Layer | Component | What we verify |
|---|---|---|
| **L1: Data** | DDB `SummarizeAndPredict` table, `ECON#THREAD#*` partition | Field presence, enum legality, citation integrity, freshness, judge coverage |
| **L2: Producer Lambda** | `newsEconomicImpact` (DeepSeek → validator → consistency-checks) | Unit tests pass, live invoke produces clean records, allowlist enforced |
| **L3: Judge Lambda** | `newsEconomicQuality` (Gemini Flash) | Unit tests pass, runs on cron, writes back, judge axes within [1,5] |
| **L4: REST proxy** | `newsSensitiveData` actions `economic_impact`, `economic_impact_list`, `economic_top_movers` | Returns 200 + correct shape for known IDs + filters |
| **L5: Hooks** | `useEconomicImpact`, `useDisruptionsList`, `useTopMovers` | Cache lifecycle, error fallback, filter passing |
| **L6: Atoms** | `SeverityBadge`, `MechanismCard`, `DisruptionRow`, `DisruptionPreview`, `QualityFlag` | Render correctly given each input variant, including degenerate ones |
| **L7: Pages** | Home, DailyPage, EconomyPage, ThreadPage, CountryPage, CountryListPage, WorldMapV2, Disclosures, Layout | Surface map matches reality; deep links work; no stale references |
| **L8: E2E** | Browser click-through | Cards → chips → deep links → MechanismCard, no 404s, no console errors |
| **L9: Calibration** | Severity distributions, judge agreement | Statistical sanity over rolling windows (Phase D/E prerequisite) |

Out of scope (tracked elsewhere): the LLM's *qualitative* taste in picking analogs (Phase C human review), backtest hit rates (Phase D), GPR-style indices (deferred).

---

## 2. The contract — what every `hasImpact:true` record must satisfy

This is the single source of truth for "is this record correct?" Every check below derives from this contract.

```
{
  PK: "ECON#THREAD#<threadId>",             // required, must match scopeId/threadId
  SK: "ECONOMIC_IMPACT",                    // required, constant
  scope: "thread",                          // required, currently always "thread"
  scopeId: "<threadId>",                    // required, equals threadId, used for deep-links
  threadId: "<threadId>",                   // required, must exist in archive
  hasImpact: true,                          // required
  entryCount: <int ≥ 1>,                    // required, equals thread.entries.length
  generatedAt: <ISO string within last 21 days>, // required, drives staleness UI
  modelId: <non-empty>,                     // required, the producer model name
  ttl: <unix seconds, ~21 days from now>,   // required, drives DDB auto-expiry

  headline: <string, 1..160 chars>,         // required, displayed in every UI
  severity: "minor" | "moderate" | "severe",// required, enum strict
  severityScore: <int 0..100>,              // required, must be inside SEVERITY_BAND[severity]
  confidence: "low" | "medium" | "high",    // required, enum strict
  horizon: "immediate" | "days" | "weeks" | "months", // required, enum strict

  instruments: [                            // required, length 1..6
    {
      instrumentId: <member of INSTRUMENT_ALLOWLIST ∪ runtime FX>,
      direction: "up" | "down" | "mixed",
      magnitude: "small" | "moderate" | "large",  // auto-normalized to "moderate" on miss
      citedTopicIds: [<≥1 topicIds, all members of thread.entries.topicId>],
      rationale: <string, optional, shown in tooltip>
    }
  ],

  winners: [{name, type∈{country,sector,company}, why}],  // ≥ 0, ≤ 5
  losers:  [{name, type∈{country,sector,company}, why}],  // ≥ 0, ≤ 5

  mechanism: <string, 1..1500 chars>,       // required, MUST contain ≥1 inline [topic-xxx]
  historicalAnalog: { event, year, outcome, caveat } | null, // optional, year ∈ 1990..2030
  watchSignals: [<≤6 strings of ≤200 chars>],

  citedTopicIds: [<≥1 unique members of thread.entries.topicId>],  // required, length ≥ 1

  marketContext: {                          // required, snapshot at gen time
    <instrumentId>: { value: <number>, asOf: <ISO> }
  },

  qualityFlags: [<strings>],                // optional Phase A flags
  // Phase B (judge) fields, present only after newsEconomicQuality has run:
  qualityScores: {                          // optional, integers 1..5 each
    coherence, citation_fidelity, analog_match, severity_calibration, no_bs
  },
  qualityReasons: { <axis>: <reason string> },  // optional
  is_low_quality: <bool>,                   // optional, true if any axis ≤ 2
  quality_judged_at: <ISO>,                 // optional
  quality_judge_model: <string>             // optional
}
```

Tombstone (`hasImpact: false`) records must carry only `PK, SK, scope, scopeId, threadId, hasImpact, entryCount, generatedAt, modelId, ttl`. Any other field present on a tombstone is a bug.

---

## 3. Layer 1 — DDB integrity checks

Each check returns **PASS** if every record satisfies the condition, **FAIL** with the offending PKs otherwise.

### Required-field presence

| ID | Check | Pass condition |
|---|---|---|
| L1.01 | PK matches `ECON#THREAD#<threadId>` and threadId equals `scopeId` field | 100% |
| L1.02 | SK = `ECONOMIC_IMPACT` | 100% |
| L1.03 | `generatedAt` parses as ISO and is within last 21 days | 100% |
| L1.04 | `ttl` ≥ `now()` | 100% (else DDB will auto-delete it) |
| L1.05 | `modelId` non-empty | 100% |
| L1.06 | `entryCount` ≥ 1 | 100% |

### Enum legality (hasImpact=true only)

| ID | Check | Pass |
|---|---|---|
| L1.07 | `severity` ∈ {minor, moderate, severe} | 100% |
| L1.08 | `confidence` ∈ {low, medium, high} | 100% |
| L1.09 | `horizon` ∈ {immediate, days, weeks, months} | 100% |
| L1.10 | `severityScore` ∈ [0,100] integer | 100% |
| L1.11 | `severityScore` inside `SEVERITY_BAND[severity]` ([0,40] / [41,69] / [70,100]) | 100% |
| L1.12 | Every instrument.direction ∈ {up,down,mixed} | 100% |
| L1.13 | Every instrument.magnitude ∈ {small,moderate,large} | 100% |
| L1.14 | Every winners[i].type and losers[i].type ∈ {country,sector,company} | 100% |

### Citation integrity

| ID | Check | Pass |
|---|---|---|
| L1.15 | `citedTopicIds.length ≥ 1` | 100% |
| L1.16 | Every entry in `citedTopicIds` exists in `ARCHIVE#YYYY-MM-DD` topic IDs for the thread's window | 100% |
| L1.17 | Every `instruments[i].citedTopicIds[j]` is also in `citedTopicIds` | 100% |
| L1.18 | **`mechanism` contains ≥ 1 inline `[topic-xxx]` reference** | 100% (currently 0% — known regression) |
| L1.19 | Every inline `[topic-xxx]` in mechanism is also in `citedTopicIds` | 100% |

### Instrument allowlist

| ID | Check | Pass |
|---|---|---|
| L1.20 | Every `instrumentId` is in `INSTRUMENT_ALLOWLIST` or a runtime FX pair `USD/XXX` for a currency in our Frankfurter snapshot | 100% |
| L1.21 | No record emits AAPL / TSM / RTX / any individual stock | 100% |
| L1.22 | `instruments.length` ∈ [1,6] | 100% |

### Tombstone hygiene

| ID | Check | Pass |
|---|---|---|
| L1.23 | Records with `hasImpact:false` carry **no** `instruments`, `mechanism`, `severity`, `severityScore`, `confidence`, `horizon`, `winners`, `losers`, `historicalAnalog`, `watchSignals`, `citedTopicIds`, `marketContext`, `qualityScores`, `is_low_quality` | 100% |
| L1.24 | Tombstone:hasImpact ratio ≤ 60% per 7-day window (high tombstone rate = LLM giving up too easily) | informational |

### Historical analog plausibility

| ID | Check | Pass |
|---|---|---|
| L1.25 | If `historicalAnalog` present: year parses to int in [1990, 2030] | 100% |
| L1.26 | If `historicalAnalog.event` present: caveat is non-empty (we want the LLM to acknowledge differences) | informational |

### Judge coverage (Phase B health)

| ID | Check | Pass |
|---|---|---|
| L1.27 | ≥ 80% of `hasImpact:true` records older than 24 h have `quality_judged_at` set | currently 0% — known regression |
| L1.28 | Every record with `quality_judged_at` also has 5 axes in `qualityScores`, each integer 1..5 | 100% |
| L1.29 | `is_low_quality === (∃ axis where qualityScores[axis] ≤ 2)` | 100% |
| L1.30 | Low-quality rate over 30-day window ≤ 30% (sanity ceiling — if higher, producer is broken, not judge) | informational |

### Implementation

A single Node script `quality/verify_ddb.js` runs all L1 checks against a paginated scan of `ECON#THREAD#` records. Output is markdown to `quality/verify/<timestamp>.md` and the loop persists per-check pass/fail counters in `quality/verify/_state.json` so iteration N+1 sees diffs from iteration N.

```bash
node quality/verify_ddb.js --window=21d --strict
# Exit 0 if all required (100%) checks pass; non-zero otherwise.
```

---

## 4. Layer 2 — Producer Lambda correctness

### Unit tests (no AWS, no LLM)

```bash
node amplify/backend/function/newsEconomicImpact/test/validator.test.js
```

Pass criterion: 31/31 pass. Tests must include (verify each is present):

| Test | What it asserts |
|---|---|
| accepts valid input | All fields preserved through `validateImpact` |
| drops unknown instruments (AAPL, RTX, BANANA) | L1.20 enforced at code level |
| drops uncited instruments | L1.17 enforced |
| drops out-of-thread topic citations | L1.16 enforced |
| invalid direction → instrument dropped | L1.12 enforced |
| invalid magnitude → normalized to "moderate" | L1.13 enforced |
| all instruments invalid → tombstone | L1.22 + L1.23 |
| empty citedTopicIds → tombstone | L1.15 |
| FX pairs from runtime snapshot accepted | L1.20 second clause |
| allowlist sanity (BRENT/INDA/EIS/BTC/ETH IN; NSEI/TA125/AAPL/RTX/TSM OUT) | L1.20 |
| **severity_score outside band → clamped** (NEW — Phase A consistency check) | L1.11 |
| **high-confidence + thin evidence → confidence downgraded to medium** (Phase A) | functional |
| **low-confidence + large magnitude → magnitude downgraded to moderate** (Phase A) | functional |
| **mechanism without `[topic-xxx]` → qualityFlags includes `mechanism_missing_inline_citation`** | L1.18 |
| **severe/moderate + thin winners or losers → severity downgraded one notch** (Phase A) | functional |
| **historical analog year < 1990 or > 2030 → analog dropped** | L1.25 |
| **stale market context → qualityFlags includes `market_context_stale:<sources>`** | functional |

### Live invoke (smoke test, ad-hoc)

```bash
aws lambda invoke --function-name newsEconomicImpact \
  --invocation-type RequestResponse --payload '{}' --region ap-northeast-1 \
  --cli-binary-format raw-in-base64-out /tmp/econ_out.json
cat /tmp/econ_out.json
aws logs tail /aws/lambda/newsEconomicImpact --since 5m --region ap-northeast-1 | grep -E "QC|Drop|tombstone|done"
```

Pass criterion: log line `Economic impact done: N generated, M tombstoned, K skipped, F failed`, F = 0.

### Cron health

```bash
aws events describe-rule --name TriggerNewsEconomicImpact --region ap-northeast-1 \
  | jq '{State,ScheduleExpression}'
```

Pass: State = `ENABLED`, ScheduleExpression = `cron(30 7 * * ? *)`. Last successful invocation in CloudWatch within 26 h.

---

## 5. Layer 3 — Judge Lambda correctness

### Unit tests

```bash
node amplify/backend/function/newsEconomicQuality/test/judge.test.js
```

Pass criterion: 26/26 pass.

### Live invoke

```bash
aws lambda invoke --function-name newsEconomicQuality \
  --invocation-type RequestResponse --payload '{}' --region ap-northeast-1 \
  --cli-binary-format raw-in-base64-out /tmp/judge_out.json
aws logs tail /aws/lambda/newsEconomicQuality --since 10m --region ap-northeast-1
```

Pass: log line `Quality judge done: J judged, L low-quality, F failed`. F ≤ 20% (Gemini free-tier 429s are tolerated). After run, L1.27 coverage rises.

### Cron health

Schedule must be `cron(0 8 * * ? *)` — deliberately aligned with Gemini quota reset. Verify last invocation within 26 h.

---

## 6. Layer 4 — REST proxy contract

Endpoint: `$ENDPOINT = https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy`

| ID | Call | Pass |
|---|---|---|
| L4.01 | `POST {action:"economic_impact",payload:{threadId:"<known good>"}}` | `success:true, data` with all fields from §2 |
| L4.02 | `POST {action:"economic_impact",payload:{threadId:"<known tombstone>"}}` | `success:true, data:{hasImpact:false,...}` |
| L4.03 | `POST {action:"economic_impact",payload:{threadId:"<bogus>"}}` | `success:false` OR `success:true, data:null` — must NOT 500 |
| L4.04 | `POST {action:"economic_impact_list",payload:{limit:5}}` | `success:true, data:[…]` length ≤ 5, every item passes §2 contract |
| L4.05 | `POST {action:"economic_impact_list",payload:{country:"Iran"}}` | every returned item mentions Iran in winners/losers/threadAnalysis country list |
| L4.06 | `POST {action:"economic_impact_list",payload:{minSeverity:"severe"}}` | every returned item has `severity:"severe"` |
| L4.07 | `POST {action:"economic_top_movers",payload:{limit:5}}` | `success:true, data:[{instrumentId,citations,…}]` |
| L4.08 | All three actions: response ≤ 6 MB (Lambda payload limit) | informational |
| L4.09 | All three actions: 95th-percentile latency < 1500 ms cold, < 400 ms warm | informational |

Script: `quality/verify_proxy.sh` — bash + curl + jq. Pass if all required checks PASS.

---

## 7. Layer 5 — Hook correctness (frontend)

```bash
cd global-perspectives-starter/frontend
npx vitest run src/test/useEconomicImpact.test.js
```

Pass: all 12 existing tests pass. Coverage must include:

| Test | Asserts |
|---|---|
| useEconomicImpact: null threadId → no fetch | hook respects guard |
| useEconomicImpact: cache hit within TTL → no fetch | localStorage path |
| useEconomicImpact: cache miss → fetches and stores | network path |
| useEconomicImpact: API error → data=null, error set, no throw | fail-silent contract |
| useEconomicImpact: malformed cache JSON → falls back to fetch | resilience |
| useDisruptionsList: passes minSeverity/country/limit filters into fetcher | filter passthrough |
| useDisruptionsList: empty array on error | fail-silent |
| useDisruptionsList: cache keyed on stable filter object | refetch only on filter change |
| useTopMovers: empty array on error | fail-silent |

**Missing tests to add** (gaps found during this audit):

- `useDisruptionsList`: identical filters in different render order → cache hit (currently a JSON-key-order risk).
- `useEconomicImpact`: localStorage quota exceeded → fetch continues, no throw.
- `useTopMovers`: limit param passes through to fetcher.

---

## 8. Layer 6 — Atom correctness

`src/test/atoms_economic.test.jsx` (NEW — to be added):

| Atom | Variant | Renders correctly? |
|---|---|---|
| SeverityBadge | level=severe, score=85, size=md | red badge "SEVERE 85" |
| SeverityBadge | level=moderate, score=undefined, size=sm | amber badge "MODER." no score |
| SeverityBadge | level=garbage | falls back to amber, label uppercase of input |
| MechanismCard | full record per §2 | renders all 6 sections (header/instruments/mechanism/winlose/analog/watch) |
| MechanismCard | hasImpact:false | renders nothing |
| MechanismCard | winners=[], losers=[] | hides winlose block (no empty container) |
| MechanismCard | historicalAnalog=null | hides analog block |
| MechanismCard | watchSignals=[] | hides watch block |
| MechanismCard | instruments[].rationale missing | InstrumentChip still renders, no tooltip text |
| DisruptionRow | scopeId absent | renders as `<div>`, not `<Link>` (no broken nav) |
| DisruptionRow | instruments.length=10 | shows first 3 + "+7 more" |
| DisruptionPreview | onExpand callback fires on click | click handler wired |
| QualityFlag | is_low_quality=true with 2 failing axes | renders chip, tooltip lists both axes |
| QualityFlag | is_low_quality=undefined (Phase B not yet run) | renders nothing |
| QualityFlag | is_low_quality=false | renders nothing |

---

## 9. Layer 7 — Per-page surface verification

Verify the **actual current state** (post-redesign, post-P0 wiring). Where the doc says one thing and code says another, fix the doc. Where the code is missing what the doc says, fix the code.

### 9.1 `/economy` — EconomyPage (`EconomyPage.jsx`)

| Check | Pass |
|---|---|
| `useDisruptionsList({ limit: 200 })` is the only hook for the list | code review |
| Empty-state copy renders when `disruptions.length === 0` | manual + unit |
| Facet filters (severity, horizon, instrument, country) each narrow the list | manual click-through |
| Sort: severity desc → severityScore desc → generatedAt desc | code review |
| Top Movers panel uses `useTopMovers(10)` and links each ticker to a filtered list view | manual click-through |
| `updatedAt` in header derives from `disruptions[0].generatedAt` | code review |
| Every row renders via `DisruptionRow` (no per-row hand-rolled markup) | code review |

### 9.2 `/` — Home (`Home.jsx`)

| Check | Pass |
|---|---|
| `useDisruptionsList({ limit: 100 })` builds `disruptionByThread` map | code review |
| Topic-kicker chip renders `SeverityBadge` only when `disruptionByThread[t.threadId]` exists | manual: spot a thread with severity, one without |
| Story-arc link rewrites to `/weekly/thread/{id}?tab=economy` when disruption present, else `/weekly/thread/{id}?tab=timeline` | manual |
| No console errors when disruption list is empty (cold incognito visit) | DevTools |
| Background poll does not re-fetch list inside cache TTL | DevTools network tab |

### 9.3 `/daily` — DailyPage (`DailyPage.jsx`)

| Check | Pass |
|---|---|
| "Today's Economic Footprint" section renders only when `disruptions.length > 0` | manual |
| Lead-disruption headline wraps in `<Link to=/weekly/thread/{scopeId}?tab=economy>` when scopeId present (P0.1) | manual |
| Top-5 instruments aggregated by citation count | code review |
| "View all →" link points to `/economy` | manual |
| `severeCount` only counts severity==='severe' (not severityScore≥70) | code review |

### 9.4 `/weekly/thread/:threadId` — ThreadPage (`ThreadPage.jsx`)

| Check | Pass |
|---|---|
| `useEconomicImpact(threadId)` only fires when `thread` is loaded (guard `thread ? threadId : null`) | code review |
| `hasEconomy = economicImpact && economicImpact.hasImpact !== false` | code review |
| 4th content tab "Economy" appears only when hasEconomy | manual |
| Tab label shows `instruments.length` as a count | manual |
| Tab severity icon matches `economicImpact.severity` | manual |
| `?tab=economy` query param auto-selects the tab on mount | manual deep-link test |
| `DisruptionPreview` in right rail click → scrolls/opens Economy tab | manual |
| `MechanismCard` renders full §2 record | manual |
| When hasEconomy=false: no Economy tab, no DisruptionPreview, no errors | manual |

### 9.5 `/weekly/country/:name` — CountryPage (`CountryPage.jsx`)

| Check | Pass |
|---|---|
| `useDisruptionsList({ country, limit: 5 })` only when `decodedName` is set | code review |
| Right-rail "Economic Disruption" panel renders only when `countryDisruptions?.length > 0` | manual |
| Each row links to `/weekly/thread/{scopeId}?tab=economy` | manual |
| Slice to top 3 with separator | manual |
| Hidden when country has zero disruptions (e.g. small country) | manual |

### 9.6 `/weekly/countries` — CountryListPage (`CountryListPage.jsx`)

| Check | Pass |
|---|---|
| `useDisruptionsList({ limit: 200 })` builds `maxSeverityByCountry` | code review |
| Sort option "Disruption" orders by SEVERITY_RANK desc | manual |
| `SeverityBadge` chip on each card shows the max severity touching that country | manual |
| Country with zero disruptions shows no chip | manual |
| Filter "All" still default; selecting "Disruption" sort doesn't break other filters | manual |

### 9.7 `/map` — WorldMapV2 (`WorldMapV2.jsx`)

| Check | Pass |
|---|---|
| `useDisruptionsList({ limit: 200 })` powers the Economy lens | code review |
| 4th lens "Economy" appears in lens menu | manual |
| When Economy lens active: rings drawn on countries with disruptions; ring color matches severity | manual |
| Clicking a country with disruptions opens the side panel with `selectedCountryDisruptions` (top 3 + WINNER/LOSER badge per record) | manual |
| Time-window control hidden on Economy lens (irrelevant) | manual |
| Switching back to Risk lens removes rings cleanly (no orphan SVG nodes) | DevTools |

### 9.8 `/disclosures` — Disclosures (`Disclosures.jsx`)

| Check | Pass |
|---|---|
| "Economic Disruption Analysis" h2 present | manual |
| LLM-as-judge methodology paragraph present (Phase B) | manual |
| Link to Zheng et al. 2023 reference present (or footnote) | manual |
| Anti-hallucination guards (4 numbered) present | manual |

### 9.9 Layout (`Layout.jsx`)

| Check | Pass |
|---|---|
| Header nav link `/economy` present | manual |
| Footer link `/economy` present | manual |
| Active state on `/economy` route lights up the nav item | manual |

### 9.10 App router (`App.jsx`)

| Check | Pass |
|---|---|
| Route `<Route path="/economy" element={<EconomyPage />} />` present | code review |
| No dangling import of any removed economic component | code review |
| Build succeeds (`npm run build`) | CI |

### 9.11 Pages that should NOT have economic surface

These were intentionally cleaned in P0.4 — any reappearance is a regression:

| Page | Forbidden |
|---|---|
| WeeklyPage | no `useDisruptionsList`, no `SeverityBadge` (except CATEGORY_ORDER label use, which is unrelated), no `disruption` prop on StoryCard |

Add grep guard:
```bash
! grep -E "useDisruptionsList|useEconomicImpact|useTopMovers|MechanismCard|DisruptionRow|DisruptionPreview" \
    global-perspectives-starter/frontend/src/components/WeeklyPage.jsx
```

---

## 10. Layer 8 — End-to-end browser verification

The atoms can render correctly but the cross-page journey can still be broken (stale cache, route mismatch, missing tab param wiring). The browser check is the only way to catch this.

### Click-through script (manual but standardized)

Run on `npm run dev` (port 5173). For each step, expected behavior is listed.

| Step | Action | Expected |
|---|---|---|
| 1 | Open `/` (incognito) | Home loads. ≥1 topic card has a severity chip on its kicker. No console errors. |
| 2 | Click a severity-chip card's "Economic impact →" link | Lands on `/weekly/thread/<id>?tab=economy`, MechanismCard rendered, no flicker. |
| 3 | Click a country in MechanismCard winners or losers list | Lands on `/weekly/country/<name>`. Right rail shows "Economic Disruption" panel. |
| 4 | Click a row in right rail Economic Disruption panel | Lands on `/weekly/thread/<id>?tab=economy`. Same MechanismCard renders. |
| 5 | Navigate to `/economy` via header nav | EconomyPage loads. Severity-grouped list, Top Movers right rail. |
| 6 | Toggle each facet filter | List narrows correctly; clearing filter restores list. |
| 7 | Click any row | Lands on the thread's Economy tab. |
| 8 | Navigate to `/map` | Map loads, Risk lens default. |
| 9 | Click Economy lens | Rings appear on countries with disruptions. |
| 10 | Click a ringed country | Panel opens with top-3 disruption rows. |
| 11 | Click a disruption row in panel | Deep-links to thread Economy tab. |
| 12 | Open DevTools Application tab → localStorage | `gp_econ_*`, `gp_disruptions_*`, `gp_top_movers_*` keys present with TTL data. |
| 13 | Wait > 30 minutes OR manually clear those keys → reload page | Hooks re-fetch; no stale data shown. |
| 14 | Disconnect network in DevTools → reload | Cached data still renders (LocalStorage fallback). No spinner forever. |
| 15 | Visit a thread known to have `hasImpact:false` (tombstone) | No Economy tab, no DisruptionPreview, no console errors. |
| 16 | Visit a thread whose `economic_impact` 404s (deleted record) | Page renders without Economy tab; no error toast. |

Pass criterion: every step matches expected behavior; zero JS errors in console across the whole run.

### Per [`feedback_test_ui_in_browser.md`](.claude/projects/-Users-benlai-Downloads-globalPerspective-v1/memory/feedback_test_ui_in_browser.md), the above must actually be run — type-check + vitest pass ≠ feature works.

---

## 11. Layer 9 — Calibration & drift checks

These produce informational reports, not pass/fail gates. Their purpose is to catch silent quality regression that all the schema checks above miss.

| Metric | Window | Healthy band | Alarm if |
|---|---|---|---|
| Severity distribution (% severe / moderate / minor) | rolling 30 d | 5-25% / 50-80% / 5-25% | drifts ≥ 2σ in 7 d |
| Tombstone rate (% hasImpact=false) | rolling 30 d | 20-40% | < 10% (LLM never refusing) or > 60% (LLM giving up) |
| Median instruments per record | rolling 30 d | 2.5-4.0 | < 2 or > 5 |
| Confidence distribution (% high / med / low) | rolling 30 d | 10-25% / 50-70% / 10-30% | > 40% high (over-confident) |
| Phase A flag rate per record | rolling 30 d | ≤ 1.5 flags/record avg | > 2.5 flags/record |
| Inline-citation compliance | rolling 7 d | 100% | < 95% — current state is 0% |
| Judge coverage on records > 24 h old | rolling 7 d | ≥ 80% | < 50% |
| Judge low-quality rate | rolling 30 d | 5-25% | > 30% (producer quality regressed) or < 2% (judge too lenient) |

Implementation: `quality/calibration_report.js` writes `quality/calibration/<YYYY-WW>.md`. Run weekly (can be a `/schedule` routine).

---

## 12. Layer 10 — the regression loop (rapph-loop spec)

The user asked for a **rapph loop** — repeated `/loop` iterations that keep running until every required check is green. Spec:

### Loop entry conditions

The loop fires on any of:
- Deploy of `newsEconomicImpact` or `newsEconomicQuality`
- Edit to any hook in `src/hooks/use{Economic,Disruptions,TopMovers}*.js`
- Edit to any atom in `src/components/atoms/{Mechanism,Disruption,Severity,Quality}*.jsx`
- Edit to any page in §9.1–§9.10 file list
- Manual user trigger (e.g. weekly health check)

### Single iteration

```
1. quality/verify_ddb.js --window=21d --strict      # §3
2. node amplify/backend/function/newsEconomicImpact/test/validator.test.js  # §4
3. node amplify/backend/function/newsEconomicQuality/test/judge.test.js     # §5
4. bash quality/verify_proxy.sh                     # §6
5. cd global-perspectives-starter/frontend && npx vitest run src/test/  # §7-§8
6. grep guards (§9.11 forbidden imports on WeeklyPage)
7. aws events describe-rule for both crons (§4 cron health, §5 cron health)
8. Write iteration report to quality/verify/iteration-<N>.md
9. Diff against previous iteration report; surface new failures up top
```

### Loop exit condition

All required (100%) checks pass for two consecutive iterations spaced ≥ 1 h apart (to catch flapping). Informational checks may remain amber.

### Loop fix policy

When a check fails inside the loop:
- **Schema failures (L1.xx)** — root-cause in producer or judge code, NOT bandaid the DDB record. Land the fix; the next cron will re-emit corrected records.
- **Unit-test failures** — fix the code, not the test. Tests are the contract.
- **REST/proxy failures** — root-cause in `newsSensitiveData` action handler.
- **Page-level failures** — fix the page; do not silently delete features (per [`feedback_no_unauthorized_removal.md`](.claude/projects/-Users-benlai-Downloads-globalPerspective-v1/memory/feedback_no_unauthorized_removal.md)).
- **E2E failures only** (with all unit/schema green) — flag for human review; do not auto-fix.

### Loop will NOT do

- Auto-delete DDB records
- Auto-promote a model swap
- Auto-merge changes to `/disclosures` (methodology copy is sensitive)
- Auto-modify the instrument allowlist
- Touch `docs/config.js` (per CLAUDE.md)

---

## 13. Initial fix queue (loop iteration 1 should target these)

Based on §0a findings:

| # | Finding | Fix candidate |
|---|---|---|
| 1 | 26/26 records lack inline `[topic-xxx]` in mechanism | Re-examine `buildPrompt()` rule 6 wording; consider hardening to a few-shot example with bracketed citations; consider rejecting the JSON in `validateImpact` (tombstone) rather than flagging — but that may cause every record to tombstone if the LLM is fundamentally broken on this. Diagnose first. |
| 2 | 0/26 records have `quality_judged_at` | Check `newsEconomicQuality` last invocation: `aws logs tail /aws/lambda/newsEconomicQuality --since 48h`. Either (a) cron never fires, (b) every Gemini call 429s, (c) writeback path throws silently. Fix root cause. |
| 3 | `ECONOMIC_DISRUPTION.md` per-page surface map still lists WeeklyPage with SeverityBadge | Edit doc to remove the WeeklyPage row (P0.4 cleaned it). |
| 4 | Only 5 distinct days of records (window: 2026-05-19 → 2026-05-23) | Not a verification bug. Add a `Coverage` line to the iteration report so we can see when we cross 30 days (~2026-06-18). |
| 5 | Atom test file does not yet exist | Create `src/test/atoms_economic.test.jsx` covering the §8 variants. |
| 6 | `useDisruptionsList` cache-key uses `JSON.stringify` — key-order-dependent | Stabilize via fixed-field-order serialization or move to `useMemo`-derived stable string. Add a unit test. |
| 7 | `verify_ddb.js`, `verify_proxy.sh`, `calibration_report.js` do not yet exist | Author these as part of iteration 1. They're the executable spine of the loop. |

---

## 14. Definition of done

The Economic Disruption layer is "verified" when:

- All §3 (L1.xx) required checks are 100% PASS across 2 consecutive loop iterations
- All §4 + §5 unit tests pass
- All §6 (REST) required checks pass
- §7 hook tests pass with the 3 added cases
- §8 atom test file exists and all variants pass
- §9 per-page checks all pass, including the §9.11 negative grep guards
- §10 click-through script runs clean (zero console errors, every step matches)
- `quality/verify/iteration-N.md` exists with all greens and is committed
- This document (`ECONOMIC_VERIFICATION_PLAN.md`) is referenced from `ECONOMIC_DISRUPTION.md` in the Testing section

After that, the loop runs on-demand per §12 entry conditions.

---

## 15. Open questions (resolve before iteration 2)

1. Should `mechanism_missing_inline_citation` upgrade from a Phase A flag to a tombstone trigger? Risk: every record tombstones if the model is broken on this dimension. Benefit: forces upstream fix.
2. Should we accept Phase B coverage < 100% indefinitely (Gemini quota) or pursue a paid-tier upgrade? Quota window is the binding constraint, not money — but $5-10/mo would buy guaranteed coverage.
3. Should the loop self-schedule (RemoteTrigger) or run only on git push hooks? Self-scheduling drift: 30% cron miss within 7 days observed in past projects. Git-hook is tighter.
4. Should `useDisruptionsList` cache TTL drop from 30 min to 10 min for `/economy` (high-traffic landing) and stay 30 min elsewhere? Net cost ~$1/mo if /economy gets traffic; not yet warranted.
