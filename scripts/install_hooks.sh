#!/usr/bin/env bash
# Install local git hooks. Run once per clone: bash scripts/install_hooks.sh
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/pre-push scripts/hooks/docs-reminder.sh
echo "Installed:"
echo "  - pre-commit: blocks docs/config.js; runs quality/check_*.mjs when frontend source is staged"
echo "  - pre-push:   npm run verify when global-perspectives-starter/frontend changed"
echo "Bypass once with --no-verify."
