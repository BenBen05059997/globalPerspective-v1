# newsWeeklyMarkets

Weekly markets report ("what moved this week and why"). Computes each tracked instrument's week-over-week % move deterministically from price history, takes the top `WEEKLY_TOP_MOVERS` (default 10) by absolute move, and grounds each mover in one of three tiers: our own ECONOMIC_IMPACT coverage (short LLM note that must pass an LLM judge), else a cited web-context note, else "No clear driver found." The LLM never supplies a number or direction. Event: `weekKey` (default today).

## Deployment
- Deployed name `newsWeeklyMarkets` · runtime `nodejs22.x` · group `economy-parked` (scripts/functions.json)
- Trigger: `TriggerWeeklyMarkets` `cron(30 8 ? * SUN *)` UTC, DISABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsWeeklyMarkets diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `MARKETS_DDB_TABLE` (default GlobalPerspectiveMarkets): scans `pk` `COMMODITIES#GLOBAL`, `RATES#GLOBAL`, `EQUITIES#GLOBAL`, `CRYPTO#GLOBAL` with `sk` `HISTORY#...`
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: scans `ECON#THREAD#`/`ECONOMIC_IMPACT` (hasImpact, within `COVERAGE_WINDOW_DAYS`, default 9); writes `WEEKLY_MARKETS#<weekKey>`/`WEEKLY_MARKETS` (ttl 180 days)
- Other env names: `MAX_TOKENS` (700), `TEMPERATURE` (0.3), `MIN_MOVE_PCT` (0.1), `JUDGE_DELAY_MS` (6000)

## Models
- Coverage note: `GROK_MODEL` (code fallback `deepseek-flash`) at `GROK_API_URL` (fallback `https://api.deepseek.com/chat/completions`), key `XAI_API_KEY`. The GROK_/XAI_ names hold DeepSeek values.
- Web context: `PERPLEXITY_MODEL` (fallback `sonar`) at `PERPLEXITY_API_URL`, key `PERPLEXITY_API_KEY`; skipped when the key is unset.
- Judge: `JUDGE_MODEL` (fallback `gemini-2.5-flash`) at `JUDGE_API_URL` (fallback Google generativelanguage), key `JUDGE_API_KEY`; with no key the gate is disabled and every note passes.

## Gotchas
- Parked with the economy feature: the schedule is DISABLED (group `economy-parked`).
- Writes `status: 'published'` directly (auto-publish since 2026-09-11); the file header still says "manual-invoke first (no EventBridge schedule)" and package.json still says "draft".
- Instruments whose week-ago anchor is older than 14 days are excluded and listed as `excluded`, not compared.
- An LLM error degrades only that mover; the run fails empty when no instrument has two weekly anchors.

## Tests
- None
