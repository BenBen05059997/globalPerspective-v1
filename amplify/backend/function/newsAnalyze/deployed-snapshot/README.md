# newsAnalyze: deployed-source snapshot

Byte copy of the code that is DEPLOYED as Lambda `newsAnalyze` (the prompt-patched, pre-credits zip of
2026-07-10), taken 2026-09-30 from `CodeSha256 4pTSGsz5uwf/qy3ffklEwHxBXsqPudj2BFHvS20FXhg=`.
Files: `index.js`, `package.json` (the zip has no other files).

Why it exists: `../src/` carries the PARKED credits feature and must never be deployed over the live
function; until now the only copy of the source that actually serves was inside AWS.

- Checked before adding: no API key / token / secret literal (only `process.env.*` names and public URLs).
- Do not edit these files. To re-verify against AWS: `scripts/audit-lambda-drift.sh newsAnalyze`.
- Deploy nothing from this directory without a fresh go-live decision (see CLAUDE.md, Lambdas).
