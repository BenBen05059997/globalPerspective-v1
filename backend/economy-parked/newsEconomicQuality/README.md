# newsEconomicQuality

PARKED. LLM-as-judge for economic impact records. Scans `ECON#THREAD#` rows with `hasImpact: true` that
were not judged within `QUALITY_RECENT_DAYS` (7), loads the thread analysis and topic summaries, and
scores each on 5 axes (coherence, citation_fidelity, analog_match, severity_calibration, no_bs). Any
axis <= 2 marks the record low quality. Writes `qualityScores`, `is_low_quality`, `quality_judged_at`
back to the record. Judge is a different model family from the producer (DeepSeek) on purpose.

## Deployment
- Deployed name `newsEconomicQuality` · runtime `nodejs22.x` · group `economy-parked` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerNewsEconomicQuality` `cron(0 8 * * ? *)` (UTC, DISABLED)
- Deploy: `scripts/lambda.sh newsEconomicQuality diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules (`package` installs prod deps).

## Reads / writes
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: scan `ECON#THREAD#*`/`ECONOMIC_IMPACT`; get `THREAD#<id>`/`THREAD_ANALYSIS`, `TOPIC#<id>`/`SUMMARY`; update the ECON record.
- Limits: `QUALITY_MAX_RECORDS` (15) per run, `INTER_CALL_DELAY_MS` (13000) between calls.

## Models
- `XAI_API_KEY` holds a Google Gemini key; `GROK_MODEL` (fallback `gemini-2.5-flash`); `GROK_API_URL` (fallback Gemini OpenAI-compatible endpoint on `generativelanguage.googleapis.com`). Legacy names; check live config before assuming the provider.
- Thinking disabled via `extra_body.google.thinking_config.thinking_budget: 0`; never also send `reasoning_effort` (Gemini 400s on both).

## Gotchas
- Economy is parked: schedule DISABLED; re-enabling needs an operator decision.

## Tests
- `node backend/economy-parked/newsEconomicQuality/test/judge.test.js` after `npm install` in `src/`. Not run 2026-10-19: no node_modules locally (fails on `@aws-sdk/client-dynamodb`).

Last verified: 2026-10-19
