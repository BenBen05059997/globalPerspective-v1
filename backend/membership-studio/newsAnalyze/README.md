# newsAnalyze

Member-side Analysis Studio run. The Studio page retired 2026-10-20 (decision 0033), so the site no longer calls this Lambda. Verifies a Firebase JWT, decides how the run is paid
(`src/lib.js` `decidePayment`), runs the user message against DeepSeek with a server-pinned system
prompt, returns the Markdown report. THIS REPO SOURCE IS NOT WHAT SERVES: the deployed zip is
prompt-patched and pre-credits (see `deployed-snapshot/README.md`); `src/` carries the PARKED credits code.

## Deployment
- Deployed name `newsAnalyze` · runtime `nodejs20.x` · group `membership-studio` (scripts/functions.json)
- Trigger: Function URL (HTTP POST/OPTIONS from the frontend); no schedule.
- Deploy: BLOCKED. `scripts/lambda.sh newsAnalyze diff` only; `deploy` is refused (deployBlocked).

## Reads / writes
- DynamoDB: `USERS_DDB_TABLE` keyed by `uid` (`tier`, `analyzeMonth`, `analyzeCount`, `creditBalance`).
- Repo src: member monthly allowance `MEMBER_MONTHLY_ALLOWANCE` (default 100), then atomic 1-credit decrement; 402 `out_of_credits`; credit refunded on LLM failure.
- External: `www.googleapis.com` (Firebase signing certs), DeepSeek chat completions.

## Models
- `XAI_API_KEY` / `GROK_API_URL` (default `https://api.deepseek.com`) / `GROK_MODEL` (repo fallback `deepseek-v4-pro`): legacy GROK/XAI names hold DeepSeek values. `MAX_TOKENS` default 1600.

## Gotchas
- deployBlocked: "Deployed zip is prompt-patched; the repo carries parked credits code. Needs a fresh go-live decision (CLAUDE.md)."
- CORS: code emits `Access-Control-Allow-Origin` (`CORS_ORIGINS` allow-list), so Function-URL CORS must stay empty.
- `SYSTEM_PROMPT` mirrors the frontend analysis prompt; keep them in sync. The header comment in `src/index.js` still describes the daily cap and member-only gate, which only the deployed code has.
- Repo src does not send `thinking: { type: 'disabled' }`; the deployed code does.

## Tests
- `cd backend/membership-studio/newsAnalyze/src && npm test` (`node --test ../test/lib.test.js`).
