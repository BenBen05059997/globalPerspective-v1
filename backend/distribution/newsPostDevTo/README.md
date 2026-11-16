# newsPostDevTo

Despite the name, this no longer posts to Dev.to (publish path removed 2026-05-18). It builds the daily brief: loads today's entries from the `today-archive` item, enriches them with up to 20 thread analyses and up to 15 country intelligence records (real countries, last 30 days), asks an LLM for a JSON brief (headline, summary, topStories, ...), resolves real thread ids deterministically, and stores `DAILY_BRIEF#<date>` for the `/briefings` page (`/daily` redirects there).

## Deployment
- Deployed name `newsDailyBrief` since 2026-11-04 (was `newsPostDevTo`, kept unscheduled until its removal) · runtime `nodejs24.x` · group `distribution` (scripts/functions.json)
- Trigger: Scheduler `InvokeDev` `cron(0 23 * * ? *)` (Asia/Tokyo, ENABLED)
- Deploy: `scripts/lambda.sh newsDailyBrief diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `id = today-archive` (only entries archived today)
- Env `NOTES_READS` (decision 0053, `ddb` default | `compare` | `notes`): the `THREAD_ANALYSIS` and `COUNTRY_INTELLIGENCE` reads come from the record's `story_analysis` and `country` notes instead (shared `noteReads.js` `rowReaders`); `compare` answers from DynamoDB and logs `[notes-compare]` differences. The role needs `s3:GetObject` on those prefixes.
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`, `COUNTRY#<name>`/`COUNTRY_INTELLIGENCE`; writes `DAILY_BRIEF#<date>`/`DAILY_BRIEF` (90-day `ttl`)
- S3 world bucket, only when env `NOTES_PREFIX` is set (unset = nothing): the brief as a `daily_brief` note under `<NOTES_PREFIX>notes/daily_brief/` (decision 0048; best-effort, never fails the run; the DynamoDB put stays). Needs `s3:GetObject`/`PutObject` on `record/notes/daily_brief/*` and its manifest. Live value: `record/` (read 2026-11-01, `project-docs/architecture/STEP5_AUDIT.md` section 1); the notes made before that came from `backend/record/cli/backfill-brief-notes.mjs`.
- External APIs: the model provider named by the model value, via `src/_shared/llm.js` (Anthropic Messages API for `anthropic:` values, DeepSeek chat completions for a bare name)
- env `RECORD_READS` = `ddb` (default, unset = this) | `record` | `compare` (decision 0054). `record` reads the day's entries (`today-archive`) from the record's view `index/today.json` while `manifest.builtAt` is under 9 h old, and reads DynamoDB for any view that cannot answer; `compare` reads both, uses DynamoDB and logs `[record-reads]` equal or DIFFER. The thread analyses and country briefings follow `NOTES_READS` (0053). Needs `s3:GetObject` on `record/views/*` (role `newsPostDevTo-role-uek0owwd`). The brief row is still put to `SUMMARIZE_PREDICT_TABLE`.

## Models
- `GROK_MODEL` (the name is old; the value is a model id), through the shared client `src/_shared/llm.js` (thinking off). Live since 2026-11-16: Claude Haiku 5.5 (decision 0060: same content quality as the earlier model, no invented fact in either; neither Claude model keeps the "exactly 4 bold phrases" rule, Haiku writes none). Code fallback `deepseek-v4-pro`. The prefix `anthropic:` uses `ANTHROPIC_API_KEY`; a bare name such as `deepseek-flash` uses DeepSeek (`GROK_API_URL`, fallback `https://api.deepseek.com`, key `XAI_API_KEY`). `maxTokens` is 4000 (raised from 2000 for Claude: complete answers ran 2,014 to 2,432 tokens). The prompt asks for JSON but the call does not set `json: true`, so there is no retry on unparseable JSON.

## Gotchas
- The handler rejects (`Missing required env vars: <names>`, never the values) when `SUMMARIZE_PREDICT_TABLE` or `XAI_API_KEY` is unset, so the Errors metric moves; it checks after the no-entries skip, so an empty day still answers 200 skipped. Other failures (unset `TOPICS_DDB_TABLE`, a bad model reply, a failed put) are returned as `500` and do not move Errors.
- `topStories[]` carry `threadId` (matched to an archive entry, never from the model; ambiguous or unmatched = `null`) and `iso3[]` (their regions through `resolveIso3`); `countryToWatch` carries `iso3[]` and the `threadId` of today's thread with most entries in that country.
- The brief prompt carries a hard limit line for `summary` (at most 350 words, exactly 4 bold phrases); the handler logs `summary words=N bold=N` after the reply and never rejects on format.
- Thinking mode is disabled on purpose (2026-07-26 outage: thinking burned `max_tokens`).

## Tests
- `cd backend/distribution/newsPostDevTo/src && npm test` (`node --test ../test/*.test.js`, offline). `dayZero`, `placeFilter` and `llm` (from `backend/shared/src` via the `src/_shared` symlink) are tested in `backend/shared/test`.
