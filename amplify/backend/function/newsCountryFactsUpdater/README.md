# newsCountryFactsUpdater

Weekly refresh of per-country facts (`FACTS#<name>` records) used by the country-briefing prompts.
40 hard-coded countries: the first 12 (Iran ... Cuba) get Wikidata head-of-state/government leadership
plus ACLED 30-day conflict counts; the rest get capital + population only, resolved from ISO3 via
Wikidata P298. Parsing rules live in `src/facts.js` (population only with its own year; capital only
without an end time; unparseable values dropped). Optional `event.countries` limits the run.

## Deployment
- Deployed name `newsCountryFactsUpdater` · runtime `nodejs24.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `Fact` `cron(0 5 ? * MON *)` (Asia/Tokyo, ENABLED)
- Deploy: `scripts/lambda.sh newsCountryFactsUpdater diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: Get then Put `PK FACTS#<country>` / `SK COUNTRY_FACTS` (whole-record replace, `ttl` +90 days).
- External: `query.wikidata.org` (SPARQL), `www.wikidata.org`, `acleddata.com` (OAuth token + read; `ACLED_USERNAME`/`ACLED_PASSWORD`, skipped when unset).

## Gotchas
- Leadership only for the original 12: Wikidata leadership was stale or wrong for others (Australia, Sudan, DR Congo, Taiwan).
- Capital/population-only countries are written with a Put, so leadership fields are never carried forward for them.
- Time budget `FACTS_TIME_BUDGET_MS` (default 150000; Lambda timeout 183 s): countries not reached are skipped and keep their old record.
- A failed ACLED login is not retried per country. 600 ms sleep between countries for Wikidata rate limits.
- Missing `SUMMARIZE_PREDICT_TABLE` throws.

## Tests
- `cd amplify/backend/function/newsCountryFactsUpdater/src && npm test` (`node --test ../test/*.test.js`): 7 pass.

Last verified: 2026-10-19
