# 0038. The forecast loop: few resolvable outcomes, nightly watch, verdict facts

Status: accepted (operator, 2026-10-22; refines 0034 and 0036, keeps the sample of 0011; supersedes the forecast parts of the 2026-10-17 grounded-forecast task)
Date: 2026-10-22

## Context
The product is an analyst tool; a forecast with a verdict separates it from a feed. Today 7,440 branches exist, 44 can ever receive a verdict, 2,451 have no question id, and no verdict has been written. Pages say "not checked yet" for all, which promises a check that never comes. Full evidence: `architecture/ARCHITECTURE_FORECAST_LOOP.md`.

## Decision
- Draw: weekly per story, only when the story has new entry facts that week; at most 3 outcomes per story per week. Each outcome is an event that gets done (not said), due 7-90 days out, with the model's own p and a named source. Mechanical gates drop missing p, vague source, lead outside 7-90, restatement, and near-duplicates of an open branch on the same story. `branch.text` is the event text. Written as `forecast_drawn` facts, never changed.
- Watch: nightly, no model. Candidates are open branches on stories with a new entry fact that day, and open branches whose due date passed 3 days ago (`GRACE_DAYS`). Nothing else is checked.
- Gather: no model. New entry title/summary plus a news search for the branch event text, results dated before due, the branch's source named.
- Judge: boxed model answers yes | no | void | not_yet. `yes` needs a verbatim quote of at least 12 characters verified by code in a cited result, and a second independent pass that also says yes. `no` only after due + 3 days. `void` only with one of `ambiguous_criterion`, `source_unavailable`, `event_moot`, `duplicate`, `criterion_met_at_issue`, or the new `issued_before_method`. Otherwise `not_yet`.
- Record: final answers become `verdict` facts {result, quote, url, at, decidedBy, evidence}. The pre-registered weekly sample of 22 (0011) stays and is what the public track record scores; all other verdicts are shown, not scored.
- Legacy: the 2,451 branches without a question id are voided once in bulk with `issued_before_method` (a one-time job, operator-approved), shown as "recorded before scoring began".
- Wording: "open · due DATE"; "happened · DATE"; "did not happen"; "could not be checked · reason"; never "not checked yet". `counts.branchesDue` counts resolvable branches only.
- Review: `newsRecordReview` reads the week's verdicts and writes readings citing verdict facts.
- Ownership: draw in `backend/pipeline/NewsProjectInvokeAgentLambda`; everything else in `backend/predictions/newsPredictionResolver`.
- Going live of "did not happen" wording needs at least 90% operator spot-check agreement over two weeks.

## Rejected
- (a) Fix the gate and keep volume: resolving 150-250 questions a day costs more model and search calls and leaves correlated near-duplicate questions.
- (c) Move resolution to the weekly review as readings: readings are judgments, not independent verdicts, and give no public score.
- (d) Stop drawing forecasts: loses the data the track record needs and the dated-commitment principle of 0035.

## Consequences
- Fewer, checkable branches; every open branch shows a due date; the loop closes with verdict facts.
- The Monday-only draft rule and the one-per-story sample cap no longer limit which verdicts exist; they only define what is scored.
- Limits: `yes` depends on search coverage; `no` is inference from silence (a late report becomes a correction fact); badly written outcomes cannot be judged.
- Needs: generator change, resolver change, the verdict inbox below, a one-time legacy job, a frontend release for wording.

## Amendment 2026-10-22: the verdict hand-off is an S3 inbox
Problem: the first hand-off (the facts writer queries DynamoDB `Q#/VERDICT` per question) would be about 4,989 queries a night (lane O measured 4,989 distinct qids in the live facts, 4,832 still due), rising with every forecast. The operator rejected it: "I don't want 5,000 queries; they are all static anyway, store this in S3."

Decision: a verdict inbox.
- The resolver appends each final verdict (`yes|no|void`) as one JSON line to `record/inbox/verdicts/YYYY-MM-DD.jsonl` (decision day, UTC; shadow under `record/shadow/inbox/verdicts/`). Only the resolver writes that prefix.
- The nightly facts run reads the inbox for the run day and the six days before (seven GetObjects, a missing day is empty) and appends one `verdict` fact per line, `eventId = sha1('verdict' + qid + revision)`. A correction is a new line with `revision` 2 or more.
- The resolver never writes `record/facts/`; the facts writer never queries DynamoDB for verdicts. The `Q#<qid>/VERDICT` rows stay in DynamoDB only for the sampled track record (0011).
- Backfill: event `{inboxFrom:'YYYY-MM-DD'}` on the facts writer reads every inbox day from that date.

Why: (1) verdicts are static once decided, so they belong in S3 like every other world fact (0035: world = S3, DynamoDB = user data); (2) one writer per file holds: the resolver owns the inbox, the facts writer owns the facts, the record stays append-only; (3) cost is bounded by days, not questions: seven small reads a night whatever the forecast volume; (4) it is replayable: delete the facts, re-read the inbox from day one, get the same verdict facts; (5) it is a general pattern, the "inbox": any producer that is not the facts writer (future: operator corrections, story merges from the review) hands facts to the record through `record/inbox/<kind>/DAY.jsonl`, and the facts writer is the only one that turns inbox lines into facts.

Rejected: a direct DynamoDB lookup (cost grows with questions; ties the record to a table); the resolver writing `record/facts/` itself (two writers of one file, manifest races, breaks 0036 section 1); the resolver invoking `newsStoryRecord` synchronously (coupling, retries, double runs).

IAM (operator yes needed, not done): resolver role `s3:PutObject` on the two inbox prefixes and `s3:GetObject` on `record/facts/*` (for WATCH). The facts writer role is unchanged (it already reads and writes `record/*`).
