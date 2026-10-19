# newsModelGuard

Daily guard against DeepSeek model retirements and an empty balance. It checks DeepSeek's `/user/balance` and alerts when `is_available` is false or the USD balance is below `DEEPSEEK_BALANCE_ALERT_USD` (default 3). It then lists every Lambda in the region and flags any model env var (`MODEL_VARS`) set to a `deepseek-*` id that is a deprecated alias (`DEPRECATED_ALIASES`, default `deepseek-chat,deepseek-reasoner`) or is missing from DeepSeek's live `/models` list. It is silent when nothing is wrong.

## Deployment
- Deployed name `newsModelGuard` · runtime `nodejs20.x` · group `monitoring` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerModelGuard` `cron(0 12 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsModelGuard diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip does not ship node_modules, and `src/` has no package.json.

## Reads / writes
- AWS: `lambda:ListFunctions` (reads every function's env variables).
- External: `api.deepseek.com/models` (`DEEPSEEK_MODELS_URL`) and `api.deepseek.com/user/balance`, using `DEEPSEEK_API_KEY`.
- SNS: `SNS_TOPIC_ARN`.
- Env: `MODEL_VARS` (default `GROK_MODEL,LLM_MODEL,MODEL,AUDIT_MODEL,JUDGE_MODEL,PPLX_MODEL,AI_MODEL`), `IGNORE_FUNCTIONS`, `DEPRECATED_ALIASES`, `DEEPSEEK_BALANCE_ALERT_USD`.

## Gotchas
- Functions whose names end in `-sandbox`, or are listed in `IGNORE_FUNCTIONS`, are skipped.
- Only direct `deepseek-` ids are checked. OpenRouter's `deepseek/...` ids are ignored.
- Without `DEEPSEEK_API_KEY`, the balance check and the "missing from /models" check are skipped, and only deprecated aliases are flagged.
- The "~N days" line in the alert uses a hard-coded burn rate of `DAILY_BURN_USD = 0.4`.
- Not a Function URL; the code emits no CORS headers.

## Tests
- `node --test backend/monitoring/newsModelGuard/test/*.test.js` (the AWS SDK is stubbed). Passed 4/4 on 2026-10-19. The header's `node --test .../test/` (directory form) fails on Node 22.

Last verified: 2026-10-19
