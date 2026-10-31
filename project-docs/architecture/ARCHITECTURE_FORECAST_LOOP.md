# The forecast loop

Status: design agreed by the operator 2026-10-22 (evidence rule amended the same day, own entries only). Decision: [0038](../decisions/0038-forecast-loop.md). Code and live AWS stay the truth for what is deployed.
Evidence for every number below: the research brief of 2026-10-22 (file:line in the code it names). Code and live AWS stay the truth.

## 1. Why
The product is an analyst tool. A forecast with a verdict is what separates it from a feed and what turns a timeline into a narrative.
The loop was open when this design was agreed:
- 7,440 branches in `forecast_drawn` facts (counted 2026-10-22) (994 forks, 2026-09-05..10-19); only 44 can ever get a verdict (the weekly sample of 22, two weeks drawn).
- 2,451 branches have no question id, no p and no source, so nothing can resolve them.
- No verdict has been written. Pages said "not checked yet" for every branch, which promises a check that never comes.
- `branch.text` is the scenario label ("Most Likely"); the event is in `trigger`. A story gets a new fork almost every day (max 31 for one story).

## 2. The loop (tree)
```text
FORECAST LOOP  (weekly draw, nightly watch; one story = one thread)
|
+- 1 DRAW        weekly, model                       [NewsProjectInvokeAgentLambda]
|  +- inputs : story entry facts of the week + FACTS# premise block + arc digest
|  +- rule   : only if the story moved this week (new entry facts); at most 3 outcomes per story per week
|  |           each = an event DONE (not said), due 7-90 days out, own p, a named source that would report it
|  |           gates drop: no p, vague source, lead outside 7-90, restatement, near-duplicate of an open branch on the story,
|  |           an outcome already true at the draw, and institution names that are not exact
|  +- model  : yes (writes the outcomes)
|  +- output : forecast_drawn fact (never changed); branch.text = the event text
|  +- cost   : about $0.003-0.005 per story forecast (A/B report 2026-10-17)
|
+- 2 WATCH       nightly, no model                   [newsPredictionResolver]
|  +- inputs : record/facts (today's entries), open branches
|  +- rule   : candidates = open branches on stories with a new entry fact today
|  |                       + open branches whose due date passed 3 days ago (GRACE_DAYS)
|  |           nothing else is checked
|  +- model  : no
|  +- output : list of (branch, trigger)
|  +- cost   : zero model calls; this is what keeps the loop cheap
|
+- 3 GATHER      no model, no search                 [newsPredictionResolver]
|  +- inputs : the story's own entry facts dated after the draw date (read from record/facts)
|  +- rule   : nothing dated before the draw; nothing from other stories; no web, no news API, no page fetching
|  +- model  : no
|  +- evidence: also operator-assigned recovered articles (latest assignment per id), reassigned entries and merged-in stories; a recovered item is a headline only
|  +- output : evidence bundle (entry title, summary, url, date)
|  +- cost   : zero searches
|
+- 4 JUDGE       boxed model                         [newsPredictionResolver]
|  +- inputs : branch event text + the evidence bundle (never p)
|  +- rule   : answers yes | no | void | not_yet
|  |           yes  = verbatim quote >= 12 chars found by code in the title/summary of an entry dated after the draw, then a 2nd independent pass also yes
|  |           no   = "not reported by DUE": due + 3 days passed and no entry on the story since the draw shows it (code-enforced)
|  |           void = only one of the VOID_REASONS (lib.js); criterion_met_at_issue stays for the draw gate only, never from evidence
|  |           else not_yet: branch stays open, no cost until the next trigger
|  +- model  : yes, at most 2 calls per check
|  +- output : yes | no | void | not_yet
|  +- cost   : about 1.4k tokens per call (old drafter)
|
+- 5 RECORD      no model                            [newsPredictionResolver -> record/inbox/verdicts/ -> newsStoryRecord -> record/facts]
|  +- inputs : final answers (yes | no | void)
|  +- rule   : append one line to record/inbox/verdicts/DAY.jsonl (resolver's prefix); the nightly facts run reads 7 inbox days and writes
|  |           the verdict fact {result, voidReason, quote, url, at, decidedBy, evidence, revision}; no DynamoDB lookups; corrections = revision n
|  |           the pre-registered weekly sample of 22 (0011) is what the public track record scores; other verdicts are shown, not scored
|  +- model  : no
|  +- output : verdict fact; views and counts rebuild from it
|  +- cost   : none
|
+- 6 REVIEW      weekly (plan step 3), model          [newsRecordReview]
|  +- inputs : the week's verdict facts + entry facts per active story
|  +- rule   : writes readings fired | dead | hold | line, each citing verdict facts
|  |           cross-story confirmed links: if another story carries a branch's outcome, the review writes a confirmed link (with hindsight)
|  +- output : record/readings/YYYY-Www.jsonl
|
+- LOOP BACK : 6 REVIEW -> new entry facts arrive -> 1 DRAW (the story moved) -> ... -> 2 WATCH (every night) -> 3 -> 4 -> 5
```

