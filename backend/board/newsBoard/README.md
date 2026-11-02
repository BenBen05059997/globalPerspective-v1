# newsBoard

The member's personal board behind one Lambda Function URL: boards (pins, strings, weights, dismissed, summary), follows, region presets, the cheap `connect` test between two pins, and the arrivals tray. POST body `{action, ...}`; every action needs a Firebase JWT (`Authorization: Bearer`) except `list_presets`. Replies are `{success, data}` or `{success:false, error, code?}`. No LLM, no S3 write.

## Deployment
- Deployed name `newsBoard` · `nodejs22.x` · 1024 MB · 15 s · group `board` (scripts/functions.json) · zip ships node_modules (the S3 client comes from the runtime). Role `newsBoard-role`.
- Trigger: Function URL (auth NONE; the JWT is checked in code). The code emits no `Access-Control-*` header, so the URL's CORS config owns CORS and must stay populated.
- Env: `SAVED_ITEMS_TABLE`, `USER_PREFS_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `TOPICS_DDB_TABLE`, `FIREBASE_PROJECT_ID`, `RECORD_READS` (live `record`). `WORLD_BUCKET` is optional (falls back to the world bucket).
- IAM (inline `newsBoard-dynamodb`, `newsBoard-record`): DynamoDB on SavedItems (`GetItem|PutItem|DeleteItem|Query`, plus an existence-guarded `UpdateItem` of `lastVisitedAt` for `visit_board`), UserPrefs (`GetItem|UpdateItem`), SummarizeAndPredict and NewsCache (`GetItem|BatchGetItem|Query`); S3 `GetObject` on `record/views/` `manifest.json`, `index/active.json`, `index/all.json`, `index/today.json`, `links/*`, `stories/*`, and `s3:ListBucket` on `record/*` (a missing file is a 404, not AccessDenied).
- The record reads for the story web and the histories need `GetObject` on `record/views/index/web.json` and `record/notes/{story_analysis,story_history,country}/*` (`manifest.json` and `<YYYY-MM-DD>.jsonl`). The grant is live (policy `newsBoard-record`, operator yes 2026-11-01); checked after a cold start (8 preset regions) and two live `connect` calls. Without it every such read fails over to DynamoDB (logged `[record-reads]`).
- Deploy: `scripts/lambda.sh newsBoard diff|package|deploy` (diff first; deploy needs the operator's go-ahead).

## Reads / writes
- Writes `SAVED_ITEMS_TABLE` (key `uid` + `savedKey` = `board#<boardId>`, item = the board plus `kind:'board'`) and `USER_PREFS_TABLE` (`SET followedThreads` / `SET followedActors` only; `followedCountries`, the opt-ins and every other attribute stay with `newsRecommend`).
- Pin enrichment and arrivals (decision 0037, `src/recordViews.js`): `index/active.json` on every `get_board` / `update_board`, `index/all.json` only for a pinned thread not in the active index (a merged story shows its survivor's row), `links/<id>.json` for arrivals candidates. A missing file answers `recordAvailable:false`; access or parse failures propagate.
- Pin enrichment is response-only and facts only: `recordAvailable`, `born`, `lastMoved` (row `lastFactAt`), `entryCount`, `counts.liveBranches`, `line` (or `null`), `counts.chapters` and `counts.confirmedLinks` both `null`. `update_board` strips them before validation and storage.
- Board shape: `backend/board/schema/board.schema.json` (symlinked into `src/`). Region table: `src/regions.js` (hard-coded ISO3 to region).

## World reads for presets and connect (`src/world.js`)
Every row goes through `_shared/world/readers.js`, so the board logic sees one shape whichever store answered. `RECORD_READS` (decision 0054): `ddb` (default when unset), `record` (the record answers; DynamoDB only when it has no answer, the read fails, or the views are older than 9 h by `record/views/manifest.json`), `compare` (both read, DynamoDB answers, differences logged `[record-reads] board <family>`).

| family | DynamoDB | record | normaliser |
|---|---|---|---|
| topic pool | NewsCache `latest` | `index/today.json` | `latestTopicsOfItem` |
| thread analyses | `THREAD#<id>/THREAD_ANALYSIS` | `stories/<id>.json` (an alias view answers with the survivor) | `threadAnalysisOfRows` |
| story web | `WEB#INDEX/LATEST` | `index/web.json` | `webIndexOfView` |
| story scores | `THREAD#<id>/THREAD_HISTORY#*` | notes `story_analysis` + `story_history` (`noteReads.threadHistory`) | `threadHistoryOfRows` |
| country scores | `COUNTRY#<name>/HISTORY#*` | notes `country` by ISO3 (`noteReads.countryHistory`, every day) | `countryHistoryOfRows` |

The S3 readers are built on first use, once per env; the notes are cached 5 minutes (`s3NoteReader`, prefix `record/`). Only `connect` reads the notes; `list_presets` reads the web, the pool and the analyses.

Parity on live data (2026-11-01, local, read-only): histories identical (44 stories, 6 countries) and `connect` identical for five pairs, except an alias thread, which gets "no analysis row" in record mode. The story web differs as data, not as shape: `index/web.json` rebuilds each story's entry count, places and title from the facts at view-build time (WEB#INDEX keeps the 05:00 web run's), so 14 of 193 stories fall in other regions and the presets differ (7 regions under ddb, 8 under record); one reverse-direction link of an older South Korea web is not in the record.

## Actions
| action | body | returns |
|---|---|---|
| `list_boards` | | `[{boardId, name, pinCount, updatedAt}]`, newest first |
| `get_board` | `boardId` | the board with record-view enrichment (404 if missing or not yours) |
| `create_board` | `name`, `presetFrom?` | new board (random UUID), empty pins and strings |
| `update_board` | `boardId`, `board` | the saved board: `normalizeBoard`, pin budget (12), schema, every ours-string `strength:'inferred'`, strings join pins on the board. `uid`, `boardId`, `lastVisitedAt` are fixed, `createdAt` kept, `updatedAt` set by the server |
| `delete_board` | `boardId` | `{boardId}` |
| `arrivals` | `boardId` | `{recordAvailable, since, arrivals}`, owner only (below) |
| `visit_board` | `boardId` | `{lastVisitedAt}`; stamps the tray read without changing `updatedAt` |
| `follow_thread` / `unfollow_thread` | `threadId` | `{followedThreads, followedActors}`; idempotent (max 300 each) |
| `follow_actor` / `unfollow_actor` | `name` | same; stored trimmed and whitespace-collapsed, compared with `normalizeActor` |
| `get_follows` | | `{followedThreads, followedActors}` |
| `list_presets` (public) | | one preset per region with 2+ analysed threads: up to 8 highest-risk threads as pins `p01..`, ours-strings (`inferred`) from the web's shared-actor pairs and causal links. A thread is in every region its countries (`threadIso3`) fall in (operator rule 2026-10-31). A pair judged by several country webs shows the newest judgement. Cached in memory 10 minutes |
| `fork_preset` | `presetId`, `name?` | a new board owned by the caller with `presetFrom` set |
| `connect` | `a`, `b` = `{kind, refId}` | `{pairKey, a, b, strength: none|weak|medium, grounds[], note, limits[]}` from `cheapGrounds` |

Errors: 401 no/invalid token; 400 validation (`code` `pin_budget_exceeded` + `budget`, `ours_must_be_inferred`, `immutable_field`, `invalid_board`); 404 for a missing board or another member's (never returns their data); 500 `Request failed`.

`connect`: `pairKey` uses threadId, ISO3 (a country pin is resolved with `resolveIso3`), or the normalised actor name. Actors come from the analysis `keyActors`, the topic pool and the web's shared-actor pairs; places from the analysis `iso3`, the web's places and the topic pool; outlets only for threads in the topic pool (else named in `limits`); scores from the story or country history. Actor pins have no scores.

`arrivals`: candidates are active-index rows born on or after the UTC day of `lastVisitedAt` (or creation) and not after today, not pinned, dismissed or merged, newest first, at most 40, one `links/<id>` GET each. A card needs a `confirmedLinks` entry to a pinned thread plus nonzero `grounds` for that pair; `via` carries `mechanism`, `direction` (`drives|driven_by|shared_cause`) and the non-empty shared kinds. At most five cards; `confirmedLinks` is empty until the weekly review has read the story.

## Gotchas
- **Inferred only:** every ours-string is stored `strength:'inferred'`; the web's own strength is shown, never stored as confirmed.
- **Duplicated JWT block:** `src/firebaseAuth.js` is copied from `newsSavedItems` (`newsRecommend` carries the same one).
- `newsSavedItems` `get_saved_items` filters out `board#` keys; `newsRecommend` ignores board items (no `itemType`).
- Follow lists are read-modify-write (no condition): two simultaneous follows can lose one.
- A cold `connect` in record mode loads every notes day of three subtypes (about 310 small files, 5 MB) before answering.
- `src/_shared` links to `backend/shared/src` and `src/board.schema.json` to the board schema; `scripts/lambda.sh` zips both as real files.

## Tests
`cd backend/board/newsBoard/src && npm install && npm test` (`node --test ../test/*.test.js`). A fake in-memory store (`test/helpers.js`); `recordReads.test.js` and `recordWebHistory.test.js` drive the three modes over fake views and notes; `store.test.js` drives the real store over a fake `send`; `validate.test.js` compares the validator with the frontend's ajv (skipped without the frontend `node_modules`).
