# newsRecordReview: first deploy (coordinator runbook)

Prepared 2026-10-23 (lane AE) from live AWS (account 280362093938, ap-northeast-1) and the code. Copy the conventions of `newsStoryRecord` (same runtime, handler, role shape, rule shape). Run each command bare. Nothing here has been run.
Variables used below: `B=globalperspective-world-280362093938`, `R=ap-northeast-1`, `ACC=280362093938`.

## 0. Package

```bash
scripts/lambda.sh newsRecordReview package        # writes .deploy-backups/newsRecordReview/build.zip (72 KB, 32 files, no node_modules; _shared symlink shipped as real files)
```
`scripts/lambda.sh newsRecordReview diff` before the function exists now stops with "not deployed" (rc 1); it used to print "identical" (fixed in this lane). After create, later deploys go through `scripts/lambda.sh newsRecordReview deploy`.

## (a) Role and trust policy (same as `newsStoryRecord-role`)

`trust.json`:
```json
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
```
```bash
aws iam create-role --role-name newsRecordReview-role --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name newsRecordReview-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole   # logs
aws iam put-role-policy --role-name newsRecordReview-role --policy-name newsRecordReview-access --policy-document file://policy.json
```

## (b) Inline policy `newsRecordReview-access` (`policy.json`)

No DynamoDB, no `web/*` (newsStoryRecord has both; the review uses neither). Reads `record/*`; writes only the three keys the review owns, live and shadow.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Sid": "RecordRead", "Effect": "Allow", "Action": "s3:GetObject",
     "Resource": "arn:aws:s3:::globalperspective-world-280362093938/record/*"},
    {"Sid": "MissingIs404", "Effect": "Allow", "Action": "s3:ListBucket",
     "Resource": "arn:aws:s3:::globalperspective-world-280362093938",
     "Condition": {"StringLike": {"s3:prefix": ["record/*"]}}},
    {"Sid": "ReviewWrites", "Effect": "Allow", "Action": "s3:PutObject",
     "Resource": [
       "arn:aws:s3:::globalperspective-world-280362093938/record/readings/*",
       "arn:aws:s3:::globalperspective-world-280362093938/record/runs/review-*",
       "arn:aws:s3:::globalperspective-world-280362093938/record/inbox/merges/*",
       "arn:aws:s3:::globalperspective-world-280362093938/record/shadow/readings/*",
       "arn:aws:s3:::globalperspective-world-280362093938/record/shadow/runs/review-*",
       "arn:aws:s3:::globalperspective-world-280362093938/record/shadow/inbox/merges/*"
     ]}
  ]
}
```
`MissingIs404`: without ListBucket a missing key answers 403, not 404, and `getJson`/`getLines` would throw on every absent file (first week's readings, `operator/aliases.json` in shadow).

Key patterns checked against the code (`P` = `record/` live or `record/shadow/` shadow, chosen by the event's `shadow`, `src/index.js:37-38`):

| Op | Key | Code |
|---|---|---|
| GET | `P views/manifest.json` | `src/select.js:23` |
| GET | `P views/index/active.json` | `src/select.js:27` |
| GET | `P facts/manifest.json` | `src/select.js:29` |
| GET | `P facts/<day>.jsonl` (all days up to the week's Sunday) | `src/select.js:33` |
| GET | `P operator/aliases.json` (missing = empty) | `src/select.js:39` |
| GET | `P readings/<week>.jsonl` (8 earlier weeks + this week) | `src/select.js:50,52` |
| GET | `P runs/review-<week>.json` (previous run id) | `src/index.js:21` |
| GET | `P inbox/merges/<date>.jsonl` (merge into the day's file) | `src/index.js:118` |
| PUT | `P runs/review-<week>.json` (started, then final) | `src/index.js:48,59` via `src/store.js:8` |
| PUT | `P readings/<week>.jsonl` | `src/index.js:112` |
| PUT | `P inbox/merges/<date>.jsonl` | `src/index.js:121` |

All reads go through `getObject`; all writes are plain `PutObject` (no conditional writes, no copy, no delete). The review never writes `facts/`, `views/`, `operator/` or `inbox/assignments`.

## (c) Create the function and its environment

Env the code reads (`grep process.env`): `WORLD_BUCKET` (`src/runtime.js:9`), `REVIEW_MODEL` (`:13`), `REVIEW_CONCURRENCY` (`:13`, added in this lane, optional, default 6), and from the shared `llm.js` for provider `deepseek`: `GROK_API_URL` (`_shared/llm.js:16`, defaults to `https://api.deepseek.com`) and `XAI_API_KEY` (`:17`). These two names hold DeepSeek (CLAUDE.md). Live source of the key: `newsPredictionResolver` env `XAI_API_KEY` (it has no `GROK_API_KEY`); `newsStoryRecord` has no key.

