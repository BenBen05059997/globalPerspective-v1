# The analyst's weekly: an agent-written brief from the week's data

Status: active (2026-10-20; operator decisions below; first run by hand on the week ending 2026-10-18)

## Decisions (operator, 2026-10-20)
1. The weekly brief becomes the **analyst's weekly**: what changed in our view, forecasts scored, new events with a
   first read, with every judgment labelled. It stops being a digest of the most-covered stories.
2. It is produced by a **headless Claude Code run on a schedule, in the cloud**, following a skill in this repo. The
   run writes one JSON file; code renders the email and the Briefings page from it. The `newsWeeklyBrief` Lambda and
   its DeepSeek prompt retire once the new path has sent one week.
3. **Confirm before send** stays on: the run produces a draft, the operator approves, then it publishes. No answer by
   Sunday 13:00Z means nothing is sent that week. (Same rule as breaking alerts, decision 1 of the cleanup plan.)
4. Storage: the brief is a fact about the world, so it lives in the world bucket (`rules/DATA_STRATEGY.md`), not in
   DynamoDB. Prefix `weekly/`: `weekly/YYYY-MM-DD.json` (week ending, draft or published, carried in the file) and
   `weekly/latest.json` (the newest published one).

## What we have today (verified 2026-10-20)
- `newsWeeklyBrief` (Sun 06:00Z, `TriggerWeeklyBrief`): top 6 stories of the week **by entry count**; per story the
  model sees only the latest headline, story arc, trajectory, watch questions and outlet names; DeepSeek writes
  `fact` + `soWhat` + 3-5 watch items; the record `WEEKLY_BRIEF#<week>` is published without review. The prompt forbids
  synthesis and predictions by design, so the output is accurate and shallow.
- `newsEmailSender` (Sun 14:00Z, `TriggerWeeklyEmailSend`, live, not dry-run): renders the newest published record
  (`renderWeeklyEmail.js`, fixed 600 px table) and sends through Resend from `brief@globalperspective.net`. Sent 10
  times since 2026-06-28; the last four weeks to 2 subscribers each. Breaking and drift emails exist but are disabled.
- The Briefings page weekly mode reads the same record with its own renderer.
- Inputs that exist and the weekly never uses: per-story daily analysis (scenarios with probabilities, cause traces),
  the prediction log (`GlobalPerspectivePredictionLog`, resolved verdicts), drift rows (`THREAD#…/DRIFT#date`, country
  drift notes used by the drift email), the story web (`WEB#INDEX` links + shared actors, snapshotted to `web/`),
  story birth dates. Exact fields: confirmed in step 2 below.

## The content (the spec)
A story appears in exactly one section, by its stage:

1. **New this week** — stories born in the last 7 days. Per story: title + first seen date + outlets; *what happened*
   (fact, sourced); *first read* (judgment, low confidence, "no forecast yet" unless one is made); *possibly connects
   to* (existing stories, "possibly related" unless the defensible-edge bar is met); *first test* (one condition with
   a date). Cap 5. **Selection (revised after draft 1):** a story must be an event (something happened on a date;
   periodic statements and reports do not qualify); rank by links to tracked stories first, then risk tier, then
   entry count as a tie-break only. Risk score measures severity, not consequence.
2. **Our view moved** — tracked stories whose *read* changed this week, not whose score wobbled. **Threshold (revised
   after draft 1):** include only a change in the trajectory label/expected path, or a risk-score move of 10 or more
   that holds at the latest regeneration. Each line says what we now expect that we did not before, in one plain
   sentence, with the mechanism. 3 lines max. From drift notes plus `THREAD_HISTORY` trajectory before vs after.
3. **Forecasts** — calls that came due this week (hit / miss / unresolved, linked to the record) and calls due next
   week. Every new call made in the brief is written to the prediction log so it is scored.
4. **Still watching** — tracked stories with no change, one line each.
5. **Coverage note** — stories and outlets counted this week, what was not covered, corrections made this week.

Per-story lines where they apply (the "six lines"): fact · what changed in our read · mechanism · our call (claim,
timeframe, confidence) · what would change our mind · connects to. Every line beyond the fact is marked `judgment`.

Honesty rules (enforced by the check script, step 3):
- a `fact` line carries at least one source from our archive (archive date + entry id or URL);
- every non-fact line carries `label: judgment` and a `confidence` (low / medium / high) or a probability;
- a `connects_to` link is `possibly_related` unless it is `defensible` (temporal precedence + explicit causal signal
  + corroboration + operator sign-off);
