# newsHealth

The operator's health and cost view (design: [ARCHITECTURE_OPS.md](../../../project-docs/architecture/ARCHITECTURE_OPS.md)). Once an hour it reads the pipeline's own files and AWS metrics and writes two JSON files. It uses no model and sends no alert (the operator removed pipeline alarms 2026-11-02): it only writes what it saw, and a source it cannot read is `nodata` with the error text, never a made-up value.

**Status: built 2026-11-04, not deployed.** No role, function or schedule exists yet; follow "Deploy" below.

## Files it writes (world bucket)
| File | Who reads it | What |
|---|---|---|
| `record/views/health.json` | Public, through the Worker (`/data/record/views/health.json`) | The pipeline panel: the last 14 UTC days, one row per stage per day (`ok`, `thin`, `missing`, `failed`, `nodata`), each with its facts, source and the source's time. Schema: `backend/record/schema/health.schema.json`. |
| `monitoring/ops.json` | `newsReadApi` action `ops`, operator uid only | The money panel: DeepSeek estimate per day, function, step and model; AWS cost per day and service; unit costs; month to date. Not under `record/views/`, so the Worker never serves it. Keeps up to 62 days so the month to date survives the 14-day query window. |

## Stages (health.json)
ingest (`record/runs/DAY.json` `inputs.rawDay`) · agent (line count of `record/inbox/entries/DAY.jsonl`) · record run (run status, counts, failures) · views (`record/views/manifest.json`) · resolver (the heartbeat `record/views/health/settle-tick.json` plus a read-only invoke of `newsPredictionResolver` `{"action":"status"}`) · situations (`world/latest.json`: age, stale, degraded, open) · briefs (daily brief note for the day; weekly on Sundays) · Lambda errors (CloudWatch `Errors` per `news*` function, one `GetMetricData`) · compare switches (`DIFFER` lines, one Logs Insights query over the step-5d groups, newsAgent, newsEmailSender). Thresholds and the measurements behind them are in `src/config.js`.

- A day is judged only after the next day's 01:00 UTC (the record run for day D finishes about 23:46 UTC on D); the open day shows `nodata` with the note "day in progress" where it cannot be judged yet.
- The resolver and situations rows are snapshots: they cannot be recomputed for a past day, so a closed day keeps the row the previous `health.json` held for it, and a day with none says "no snapshot was kept". The first days after deploy therefore show `nodata` for those two stages.
- Logs Insights only sees what log retention keeps (newsAgent keeps 7 days); a day with no `[usage]` line at all is `usd: null`, not a free day.

