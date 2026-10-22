# newsInvokeGemini

The topic selector at the head of the content pipeline. Despite the name, it does not call Gemini. It fetches 26 hard-coded RSS feeds (BBC, Al Jazeera, Guardian, AllAfrica, CNA and others) and sends them to one LLM call that picks up to `TOPICS_LIMIT` topics (default 15, max 20). Order of a run: fetch, **raw capture** (every fetched item to the inbox), collapse same-event items, model, drop repeats, write. The prompt carries the done-not-said rule (decision 0020), a significance floor instead of a quota, 24h soft dedup and narrative continuity (today plus 7 days). It drops source URLs that were not among the fetched articles, enriches sources (`src/source_enrichment.js`, `src/outlet_metadata.js`), and writes the topics cache item with `status: 'pending'`. It also writes a saw-vs-chose capture to S3 for newsImpactAudit.

## Deployment
- Deployed name `newsInvokeGemini-dev` (repo dir `newsInvokeGemini`) · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `InvokeGoogleGemini` `cron(15 4/8 * * ? *)` (UTC, ENABLED). No Function URL (checked 2026-10-19).
- Deploy: `scripts/lambda.sh newsInvokeGemini diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships no node_modules: `src/package.json` has no production deps (the runtime provides `@aws-sdk` v3).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE` (key `id`): reads `seen-today` and `archive#YYYY-MM-DD` (today and the previous 7 days); writes the cache item `id = TOPICS_CACHE_ITEM_ID` (default `staging`) and `seen-today`.
- S3 `WORLD_BUCKET`: appends **every fetched item** to `record/inbox/articles/YYYY-MM-DD.jsonl` (raw capture, below; shadow `record/shadow/inbox/articles/` when `RAW_CAPTURE_SHADOW=1`). Also writes `audit/ingest-capture/latest.json` plus `audit/ingest-capture/YYYY-MM-DD/HHMM.json` (`INGEST_CAPTURE_PREFIX`). Fenced: a failure never breaks ingestion.
- External: the RSS feed hosts listed in `src/index.js`, and the LLM endpoint below.
- Env: `WORLD_BUCKET`, `RAW_CAPTURE_SHADOW`, `SOURCE_ENRICH_ENABLED`, `SOURCE_ENRICH_THRESHOLD`, `SOURCE_ENRICH_MAX`, `SOURCE_ENRICH_CROSS_TOPIC`, `TOPICS_LIMIT`.

## Models
- `GROK_MODEL` (fallback `deepseek-v4-pro`, "matches the live env" per the code comment) through the shared client `src/_shared/llm.js` (`backend/shared/src`, plain fetch, no SDK): `GROK_API_URL` (base or full `/chat/completions` URL, fallback `https://api.deepseek.com`), key `XAI_API_KEY`. The GROK_/XAI_ names are legacy and hold DeepSeek values; thinking is disabled.

## Gotchas
- A failed run on a scheduled event (missing key, model/upstream error, empty reply) throws, so the Lambda `Errors` metric counts it; only direct HTTP invocations get a 4xx/5xx response body. It used to return `{status:'error'}`, which reported success and hid 28 days of missing archives. Test: `node --test src/scheduled-failure.test.js`.
- The names "Gemini" and "Grok" in the code and logs are historical.
- It emits `Access-Control-Allow-Origin: *` on its HTTP-shaped responses. If a Function URL is ever added, its CORS config must stay empty.
- `INGEST_CAPTURE_TABLE` and `CAPTURE_TTL_DAYS` are still read but unused; capture moved to S3 in S8·T2b.
- `max_tokens` is 12000; truncated JSON output goes through `salvageTruncatedTopics`.

## Source field contract

Source fields are bound to the fetched RSS URL: `publishedAt` is ISO UTC (null when missing or invalid), while `age` stays for older readers. `outlet` comes only from `src/outlet_metadata.js`; unknown domains keep null. Country codes pass the shared `resolveIso3` resolver; unknown inputs are dropped and logged with their count.

