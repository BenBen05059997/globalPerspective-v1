#!/usr/bin/env bash
# Install local git hooks. Run once per clone:
#   bash scripts/install_hooks.sh

set -e
cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
chmod +x .githooks/pre-push

echo "Installed:"
echo "  - .githooks/pre-push (runs quality/verify_all.sh --fast when economic-layer files changed)"
echo
echo "Bypass for a single push with: git push --no-verify"
