# newsBoard

The member's personal board behind one Lambda Function URL: boards (pins, strings, weights, dismissed, summary), follows, region presets and the cheap `connect` test between two pins. POST body `{action, ...}`; every action needs a Firebase JWT (`Authorization: Bearer`) except `list_presets`. Replies are `{success, data}` or `{success:false, error, code?}`. No LLM, no S3 write: `record/pairs/` caching comes later with `newsConnect`.

## Deployment
- Live since 2026-10-20. Deployed name `newsBoard` · runtime `nodejs22.x` · 256 MB · 15 s · group `board` (scripts/functions.json) · zip ships node_modules. Role `newsBoard-role` (created 2026-10-20 with operator approval).
- Trigger: Function URL (auth NONE; the JWT is checked in code). CORS belongs to the URL config and must stay populated: the code emits no `Access-Control-*` header.
- Env: `SAVED_ITEMS_TABLE`, `USER_PREFS_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `TOPICS_DDB_TABLE`, `FIREBASE_PROJECT_ID`.
- IAM (role `newsBoard-role`: `AWSLambdaBasicExecutionRole` + inline `newsBoard-dynamodb`): `dynamodb:GetItem|PutItem|DeleteItem|Query` on the SavedItems table; `GetItem|UpdateItem` on UserPrefs (only `followedThreads`/`followedActors` are SET); `GetItem|BatchGetItem|Query` read-only on SummarizeAndPredict; `GetItem` read-only on NewsCache; CloudWatch Logs. S3 read-only on the three `record/views/` keys above (policy `newsBoard-record`). Nothing else (no S3 write, no other tables).
- Deploy: `scripts/lambda.sh newsBoard diff|package|deploy` (after creation; diff first).

## Reads / writes
- Writes `SAVED_ITEMS_TABLE` (key `uid` + `savedKey` = `board#<boardId>`, item = the board plus `kind:'board'`) and `USER_PREFS_TABLE` (`SET followedThreads` / `SET followedActors` only; `followedCountries`, the opt-ins and every other attribute stay with `newsRecommend`).
- Reads (world, read-only) go through `_shared/world/` (the one reader; `src/world.js` only adds board logic over its normalised objects, and the store passed in is the world client). Rows read: `SUMMARIZE_PREDICT_TABLE` `WEB#INDEX/LATEST` (`links[]`, `shared[]` with `actors`, `threads{}` with `places`), `THREAD#<id>/THREAD_ANALYSIS` (`threadTitle`, `riskScore`, `lead`, `iso3[]`, `keyActors[]`), `THREAD#<id>/THREAD_HISTORY#<date>` and `COUNTRY#<name>/HISTORY#<date>` (`dateKey`, `riskScore`; points without a score are dropped); `TOPICS_DDB_TABLE` `latest` (`topics[]`: `threadId`, `title`, `actors`, `iso3`, `sources[].source`).
- Board shape: `backend/board/schema/board.schema.json` (symlinked into `src/`). Region table: `src/regions.js` (hard-coded ISO3 -> region; only the frontend has a region mapping, keyed by ISO-2 in ESM).

## Actions
| action | body | returns |
|---|---|---|
| `list_boards` | | `[{boardId, name, pinCount, updatedAt}]`, newest first |
| `get_board` | `boardId` | the board (404 if missing or not yours) |
| `create_board` | `name`, `presetFrom?` | new board (random UUID), empty pins and strings |
| `update_board` | `boardId`, `board` | the saved board. Normalised with `normalizeBoard`, then pin budget (12), schema, every ours-string `strength:'inferred'`, strings join pins on the board. `uid`/`boardId` cannot change (400), `createdAt` is kept, `updatedAt` is set by the server |
| `delete_board` | `boardId` | `{boardId}` |
| `follow_thread` / `unfollow_thread` | `threadId` | `{followedThreads, followedActors}`; idempotent (max 300 each) |
| `follow_actor` / `unfollow_actor` | `name` | same; stored trimmed and whitespace-collapsed, compared with `normalizeActor` |
| `get_follows` | | `{followedThreads, followedActors}` |
| `list_presets` (public) | | one preset per region with 2+ analysed threads: up to 8 highest-risk threads as pins `p01..`, ours-strings (`inferred`) from WEB#INDEX causal links and shared-actor pairs. Cached in memory 10 minutes |
| `fork_preset` | `presetId`, `name?` | a new board owned by the caller with `presetFrom` set |
| `connect` | `a`, `b` = `{kind, refId}` | `{pairKey, a, b, strength: none|weak|medium, grounds[], note, limits[]}` from `cheapGrounds` |

Errors: 401 no/invalid token; 400 validation with a message (`code` `pin_budget_exceeded` + `budget`, `ours_must_be_inferred`, `immutable_field`, `invalid_board`); 404 for a missing board or another member's board (never returns their data); 500 `Request failed`.

