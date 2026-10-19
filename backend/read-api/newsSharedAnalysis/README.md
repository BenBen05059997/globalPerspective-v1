# newsSharedAnalysis

Analysis Studio share links. POST (Firebase JWT) re-fetches and freezes a run's sources from the public proxy, re-runs the Studio checks, refuses on any error, and stores an unlisted share (frozen sources and citations each carry their story's `threadId`); GET `?id=` returns the frozen share (public, owner uid stripped); DELETE `?id=` is owner-only hard delete. No LLM.

## Deployment
- Deployed name `newsSharedAnalysis` · runtime `nodejs22.x` · group `read-api` (scripts/functions.json)
- Trigger: Function URL (POST/GET/DELETE/OPTIONS); no schedule
- Deploy: `scripts/lambda.sh newsSharedAnalysis diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB: `SHARES_TABLE` (GlobalPerspectiveShares, PK `id`; GSI `uid-createdAt-index` used to count a user's shares per UTC day)
- External: `PROXY_URL` (public restProxy actions `topics`, `summary`, `prediction`, `trace_cause`, `narrative_thread`, `thread_analysis`, `prediction_snapshot`, called with the reader's own bearer token); Google x509 certs for JWT verification
- Env names: `FIREBASE_PROJECT_ID`, `CORS_ORIGINS`, `DAILY_SHARE_CAP` (default 20), `PROXY_URL`, `SHARES_TABLE`

## Gotchas
- CORS is emitted in code (`src/cors.js`), so the Function-URL CORS config must stay empty.
- JWT check fails closed when `FIREBASE_PROJECT_ID` is unset (every POST/DELETE gets 401).
- 409 `sources_changed` when the server's numbered sources differ from the ones the run cited.
- Every response carries `X-Robots-Tag: noindex, nofollow`.
- `analysisValidator.js`, `analysisStruct.js`, `webCitations.js`, `analysisContext.js`, `analysisPrompt.js`, `driftNote.js`, `dropRedatedRepeats.js` and `test/fixtures/contextGolden.json` are byte-identical copies of frontend files; `scripts/check-shared-sync.mjs` guards them. Edit both sides.

## Tests
- `cd backend/read-api/newsSharedAnalysis/src && npm test` (`node --test ../test/*.test.js`) - 39 passed 2026-10-19

Last verified: 2026-10-19
