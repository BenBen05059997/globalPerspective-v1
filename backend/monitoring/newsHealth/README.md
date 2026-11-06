# newsHealth

The operator's health and cost view (design: [ARCHITECTURE_OPS.md](../../../project-docs/architecture/ARCHITECTURE_OPS.md)). Once an hour it reads the pipeline's own files and AWS metrics and writes two JSON files. It uses no model and sends no alert (the operator removed pipeline alarms 2026-11-02): it only writes what it saw, and a source it cannot read is `nodata` with the error text, never a made-up value.

**Status: live, all four phases deployed.** Deployed 2026-11-04 (about 20:34 JST), rule `TriggerHealth` hourly and ENABLED; `record/views/health.json` and `monitoring/ops.json` are written. The `ops` action is in the deployed `newsReadApi` (`OPS_OPERATOR_UIDS` set) and the `/ops` page is released (bundle `index-DCySZ7bZ`, release 7, with the Quality panel; the `recovered` glyph is on main, not yet released). Readers (phase 2) are live: `CF_ANALYTICS_TOKEN` is set and the Cloudflare pull reads `ok`; Web Analytics was switched to automatic setup on 2026-11-05 (the snippet-mode site dropped every beacon with a 404), so reader data starts on 2026-11-05. Quality (phase 3) was deployed 2026-11-05 about 23:00 JST. Self-healing (phase 4) was deployed 2026-11-06 about 00:00 JST with `HEAL=dry`: it decides and reports in `now.heal` and writes and invokes nothing; the operator sets `HEAL=on` after reading a dry tick. Its recovery step is the Lambda `newsRecover` ([README](../../record/newsRecover/README.md)).

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

## Readers (ops.json `readers`, phase 2)
Built once per UTC day (the first run of the day; again each hour while Cloudflare is not `ok`). Design: ARCHITECTURE_OPS.md "Phase 2 as built". Code: `src/cloudflare.js` (the API), `src/readers.js` (families, summaries, attention), `src/pageFamilies.json` (path -> family and family -> features), `aws.js` `ownRows`.
- Cloudflare Web Analytics, GraphQL `rumPageloadEventsAdaptiveGroups`, 14 days, by date and path, referrer host, country. No `CF_ANALYTICS_TOKEN` -> `readers.cloudflare = {status: 'not_connected'}` and no call; an API failure -> `{status: 'error', error}`.
- Own tables (counts only): `GlobalPerspectiveUserTable` (`createdAt`), `GlobalPerspectiveSavedItems` (`savedKey`), `GlobalPerspectiveShares` (`createdAt`).
- Env: `CF_ANALYTICS_TOKEN` (secret; set 2026-11-05, status `ok`), `CF_ACCOUNT_ID` (defaults to the account id in `scripts/site-release.config.json`, not a secret).
- The query filters `rumPageloadEventsAdaptiveGroups` by `requestHost: globalperspective.net` (the apex; www 301s to it), not by site tag: the token cannot call the Web Analytics site-list REST endpoint (HTTP 403), and the beacon `token` in the served HTML is not the analytics `siteTag`.
- IAM (`iam/policy.json`, now `OwnTablesProjectedScanOnly`): `dynamodb:Scan` on `arn:aws:dynamodb:ap-northeast-1:280362093938:table/GlobalPerspectiveUserTable`, `.../GlobalPerspectiveSavedItems`, `.../GlobalPerspectiveShares`.
- Test event flag `{"skipReaders": true}`; `node index.js --dry` shows the section locally.
- Live check 2026-11-05: the GraphQL fields were accepted (`readers.cloudflare.status` `ok`). The pull of 21:58 JST counted 0 views because the site's beacons only started after Web Analytics was switched to automatic setup (about 22:05 JST); real counts begin with the next daily pull. A wrong field comes back as `readers.cloudflare = {status: 'error', error: 'Cloudflare GraphQL: ...'}` with the API's message.

### Set or rotate the Cloudflare token (operator; done once on 2026-11-05)
1. Cloudflare dashboard, My Profile, API Tokens, Create Token, custom: Account, Account Analytics, Read; this account only. Copy it.
2. Run this in a terminal (the token is read from a prompt, so it is not in shell history or output), one block:
```
umask 077
NHENV=$(mktemp)
read -s -p "Cloudflare token: " CFT; echo
aws lambda get-function-configuration --function-name newsHealth --region ap-northeast-1 --query 'Environment.Variables' --output json > "$NHENV"
CFT="$CFT" NHENV="$NHENV" python3 - <<'EOF'
import json, os
f = os.environ['NHENV']
env = json.load(open(f)) or {}
env['CF_ANALYTICS_TOKEN'] = os.environ['CFT']
json.dump({'Variables': env}, open(f, 'w'))
EOF
unset CFT
aws lambda update-function-configuration --function-name newsHealth --region ap-northeast-1 --environment "file://$NHENV" --query 'Environment.Variables | keys(@)'
rm -f "$NHENV"
```
   (`umask 077` and `mktemp` keep the temp file private to you, and `CFT` is handed to python as an environment variable of that one command; the final query prints the variable names, never values.)