## Money (ops.json)
- DeepSeek is an estimate: the `[usage]` lines (`fn`, `step`, `model`, `prompt_tokens`, `completion_tokens`, `prompt_cache_hit_tokens`) summed per hour, function, step and model by one Logs Insights query over every `/aws/lambda/news*` group, priced hour by hour with `src/prices.json` (operator-owned; list rates read from https://api-docs.deepseek.com/quick_start/pricing on 2026-11-04, with the peak and off-peak windows). Chinese public holidays are off-peak at DeepSeek and not modelled, so those days are an upper bound. A model with no price (for example `jev-1.14.0`) is listed under `unpriced` and adds nothing. An actual balance is not read here (the key would be a secret copy; `newsModelGuard` already reads the balance).
- AWS: Cost Explorer `GetCostAndUsage` (daily, by service, UnblendedCost) once per UTC day: the first hourly run of a day that finds no pull for that day. $0.01 a call. Cost Explorer lags, so the newest day can still grow.
- Unit costs: a day's model spend for the matching functions and steps divided by that day's count (entries and `forecast_drawn` from the run file, country notes by line count, daily brief 0 or 1); the weekly review's spend per ISO week. Mapping in `CONFIG.units`.

## Deployment
- Name `newsHealth` · `nodejs24.x` · handler `index.handler` · timeout 120 s · 256 MB · group `monitoring` (scripts/functions.json). Worst case a run waits 60 s for each of the two Logs Insights queries (they run side by side), plus the resolver invoke; a normal run takes under 30 s. The zip does not ship node_modules (the runtime's AWS SDK v3 is used).
- Trigger: EventBridge rule `TriggerHealth`, `rate(1 hour)`, ENABLED, no input.
- Env: `WORLD_BUCKET` (default `globalperspective-world-280362093938`). No secrets.
- Test event flags: `{"dry": true}` (writes nothing), `{"skipCost": true}`.

## Deploy (operator authorization for each IAM and AWS step; nothing here has been run)
```
# 1. role (IAM)
aws iam create-role --role-name newsHealth-role --assume-role-policy-document file://backend/monitoring/newsHealth/iam/trust.json
aws iam put-role-policy --role-name newsHealth-role --policy-name newsHealth --policy-document file://backend/monitoring/newsHealth/iam/policy.json
# 2. the read API may read the money file (shared role of newsReadApi; it has no monitoring/ access today)
aws iam put-role-policy --role-name newsprojectLambdaRolefcb19312-dev --policy-name opsRead --policy-document file://backend/monitoring/newsHealth/iam/read-api-ops-read.json
# 3. package and create (wait ~10 s after the role is created)
scripts/lambda.sh newsHealth package
aws lambda create-function --function-name newsHealth --runtime nodejs24.x --handler index.handler --timeout 120 --memory-size 256 --role arn:aws:iam::280362093938:role/newsHealth-role --zip-file fileb://.deploy-backups/newsHealth/build.zip --environment 'Variables={WORLD_BUCKET=globalperspective-world-280362093938}' --region ap-northeast-1
# 4. one dry run through Lambda, then the schedule
aws lambda invoke --function-name newsHealth --payload '{"dry":true}' --cli-binary-format raw-in-base64-out --region ap-northeast-1 /dev/stdout
aws events put-rule --name TriggerHealth --schedule-expression 'rate(1 hour)' --state ENABLED --region ap-northeast-1
aws lambda add-permission --function-name newsHealth --statement-id TriggerHealth --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn arn:aws:events:ap-northeast-1:280362093938:rule/TriggerHealth --region ap-northeast-1
aws events put-targets --rule TriggerHealth --targets 'Id=1,Arn=arn:aws:lambda:ap-northeast-1:280362093938:function:newsHealth' --region ap-northeast-1
# 5. newsReadApi: deploy the `ops` action, then add OPS_OPERATOR_UIDS to its env (fetch, merge, write the full map)
```
Role policy: `iam/policy.json` (S3 Get on `record/*`, `world/latest.json` and the old `monitoring/ops.json` so history carries over; `s3:ListBucket` so a missing key is a 404, not AccessDenied; Put only on the two files; `logs:StartQuery` on `/aws/lambda/news*`; `logs:GetQueryResults` and `DescribeLogGroups`; `cloudwatch:GetMetricData`; `ce:GetCostAndUsage`; `lambda:InvokeFunction` on `newsPredictionResolver`; its own log group). After the first real run, check `aws s3 ls s3://globalperspective-world-280362093938/record/views/health.json` and that `/data/record/views/health.json` answers 200 through the Worker.

## Local preview (no S3 writes)
```
cd backend/monitoring/newsHealth/src && npm install     # devDependencies only: the AWS SDK clients, for local runs
node index.js --dry > /tmp/health-preview.json          # reads live S3, CloudWatch, Logs, the resolver status and (if none was pulled) Cost Explorer; prints {"health", "ops"}
node index.js --dry --no-cost                           # same without the $0.01 Cost Explorer call
```
Needs AWS read credentials for ap-northeast-1.

## Reads / writes
Reads: S3 (above), CloudWatch metrics and Logs Insights, the resolver's `status` action, Cost Explorer. Writes: the two files, nothing else. Not a Function URL; the code emits no CORS headers.

## Tests
`cd backend/monitoring/newsHealth/src && npm test` (`node --test ../test/*.test.js`, offline, fakes for every AWS port). Covers day arithmetic, every stage's thresholds, a day with missing files, unreadable sources, snapshot carry-forward, the schema, pricing (peak, cache hits, unknown model), unit costs, history retention, the once-a-day Cost Explorer pull and the Logs Insights polling.
