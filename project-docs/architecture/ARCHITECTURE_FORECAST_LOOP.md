# The forecast loop

Decision: [0038](../decisions/0038-forecast-loop.md) (design agreed by the operator 2026-10-22; evidence rule: our own entries only). Place in the system: [ARCHITECTURE_TIMELINE.md](ARCHITECTURE_TIMELINE.md). Code and live AWS are the truth for what is deployed: the draw is `NewsProjectInvokeAgentLambda-dev`, the nightly pass is `newsPredictionResolver` (rule `TriggerPredictionResolver`, 10:30 UTC daily). Diff a deployed zip against the repo before deploying either (`scripts/lambda.sh <name> diff`).

## 1. Why
The product is an analyst tool. A forecast with a verdict is what separates it from a feed and what turns a timeline into a narrative. Before this design the loop was open: most branches carried no question id, no probability and no source, so nothing could resolve them; the resolver sampled 22 questions a week and the pages promised a check ("not checked yet") that never came; a story could fork almost daily. The loop now draws few, checkable outcomes, watches only what moved, and judges on the story's own entries.

## 2. The loop
```text
FORECAST LOOP  (weekly draw, nightly watch; one story = one thread)
|
+- 1 DRAW     weekly per story, model                 [NewsProjectInvokeAgentLambda  src/forecast-draw.js]
|  +- rule   : only if the story moved (new entry facts) and no fork was drawn for it in the last 7 days (MIN_GAP_DAYS);
|  |           at most 3 outcomes per draw (MAX_OUTCOMES); each is an event DONE (not said), due 7-90 days out, with its own p
|  |           and a named source that would report it
|  |           gates drop: no p, vague source, lead under 7 days, restatement, near-duplicate of an open branch on the story,
|  |           an outcome already true at the draw, institution names that are not exact (G-gates in lib.js and questions.js)
|  +- output : forecast_drawn fact (never changed); branch.text is the event text
|
+- 2 WATCH    nightly, no model                       [newsPredictionResolver  src/watch.js]
|  +- rule   : candidates = open branches on stories with a new entry fact (yesterday or today)
|  |           + open branches whose due date passed 3 days ago (GRACE_DAYS); oldest due first; cap 60 per run, overflow logged
|  |           a moved story with no entry dated after the draw and not past due + 3 is skipped
|  +- cost   : zero model calls; this keeps the loop cheap
|
+- 3 GATHER   no model, no search                     [src/gather.js]
|  +- evidence: the story's own `entry` facts dated after the draw day, up to due + 3 days, read from record/facts;
|  |           nothing dated before the draw, no other story, no web search, no news API
|  |           also counted: operator-assigned recovered articles (latest assignment per id), reassigned entries and the survivor of a
|  |           merged story; a recovered article is a headline only and may support `yes`, but its silence never supports `no`
|  +- coverage: record/runs/DAY.json for each day from the draw to the due day; a day without a Run of status ok|partial and
|  |           archiveDay present is a coverage gap (our outage is not silence in the world)
|
+- 4 JUDGE    boxed model, never sees p               [src/draft.js, src/lib.js]
|  +- yes  = a verbatim quote of at least 12 characters found by code in the title or summary of a cited entry, then a second
|  |         independent pass (bundle in reverse order) also yes
|  +- no   = only after due + 3 days, only on a complete bundle with no coverage gap; reads "not reported by DUE" (a claim about
|  |         our coverage); zero entries after the draw and past due + 3 is a `no` by rule with no model call
|  +- void = one of VOID_REASONS (ambiguous_criterion, source_unavailable, event_moot, duplicate, criterion_met_at_issue) or
|  |         issued_before_method; criterion_met_at_issue applies at the draw gate only
|  +- else not_yet: the branch stays open until the next trigger; at most 2 model calls per check; a third unclear draft (5 days
|  |         apart, at or after due + 3) writes void `unclear after 3 drafts`
|
+- 5 RECORD   no model            [resolver -> record/inbox/verdicts/ -> newsStoryRecord -> record/facts]
|  +- the verdict is put-once as Q#<qid>/VERDICT in the prediction log and appended as one line to record/inbox/verdicts/DAY.jsonl;
|  |  the nightly facts run reads the run day and six days before and writes the verdict fact (revision 2+ = a correction)
|  +- the pre-registered weekly sample of 22 (decision 0011) is what the public track record scores; other verdicts are shown, not scored
|
+- 6 REVIEW   weekly, model                           [newsRecordReview]
|  +- reads the week's verdict facts and entries per active story; a branch outcome carried by another story becomes a confirmed
|     link with hindsight. Branch status is not a reading: it is the verdict, else open or past due (0039 amendment)
|
+- LOOP BACK: new entry facts -> 1 DRAW (the story moved) -> 2 WATCH every night -> 3 -> 4 -> 5
```

