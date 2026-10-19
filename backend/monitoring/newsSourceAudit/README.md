# newsSourceAudit

Scheduled source-truth audit for the summarizer. For the top `AUDIT_N` (default 6) live topics it rates source robustness (none / single / low / corroborated), fetches up to 3 source articles, and asks an LLM whether our cached summary drifts from them (hedge turned into assertion, invented result, added framing). Logs every verdict; sends an SNS alert when drift count reaches `DRIFT_ALERT_THRESHOLD` (default 2). Self-contained port of `quality/analysis/source_check.mjs`.

## Deployment
- Deployed name `newsSourceAudit` · runtime `nodejs22.x` · group `monitoring` (scripts/functions.json)
- Trigger: `newsSourceAuditDaily` `cron(30 11 ? * MON,WED,FRI *)` UTC, ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsSourceAudit diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- `PROXY_ENDPOINT` (public proxy actions `topics`, `summary`)
- External: each topic's source URLs (article fetch, 15s timeout)
- SNS: publishes to `SNS_TOPIC_ARN` when the threshold is hit
- No S3 or DynamoDB writes

## Models
- `AUDIT_MODEL` (code fallback `deepseek-v4-pro`) at `GROK_API_URL` (fallback `https://api.deepseek.com`), key `XAI_API_KEY`. The GROK_/XAI_ names point at DeepSeek. Thinking mode disabled.

## Gotchas
- The rule is named `...Daily` but runs Mon/Wed/Fri only.
- With no fetchable article it audits against source snippets instead.
- An LLM error is logged as `audit-error` and does not count as drift.

## Tests
- None

Last verified: 2026-10-19
