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
   a date). Cap 5. **Selection (revised after drafts 1 and 2):** a story must be an event (something happened on a
   date; periodic statements and reports do not qualify). A story qualifies by either (a) links to tracked stories or
   (b) risk tier elevated or high with reports from 2+ outlets. Rank qualified stories by links, then risk tier. A
   single-outlet story ranks last and its fact line says it rests on one source. Links alone over-select (draft 2
   dropped Hormuz, 12 vessels struck, for a one-headline boarding); risk alone selects tolls (draft 1).
2. **Our view moved** — tracked stories whose *read* changed this week, not whose score wobbled. **Threshold (revised
   after drafts 1 and 2):** include only a change in the expected path, or a risk-score move of 10 or more that holds
   at the latest regeneration, and only for stories at moderate risk or above (a 20→10 move on a low-risk story is
   not a view moving). Each line says what we now expect that we did not before, in one plain
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
Selection is never by coverage volume. The JSON is complete (every qualifying item); length caps apply to the
rendered email only, never to the file.

## Why, and what else has to exist (operator discussion, 2026-10-20)

**Why a reader opens it.** Three reasons, nothing else: not to miss a change in the countries they follow; to check
their own read against a dated, labelled view from elsewhere and later see who was right; to lift a sourced fact line
into their own note. A recap of the news (today's brief) serves none of the three.

**What we want from it.** (1) Build the record: every week adds dated judgments and scored calls to a history that
cannot be rewritten; in six months the history is the product and the weekly is how it is built and shown. (2) Get
ten conversations: the weekly is the cheapest thing to put in front of ten potential buyers; the personal layer is
what makes signing in worth it.

**Gaps the weekly cannot paper over** (found in step 1, in order of importance):
1. Forecast settling has never run under the question scheme: 44 sampled questions, 0 verdicts. The Forecasts
   section is empty until it does. The settle code exists (`SETTLE#` rows, model draft, 3-day grace) and has never
   been completed; it needs its own check and a weekly operator confirm, like the alerts.
2. No corrections store. The site's corrections feed is really the drift notes. A small operator-written store, read
   by the weekly and the story page.
3. First reads are thin: 14 of 59 stories born in the week had any analysis. Run the story analysis on the day a story
   is born, not days later.
4. Country drift notes are written daily and shown nowhere. The personal layer is their first outlet; the country
   page should show them too.
5. All 56 web links are model-inferred ("possibly related"). The "defensible" tier the spec promises needs an operator
   review command, like the alert confirm.
6. Duplicate stories for one event (Pakistan, Brazil, settlers) broke both drafts. The birth-of-story step should
   check for duplicates; the threads CLI merge stays the manual fallback.

**Not now:** per-user generated text, charts, more map features, more sections. Everything above is about making the
judgment trustworthy; the design canvas already covers how it looks.

**Order from here:** step 3 (skill, check, publish, first real run) → forecast settling → `features/weekly` page and
email renderer → cloud schedule and confirm → corrections, early analysis, defensible-link review, one at a time.

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
- [x] 2. Drafts by hand for the week ending 2026-10-18 (Sonnet, 2026-10-20). Draft 1: honesty rules held (12 facts
      cited, 21 judgments with confidence, dates after the send); review found selection by risk score picked
      non-events, "moved" reported 3-5 point noise, judgments too compressed. Draft 2 under revised rules: judgments
      now plain sentences with the mechanism and a reason per test; "moved" lines in the wanted form (a week ago we
      expected X, now Y, because Z); JSON Schema written and validated (ajv). Review found link-first selection
      over-corrected (dropped Hormuz for a single-source boarding), a low-risk story passed the "moved" bar, and the
      email word cap was applied to the JSON. Rules revised a second time (above) and frozen; draft 3 is produced by
      the real procedure in step 3 as its first test. Files: scratchpad `weekly/2026-10-18.draft2.{json,txt}`,
      `weekly/schema.json`. Nothing sent; calls not logged.
- [ ] 3-6 replaced by the build stages below (2026-10-20).

## Build stages for the first new-path send, Sunday 2026-10-25 (written 2026-10-20; nothing started)
Target: the week ending 2026-10-25 goes out as the analyst's weekly at 14:00Z. The pipeline reads the live tables
directly (as drafts 1-2 did); it switches to `record/` once `newsStoryRecord` exists (record plan step 2). Code selects,
the agent writes, code checks: selection rules are deterministic in the pull script, so the agent never chooses what
counts. Each stage is one sequential Sonnet agent; the operator checks between stages.

### W0: content v2 frozen (from the 2026-10-20 digest discussion) — done 2026-10-20
- [x] `backend/weekly/README.md` (the group's front door: the three-names line, what it owns (`weekly/` in S3 only),
      what it reads, what reads it, how to run each script) and `backend/weekly/sections.js` (the section model).
- [x] Sections, in order: **Lead** (one paragraph: the week's most important change as an argument: what happened,
      what we now expect, what would prove us wrong); **Where our view moved** (changelog: one line per story, before →
      after with the mechanism; numbers on the page, one sentence per line in the email; "none this week" stated);
      **The trace** (up to 5 anchor stories: where it was, where it is (dated steps), where it goes: the branches we drew
      with p, trigger and date; branch status shows "not yet checked" until the record's trigger check exists);
      **Next week's dates** (triggers and forecast due dates in the coming 7 days); **New this week** (2-3, the frozen
      selection rule, first read labelled low); **What we did not see** (coverage footer). No scoreboard, no Brier
      number (that stays on /track-record). "Still watching" is dropped.
- [x] `backend/weekly/schema/weekly.schema.json` v2 (JSON Schema; from scratchpad `weekly/schema.json`, reshaped to the sections
      above; every judgment `{text, label:'judgment', confidence}`; every fact `{text, sources[]}`).

Notes from W0: required sections are lead, moved, coverage; trace, dates, new are skipped when empty. Caps: moved 6,
trace 5, new 3; the content-v2 cap of 3 on "New this week" replaces the older "JSON complete" rule for that section
(qualifying items beyond 3 are not stored). Email word caps (110/140/200/80/180/70) are first guesses to tune after a
real render. Example `valid-2026-10-18.json` is reshaped from draft 2; its lead and step dates are reconstructions,
flagged in its `notes.unconfirmed`.

### W1: pull (read-only, deterministic) — built on lane/weekly (B), switched to world/; merge pending
- [ ] `backend/weekly/pull.mjs --week-ending YYYY-MM-DD`: reads NewsCache `archive#` (7 days + 30 for births),
      `THREAD_ANALYSIS`, `DRIFT#`/`DRIFTLOG#` (thread + country), `PRED#` scenarios with triggers, `Q#` due/verdicts,
      `web/latest.json`; applies the frozen selection rules (event-only; links or elevated risk with 2+ outlets;
      single-outlet last; "moved" = expected-path change or a 10-point move that holds, only at moderate risk or above);
      writes one inputs JSON with the candidates per section and the coverage facts. Tests on fixtures.

W1 lane notes (2026-10-20): read-only AWS CLI adapter and pure fixture-tested selection added on lane/weekly. Earliest observed birth is bounded by the 30-day pre-week lookback; conservative event and directional-path gates expose exclusions for review. Live latest web is retained as current evidence, not a historical reconstruction.

W1 migration notes (2026-10-20): rebased onto coordinator world/ and provenance commits. Shared readers now supply normalized archive, analysis/history, deduplicated drift, scenario membership, births, outlets, tiers, coverage and forks; only weekly selection and hashing remain local. CLI is isolated to the local generic transport. Requested coordinator readers for sampled questions and dated S3 web provenance; final dry-run regeneration waits for those shared APIs. Sunday web/2026/10/18.json was checked read-only and is absent, so the documented latest fallback applies.

### W2: write + check + publish — built on lane/weekly; final dry run waits for two shared readers (in progress)
- [ ] `.claude/skills/weekly-brief/SKILL.md`: the procedure only, pointing at `backend/weekly/` (read the inputs JSON; write each section to the schema;
      honesty rules; no fact without a source; dates after the send; numbers only from the inputs).
- [ ] `backend/weekly/check.mjs`: schema + rules (every fact sourced from the inputs, every judgment labelled,
      every date after the send, every threadId in the inputs, word caps for the email rendering only).
- [ ] `backend/weekly/publish.mjs`: writes `weekly/YYYY-MM-DD.json` create-only with `status:'published'` and
      `weekly/latest.json` (via `backend/shared/src/s3json.js`); `backend/weekly/hold.mjs` sets the week to `held` (publish-unless-vetoed).
- [ ] Dry run on the week ending 2026-10-18 (compare with draft 2), written to scratchpad, not S3.

W2 lane notes (2026-10-20): skill, schema/provenance checker and create-only publish/append-only hold implemented with fake-client tests. Dry-run artifacts are in gp-mailbox/artifacts/weekly-2026-10-18.{inputs,v2}.json; check passes. New top three match W0. Moved is empty: score/framing language cannot establish an expected-path revision; ambiguous trajectories remain in pathReviewCandidates. Coverage is 11/59 analysed by Sunday rather than W0's 14 current analyses. The JSON retains all 98 selected future date occurrences; the example had three hand-picked dates. No publication, prediction-log write or send was performed.

### W3: email — built on lane/weekly (runtime-only `_weekly`, current-Sunday gate); deploy needs sender IAM (operator yes)
- [ ] `newsEmailSender/src/_weekly` symlink to `backend/weekly/` (`scripts/lambda.sh` zips it like `_shared`; check the
      script handles a second symlink, extend it if not).
- [ ] `newsEmailSender` weekly mode reads `weekly/latest.json` (skips `held`); `renderWeeklyEmail.js` rewritten for the
      v2 sections (600 px table, light, risk as number + word); links to existing story and country pages (the weekly page
      comes in W5). Tests; deploy (standing Lambda auth, diff first).
- [ ] Send-to-self: one render sent only to the operator address for a phone check (operator yes for that send).

W3 lane notes (2026-10-20): sender weekly mode and renderer prepared on lane/weekly: S3 latest with held/already-sent gates, relative _weekly symlink, six-section light table, labels/risk words, logged-deadline wording, whole-block email budgets and structure/escaping tests. HTML/text artifacts are in gp-mailbox/artifacts. Read-only deployed diff found repo-ahead shared helpers only. IAM and zip verification requested from the coordinator; rsync -aL already follows the extra symlink. No deploy, send-to-self, live S3 write or schedule change performed. Browser inventory is empty, so visual phone review remains with the coordinator. Final DONE waits for the shared world reader integration required in coordinator.md.

W3 audit follow-up (2026-10-20): runtime/sections.js is the single model, with sections.js as a compatibility symlink for existing guards and schema tests; sender _weekly points only at runtime/. Staging verifies that no fixtures, tools, tests or examples ship through _weekly. Sender now logs and skips snapshots not matching the current UTC Sunday, even with force, as well as missing/held/nonpublished and already-sent weeks. Hermetic sender tests cover stale and future weeks.

### W4: first real run and the switch (operator yes)
- [ ] Saturday 2026-10-24: pull + write + check for the week ending 2026-10-25 run from this machine (the cloud run is
      W6); operator reads the draft; publish by Sunday 13:00Z unless held.
- [ ] Disable `TriggerWeeklyBrief` (old Lambda stops writing) and point the 14:00Z send at the new path (fresh yes:
      user-facing send). If W1-W3 are not ready by Saturday, the operator chooses: hold the 25 Oct send or let the old
      digest go once more.

### W5: the weekly page (after the first send)
- [ ] `features/weekly/` at `/briefings/weekly?week=`; Briefings `WeeklyMode` deleted. Needs the Worker allowlist + its
      reader IAM for `weekly/` (operator yes, frontend release).

### W6: cloud schedule and retirement
- [ ] `backend/weekly/routine/` (lane B, after W1-W3 DONE): `routine.json` (cron Sunday 06:00Z, repo, model Sonnet, the
      exact prompt: run pull, write per SKILL.md, check, publish; stop on a failed check), `iam-policy.json` (read
      NewsCache, SummarizeAndPredict, GlobalPerspectivePredictionLog, s3 web/*; write s3 weekly/* only), `README.md`
      (create/update the routine from routine.json, rotate keys, veto with hold.mjs, read a run's log). The routine and
      the IAM user are created only by the coordinator from these files, with the operator's yes.
- [ ] Headless Claude Code run on a schedule in the cloud with a credential scoped to `weekly/*` write and the tables'
      read (operator yes); operator notified with the draft.
- [ ] Retire `newsWeeklyBrief` (after one new-path send); ARCHITECTURE flow 5, STATUS, reference regen, Atlas.

## Where it lives (operator, 2026-10-20)
- Frontend: a new feature folder `features/weekly/` (page, hook reading `weekly/latest.json` and past weeks, the
  section model shared with the email renderer; public weekly for everyone, the member layer on top from followed
  countries + that week's country drift notes). It replaces Briefings' `WeeklyMode`. Route `/briefings/weekly`
  (`?week=YYYY-MM-DD`); `/weekly/*` is taken by the countries list. Email links carry the week only, never a token.
- **One backend source of truth: `backend/weekly/`** (operator, 2026-10-20). It holds the schema, the pull, check,
  publish and hold scripts, the shared section model (`sections.js`, the one definition of what each section contains
  and in what order) and its README. Nothing about the weekly's content is defined anywhere else.
- The agent procedure stays in `.claude/skills/weekly-brief/SKILL.md` (where Claude Code finds skills) and holds only
  the procedure; every rule, field and path it uses comes from `backend/weekly/`.
- The email stays in `backend/distribution/newsEmailSender` (one Lambda owns sending); its weekly template imports the
  section model from `backend/weekly/` through a committed `src/_weekly` symlink, zipped as real files like `_shared`.
- The page `features/weekly/` uses a mirrored copy of the section model's core block, checked by
  `scripts/check-shared-sync.mjs` (as links.js and board.js are).
- Design: the Personal Weekly canvas, https://claude.ai/artifact/CTKb75Mv3fC9Y6BV46hKnK (desktop, phone, email;
  the site's tokens; risk as number + word; the digest band marks where the personal layer ends).

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
- 2026-10-20: one backend source of truth for the weekly: `backend/weekly/` (operator); stages W0-W3 repointed.
- 2026-10-20: build stages W0-W6 written for a first new-path send on 2026-10-25; content v2 recorded in W0.
- 2026-10-20: decision 3 revised to publish-unless-vetoed (no human gate, operator); the weekly will read `record/` once
  `PLAN_2026-10-20_record_backend.md` step 2 exists.
- 2026-10-20: Studio board brainstorm recorded in `PLAN_2026-10-20_board.md`; if adopted, its board weekly replaces
  the "your countries" half of the personal weekly.
- 2026-10-20: "Why, and what else has to exist" recorded after the operator discussion; explainer artifact built
  from it (temporary; the Atlas stays the one living artifact).
- 2026-10-20: plan written after the content review of the 2026-10-18 brief (accurate, disciplined, shallow by prompt
  design; selection by volume; inputs limited to the thread analysis summary).
