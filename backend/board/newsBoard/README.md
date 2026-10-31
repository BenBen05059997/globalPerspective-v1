# newsBoard

The member's personal board behind one Lambda Function URL: boards (pins, strings, weights, dismissed, summary), follows, region presets, the cheap `connect` test between two pins, and the arrivals tray. POST body `{action, ...}`; every action needs a Firebase JWT (`Authorization: Bearer`) except `list_presets`. Replies are `{success, data}` or `{success:false, error, code?}`. No LLM, no S3 write.

## Deployment
- Deployed name `newsBoard` · runtime `nodejs22.x` · 256 MB · 15 s · group `board` (scripts/functions.json) · zip ships node_modules. Role `newsBoard-role`.
- Trigger: Function URL (auth NONE; the JWT is checked in code). The code emits no `Access-Control-*` header, so the URL's CORS config owns CORS and must stay populated.
- Env: `SAVED_ITEMS_TABLE`, `USER_PREFS_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `TOPICS_DDB_TABLE`, `FIREBASE_PROJECT_ID`. `WORLD_BUCKET` is optional (the code falls back to the world bucket name).
- IAM (inline policies `newsBoard-dynamodb` and `newsBoard-record`): DynamoDB `GetItem|PutItem|DeleteItem|Query` on SavedItems, plus `UpdateItem` on SavedItems in `newsBoard-record` (for `visit_board`, an existence-guarded `UpdateItem`); `GetItem|UpdateItem` on UserPrefs; `GetItem|BatchGetItem|Query` on SummarizeAndPredict and NewsCache; S3 `GetObject` on `record/views/index/active.json`, `record/views/index/all.json` and `record/views/links/*`. `newsBoard-record` also grants `s3:ListBucket` on the world bucket (a missing view then reads as 404, not AccessDenied).
- Deploy: `scripts/lambda.sh newsBoard diff|package|deploy` (diff first; deploy needs the operator's go-ahead).

## Reads / writes
- Writes `SAVED_ITEMS_TABLE` (key `uid` + `savedKey` = `board#<boardId>`, item = the board plus `kind:'board'`) and `USER_PREFS_TABLE` (`SET followedThreads` / `SET followedActors` only; `followedCountries`, the opt-ins and every other attribute stay with `newsRecommend`).
- World reads go through `_shared/world/` (the one reader; `src/world.js` adds board logic over its normalised objects). Rows read: `SUMMARIZE_PREDICT_TABLE` `WEB#INDEX/LATEST`, `THREAD#<id>/THREAD_ANALYSIS`, `THREAD#<id>/THREAD_HISTORY#<date>`, `COUNTRY#<name>/HISTORY#<date>` (points without a score are dropped); `TOPICS_DDB_TABLE` `latest`.
- Record views (decision 0037), server-side only through `src/recordViews.js`: `record/views/index/active.json` (every `get_board` and `update_board` response), `index/all.json` (only when a pinned thread is not in the active index; a merged story shows its survivor's row) and `links/<id>.json` (arrivals candidates). A missing file answers `recordAvailable:false`; access or parse failures propagate. The browser fetches story views, links and counts itself through the Worker's `/data/record/views/`.
- Pin enrichment is response-only and facts only: `recordAvailable`, `born`, `lastMoved` (row `lastFactAt`), `entryCount`, `counts.liveBranches`, `line` (the row's `line` when the story has a weekly reading, else `null`), `counts.chapters` and `counts.confirmedLinks` both `null`. `update_board` strips all of these before validation and storage.
- Board shape: `backend/board/schema/board.schema.json` (symlinked into `src/`). Region table: `src/regions.js` (hard-coded ISO3 to region).
- Env `RECORD_READS` = `ddb` (default) | `record` | `compare` (decision 0054): the topic pool (`latest`) and the thread analyses behind presets and connect come from `index/today.json` and `stories/<id>.json`, through the same normalisers (`_shared/world/readers.js`). Not equal on live data yet: the story analysis note keeps `iso3` sorted, DynamoDB kept most-mentioned first, and `threadIso3` takes the first match, so the record moved 2 Ebola stories to another preset region (8 presets against 7 on 2026-10-31); leave this Lambda on `ddb` until the order is in the note (decision 0054). Needs `s3:GetObject` on `record/views/index/today.json`, `manifest.json` and `stories/*` besides the `index/active.json`, `index/all.json` and `links/*` it has (role `newsBoard-role`).

## Actions
| action | body | returns |
|---|---|---|
| `list_boards` | | `[{boardId, name, pinCount, updatedAt}]`, newest first |
| `get_board` | `boardId` | the board with record-view enrichment (404 if missing or not yours) |
| `create_board` | `name`, `presetFrom?` | new board (random UUID), empty pins and strings |
| `update_board` | `boardId`, `board` | the saved board. Normalised with `normalizeBoard`, then pin budget (12), schema, every ours-string `strength:'inferred'`, strings join pins on the board. `uid`, `boardId` and `lastVisitedAt` cannot be changed by the client, `createdAt` is kept, `updatedAt` is set by the server |
| `delete_board` | `boardId` | `{boardId}` |
| `arrivals` | `boardId` | `{recordAvailable, since, arrivals}`, owner only (below) |
| `visit_board` | `boardId` | `{lastVisitedAt}`; stamps the tray read without changing `updatedAt` |
| `follow_thread` / `unfollow_thread` | `threadId` | `{followedThreads, followedActors}`; idempotent (max 300 each) |
| `follow_actor` / `unfollow_actor` | `name` | same; stored trimmed and whitespace-collapsed, compared with `normalizeActor` |
| `get_follows` | | `{followedThreads, followedActors}` |
| `list_presets` (public) | | one preset per region with 2+ analysed threads: up to 8 highest-risk threads as pins `p01..`, ours-strings (`inferred`) from WEB#INDEX causal links and shared-actor pairs. Cached in memory 10 minutes |
| `fork_preset` | `presetId`, `name?` | a new board owned by the caller with `presetFrom` set |
| `connect` | `a`, `b` = `{kind, refId}` | `{pairKey, a, b, strength: none|weak|medium, grounds[], note, limits[]}` from `cheapGrounds` |

Errors: 401 no/invalid token; 400 validation with a message (`code` `pin_budget_exceeded` + `budget`, `ours_must_be_inferred`, `immutable_field`, `invalid_board`); 404 for a missing board or another member's board (never returns their data); 500 `Request failed`.

`connect`: `pairKey` uses threadId, ISO3 (a country pin is resolved with `resolveIso3`), or the normalised actor name. Actors come from `THREAD_ANALYSIS.keyActors`, the topic pool and the WEB#INDEX shared-actor pairs; places from `THREAD_ANALYSIS.iso3` (older rows fall back to the web's `places` and the topic pool); outlets only for threads in the `latest` topic pool (otherwise empty and named in `limits`); scores from `THREAD_HISTORY#` / `HISTORY#`. Actor pins have no scores.

`arrivals`: candidates are active-index rows born on or after the UTC day of `lastVisitedAt` (or creation) and not after today, not pinned, not dismissed, not merged, newest first, at most 40, one `links/<id>` GET each. A card needs a `confirmedLinks` entry to a pinned thread plus nonzero `grounds` for that pair; its title is the row `title` and `via` carries `mechanism` and `direction` (`drives|driven_by|shared_cause`) and the non-empty shared kinds. At most five cards. `confirmedLinks` is empty until the weekly review has read the story, so such a story shows no card. Dismissals stay in `dismissed[]`.

## Gotchas
- **Inferred only:** every ours-string is stored `strength:'inferred'`; the web's own strength is read from WEB#INDEX when shown, never stored as confirmed. `update_board` rejects anything else.
- **Duplicated JWT block:** `src/firebaseAuth.js` is copied from `newsSavedItems` (and `newsRecommend` carries the same one).
- `newsSavedItems` `get_saved_items` filters out `board#` keys so boards never show as saved items. `newsRecommend` `loadSavedItems` reads every item for a uid; board items have no `itemType`, so the interest profile ignores them.
- Follow lists are read-modify-write (no condition): two simultaneous follows can lose one.
- `src/_shared` is a symlink to `backend/shared/src` and `src/board.schema.json` a symlink to the board schema; `scripts/lambda.sh` zips both as real files.

## Tests
`cd backend/board/newsBoard/src && npm install && npm test` (`node --test ../test/*.test.js`). A fake in-memory store (`test/helpers.js`); `store.test.js` drives the real store over a fake `send`; `validate.test.js` checks the hand-written validator against the frontend's ajv and skips that comparison if the frontend `node_modules` are missing.
