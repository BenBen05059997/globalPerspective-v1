# newsMarketsData

Ingests free economic data into DynamoDB for the economy surfaces. It pulls FX (Frankfurter/ECB), commodities, equities and ETFs (Yahoo Finance), crypto (CoinGecko), bond yields (FRED, free key) and country macros (World Bank). The event `source` selects one feed (`fx`, `commodities`, `equities`, `crypto`, `yields`, `macros`), or `all` (the default) runs the hourly set. `{"source":"seed_history"}` is a one-time, manual-only backfill of HISTORY rows from Yahoo. It never overwrites an existing row or today's row. No LLM.

## Deployment
- Deployed name `newsMarketsData` · runtime `nodejs24.x` · group `economy-parked` (scripts/functions.json)
- Triggers (EventBridge, UTC, all ENABLED): `MarketsDataHourly` `rate(1 hour)` input `{"source":"all"}`; `MarketsMacrosWeekly` `cron(0 2 ? * SUN *)` input `{"source":"macros"}`; `MarketsYieldsDaily` `cron(0 6 ? * MON-FRI *)` input `{"source":"yields"}`.
- Deploy: `scripts/lambda.sh newsMarketsData diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip does not ship node_modules.

## Reads / writes
- DynamoDB `MARKETS_DDB_TABLE` (default `GlobalPerspectiveMarkets`), keys `pk`/`sk` with a `ttl`: `FX#USD`, `RATES#GLOBAL`, `COMMODITIES#GLOBAL`, `EQUITIES#GLOBAL`, `CRYPTO#GLOBAL`, `MACRO#<country>`; sk `LATEST`, `HISTORY#YYYY-MM-DD` or `HISTORY#YYYY-Q#`.
- External: `api.frankfurter.app`, `api.stlouisfed.org` (`FRED_API_KEY`), `api.worldbank.org`, `query1.finance.yahoo.com`, `api.coingecko.com`.

## Gotchas
- The group is `economy-parked`, but all three schedules are still ENABLED, so it keeps writing.
- `all` also runs yields on weekdays from 06 to 22 UTC, and macros on Sunday at 02 UTC. Those overlap with the dedicated yields and macros rules, so both run twice at those times.
- Each source runs in its own try/catch, and a failure is recorded in that source's result. The handler always returns `statusCode: 200`.
- Every external fetch has a 10 s timeout. Seeding waits 300 ms between Yahoo calls.
- Not a Function URL; the code emits no CORS headers.

## Tests
- None.

Last verified: 2026-10-19