## 3. Stages in detail

### Draw (weekly, model)
- Cadence: weekly per story, and only when the story has new entry facts that week. The deployed generator follows this; before it, a story forked up to daily.
- Count: at most 3 outcomes per story per week (before: 3 scenarios x up to 3 triggers, about 8 per fork).
- Outcome: a concrete event that gets DONE, not said (operator editorial rule, decision 0020, applied to branches). Due 7-90 days out (the prompt says 90, the existing gate 180; the sample window is 7-84). Own p. A named source that would report it.
- Gates: the existing G-gates in `lib.js` and `questions.js` keep their names. G7 no p, G8 generic source, G9 lead under 7 days, G10 restatement, G12 near-duplicate; this design adds: lead over 90 days dropped, near-duplicate checked against open branches on the same story (before: the last 14 prior rows).
- Written as `forecast_drawn` facts and never changed. `branch.text` becomes the event text; the scenario label is not the branch text any more.
- Draw quality is the largest lever (Section 7). Invented calendar facts and templated probabilities (older plan, P1/P2) belong here.

### Watch (nightly, no model)
Candidates only: open branches on stories with a new entry fact that day (from `record/facts`), plus open branches whose due date passed 3 days ago. This replaces "all branches are due" and the Monday-only draft.

### Gather (no model, no search)
Amendment 2026-10-22 (2): the evidence is the story's own `entry` facts dated after the draw date, read from `record/facts`. Nothing dated before the draw counts, other stories are not checked, and there is no web search, news API or page fetching. Amendment 2026-10-24: operator-assigned recovered articles (latest assignment per id), reassigned entries and the survivor of a merged story also count; a recovered article is a headline only ("[recovered headline, no text]"), may support `yes`, and its silence never supports `no`. If another story carries the outcome, the weekly review writes a confirmed link with hindsight.

### Judge (boxed model)
The rules of `newsPredictionResolver/src/lib.js` stay: the quote is verified by code against the title or summary of an entry dated after the draw, `yes` needs a second independent pass, `no` ("not reported by DUE") waits for due + 3 days (`GRACE_DAYS`) and means no entry since the draw shows the event, `void` takes one of `VOID_REASONS` (`ambiguous_criterion`, `source_unavailable`, `event_moot`, `duplicate`, `criterion_met_at_issue`) plus `issued_before_method` (decision 0038). `criterion_met_at_issue` applies at the draw gate only, since evidence before the draw is never read. The judge is blind to p.

### Record (no model)
Verdicts become `verdict` facts for every judged branch, not only the sample. The 22-per-week pre-registered sample (0011) stays and is what the public track record scores (Brier skill stays null below 150 resolved). All other verdicts are shown on pages, not scored. Operator corrections are appended (0034).

