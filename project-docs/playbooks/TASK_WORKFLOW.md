# Task workflow (reset 2026-10-19)

1. Check the code and live AWS yourself; docs describe intent and can be stale.
2. Design work: write or update the plan doc (`_proposed/` → `_active/` → `_shipped/`), record operator decisions there. A discussion is not a build go-ahead.
3. Build in small commits; `npm run verify` for frontend; click every touched control in a browser.
4. Docs only when architecture changes (Lambda, store/S3 prefix, schedule, route, feature, data flow added or removed): update `architecture/ARCHITECTURE.md` and `INDEX.md` in the same commit. The Stop hook (`scripts/hooks/docs-reminder.sh`) reminds you.
5. Git log is the change log; `CHANGES.md` is a frozen archive.

Hooks (`bash scripts/install_hooks.sh`): pre-commit blocks `docs/config.js` and runs the `quality/check_*.mjs` style ratchets when frontend source is staged; pre-push runs `npm run verify` when frontend changed.
