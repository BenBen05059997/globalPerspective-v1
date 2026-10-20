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
   a date). Cap 5, ranked by risk tier then by links to tracked stories.
2. **Our view moved** — tracked stories whose judgment changed this week: last week's read → this week's, and the
   mechanism. From drift notes plus the agent's comparison with last week's file. 3 lines max.
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
- no line may claim a figure, date or name that is not in the cited source.
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
- [ ] 1. Confirm the inputs (read-only, Sonnet agent): exact fields and keys for story birth dates, drift notes,
      forecasts due/resolved in a week, web links, corrections; which are in S3 and which in DynamoDB. Written into
      this plan under "Inputs, confirmed".
- [ ] 2. First draft by hand for the week ending 2026-10-18, from those inputs, in the JSON shape below. Reviewed by
      the operator. Nothing is sent.
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

## Inputs, confirmed
(filled by step 1)

## Log
- 2026-10-20: plan written after the content review of the 2026-10-18 brief (accurate, disciplined, shallow by prompt
  design; selection by volume; inputs limited to the thread analysis summary).