3. Invoke once: `aws lambda invoke --function-name newsHealth --payload '{}' --cli-binary-format raw-in-base64-out --region ap-northeast-1 /dev/stdout` and read `readers` in the answer: `ok`, or the error text.

## Quality (ops.json `quality`, phase 3)
Built once per UTC day (the first run of the day), for the last closed UTC day; a check that failed is read again hourly, alone. Design: ARCHITECTURE_OPS.md "Phase 3 as built". Code: `src/quality.js` (checks and section), `QUALITY` in `src/config.js`, ports in `src/aws.js` (`listKeys`, `clientErrorRows`, `auditLog`). Every check names its `source` and `day`; `{status:'not_available', why}` where the source does not exist, `{status:'error', error}` where a read failed.
| Check | Source | Result |
|---|---|---|
| duplicates, merged | `world/latest.json`; `situations/merges/YYYY/MM/DD/` (the tracker's merge files) | groups of open situations with the same normalised title and country set; merges of the day by rule |
| summaries about their sources | `record/inbox/entries/DAY.jsonl`, `ai.summary` | count, phrases, 5 examples (title, phrase) |
| pins outside their country | none | `not_available`: newsSituationIngest moves such centroids silently, no log or file counts them |
| forecast voids, coverage gaps | `record/inbox/verdicts/DAY.jsonl`; `record/runs/DAY.json` x 14 days | voids by reason (record gap first); gap days with the reason |
| source audit | `/aws/lambda/newsSourceAudit` log (Logs Insights, 7 days) | last run: checked, drift (titles), errors, single-source; `deadOutlets` is `not_available` (the audit does not record outlets it cannot fetch) |
| client errors by page | DynamoDB `GlobalPerspectiveClientErrors`, Scan projecting `day`, `count`, `sampleUrl` | the day vs the median of the 14 days before, per page family |
- Event flag `{"skipQuality": true}`; `node index.js --dry` shows the section.
- IAM beyond phase 2 (in `iam/policy.json`, applied 2026-11-06): `s3:GetObject` on `situations/merges/*`, `dynamodb:Scan` on `GlobalPerspectiveClientErrors`. A check whose read is refused reads `error` with the AccessDenied text and is read again on the next hourly run.
- The run can take longer with the extra reads (a Logs Insights query for the audit, up to 30 s); the 120 s timeout still holds because the quality pull runs beside the readers pull.

## Self-healing (phase 4)
Runs first on every tick, before `health.json` is built. Design and the reasons: [ARCHITECTURE_OPS.md](../../../project-docs/architecture/ARCHITECTURE_OPS.md) "Phase 4 as built". Code `src/heal.js` (the pass), `src/healthRead.js` (S3 reads shared with `health.js`), settings `HEAL` in `src/config.js`, ports in `src/aws.js` (`invoke`, `staging`).
- **Condition:** `record/inbox/entries/D.jsonl` has no line, for today or the two days before. Thin days (under 20) are not healed. An unreadable file is skipped.
- **Step 1 (once per day, 21:00-23:00 UTC of D, never inside a scheduled run):** staging fresh (generated on D, not processed) -> invoke `newsAgent {}`; else invoke `newsIngest {}` and, next tick, the agent if staging is then fresh. The next tick reads the entries file: lines present -> ledger `healed`.
- **Step 2 (from D+1 00:30 UTC, within 48 h, still empty):** `newsRecover {day}` (up to 3 invokes, result in `monitoring/heal/recover/D.json`); with at least 300 articles in the day file, `newsStoryRecord {recovery:true, date:D}` (up to 2 invokes); the Run file must show `notes:"recovery"`, `inputs.recovered:true`, status ok, no failures -> ledger `recovered`. Otherwise `unhealed` with the reason; nothing is retried after an outcome.
- **Ledger** `monitoring/heal/D.json`, written before each invoke (a failed write means no invoke; a refused invoke still counts). A day with an `outcome` is never touched again.
- **Shown:** agent row status `recovered` (new), `facts.heal`, a note; `health.json now.heal` = what this tick did. `/ops` draws `recovered` as `↺`.
- **Switch:** env `HEAL` = `on` | `dry` | anything else (off, the default). `dry` decides and reports with nothing written or invoked. Event flags `{"heal":"dry"}` / `{"heal":"off"}` / `{"dry":true}` can only lower the mode.
- **Never:** an alert, an email, `force`, a second agent run for a day, a forecast on a recovered day, made-up articles.
- **Cost:** a re-run costs what a scheduled ingest (model + Brave) and agent run cost, at most once each per day; recovery uses no model and no paid API.

### State and turning it on
Deployed 2026-11-06 about 00:00 JST: `newsRecover` (role, function, no schedule; steps in its README), the whole role policy `iam/policy.json` (phases 1-4), and this code, with `HEAL=dry`. Remaining step, needing the operator's yes:
```
# 1. look at a dry tick: invoke once (or wait for the hourly tick) and read health.json now.heal (mode "dry", actions with dry:true)
aws lambda invoke --function-name newsHealth --payload '{}' --cli-binary-format raw-in-base64-out --region ap-northeast-1 /dev/stdout
# 2. HEAL=on: fetch the env, merge HEAL=on, write the full map (temp file; keep WORLD_BUCKET and CF_ANALYTICS_TOKEN)
```
Planned with step 2 (operator, 2026-11-06; not done): once `HEAL=on`, disable the rule `TriggerFreshnessMonitor` (the `/ops` page and the heal pass then cover a stale feed). The `/ops` Quality panel already replaced the `newsErrorDigest` email (`TriggerErrorDigest` DISABLED 2026-11-06) and reads the `[audit]` log lines of `newsSourceAudit`, which no longer emails.
Read-only preview from a laptop (no S3 write, no invoke): `HEAL=dry node index.js --dry` in `src/` (needs `npm install` there for the SDK clients).

## Deployment
- Name `newsHealth` · `nodejs24.x` · handler `index.handler` · timeout 120 s · 256 MB · group `monitoring` (scripts/functions.json). Worst case a run waits 60 s for each of the two Logs Insights queries (they run side by side), plus the resolver invoke; a normal run takes under 30 s. The zip does not ship node_modules (the runtime's AWS SDK v3 is used).
- Trigger: EventBridge rule `TriggerHealth`, `rate(1 hour)`, ENABLED, no input.
- Env: `WORLD_BUCKET` (default `globalperspective-world-280362093938`), `HEAL` (`on` | `dry`; unset = off; currently `dry`), `CF_ANALYTICS_TOKEN` (secret).
- Test event flags: `{"dry": true}` (writes nothing), `{"skipCost": true}`.

## Deploy (the steps used on 2026-11-04; each IAM and AWS step needed the operator's yes)
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
Role policy: `iam/policy.json` (the whole policy, phases 1-4; applied 2026-11-06). Reads: S3 Get on `record/*`, `situations/merges/*`, `world/latest.json`, the old `monitoring/ops.json` (so history carries over) and `monitoring/heal/*`; `s3:ListBucket` so a missing key is a 404, not AccessDenied; `dynamodb:Scan` (projected) on the three readers tables and `GlobalPerspectiveClientErrors`; `dynamodb:GetItem` on `NewsCache` with leading key `staging`; `logs:StartQuery` on `/aws/lambda/news*`, `logs:GetQueryResults`, `DescribeLogGroups`; `cloudwatch:GetMetricData`; `ce:GetCostAndUsage`. Writes: S3 Put only on `monitoring/ops.json`, `record/views/health.json` and `monitoring/heal/*`; its own log group. Invokes: `lambda:InvokeFunction` on `newsPredictionResolver` and on `newsAgent`, `newsIngest`, `newsStoryRecord`, `newsRecover`. After the first real run, check `aws s3 ls s3://globalperspective-world-280362093938/record/views/health.json` and that `/data/record/views/health.json` answers 200 through the Worker.

## Local preview (no S3 writes)
```
cd backend/monitoring/newsHealth/src && npm install     # devDependencies only: the AWS SDK clients, for local runs
node index.js --dry > /tmp/health-preview.json          # reads live S3, CloudWatch, Logs, the resolver status and (if none was pulled) Cost Explorer; prints {"health", "ops"}
node index.js --dry --no-cost                           # same without the $0.01 Cost Explorer call
```
Needs AWS read credentials for ap-northeast-1.

## Reads / writes
Reads: S3 (above), CloudWatch metrics and Logs Insights, the resolver's `status` action, Cost Explorer, the three own tables (projection scan), Cloudflare's analytics API (HTTPS, when a token is set). Writes: the two files and, with `HEAL=on`, the heal ledger `monitoring/heal/DAY.json`; with `HEAL=on` it also starts `newsAgent`, `newsIngest`, `newsRecover` and `newsStoryRecord` (asynchronous invokes) and reads the ingest's `staging` item in `NewsCache`. Not a Function URL; the code emits no CORS headers.

## Tests
`cd backend/monitoring/newsHealth/src && npm test` (`node --test ../test/*.test.js`, offline, fakes for every AWS port). Covers (self-healing: `test/heal.test.js`, a forced-missing day healed by the agent re-run, by ingest then agent and by recovery, a day that cannot heal without a loop, the once-per-day guards, the schedule windows, dry/off, the `recovered` row and the schema; quality: `test/quality.test.js`, every check on injected ports) day arithmetic, every stage's thresholds, a day with missing files, unreadable sources, snapshot carry-forward, the schema, pricing (peak, cache hits, unknown model), unit costs, history retention, the once-a-day Cost Explorer pull and the Logs Insights polling.
