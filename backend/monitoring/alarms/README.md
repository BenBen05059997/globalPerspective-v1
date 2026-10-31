# Pipeline alarm spec

`spec.json` is a reviewable CloudWatch configuration proposal, not an installer, and it is not applied: none of its `GP-stage-*` alarms or metric filters exist. The operator does not want pipeline alarms. A 402 filter and record alarms were created and removed again on 2026-10-31. Do not create alarms from this spec without a fresh request.

What does exist (CloudWatch, read 2026-10-31): native `lambda-errors-*` alarms on `NewsProjectInvokeAgentLambda-dev`, `newsInvokeGemini-dev`, `newsThreadAnalysis`, `newsCountryIntelligence`, `newsPostDevTo`, `newsPostLinkedin` and `newsSensitiveData-dev` (plus its duration and throttles alarms), DynamoDB throttle alarms on NewsCache and SummarizeAndPredict, and the PPA project's alarms. Every news monitor publishes to the SNS topic `GlobalPerspectiveAlerts`; `GlobalPerspectivesAlerts` (plural) also exists, and the spec's proposed consolidation onto it has not happened.

## What the spec holds

- `stages`: eight stages (1 Ingest, 2 Stories, 3 Daily notes, 4 One reader, 5 Facts, 6 read APIs, 7 Delivery, 8 Watch), not the ten stages of `ARCHITECTURE_TIMELINE.md`. Spec 1-5 are pipeline stages 1-5; spec 6 and 7 are pipeline stage 9; spec 8 is pipeline stage 10. Pipeline stages 6 (Review), 7 (Views) and 8 (Weekly report) have no spec stage.
- `llmFunctions`: the inventory of Lambdas that call an LLM (shared `_shared/llm` and direct clients), with source files. A source inventory does not prove the deployed zips match; diff first.
- `metricFilters` and `alarms`: an insufficient-balance (402) filter per LLM log group, a failed-run marker filter per stage (`[pipeline-status] ... failed`), native `Errors` alarms per Lambda, aggregate `GP-stage-N-failed` alarms, and a selector dead-man alarm (`GP-selector-no-capture-9h`: 108 five-minute buckets without a capture log, missing data filled with zero). All alarm actions target one topic.
- A returned `{statusCode:503}` is a successful invocation, so native `Errors` misses the agent's empty or stale run; the spec keeps a marker alarm on its log group as well.

Offline check: `node --test backend/monitoring/alarms/spec.test.mjs`.

## Client-error CORS

`client-errors-cors.json` is the Function URL CORS config of `newsClientErrors`. It matches the live config: methods POST, header content-type, max age 3600, origins `https://globalperspective.net`, `https://www.globalperspective.net`, `https://benben05059997.github.io` and the localhost / 127.0.0.1 development ports 5173 and 5174. The handler emits no `Access-Control-Allow-Origin`, so the Function URL stays the only CORS owner; do not add CORS headers to the handler while the URL emits them. Apply a change with `aws lambda update-function-url-config --function-name newsClientErrors --cors file://backend/monitoring/alarms/client-errors-cors.json --region ap-northeast-1` after re-reading the live config (operator go-ahead).