`connect` details: `pairKey` uses threadId, ISO3 (a country pin is resolved with `resolveIso3`), or the normalised actor name. Actors come from `THREAD_ANALYSIS.keyActors`, the topic pool and the WEB#INDEX shared-actor pairs; places from `THREAD_ANALYSIS.iso3` (older rows have none, so the web's `places` and the topic pool fill in); outlets (`world.outletsOf`: distinct lower-cased hosts, `www.` stripped) only for threads in the `latest` topic pool (otherwise empty and named in `limits`); scores from `THREAD_HISTORY#` / `HISTORY#`. Actor pins have no scores.

## Gotchas
- **Inferred only (slice 1):** `stringTexture` draws ours + weak|medium|strong as solid, so every ours-string is stored `strength:'inferred'`; the web's own strength is read from WEB#INDEX when shown, never stored as confirmed. `update_board` rejects anything else.
- **Duplicated JWT block:** `src/firebaseAuth.js` is copied from `newsSavedItems` (and `newsRecommend` carries the same one). A candidate for `backend/shared`; not moved yet.
- **CORS:** if this Function URL's CORS config is empty while the code emits no header, browsers fail; keep the URL config populated.
- `newsSavedItems` `get_saved_items` filters out `board#` keys so boards never show as saved items. `newsRecommend` `loadSavedItems` reads every item for a uid; board items have no `itemType`, so the interest profile ignores them.
- Follow lists are read-modify-write (no condition): two simultaneous follows can lose one. Acceptable for a one-member write path.
- `src/_shared` is a symlink to `backend/shared/src` (`world/` reader, `record.js` rules, `resolveIso3`, `countries`); `src/board.schema.json` is a symlink to the board schema. `rsync -aL` in `lambda.sh` copies both as real files.

## Tests
- `cd backend/board/newsBoard/src && npm install && npm test` (`node --test ../test/*.test.js`): 35 pass. Fake in-memory store (`test/helpers.js`); `store.test.js` drives the real store over a fake `send`; `validate.test.js` checks the hand-written validator against ajv (the frontend's copy) on the schema examples and mutated boards, and skips the ajv comparison if the frontend `node_modules` are missing.

Last verified: 2026-10-20

## Record views (decision 0037, deployed 2026-10-22)

newsBoard reads three kinds of view file from S3, server-side only, through `src/recordViews.js`: `record/views/index/active.json` (every `get_board` and `update_board` response), `record/views/index/all.json` (only when a pinned thread is not in the active index; a merged story shows its survivor's row) and `record/views/links/<id>.json` (arrivals candidates). It no longer reads `record/index.json` or `record/stories/*`, and `story_view` is gone: the browser fetches `stories/<id>.json`, `links/<id>.json` and `counts/<date>.json` itself through the Worker's `/data/record/views/`. Missing files answer `recordAvailable:false`; access or parse failures propagate. No record write. `WORLD_BUCKET` defaults to `globalperspective-world-280362093938`. Deployed 2026-10-22 (CodeSha256 5ZfOxSsi...) with `s3:GetObject` for `newsBoard-role` (policy `newsBoard-record`) on `record/views/index/active.json`, `record/views/index/all.json` and `record/views/links/*`.

An index file is `{stories:[row]}` (a bare array is also accepted). Pin enrichment is response-only and facts only: `recordAvailable`, `born`, `lastMoved` (= row `lastFactAt`), `entryCount`, `counts.liveBranches` (= `liveBranchCount`), and `line: null`, `counts.chapters: null`, `counts.confirmedLinks: null`; `risk` is omitted until a dated reading exists. `update_board` strips all of these before validation and storage.

`arrivals {boardId}` is owner-only: `{recordAvailable, since, arrivals}`. Candidates are active-index rows born on or after the UTC day of `lastVisitedAt` (or creation) and not after today, not pinned, not dismissed, not merged, newest first, at most 40, one `links/<id>` GET each. A card needs a `confirmedLinks` entry with `strength:'strong'` to a pinned thread plus nonzero `grounds` for that pair in `links[]`; the card title is the row `title`. `confirmedLinks` is empty until the weekly review exists, so for now the tray answers with no cards. At most five cards. `visit_board {boardId}` stamps `lastVisitedAt` after a successful tray read without changing `updatedAt`; normal edits cannot forge it. The existence-guarded SavedItems `UpdateItem` for that stamp still needs the coordinator's grant. Dismissals stay in `dismissed[]`.

Choices (0037 gaps): the index container is `{stories:[rows]}` keyed `threadId`; a confirmed arrival link is a `confirmedLinks` entry with `strength:'strong'`; `grounds` on the arrival `via` is the list of non-empty shared kinds (`actors`, `places`, `sources`), not the old per-ground objects.
