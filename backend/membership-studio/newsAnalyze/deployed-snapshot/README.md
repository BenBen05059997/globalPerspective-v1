# newsAnalyze: deployed-source snapshot

Byte copy of the code DEPLOYED as Lambda `newsAnalyze` (the prompt-patched, pre-credits zip of
2026-07-10), taken 2026-09-30 from `CodeSha256 4pTSGsz5uwf/qy3ffklEwHxBXsqPudj2BFHvS20FXhg=`.
Files: `index.js`, `package.json` (the zip has no other files).

Why it exists: `../src/` carries the PARKED credits feature and must never be deployed over the live
function; this is the only repo copy of the source that actually serves.

What the deployed code does (differs from `../src/`):
- Firebase JWT -> requires `tier === 'member'` (403 `membership_required` otherwise).
- Daily fair-use cap `ANALYZE_DAILY_CAP` (default 50) on `analyzeDay`/`analyzeCount` in `USERS_DDB_TABLE`;
  429 `daily_limit` when hit. No credits, no monthly allowance.
- DeepSeek call sends `thinking: { type: 'disabled' }`; `GROK_MODEL` fallback is `deepseek-chat`.
- Emits `Access-Control-Allow-Origin` in code, so the Function-URL CORS config must stay empty.

Rules:
- Checked before adding: no API key / token / secret literal (only `process.env.*` names and public URLs).
- Do not edit these files. To re-verify against AWS: `scripts/audit-lambda-drift.sh newsAnalyze`.
- Deploy nothing from this directory or `../src/` without a fresh go-live decision (CLAUDE.md).

Last verified: 2026-10-19
