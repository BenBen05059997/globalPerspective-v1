# Deploying the rebuilt newsPredictionResolver

Prepared 2026-10-23 from the repo and read-only AWS calls. The live function still runs the old Brave-search build.
Region `ap-northeast-1`, account `280362093938`, bucket `globalperspective-world-280362093938`.
Every command below is a single bare command; run them from the repo root of the merged code. Nothing here has been run.

## 0. Live state (read 2026-10-23)
- Runtime `nodejs22.x`, handler `index.handler`, x86_64, 256 MB, timeout 600 s, no layers, role `newsPredictionResolver-role`.
- Schedule: EventBridge rule `TriggerPredictionResolver`, `cron(30 10 * * ? *)` (ENABLED), one target `resolver`, input `{"action":"tick"}`. No EventBridge Scheduler schedule invokes it.
- Env names live: `LLM_CONCURRENCY, PREDICTION_LOG_TABLE, GROK_API_URL, MAX_RESOLVE_PER_RUN, BRAVE_SEARCH_API_KEY, GROK_MODEL, XAI_API_KEY`.
- `scripts/lambda.sh newsPredictionResolver diff`: every differing deployed file is `repo-ahead` (deployed bytes are in git history) or repo-only (`gather.js, inbox.js, watch.js, _shared/rss.js`); the deployed-only `search.js` is also in git history. Exit code was 1 (repo ahead only), so `deploy` will not need `--force`. Re-run the diff right before deploying.
- Package: `scripts/lambda.sh newsPredictionResolver package` builds a 76 KB zip (31 files, `_shared` symlink shipped as real files, no node_modules; the runtime's `@aws-sdk` v3 is used). Local sha256(b64) of that build: `7rRv+ZS4sIzl3SWpD3jdNlPsaNnNZecrvF69BF5MIlU=` (changes if the repo moves).

## (a) Env map

`process.env` the new code reads: `AWS_REGION` (runtime), `PREDICTION_LOG_TABLE` (src/index.js:29), `XAI_API_KEY` (index.js:30; also `_shared/llm.js:17`), `GROK_API_URL` (`_shared/llm.js:16`, default `https://api.deepseek.com`), `DRAFT_MODEL` (index.js:31, default `deepseek-v4-pro`), `LLM_CONCURRENCY` (index.js:32, default 3), `MAX_RESOLVE_PER_RUN` (index.js:33, default 60), `WORLD_BUCKET` (index.js:316), `AWS_LAMBDA_FUNCTION_NAME` (runtime, usage log).

| Variable | Live | Action |
|---|---|---|
| `WORLD_BUCKET` | missing | ADD `globalperspective-world-280362093938`. Without it every S3 read fails ("facts unreadable") and nothing is judged. |
| `BRAVE_SEARCH_API_KEY` | present | REMOVE (search.js is gone; nothing reads it) |
| `GROK_MODEL` | present | REMOVE (the new code uses `DRAFT_MODEL`; this function's code never reads `GROK_MODEL`) |
| `DRAFT_MODEL` | missing | optional; default `deepseek-v4-pro` is what the code and README expect. Leave unset unless you want to pin it. |
| `XAI_API_KEY`, `GROK_API_URL`, `LLM_CONCURRENCY`, `MAX_RESOLVE_PER_RUN`, `PREDICTION_LOG_TABLE` | present | KEEP unchanged (secret stays; do not print it) |

Procedure (fetch -> merge -> write the FULL map; `update-function-configuration --environment` replaces the whole map; the secret goes through a temp file, never the terminal):

```
aws lambda get-function-configuration --function-name newsPredictionResolver --region ap-northeast-1 --query 'Environment' --output json > "$TMPDIR/resolver-env.json"
node -e 'const f=process.argv[1],fs=require("fs");const e=JSON.parse(fs.readFileSync(f,"utf8"));const v=e.Variables;delete v.BRAVE_SEARCH_API_KEY;delete v.GROK_MODEL;v.WORLD_BUCKET="globalperspective-world-280362093938";fs.writeFileSync(f,JSON.stringify({Variables:v}));console.log(Object.keys(v).sort().join(","))' "$TMPDIR/resolver-env.json"
aws lambda update-function-configuration --function-name newsPredictionResolver --region ap-northeast-1 --environment file://$TMPDIR/resolver-env.json
rm "$TMPDIR/resolver-env.json"
```
Expected names after: `GROK_API_URL, LLM_CONCURRENCY, MAX_RESOLVE_PER_RUN, PREDICTION_LOG_TABLE, WORLD_BUCKET, XAI_API_KEY`. Verify with `get-function-configuration --query 'Environment.Variables|keys(@)'`.

Order: the old code ignores `WORLD_BUCKET` and still needs the Brave key until the new zip is live, so do the code deploy first (or both within minutes). The nightly cron is 10:30 UTC; do not leave the old code with the Brave key removed across it, and do not leave the new code without `WORLD_BUCKET` across it.

## (b) IAM delta (IAM change: needs a fresh yes)

Role has: managed `AWSLambdaBasicExecutionRole`; inline `ddb-predictionlog` (Scan, GetItem, PutItem, Query, UpdateItem on `GlobalPerspectivePredictionLog` and `/index/*`); inline `newsPredictionResolver-record` (FactsRead: GetObject `record/facts/*`; VerdictInbox: GetObject+PutObject `record/inbox/verdicts/*` and `record/shadow/inbox/verdicts/*`; MissingIs404: ListBucket with prefix `record/facts/*`, `record/inbox/verdicts/*`, `record/shadow/inbox/verdicts/*`).

What the new code needs:

| Access | Code | Covered live? |
|---|---|---|
| DynamoDB Scan PRED# (`allQuestionPreds`, `predRows`), Scan Q# and SEED# rows | src/store.js:41, 50, 54, 38 | yes (Scan) |
| DynamoDB GetItem | store.js:33 (`get`) | yes |
| DynamoDB PutItem (conditional put-once) | store.js:27 | yes |
| DynamoDB Query (`queryPK`, `correct`) | store.js:59 | yes |
| DynamoDB UpdateItem | not used by the new code | granted, unused (leave; do not tighten in this deploy) |
| S3 GetObject `record/facts/<day>.jsonl` (`getLines`) | src/gather.js:7, 49 | yes |
| S3 GetObject `record/runs/<day>.json` (`getJson`, coverage guard) | src/gather.js:8, 66 | NO, missing |
| S3 ListBucket prefix `record/runs/*` (so an absent key reads as 404, not 403) | s3json.getJson on NoSuchKey | NO, missing |
| S3 GetObject + PutObject `record/inbox/verdicts/<day>.jsonl` (`appendLines` = get, then conditional put) | src/inbox.js:8, 33, 40 | yes |
| S3 same under `record/shadow/inbox/verdicts/` | inbox.js:8 | yes |
| `record/views/*` | not read anywhere in src/ | not needed, do not grant |
| `record/facts/` writes | none (the resolver never writes facts) | none granted, correct |

Delta (add as a new statement to `newsPredictionResolver-record`; `put-role-policy` replaces the whole inline policy, so fetch it, add the statements, write it back). Write the merged document to a file first:

```
aws iam get-role-policy --role-name newsPredictionResolver-role --policy-name newsPredictionResolver-record --query PolicyDocument --output json > "$TMPDIR/rec-policy.json"
```
Statements to add to the `Statement` array (new Sids, MissingIs404 left untouched):
```json
{
  "Sid": "RunsRead",
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::globalperspective-world-280362093938/record/runs/*"
},
{
  "Sid": "RunsMissingIs404",
  "Effect": "Allow",
  "Action": "s3:ListBucket",
  "Resource": "arn:aws:s3:::globalperspective-world-280362093938",
  "Condition": { "StringLike": { "s3:prefix": ["record/runs/*"] } }
}
```
then `aws iam put-role-policy --role-name newsPredictionResolver-role --policy-name newsPredictionResolver-record --policy-document file://$TMPDIR/rec-policy.json`.

If `record/runs/*` is not granted: the code does not crash. Every `getJson` fails, so every day is a "run unreadable" gap and every `no` becomes `not_yet / coverage_gap` (no false `no`s, but no `no` verdicts ever). `yes` and `void` are unaffected.

## (c) Shadow run: what `shadow` does, exactly

Event shape (src/index.js:253): `{"action":"tick"|"draft", "shadow":true, "dryRun":false, "limit":N}`. `shadow:true` changes ONE thing: `inbox.js` writes the verdict line to `record/shadow/inbox/verdicts/<decision day>.jsonl` instead of `record/inbox/verdicts/`. It does NOT suppress DynamoDB. A shadow run that is not a dry run writes REAL, immutable rows to `GlobalPerspectivePredictionLog`: `Q#<qid>/DRAFT#<iso>` for every checked candidate, `Q#<qid>/VERDICT` for every yes/no/void (put-once, cannot be overwritten, and it removes the question from every later candidate list), and with `action:"tick"` also `SEED#`/`SAMPLE#`/`SETTLE#` rows and next-week commits. The `newsStoryRecord` inbox consumer only reads the non-shadow prefix, so the S3 side stays quarantined; the Dynamo side does not. README line 83 says the same ("Q# rows are still written").

So for a true no-write look use read-only actions:
- `{"action":"watch"}`: WATCH + GATHER only: no model, no writes (checkPass runs with dryRun). Returns `out.watch` {questions, movedThreads, candidates, total, overflow, unreadable, moved, grace}.
- `{"action":"draft","dryRun":true}` or `{"action":"tick","dryRun":true}`: same, plus `wouldCheck` (qid, deadline, reason, sampled), `wouldSettle`, `wouldCommit`, `wouldDraw`. No LLM, no writes.
- `{"action":"status"}`: counts only.
- `{"action":"replay","items":[...]}`: runs the judge on supplied questions, no writes (needs a funded model).

Invoke (single command; response goes to a file, then read it):
```
aws lambda invoke --function-name newsPredictionResolver --region ap-northeast-1 --cli-binary-format raw-in-base64-out --payload '{"action":"watch"}' "$TMPDIR/resolver-out.json"
```
(`--payload '{"action":"draft","dryRun":true,"limit":60}'` for the fuller preview.)

A real shadow with writes (only if you accept Q# rows in the live table): `--payload '{"action":"draft","shadow":true,"limit":5}'` (use `draft`, not `tick`, to avoid commits/draws; it still runs `settlePass`, which settles any waiting sampled draft, written to the shadow inbox). Keep `limit` small.

Inspect afterwards:
- Response JSON: `watch`, `dueForDraft`, `drafted`, `settled`, `errors`, `inbox` (keys written), `coverageGaps`, `skippedForTime`.
- CloudWatch `/aws/lambda/newsPredictionResolver`: lines `watch {...}`, `coverage_gap <qid> [...]`, `settle {...}`, `settle errors [...]`, and `[usage] {...}` per successful model call. `REPORT` line for duration and max memory.
- S3: `aws s3 cp s3://globalperspective-world-280362093938/record/shadow/inbox/verdicts/<today>.jsonl -` (shadow runs only; real runs: `record/inbox/verdicts/`).
- DynamoDB: `Q#<qid>` rows (`DRAFT#...`, `VERDICT`); `SETTLE#<week>/TICK#<iso>` has `watch` and `errors` for a tick.
- Success criteria: `errors` empty (no "facts unreadable", no "inbox line not written"); `watch.unreadable` = 0.

## (d) Memory and timeout

Volume (read-only look, 2026-10-23):
- `record/views/index/active.json` holds no due-branch field (only per-story `branchCount`/`liveBranchCount`; `builtFrom.factsThrough` 2026-10-22), so the volume was taken from the PRED rows and facts directly.
- 604 PRED rows with `questionSchema`, 5,006 distinct question branches on 315 threads (about 16 per thread), 4,839 with deadline today or later, 139 already past due + 3, 45 `Q#` rows. The table is 6,582 items / 23.5 MB, all scanned by every run (`allQuestionPreds` + `listQuestionRows`).
- Entry facts per normal day (Sep 30 - Oct 19): 25-48, on 17-34 distinct threads. Questions on those moved threads issued before that day and still open: 800-1,050 per day. So on every normal night the moved list is far over the cap: 60 are checked (`MAX_CANDIDATES` / `MAX_RESOLVE_PER_RUN`, oldest due first) and 700+ overflow, reported in `watch.overflow`, not an error. It is a backlog, not a bug, but set expectations: the cap will always bind.
- Today specifically: `record/facts` for Oct 20 to Oct 22 hold zero `entry` facts (only `article`/`run`), and the runs of Oct 21-23 are `failed`. So tonight WATCH finds no moved threads; only "grace" candidates (past due + 3) can appear. Of the 139 past-grace questions only about 16 have no coverage gap in draw+1..due (runs failed on Sep 15-29, Oct 14, Oct 21-23, `thin` on Sep 13, Oct 13, Oct 20), the rest return `coverage_gap` not_yet.
- Model calls: at most 60 candidates x (1 call, or 2 when pass 1 says yes) per night; zero-entry candidates cost no call.

Recommendation:
- Memory: raise 256 -> 512 MB. The old build peaked at 120-127 MB on a 3-6 s run; the new one scans ~20 MB of PRED rows plus Q# rows as DynamoDB documents and parses up to ~90 days of facts files per window. 512 MB gives headroom and a faster CPU for the same price per run (pennies). Check `Max Memory Used` after the first run and adjust.
- Timeout: keep 600 s. The check loop stops starting work after 420 s (`CHECK_BUDGET_MS`); 60 candidates / concurrency 3 = 20 rounds. A started check can last up to two 300 s LLM calls in the worst case (timeout 300 s, one retry on 5xx/429/timeout; yes needs a second pass), which can pass 600 s only when DeepSeek is hanging; the leftover work is picked up the next night (immutable put-once rows, `skippedForTime`). Raising to 900 s is possible but not needed.
- Optionally `LLM_CONCURRENCY` 3 -> 5 if the first run shows `skippedForTime`.

```
aws lambda update-function-configuration --function-name newsPredictionResolver --region ap-northeast-1 --memory-size 512
```
(Run after the env update has finished: `LastUpdateStatus` must be `Successful` before the next configuration call; check with `get-function-configuration --query LastUpdateStatus`.)

## (e) Deploy order and rollback

1. Re-run `scripts/lambda.sh newsPredictionResolver diff` (expect exit 1, repo-ahead only) and `cd backend/predictions/newsPredictionResolver && node --test test/*.test.js`.
2. IAM delta (b), then the env update (a), then memory (d).
3. `scripts/lambda.sh newsPredictionResolver deploy` (backs up the live zip to `.deploy-backups/newsPredictionResolver/` first, uploads `build.zip`, confirms the sha). Do the env update before the 10:30 UTC cron or right after the deploy so the new code never runs without `WORLD_BUCKET`.
4. `{"action":"watch"}` invoke (c), then the next scheduled tick.
5. Rollback: `scripts/lambda.sh newsPredictionResolver rollback` re-uploads the newest backup in `.deploy-backups/newsPredictionResolver/`. Env: the old code needs `BRAVE_SEARCH_API_KEY`, which step (a) removes. Keep the removed value until the new build is accepted, or rollback restores code without its key. Written rows cannot be rolled back: `Q#` DRAFT/VERDICT rows are immutable (a wrong verdict is corrected with `{"action":"correct",...}`, appending `VERDICT#n`); shadow lines can be deleted only with a destructive S3 op (needs a fresh yes).
6. IAM additions are additive and harmless to leave on rollback.

## With DeepSeek unfunded (HTTP 402): what happens

Read from `_shared/llm.js:92-123`, `src/draft.js:51-66`, `src/index.js:193-208`:
- 402 is not retried (retry only on network error, 429, 5xx). `chat` throws `LLM 402: ...` at once, so a call fails in well under a second and the 60-candidate pass does not stall. `draftQuestion` catches it and returns `{verdict:'needs_human', note:'llm error: LLM 402...'}`.
- The run does NOT crash and does NOT skip JUDGE: every candidate that has entries gets a real `Q#<qid>/DRAFT#<iso>` row with `verdict:needs_human, note:'llm error: ...'`. No `VERDICT` row, no inbox line (needs_human is not final), and `isUnclearDraft` ignores `llm error` notes so they never count toward the three-unclear void. The same-day rule (`days.includes(today)`) then keeps that question out of tonight's list on a retry, and the next night picks it up again. `out.drafted` lists them with `needs_human`; `errors` stays empty (this is not reported as an error: the 402 text is only in the DRAFT row's `note`, and CloudWatch has no `[usage]` line).
- Candidates with NO entries after the draw need no model. After due + 3 on a complete bundle with a healthy Run on every window day, they get a rule-made `no` (decidedBy `rule:no_entries_after_draw`): a real `VERDICT` row and inbox line even with the model unfunded. Otherwise `not_yet` (reason `coverage_gap` when the record has holes) written as a DRAFT row. With today's data about 16 past-grace questions can pass the coverage guard; whether they have entries decides model vs rule.
- WATCH and GATHER are fully inspectable without the model: `{"action":"watch"}` (and `draft` with `dryRun:true`) read Dynamo and S3 only and return the candidate list with reason `moved|grace`, deadlines, counts, `unreadable`, and, in the CloudWatch `watch {...}` line, the totals. The evidence bundles themselves are not in the response (only qid, deadline, reason, sampled); to see a bundle, read the facts day from S3 or use `replay` once the model is funded.
- So the recommended first post-deploy step is the `watch` invoke (no model, no writes). Do not run a non-dry-run `draft`/`tick` while unfunded unless the rule-made `no` verdicts and `needs_human` DRAFT rows are acceptable.