## 3. Objects and ownership
| Object | Where | Notes |
|---|---|---|
| `forecast_drawn` fact | `record/facts/` | forkId, branches {branchId, text, p, trigger, resolutionSource, due, qid}; written by `newsStoryRecord` from `PRED#` rows (it scans the prediction log for the 30-day window, so a forecast whose topic left the day's entries is still found) |
| `verdict` fact | `record/facts/` | qid, result, voidReason, quote, url, at, decidedBy, evidence, revision; `eventId = sha1('verdict' + qid + revision)`; only `newsStoryRecord` writes it, from the inbox |
| verdict inbox | `record/inbox/verdicts/YYYY-MM-DD.jsonl` (shadow `record/shadow/inbox/verdicts/`) | one line per final verdict, written only by the resolver |
| draws inbox | `record/inbox/draws/YYYY-MM-DD.jsonl` (shadow `record/shadow/inbox/draws/`) | one `commit` line per week's seed hash and one `draw` line per week's sample, written only by the resolver (0043) |
| `question_commit`, `question_draw` facts | `record/facts/` | the week's published seed hash; the revealed seed and the sampled qids; `eventId = sha1(kind + weekId)`; only `newsStoryRecord` writes them, from the draws inbox. The story views derive each branch's `scoring` and `state` from them |
| `Q#<qid>` `SAMPLED`, `DRAFT#`, `VERDICT`, `VERDICT#<n>` | `GlobalPerspectivePredictionLog` | the resolver's working rows, put-once; a correction appends `VERDICT#<n>` |
| `SAMPLE#<week>`, `SEED#<week>` | same table | the pre-registered draw of 22 and its seed commit |
| `predictions/track_record.json` | S3 | the scored sample only; `newsPredictionsSnapshot` rebuilds it every 30 minutes |
| `record/views/track-record.json` | S3 | the public `/track-record` page's source (decision 0044): the question scheme counted from the `forecast_drawn`, `question_*` and `verdict` facts, plus the frozen pilot-era constants. Built nightly by `newsStoryRecord`; the settle health and the draw pool stay in the prediction log |
| `record/legacy/predictions/` | S3 | whole `PRED#` rows from before the record that no rule places on a story, copied once (decision 0047); not facts, and none carries a question id, so none is scored |

Draw code lives in `backend/pipeline/NewsProjectInvokeAgentLambda`; watch, gather, judge and record in `backend/predictions/newsPredictionResolver`; review in `backend/record`. The resolver writes only `record/inbox/verdicts/` and `record/inbox/draws/` (and their shadows) under `record/`, reads `record/facts/` and `record/runs/` (its role has both), and needs no search key. An operator dispute is `predictions/settle-correct.js --correct <qid> <yes|no|void> "<reason>"`, which appends a correction (0034: no human gate on verdicts).

## 4. Pages (wording)
Shared in `shared/lib/branchWording.js`; never "not checked yet", never "DEAD".
| Branch state | Words |
|---|---|
| open | "open · due DATE" |
| yes | "happened · DATE" |
| no | "not reported by DATE" |
| void | "could not be checked · reason" |
| before scoring began | "recorded before scoring began" |

`counts.branchesDue` counts resolvable branches only. The legacy void job marked 2,451 old branches with no question id as void `issued_before_method` (run 2026-10-30).

## 5. Verification
1. Unit and golden tests in the resolver and generator: a non-verbatim quote is rejected; no `no` before due + 3 days; an invalid void reason is rejected.
2. Dry run: `{action:'watch'}` lists tonight's candidates with no model and no writes; `dryRun:true` writes nothing.
3. Shadow output goes to `record/shadow/` on a manual `shadow:true` invoke.
4. Operator spot-check: ten random verdicts a week with quote and URL; disagreements are appended as corrections. The "not reported by" wording stays only while agreement holds (target at least 90% over two weeks).
5. A judge benchmark (a gold set of about 100 questions with frozen evidence, scored by Cohen's kappa against the operator, false "happened" under 5%, rerun on every judge change) is the intended gate for judge prompt or model changes. It is not built: there is no `bench/` folder in the resolver and the earlier gold material was lost with the old mailbox on 2026-10-25.

## 6. Limits
- `yes` and "not reported" depend on what our own feed carried. Silence in our feed is not proof the event did not happen; a late entry becomes a correction.
- Another story may carry the outcome; only the weekly review's confirmed links catch that.
- A badly written outcome cannot be judged; draw quality is the largest lever.
- The loop needs the pipeline to keep writing entries: while the model provider is down nothing can be judged `yes`.

Decisions: [0038](../decisions/0038-forecast-loop.md) (this loop), [0011](../decisions/0011-track-record-and-studio.md) (sampled track record), [0034](../decisions/0034-auto-verdicts-no-human-gate.md) (resolver writes verdicts), [0036](../decisions/0036-facts-file-format.md) (fact formats).
