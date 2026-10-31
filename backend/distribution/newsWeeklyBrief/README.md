# newsWeeklyBrief

Generates the weekly intelligence brief as a "signals" digest. Reads 7 days of topic archives, takes the top `WEEKLY_TOP_THREADS` (default 6) threads by entry count and the top `WEEKLY_TOP_COUNTRIES` (default 6) real countries, and asks an LLM for per-signal text only (lede, fact, so-what, related) plus a watch list. Risk level, region, `iso3[]` (via `resolveIso3`), sources, as-of dates and `relatedThreadIds` (this week's other signals linked to it, derived from the story web) are joined in from stored data, never from the model; `threadIds[]` is stored on the brief. Served by newsSensitiveData `weekly_brief` (latest, or a past week with `week=YYYY-MM-DD`). A successfully read empty week skips without publishing. Unusable generated output and configuration/read/model/publish failures throw, with a failed-run marker; an absent optional record remains a normal omission. Event: `weekKey` (default today), `mode: 'grounded'` (default `free`).

## Deployment
- Deployed name `newsWeeklyBrief` · runtime `nodejs22.x` · group `distribution` (scripts/functions.json)
- Trigger: `TriggerWeeklyBrief` `cron(0 6 ? * SUN *)` UTC, ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsWeeklyBrief diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `today-archive` and `archive#YYYY-MM-DD` (key `id`)
- Env `NOTES_READS` (decision 0053, `ddb` default | `compare` | `notes`): the `THREAD_ANALYSIS` and `COUNTRY_INTELLIGENCE` reads come from the record's `story_analysis` and `country` notes instead (shared `noteReads.js` `rowReaders`; a failed read still fails the run); `compare` logs `[notes-compare]` differences. The role needs `s3:GetObject` on those prefixes.
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`, `COUNTRY#<name>`/`COUNTRY_INTELLIGENCE`; writes `WEEKLY_BRIEF#<weekKey>`/`WEEKLY_BRIEF` (ttl 180 days)
- S3 world bucket, only when env `NOTES_PREFIX` is set (unset = nothing): the brief as a `weekly_brief` note under `<NOTES_PREFIX>notes/weekly_brief/` (decision 0048; best-effort, never fails the run; the DynamoDB put stays). Needs `s3:GetObject`/`PutObject` on `record/notes/weekly_brief/*` and its manifest. Live env has no `NOTES_PREFIX` (read 2026-10-31), so no note is written yet; the notes already in the record came from `backend/record/cli/backfill-brief-notes.mjs`.
- Sends no email itself (`newsEmailSender` reads `WEEKLY_BRIEF#` for the weekly email).
- Other env names: `MAX_TOKENS` (3500), `TEMPERATURE` (0.3)

## Models
- `GROK_MODEL` (code fallback `deepseek-v4-pro`) via the shared client `src/_shared/llm.js` (`GROK_API_URL`, fallback `https://api.deepseek.com`; key `XAI_API_KEY`). The GROK_/XAI_ names hold DeepSeek values.

## Gotchas
- Writes `status: 'published'` directly (auto-publish). To hold a bad brief back, set its status to `draft`; the serving action only serves `published`.
- Country records that are regions or older than 30 days are skipped (`usableCountryRecord`).
- `dayZero`, `placeFilter` and `llm` come from `backend/shared/src` through the `src/_shared` symlink; `scripts/lambda.sh` zips them as real files. Shared-module tests live in `backend/shared/test`.

## Tests
- `cd backend/distribution/newsWeeklyBrief/src && npm test` (`node --test ../test/*.test.js`) - includes mocked publish/read rejection, no-work skips and country/link rules
