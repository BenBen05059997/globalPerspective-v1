#!/usr/bin/env bash
# Self-test for .githooks/pre-commit (2026-10-19 rules reset: config.js guard + style ratchets).
# Builds a throwaway git repo in a temp dir, installs the hook and a stub quality/ check, and
# exercises each rule. Never touches the real repo. Run: bash scripts/test_pre_commit_hook.sh

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK_SRC="$HERE/../.githooks/pre-commit"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/precommit-test.XXXXXX")"
FAIL=0

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }
g() { git -C "$WORK" "$@"; }
commit_ok() { g commit -q -m "$1" >"$WORK/.log" 2>&1; }

g init -q -b main
g config user.email "test@example.com"
g config user.name "Test"
mkdir -p "$WORK/.githooks" "$WORK/quality" "$WORK/docs" "$WORK/scripts" \
  "$WORK/amplify/backend/function/newsFoo/src" "$WORK/global-perspectives-starter/frontend/src/features/foo"
cp "$HOOK_SRC" "$WORK/.githooks/pre-commit"
chmod +x "$WORK/.githooks/pre-commit"
g config core.hooksPath .githooks
# Stub ratchet: fails while quality/.ratchet-fail exists (the real checks are quality/check_*.mjs).
cat > "$WORK/quality/check_stub.mjs" <<'EOF'
import fs from 'node:fs';
if (fs.existsSync(new URL('./.ratchet-fail', import.meta.url))) { console.log('stub ratchet: rise'); process.exit(1); }
EOF
echo "seed" > "$WORK/README.md"
echo "# Changes" > "$WORK/CHANGES.md"
g add -A && g commit -q -m "seed" --no-verify

# (a) staged docs/config.js is blocked
echo "window.CONFIG = {}" > "$WORK/docs/config.js"
g add docs/config.js
if commit_ok "config"; then fail "(a) docs/config.js should be blocked"; else
  grep -q "operator-owned" "$WORK/.log" && pass "(a) docs/config.js blocked" || fail "(a) blocked without the config message: $(cat "$WORK/.log")"
fi
g reset -q; rm -f "$WORK/docs/config.js"

# (b) code change without a CHANGES.md entry passes (CHANGES.md is frozen; no changelog rule)
echo "console.log(1)" > "$WORK/amplify/backend/function/newsFoo/src/index.js"
g add amplify/backend/function/newsFoo/src/index.js
commit_ok "lambda code only" && pass "(b) code change without CHANGES.md passes" || fail "(b) should pass: $(cat "$WORK/.log")"

# (c) frontend source + a failing ratchet is blocked, and the check's output is shown
touch "$WORK/quality/.ratchet-fail"
echo "export const a = 1" > "$WORK/global-perspectives-starter/frontend/src/features/foo/a.js"
g add global-perspectives-starter/frontend/src/features/foo/a.js
if commit_ok "frontend with rise"; then fail "(c) failing ratchet should block a frontend commit"; else
  grep -q "stub ratchet: rise" "$WORK/.log" && pass "(c) failing ratchet blocks and prints its output" || fail "(c) blocked without check output: $(cat "$WORK/.log")"
fi

# (d) frontend source + passing ratchets passes
rm -f "$WORK/quality/.ratchet-fail"
commit_ok "frontend clean" && pass "(d) frontend commit with passing ratchets passes" || fail "(d) should pass: $(cat "$WORK/.log")"

# (e) ratchets run only when frontend source is staged
touch "$WORK/quality/.ratchet-fail"
echo "echo hi" > "$WORK/scripts/util.sh"
g add scripts/util.sh
commit_ok "non-frontend" && pass "(e) non-frontend commit skips the ratchets" || fail "(e) should pass: $(cat "$WORK/.log")"

# (f) frontend CSS counts as frontend source too
echo ".a{}" > "$WORK/global-perspectives-starter/frontend/src/features/foo/a.css"
g add global-perspectives-starter/frontend/src/features/foo/a.css
if commit_ok "css with rise"; then fail "(f) CSS change should run the ratchets"; else pass "(f) CSS change runs the ratchets"; fi
g reset -q; rm -f "$WORK/quality/.ratchet-fail"

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL CASES PASSED"; exit 0; fi
echo "ONE OR MORE CASES FAILED"; exit 1
