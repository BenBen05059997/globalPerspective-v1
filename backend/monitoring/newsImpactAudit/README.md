# newsImpactAudit

Daily independent audit of the topic selector's impact judgment. It reads the latest selector capture (what newsInvokeGemini saw vs chose) and asks an LLM which high-impact events were missed. It also computes two objective gaps: GDACS Orange/Red disasters from the last 5 days that the selection doesn't cover, and countries with serious GDELT conflict (>= 30 mentions or >= 3 events) over the last 2 days that it doesn't cover. It writes the verdict to S3 and SNS-alerts. It only measures and alerts; it never changes the live feed.

## Deployment
- Deployed name `newsImpactAudit` · runtime `nodejs22.x` · group `monitoring` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerImpactAudit` `cron(0 9 * * ? *)` (UTC, DISABLED)
- Deploy: `scripts/lambda.sh newsImpactAudit diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip does not ship node_modules.

## Reads / writes
- S3 `WORLD_BUCKET`, reads: `audit/ingest-capture/latest.json` (`INGEST_CAPTURE_KEY`), `corpus/gdacs/latest.json` (`GDACS_CORPUS_KEY`), `corpus/gdelt/<today|yesterday>.json` (`GDELT_CORPUS_PREFIX`).
- S3 writes: `audit/impact/<YYYY-MM-DD>.json` and `audit/impact/latest.json` (`IMPACT_AUDIT_PREFIX`).
- DynamoDB: none (the IngestCapture/ImpactAudit/GdacsEvents/GdeltConflict tables were dropped in S8·T2).
- SNS: `SNS_TOPIC_ARN` when misses >= `MISS_ALERT_THRESHOLD` (default 2), or on any GDACS `country_absent` gap or GDELT gap.

## Models
- `GROK_MODEL` (fallback `deepseek-flash`) through the shared client `src/_shared/llm.js` (`backend/shared/src`): `GROK_API_URL` (fallback `https://api.deepseek.com`), key `XAI_API_KEY`. Despite the GROK_/XAI_ names, this is DeepSeek. Thinking is disabled.

## Gotchas
- The schedule is DISABLED, so the audit is dormant and runs only on a manual invoke.
- It uses the same model family as the selector by operator choice. The prompt is tuned to look for under-covered atrocity, displacement and Africa stories.
- The S3 verdict write is best-effort and never blocks the SNS alert.
- Not a Function URL; the code emits no CORS headers.

## Tests
- None.

Last verified: 2026-10-19
