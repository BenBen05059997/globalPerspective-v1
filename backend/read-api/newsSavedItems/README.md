# newsSavedItems

Per-user saves/bookmarks. Actions `save_item`, `unsave_item`, `get_saved_items` (optional `itemType` filter, newest first, up to 500). Every action needs a Firebase JWT (`Authorization: Bearer`). Item types: `thread`, `country`, `daily`, `weekly` (a weekly brief, itemId = its weekOf), `pair`; `itemId` max 256 chars, no `#`; `metadata` object max 4 KB (larger is dropped). Invoked only through its Function URL (HTTP replies).

## Deployment
- Deployed name `newsSavedItems` · runtime `nodejs24.x` · group `read-api` (scripts/functions.json)
- Trigger: Function URL (frontend via `shared/api/restProxy.js`); no schedule. The AppSync API that once also invoked it was removed 2026-11-02.
- Deploy: `scripts/lambda.sh newsSavedItems diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- DynamoDB `SAVED_ITEMS_TABLE`: key `uid` + `savedKey` = `<itemType>#<itemId>`; Put, Delete, Query (`begins_with(savedKey, '<type>#')`)
- External APIs: Google securetoken x509 certs (JWT verify, `FIREBASE_PROJECT_ID`)
- Consumer: newsRecommend Queries the same table to build interest profiles

## Gotchas
- CORS: code does not emit `Access-Control-Allow-Origin` (by design, per code comment) and relies on the Function-URL CORS config, which must stay populated. Emitting it in code too would duplicate headers and break the browser.
- OPTIONS returns a bare 200 only as a fallback; preflight is normally answered by the Function URL config.

## Tests
- `node --test backend/read-api/newsSavedItems/test/index.test.js` (Function URL actions, auth, validation, no CORS headers).
