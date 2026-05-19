# newsEconomicImpact Lambda

Per-thread economic disruption analysis. Reads news threads, calls DeepSeek with a closed instrument allowlist + market snapshot, validates the JSON, writes records to `SummarizeAndPredict` table.

For the full concept + methodology, see [`ECONOMIC_DISRUPTION.md`](../../../../ECONOMIC_DISRUPTION.md) at the repo root.

For the implementation plan, see [`ECONOMIC_DISRUPTION_PLAN.md`](../../../../ECONOMIC_DISRUPTION_PLAN.md).

## Run tests

```bash
# Validator unit tests (closed allowlist, citation requirement, enum normalization)
node amplify/backend/function/newsEconomicImpact/test/validator.test.js
```

The validator tests require the Lambda's `node_modules` to be installed:

```bash
cd amplify/backend/function/newsEconomicImpact/src && npm install
```

No AWS credentials needed — tests run entirely locally with the @aws-sdk modules stubbed at the require level.

## Deploy

```bash
# Zip the source
cd amplify/backend/function/newsEconomicImpact/src
zip -rq /tmp/newsEconomicImpact.zip . -x "*.zip" "_under_test.js"

# Update existing Lambda
aws lambda update-function-code \
  --function-name newsEconomicImpact \
  --region ap-northeast-1 \
  --zip-file fileb:///tmp/newsEconomicImpact.zip

# Or create from scratch (first-time deploy — see ECONOMIC_DISRUPTION_PLAN.md for env vars + IAM)
```

## Invoke manually

```bash
# Default — process up to ECON_MAX_THREADS (env var, default 15)
aws lambda invoke \
  --function-name newsEconomicImpact \
  --region ap-northeast-1 \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/out.json
cat /tmp/out.json
```

## Schedule

EventBridge rule `TriggerNewsEconomicImpact`, `cron(30 7 * * ? *)` — daily 07:30 UTC. Runs after `newsThreadAnalysis` (06:30), `newsCountryIntelligence` (07:00), and `newsSystemsAnalysis` (07:15) so it can read their fresh output.

## Files

- `src/index.js` — handler + validator + LLM call + DDB writes
- `src/economic_analogs.json` — curated historical reference events (22 entries)
- `src/package.json` — AWS SDK dependencies only
- `test/validator.test.js` — 31 validator unit tests (no AWS, no LLM calls)