| Var | Value |
|---|---|
| `WORLD_BUCKET` | `globalperspective-world-280362093938` |
| `REVIEW_MODEL` | `deepseek-v4-pro` (the "larger model": `newsAnalyze` and `newsSystemsAnalysis` run `GROK_MODEL=deepseek-v4-pro`; `newsPredictionResolver` runs `deepseek-flash`). Operator to confirm this name. |
| `GROK_API_URL` | copy from newsPredictionResolver (`https://api.deepseek.com/chat/completions`; the base URL works too) |
| `XAI_API_KEY` | `<copy from newsPredictionResolver XAI_API_KEY>` |
| `REVIEW_CONCURRENCY` | `6` for the shadow run; see (d) before the full run |

Build the env file without printing the key (the file holds the key: `chmod 600`, delete after):
```bash
umask 077
aws lambda get-function-configuration --function-name newsPredictionResolver --region ap-northeast-1 --query Environment.Variables --output json | python3 -c '
import json,sys
src=json.load(sys.stdin)
env={"WORLD_BUCKET":"globalperspective-world-280362093938","REVIEW_MODEL":"deepseek-v4-pro","REVIEW_CONCURRENCY":"6",
     "GROK_API_URL":src["GROK_API_URL"],"XAI_API_KEY":src["XAI_API_KEY"]}
json.dump({"Variables":env},open("/tmp/review-env.json","w"))'
```
Create (role needs ~10 s after creation to propagate; retry once on "cannot be assumed"):
```bash
aws lambda create-function --region ap-northeast-1 --function-name newsRecordReview \
  --runtime nodejs22.x --handler runtime.handler --architectures x86_64 \
  --role arn:aws:iam::280362093938:role/newsRecordReview-role \
  --memory-size 1024 --timeout 900 \
  --zip-file fileb://.deploy-backups/newsRecordReview/build.zip \
  --environment file:///tmp/review-env.json
rm /tmp/review-env.json
aws lambda wait function-active-v2 --region ap-northeast-1 --function-name newsRecordReview
scripts/lambda.sh newsRecordReview diff      # expect: identical to the repo package
```
No Function-URL is created (the handler emits no CORS headers and nothing calls it from a browser).

## (d) Memory, timeout, concurrency

- Memory 1024 MB (matches newsStoryRecord). Live facts are ~49 days at up to ~0.9 MB of JSONL each, parsed once into memory, plus 8 readings files and the bundles of ~500 stories; README's 512 MB is too tight with that and the extra memory buys CPU for parsing.
- Timeout 900 s (the Lambda maximum).
- Concurrency is the real constraint. Live `active.json` holds 519 stories (shadow: 14). The first run reads every one (no earlier readings), one DeepSeek call each, `maxTokens` 3000. At `REVIEW_CONCURRENCY=6` that is 87 sequential rounds: it fits 900 s only if a call averages under ~9 s, which a large model on a big bundle will not. The handler stops starting stories with under 60 s left, records them as `timeout` / `notReached`, the Run becomes `partial` and the invoke errors (the Errors metric moves). Measure the average call time in the shadow run (the `[usage]` log lines and Run timestamps), then set `REVIEW_CONCURRENCY` = ceil(stories x seconds_per_call / 800), watching for DeepSeek 429s (llm.js retries 429/5xx with backoff). Existing practice elsewhere is 3 (resolver).
- A re-run of the same week does NOT skip stories already read this week (the skip rule only looks at earlier weeks' readings), so to finish a partial run pass `threadIds` (the Run's `failures` entries with `stage:"timeout"` list them) instead of repeating the whole week. A re-run replaces only the stories it read and keeps the other stored lines.

## (e) Schedule (EventBridge rule, same shape as `TriggerStoryRecord`)