- a watch/test item has a date after the send date;
- no line may claim a figure, date or name that is not in the cited source;
- every judgment line is one plain sentence a reader outside the pipeline can follow: the mechanism spelled out, no
  shorthand, no internal names (scenario labels, score deltas, model terms) unless explained in the line.
Selection is never by coverage volume.

## The pipeline
1. **Saturday 00:00Z, scheduled headless run (cloud)** loads `.claude/skills/weekly-brief/`, gathers the inputs for
   the week, writes the draft JSON and its working notes (sources used, facts it could not confirm), runs the check
   script, uploads `weekly/<week>.json` with `status: draft`, and notifies the operator with the draft.
2. **Operator review**: yes / drop item N / no. Yes → the file is republished with `status: published`,
   `weekly/latest.json` is updated, new calls are logged to the prediction log.
3. **Sunday 14:00Z `newsEmailSender`** reads `weekly/latest.json` (not the DynamoDB record) and sends. The Briefings
   page reads the same file.

Needs a fresh operator yes when reached: the cloud credential (read on the tables and the world bucket, write on
`weekly/*` only — an IAM change), holding the 25 Oct send (`TriggerWeeklyEmailSend` off: a user-facing send change),
retiring `TriggerWeeklyBrief`, and pointing the sender at S3 (first live send of the new format).

## Steps (in order; each ticked with its commit; docs updated in the same change)
- [x] 0. Plan written; decisions recorded (this file).
- [x] 1. Inputs confirmed (read-only, Sonnet agent, 2026-10-20): see "Inputs, confirmed". Findings that change the
      spec: no stored birth date (derive from the archive); 0 forecasts ever settled under the question scheme, so the
      forecasts section is honest-thin for weeks; no corrections store; archive gap on 10-14.
- [~] 2. First draft by hand for the week ending 2026-10-18 (Sonnet, 2026-10-20): honesty rules held (12 facts cited,
      21 judgments with confidence, dates after the send); three rule gaps found by review: selection by risk score
      picked non-events, "moved" reported 3-5 point score noise, judgments too compressed to read. Spec revised
      above; draft 2 under the revised rules, reviewed by the operator. Nothing is sent.
- [ ] 3. The skill `.claude/skills/weekly-brief/SKILL.md` (the procedure) + `scripts/weekly-brief/check.mjs`
      (schema + honesty rules) + `scripts/weekly-brief/publish.mjs` (draft → published, latest.json, prediction log).
- [ ] 4. Readers: `newsEmailSender` weekly mode and the Briefings weekly mode read `weekly/latest.json`; new renderers
      (one shared section model, two renderers). Email tested by send-to-self on a phone mail app.
- [ ] 5. Cloud scheduled run + credential (needs yes); notification to the operator; one supervised Saturday run.
- [ ] 6. Retire `newsWeeklyBrief` + `TriggerWeeklyBrief`; ARCHITECTURE flow, STATUS, reference regen, Atlas.

## JSON shape (draft; fixed in step 3)
```json
{ "weekEnding": "2026-10-18", "status": "draft|published", "generatedAt": "...", "producer": "claude-code weekly-brief v1",
  "new": [ { "threadId": "", "title": "", "firstSeen": "", "outlets": [], "fact": { "text": "", "sources": [] },
            "firstRead": { "text": "", "label": "judgment", "confidence": "low" },
            "connectsTo": [ { "threadId": "", "relation": "possibly_related|defensible" } ],
            "firstTest": { "condition": "", "by": "YYYY-MM-DD" } } ],
  "moved": [ { "threadId": "", "from": "", "to": "", "mechanism": "", "label": "judgment", "confidence": "" } ],
  "forecasts": { "resolved": [ { "id": "", "claim": "", "verdict": "hit|miss|unresolved" } ],
                 "due": [ { "id": "", "claim": "", "by": "" } ],
                 "new": [ { "threadId": "", "claim": "", "by": "", "probability": 0.0 } ] },
  "watching": [ { "threadId": "", "line": "" } ],
  "coverage": { "stories": 0, "outlets": 0, "gaps": [], "corrections": [] },
  "notes": { "sourcesUsed": [], "unconfirmed": [] } }
```