### Review (weekly, step 3)
`newsRecordReview` reads the week's verdicts and writes readings (fired/dead/hold/line) that cite verdict facts.

### Pages (wording)
| Branch state | Words |
|---|---|
| open | "open · due DATE" |
| yes | "happened · DATE" |
| no | "not reported by DATE" (a claim about our coverage, not the world) |
| void | "could not be checked · reason" |
| before scoring began | "recorded before scoring began" |

Never "not checked yet". `counts.branchesDue` counts resolvable branches only.

## 4. Objects and where they live
| Object | Where | Notes |
|---|---|---|
| `forecast_drawn` fact | `record/facts/YYYY-MM-DD.jsonl` | forkId, branches {branchId, text, p, trigger, resolutionSource, due} (0036); written by `newsStoryRecord` from `PRED#` rows today |
| `verdict` fact | `record/facts/` | qid, result, quote, url, at, decidedBy, evidence; written only by `newsStoryRecord` from the inbox, `eventId = sha1('verdict' + qid + revision)`, a correction is a line with revision 2 or more |
| verdict inbox | `record/inbox/verdicts/YYYY-MM-DD.jsonl` (shadow `record/shadow/inbox/verdicts/`) | one line per final verdict (`yes|no|void`), decision day UTC, written only by the resolver; the facts run reads the run day and six days before |
| `Q#<qid>/SAMPLED, DRAFT#, VERDICT, VERDICT#<n>` | DynamoDB `GlobalPerspectivePredictionLog` | resolver's working rows, put-once |
| `SAMPLE#<week>`, `SEED#<week>` | same table | the pre-registered draw of 22 and its commit |
| `record/views/` (stories, counts, index) | S3 | rebuilt from facts; the board and thread pages read these |
| `predictions/track_record.json` | S3 | the scored sample only |
| `record/shadow/` | S3 | shadow fortnight output (Section 6) |

A verdict reaches `record/facts/` through the inbox (decision 0038 amendment): the resolver appends to `record/inbox/verdicts/`, `newsStoryRecord` turns the lines into facts. The `Q#<qid>/VERDICT` rows stay only for the sampled track record.

## 5. Ownership
The code lives in two groups only, so nobody hunts for it:
- Draw: `backend/pipeline/NewsProjectInvokeAgentLambda` (generator: prompt, `lib.js`, `questions.js`).
- Watch, Gather, Judge, Record: `backend/predictions/newsPredictionResolver`.
- Prefixes: the resolver writes `record/inbox/verdicts/` and `record/shadow/inbox/verdicts/` and nothing else in `record/`; it reads `record/facts/` (and `record/runs/` for the coverage guard) and never writes it. `newsStoryRecord` writes `record/facts/`, converting the inbox lines into `verdict` facts.
- Evidence is our own entries only, so the resolver needs no search key and no web access.
- Review: `backend/record` (`newsRecordReview`, step 3 of the foundation plan; live since 2026-10-31, Mondays 01:00 UTC).
This doc is linked from `backend/predictions/README.md`, the resolver README and `ARCHITECTURE_TIMELINE.md` §1b row 3 and §3.

## 6. Verification (how we know it works)
1. Unit/golden tests: a fixed branch plus a fixed search fixture gives the expected verdict. Pass: a non-verbatim quote is rejected; no `no` before due + 3 days; an invalid void reason is rejected.
2. Replay: run the resolver in dry run over the 44 sampled questions and over 20 branches whose outcome is already known from later entry facts in `record/facts`. This is done by the judge benchmark below; agreement is reported per set (threshold set by the operator before the run).
3. Shadow fortnight: the new resolver writes verdicts to `record/shadow/` only, side by side with the Monday sampler. Pass: agreement on the shared 22.
4. Operator spot-check: each week 10 random verdicts with quote and URL; disagreements are appended as corrections. Pass: at least 90% agreement over two weeks before the "not reported by" wording goes live.
5. Watch metrics and alarms: verdicts per day, void share, two-pass disagreement, branches past due + 3 with no check, model errors.
6. Cost line: checks per night is about stories moved x open branches on them + due branches; expected a few dozen; at most 2 model calls per check.