Offline source-field regressions: `node --test src/source-fields.test.js` (from this folder).

## Raw capture (inbox)

Before any model call the run appends every fetched item (the url-deduped pool, not the collapsed prompt rows) to `record/inbox/articles/YYYY-MM-DD.jsonl`, so a model outage never loses the day (foundation review rule 1, draft decision 0040; inbox pattern of the 0038 amendment). The selector is the only writer of that prefix; the facts writer turns lines into facts later. Line: `{schemaVersion:1, rawId, url, canonicalUrl, title, outlet, feed, publishedAt|null, fetchedAt, snippet|null, lang|null}`; `rawId = sha1(canonicalUrl)` (`_shared/record.js`), so an item seen again by a later run is skipped and the first line stays. Day = UTC day of `publishedAt`, else of `fetchedAt`. Each day file is read-modify-written with `appendLines` (conditional write, retried on a lost race); a run touches up to three day files (48 h window). A failed or slow (30 s) write is logged `[raw-capture] failed (non-fatal ...)` and the run continues.

## Selection rules in code

- Parser (`parseRssXml`): `<item ...attributes>` (Dawn `xmlns:`, DW and Nikkei `rdf:about`), Atom `<entry>` with `<link href>`, `<dc:date>`/`published`/`updated` as the date, `description`/`summary`/`content` as the snippet, HTML entities decoded (Dawn and CNA escape their HTML). Before 2026-10-22 only a bare `<item>` matched, so Dawn, DW and Nikkei Asia contributed nothing. Nikkei's feed has no date and no description.
- Prompt (`buildSelectionPrompt`): rule 9 done-not-said with three examples; rule 7 significance floor (10 deaths or 100 injured or displaced; head of state or government or parliament decision; nationally significant court ruling; treaty, sanction, expulsion, recognition; strike or attack on infrastructure; disaster declaration) then fill by significance up to the limit; no category minimums or cap; regional diversity is a soft note.
- Dedupe (`src/dedupe.js`): before the model, items with the same canonical url or title token Jaccard >= 0.6 collapse to one prompt row (the longer description stays; the full pool is still used to validate and enrich sources). After the model, a topic that repeats a title of the last 24 h runs or of today or yesterday's archive (Jaccard >= 0.5) is dropped unless its title has a number the earlier title lacks.

## Choices

- Raw capture stores the whole fetched pool, not the collapsed prompt rows: the raw layer loses nothing, the collapse is a prompt economy.
- Collapse uses the 0.6 Jaccard from the brief; the post-model drop uses 0.5 (the audit's method) because topic titles are model-written paraphrases. Both ignore a short stop-word list and thousands separators.
- The post-model check reads `seen-today` (24 h) plus archive rows dated yesterday or today, so a topic from an earlier run today is caught before the analysis agent has archived it.
- The "fill the limit" sentence in the 24h dedup block of the prompt was removed with the quota; a previously covered topic is allowed only for a significant new development.
- Entity decoding applies to titles and snippets, not to `url`: the `&amp;` inside BBC links is kept as fetched so entry ids (sha1 of the canonical url) do not change across the deploy.
- The inbox write uses `process.env.WORLD_BUCKET`, falling back to the bucket name already hard-coded for `audit/ingest-capture`.

## Tests
- `cd backend/pipeline/newsInvokeGemini && node --test` (offline, no AWS SDK needed): `src/*.test.js` (source fields, scheduled failure) and `test/` (parser on a 26-feed fixture set in `test/fixtures/feeds/`, prompt text, dedupe, raw capture and the whole handler with a fake S3, model and DynamoDB). 42 pass on 2026-10-22.
- `cd src && node test_enrichment.js` (offline). Passed 23/23 on 2026-10-19.

Last verified: 2026-10-22