## Inputs, confirmed (step 1, read-only against live AWS, 2026-10-20; week 2026-10-12..10-18)
- **Story birth date: not stored.** `THREAD#…/TOPICS.updatedAt` is the last regeneration; `THREAD_HISTORY#` starts at
  the first analysis, not at birth. Reliable method: scan `NewsCache` (`archive#YYYY-MM-DD` items, `entries[].threadId`)
  and take the earliest archive date per thread. Window: 59 threads born (7 / 1 / 0 / 24 / 13 / 10 / 4 by day), only 14
  with a `THREAD_ANALYSIS` row, 39 with a single entry. Duplicates exist (the same event split over 2-3 threads:
  Pakistan roof collapse, Alberta base fire, Brazil Amazon, Israeli settlers); the draft must pick one.
- **Archive gaps:** no `archive#2026-10-14` item (and none for 09-14..09-29). A 10-14 birth shows as 10-15. The
  coverage note states this.
- **Drift notes:** `THREAD#<id>` and `COUNTRY#<name>` rows, SK `DRIFT#<asOf>` (60-day TTL) and `DRIFTLOG#<asOf>`
  (kept). Thread fields: `changeScore{from,to,delta}`, `priorTitle`, `currentTitle`, `triggerEvent`, `whyChanged`,
  `noSingleDriver`, `directionFlag`. They record a risk score moving and why, not a forecast changing. Window: 22 thread
  notes, 6 country notes (none 10-13..10-15). "Our view moved" compares these plus `THREAD_HISTORY#<date>.trajectory`.
- **Forecasts (`GlobalPerspectivePredictionLog`, PK/SK, no index, scan):** `PRED#<topicId>/<date>` rows carry
  `scenarios[].probability` and `triggers[{text,deadline,p,resolutionSource}]`; trigger `status` is never updated.
  Scored questions are `Q#<qid>/SAMPLED` (44 rows) with `deadline` and `clusterKey` (= threadId); verdicts are
  `Q#<qid>/DRAFT#<iso>` then (none yet) `VERDICT`. **Resolved in the window: 0.** No question has ever been settled;
  the only verdicts (137) are the legacy batch of 2026-07-24, which is what `predictions/track_record.json` (Brier
  0.154) reports. Due 10-19..10-25: 213 triggers, of which 2 are in the scored sample (Sudan SAF statement, 10-25,
  p 80; Kenya ring vaccination, 10-23, p 70). Hurricane question `33987025ca046672ecdc` reached its 10-18 deadline;
  model draft `not_yet`, in the 3-day grace.
- **Story web:** `WEB#INDEX` / SK `LATEST` equals `web/latest.json`'s `index`. `links[]` = `{from,to,confidence
  weak|medium|strong,lagDays,mechanism,cited[],country}`, `shared[]` = `{a,b,actors[],weight}`; per thread
  `THREAD#<id>/WEB` with `into[]`, `from[]`, `shared[]`. All LLM-inferred, so `possibly_related` by default. Window:
  38 of 56 links touch an active thread, 11 touch a thread born in the window.
- **Per-story analysis:** `THREAD_ANALYSIS` has `storyArc`, `trajectory` (scenario percentages as prose),
  `rootCauseChain`, `watchQuestions[≤3]`, `riskScore`, `dimensions`, `keyActors`, `groundingSources`; no structured
  scenarios. Archive `entries[].ai.prediction` / `trace_cause` are cut at 1500 chars; full scenarios are in the
  `PRED#` rows (146 of the 204 window entries have one).
- **Corrections:** no editorial-corrections store exists anywhere (no prefix, no rows, no writer). The site's
  "corrections feed" is the `DRIFT#` rows (capped at 5 for non-members). `coverage.corrections` stays `[]` until a
  store exists; drift is reported under "our view moved".
- **Citations:** an archive entry has no id; cite `archive#<date>` + `topicId` + `sources[].url` (`sources[]` has
  `source, url, title, snippet, outletCountry, tier`; no per-source date; some urls carry `&amp;`).
- **Last two briefs:** `WEEKLY_BRIEF#2026-10-11` and `#2026-10-18`, `signals[].threadId/riskScore/soWhat`,
  `watch[].{event,date,stake}`; one 10-18 watch item has an empty date (would fail the new rule). Three threads carry
  over between the two weeks (Saudi/Yemen, Russia attack, US execution).
- Working files for the week (raw pulls): scratchpad `inputs/` of this session (not in the repo).

## Log
- 2026-10-20: plan written after the content review of the 2026-10-18 brief (accurate, disciplined, shallow by prompt
  design; selection by volume; inputs limited to the thread analysis summary).