`TriggerStoryRecord` live: rule on the default bus, `cron(45 23 * * ? *)`, description, one target (Id = function name) with a constant `Input`, and a `lambda:InvokeFunction` resource permission scoped by SourceArn. Create the rule DISABLED (functions.json says `DISABLED`); enable it only after the live run is accepted.
```bash
aws events put-rule --region ap-northeast-1 --name TriggerRecordReview --schedule-expression 'cron(0 1 ? * MON *)' --state DISABLED \
  --description 'newsRecordReview: weekly review of the ISO week that just ended (Monday 01:00 UTC)'
aws lambda add-permission --region ap-northeast-1 --function-name newsRecordReview --statement-id TriggerRecordReview \
  --action lambda:InvokeFunction --principal events.amazonaws.com \
  --source-arn arn:aws:events:ap-northeast-1:280362093938:rule/TriggerRecordReview
aws events put-targets --region ap-northeast-1 --rule TriggerRecordReview \
  --targets '[{"Id":"newsRecordReview","Arn":"arn:aws:lambda:ap-northeast-1:280362093938:function:newsRecordReview","Input":"{\"shadow\":false}"}]'
```
Payload is `{"shadow":false}` and no `week`: the default is the ISO week that ended before now (`lastEndedWeek`), which on Monday 01:00 UTC is the week that just ended. The handler's default for `shadow` is `true`, so omitting it would silently write only under `record/shadow/`. Enable later with `aws events enable-rule --name TriggerRecordReview` (after "yes" per CLAUDE.md: it is not a user-facing send, but it starts paid model calls weekly).

## (f) Shadow-first sequence

Event shape (`src/index.js:35-41`): `{week:"YYYY-Www", threadIds:[...], shadow:true|false (default true), dryRun:true}`. A week can only be read once the views' `factsThrough` reaches its Sunday, so `2026-W43` (ends 2026-10-25) fails with "views not built through" until `newsStoryRecord` has built 2026-10-25. Use `2026-W42` now (Mon 2026-10-12 to Sun 2026-10-18). Live `record/views/manifest.json` factsThrough is 2026-10-22 (ok); shadow's is 2026-10-20 (ok).

1. Dry run on the live data, no model, no write (checks the read permissions and sizes):
   `aws lambda invoke --function-name newsRecordReview --payload '{"week":"2026-W42","shadow":false,"dryRun":true}' --cli-binary-format raw-in-base64-out out.json` ; out.json lists selected stories with `bundleChars`, and `skipped`. Expect about 519 active rows, almost all selected.
2. Shadow run with the model: `{"week":"2026-W42","shadow":true}` (default prefix). It reads `record/shadow/{views,facts,operator}`; the shadow tree holds only 14 stories, facts for 5 days (2026-09-20, 10-19..10-21, 10-23), none inside W42, so expect mostly `no_facts_by_week_end` skips and a thin result. That tests permissions, the DeepSeek key/URL/model and the write path, not quality. `record/shadow/operator/aliases.json` does not exist (the real file is `record/operator/aliases.json`), so shadow aliases are empty; copy it into `record/shadow/operator/` first if alias checks should be exercised.
3. Check, under `record/shadow/`: `runs/review-2026-W42.json` (`status:"ok"`, `counts.failed:0`, `notReached:0`, `rejections` with sane reasons, `promptVersion:"review-2"`, `model`), `readings/2026-W42.jsonl` (each line has `cites`, `covers`, `readingId`; validates against `schema/reading.schema.json`), `inbox/merges/<today>.jsonl` (merges only where the 5% rule holds). Look at one `[usage]` log line per call in CloudWatch `/aws/lambda/newsRecordReview` for token counts and latency; compute seconds per call for (d).
4. Live canary, 2 or 3 stories: `{"week":"2026-W42","shadow":false,"threadIds":["<id1>","<id2>"]}` writes real `record/readings/2026-W42.jsonl` and `record/runs/review-2026-W42.json`. Check as in step 3 under `record/`.
5. Full live run: `{"week":"2026-W42","shadow":false}` with `REVIEW_CONCURRENCY` set per (d) (`aws lambda update-function-configuration`: fetch, merge, write the full env map). Check `status`, `counts.notReached`, `counts.failed`. Finish a partial run with `threadIds` of the unfinished stories.
6. Only then enable the rule (e). Per the README the golden-week score (lane U) and the DeepSeek top-up gate the first live run; those are the operator's gate, not covered here.

Rollback: `aws events disable-rule --name TriggerRecordReview`; readings are append-per-week files that `newsStoryRecord` only reads, so a bad week is removed by deleting `record/readings/<week>.jsonl` (destructive S3 op: needs a fresh yes).
