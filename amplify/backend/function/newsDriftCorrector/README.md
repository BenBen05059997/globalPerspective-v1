# newsDriftCorrector — deploy & configure

The **living-analysis corrector** (Phase 1b — see `../../../../LIVING_ANALYSIS_PLAN.md`).

Per covered country, once a day (after `newsCountryIntelligence`):
1. **Gate (deterministic, no LLM):** read the daily `HISTORY#` snapshots; did the *conclusion* move **recently** (risk level flip / |Δscore|≥8 / trajectory, within `DRIFT_LOOKBACK_DAYS`)? Most days → no-op.
2. **Ground (DeepSeek):** if it moved, read the country's real archive events in the window and ask the model to pick the SINGLE numbered event that explains it (or honestly declare no single driver — it can't invent a cause).
3. **Write a note, never overwrite:** `COUNTRY#{name}` / `DRIFT#{date}` = `{ since, asOf, changeLevel, changeScore, triggerEvent{topicId,title,date}, whyChanged, noSingleDriver, ttl }`.

Served by `newsSensitiveData` `country_history` (`driftNotes[]`), rendered in `CountryWhatChanged` as "↳ Because: <event> — <why>".

> Same-family model (DeepSeek) is fine here: the corrector *grounds a causal explanation* (generation), it does **not** judge the analyzer's prose — so LLM-judge family-bias doesn't apply. Different-family stays reserved for a future quality-judge.

## Env vars
| Var | Value | Notes |
|-----|-------|-------|
| `SUMMARIZE_PREDICT_TABLE` | the SummarizeAndPredict table | reads `HISTORY#`, writes `DRIFT#` |
| `TOPICS_DDB_TABLE` | the Topics/NewsCache table | reads `archive#<date>` + `today-archive` for events |
| `XAI_API_KEY` / `GROK_API_URL` / `GROK_MODEL` | **DeepSeek** (`deepseek-chat`, `api.deepseek.com/chat/completions`) | legacy names hold DeepSeek — copy from `newsCountryIntelligence` |
| `DRIFT_LOOKBACK_DAYS` | `10` | only note a move within this recency window |
| `DRIFT_TTL_DAYS` | `60` | note TTL |
| `DRIFT_MAX_EVENTS` | `25` | events fed to the grounding prompt |
| `DRIFT_COUNTRIES` | (default = the 12 covered) | comma list; or invoke with `{"country":"Ukraine"}` |

## Local test (no AWS)
```bash
cd amplify/backend/function/newsDriftCorrector/src && npm test   # node --test ../test/lib.test.js
```
The grounded-note quality was proven against live data before deploy (Ukraine/US cited real events; Iran correctly no-noted a stale move).

## Create the Lambda (AWS CLI sketch)
```bash
cd amplify/backend/function/newsDriftCorrector/src
zip -r ../deploy.zip . -x '*/node_modules/*'   # runtime provides @aws-sdk; include lib.js
aws lambda create-function --function-name newsDriftCorrector \
  --runtime nodejs20.x --handler index.handler --timeout 120 --memory-size 256 \
  --role <exec-role-with-policy-below> --zip-file fileb://../deploy.zip --region ap-northeast-1
# env via update-function-configuration --environment file://env.json (secrets in a temp file)
# schedule ~07:20 UTC (after country-intel):
aws events put-rule --name TriggerDriftCorrector --schedule-expression 'cron(20 7 * * ? *)' --region ap-northeast-1
# ...add-permission + put-targets to wire the rule to the function.
```

### IAM policy (minimal)
- `dynamodb:Query` + `dynamodb:GetItem` + `dynamodb:PutItem` on `SUMMARIZE_PREDICT_TABLE`
- `dynamodb:GetItem` on `TOPICS_DDB_TABLE`
- basic-exec (CloudWatch logs)

## Also deploy alongside
- `newsSensitiveData` — `country_history` now returns `driftNotes[]` (code change; needs redeploy).
- Frontend — `CountryWhatChanged` renders the grounded note.