### Judge benchmark
Purpose: a fixed gold set with known answers, frozen evidence and a runner that scores any model. Every judge prompt, model or rule change passes it before deploy, like tests.

Requirements:
0. Evidence rule (amendment 2026-10-22 (2)): the evidence is the story's own entry facts written after each draw, not web search. The benchmark is re-cut as questions plus those entry facts; the re-run is pending until the pipeline writes entries again (DeepSeek top-up). The 2026-10-22 web-evidence run (110 questions, 47 due, 38 undecided on weak pages, 47/47 agreement between two Claude sub-agents) stays as a recorded first attempt; its frozen web results are no longer the evidence.
1. Gold set of about 100 questions labelled by the operator. Pool: the 96 overdue question branches of 2026-10-22, the 44 sampled questions, and about 20 branches whose outcome later entry facts show. Stratified: clear yes, clear no, void, boundary. Kept out of judge-prompt tuning.
2. Humans first: the operator labels a blind subset of 50 before seeing any model answer. Where the operator hesitates, the question is badly drawn; that goes back to the draw gates as feedback.
3. Frozen evidence: the story's entry facts dated after the draw are copied once per question and stored with the gold set, so every model sees identical text. Location (proposed): S3 `bench/judge/YYYY-MM-DD/`, not under `record/` because it is not a world fact; gold labels as JSONL.
4. A reference model of a different family than DeepSeek labels the full set; the operator reviews it on the other 50.
5. The runner reuses the resolver's judge code unchanged (verified quote, two passes for yes, no before due + grace, VOID_REASONS). The model is a parameter. It never writes live tables.

| Metric | Pass |
|---|---|
| Cohen's kappa vs operator | at least 0.6 |
| False "happened" (yes when truth is no/not_yet) | under 5% |
| Quote-check pass rate, two-pass disagreement, cost and time per question | reported, read with the confusion matrix |

Outputs: the judge model choice with evidence, cost per check, and a list of failure classes.

Maintenance: rerun on every judge change. The weekly spot-check and every correction add gold cases. Quarterly refresh. The nightly void-share and two-pass-disagreement alarms trigger a rerun.

Roles: a Sonnet lane builds the runner and evidence capture under `backend/predictions/newsPredictionResolver/bench/` (proposed path); an Opus agent runs the benchmark and writes the analysis; the operator names the reference model, sets its API key, approves it as a paid API, and labels the blind 50.

Sources: practitioner guidance on LLM-as-judge calibration with Cohen's kappa (oneuptime.com/blog/post/2026-08-31-calibrate-llm-judge-cohens-kappa, mlflow.org/articles/tags/llm-as-a-judge); "Judging the Judges" arxiv.org/abs/2406.12624; ForecastBench arxiv.org/abs/2409.19839; Metaculus tournament rules, where annulled or ambiguous questions drop out of scoring (metaculus.com/tournament-rules/).

## 7. Limits (honest)
- Coverage: `yes` and "not reported" depend on what our own feed carried. Silence in our feed is not proof the event did not happen; a true event we never covered reads "not reported by DATE", and a late entry becomes a correction fact.
- Another story may carry the outcome; only the weekly review's confirmed links catch that.
- A badly written outcome cannot be judged. Draw quality matters most.
- The loop needs the pipeline to keep writing entries: while it is down (DeepSeek top-up) nothing can be judged `yes`.

## 8. Decisions
[0038](../decisions/0038-forecast-loop.md) (this loop) · [0011](../decisions/0011-track-record-and-studio.md) (sampled track record, kept) · [0034](../decisions/0034-auto-verdicts-no-human-gate.md) (resolver writes verdicts) · [0036](../decisions/0036-facts-file-format.md) (`forecast_drawn`, `verdict` format).
