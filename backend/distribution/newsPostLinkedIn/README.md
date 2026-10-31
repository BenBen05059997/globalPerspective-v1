# newsPostLinkedIn

Posts new topics from the `latest` topics item to LinkedIn and Bluesky. Each platform is active only when its credentials are set. Per platform: dedup by title fingerprint, enforce per-run and rolling-24h caps, post highest-significance topics first. LinkedIn posts include the topic SUMMARY and PREDICTION (structured prediction JSON is rendered as prose); Bluesky gets a short 300-char post. Both attach a generated world-map PNG (`mapImageGenerator.js`, sharp + bundled Inter fonts and SVG template).

## Deployment
- Deployed name `newsPostLinkedin` (lower-case "in") · runtime `nodejs24.x` · group `distribution` (scripts/functions.json)
- Trigger: Scheduler `InvokeLinkedIn` `cron(20 */3 * * ? *)` (Asia/Tokyo, ENABLED)
- Deploy: `scripts/lambda.sh newsPostLinkedIn diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules (sharp linux-x64 binaries).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `id = latest`
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `<SUMMARY_PREDICT_PK_PREFIX><topicId>` (default `TOPIC#`) with SK `SUMMARY` / `PREDICTION`
- DynamoDB `SOCIAL_POSTS_TABLE` (or `LINKEDIN_POSTS_TABLE`): `POSTED#<PLATFORM>#<fingerprint>` (30-day `ttl`); legacy `POSTED#<fingerprint>` also checked for LinkedIn; daily count is a Scan
- External APIs: `api.linkedin.com/rest/images` and `/rest/posts` (version `202601`); `bsky.social/xrpc` (createSession, uploadBlob, createRecord)
- Env names: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID`, `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`, `MAX_POSTS_PER_RUN` (default 5), `MAX_POSTS_PER_DAY` (default 100), `SITE_URL` (home link; a LinkedIn post links its story page via `src/_shared/links.js` `storyHref` when the topic has a `threadId`)
- env `RECORD_READS` = `ddb` (default, unset = this) | `record` | `compare` (decision 0054). `record` reads the topic pool from `index/today.json` (the latest run, with the sources past ten kept whole) instead of `id = latest`, falling back to DynamoDB when the view is missing or older than 9 h; `compare` logs `[record-reads]` and posts from DynamoDB. The `TOPIC#` summaries and the dedupe table stay in DynamoDB. Needs `s3:GetObject` on `record/views/*`.

## Gotchas
- Throws if any of the three table env names is missing; with no platform credentials it returns `skipped`.
- A map-image failure does not block the post.
- A platform that attempted posts and posted none makes the run throw after all platforms run (`Every attempted post failed on <PLATFORM>`), so the `lambda-errors-newsPostLinkedin` alarm fires; partial success returns normally.
- `nostr-tools` and `ws` are dependencies but unused by the code.

## Tests
- `cd backend/distribution/newsPostLinkedIn/src && npm test` (`node --test ../test/*.test.js`, offline; DynamoDB, map image and fetch stubbed).
