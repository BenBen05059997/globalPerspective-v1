#!/usr/bin/env bash
#
# Frontend deploy script for Global Perspectives.
#
# Builds the Vite app and copies the build output into docs/ so GitHub Pages
# (globalperspective.net) picks it up. Refuses to touch docs/config.js, which
# holds runtime config (Firebase, API endpoint, Google Maps key).
#
# Usage:   ./deploy.sh
#          ./deploy.sh --skip-build      # copy already-built dist/ only
#          ./deploy.sh --commit "msg"    # build, copy, and commit
#          ./deploy.sh --commit "msg" --push   # ...and push to origin
#
# Each run: builds, copies dist/ → docs/, STRIPS docs/assets/*.map (sourcemaps
# are 'hidden' and must never be served), and resyncs docs/404.html byte-for-byte
# with docs/index.html (the GitHub Pages SPA fallback — a stale hash here makes
# deep-link refreshes render blank). docs/config.js is hash-guarded, never touched.
#
# By default the script does NOT push — review the diff and push manually.
# Pass --push (with --commit) to push to origin in one shot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
FRONTEND_DIR="$REPO_ROOT/global-perspectives-starter/frontend"
DIST_DIR="$FRONTEND_DIR/dist"
DOCS_DIR="$REPO_ROOT/docs"
CONFIG_FILE="$DOCS_DIR/config.js"

SKIP_BUILD=0
COMMIT_MSG=""
PUSH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1; shift ;;
    --commit)
      COMMIT_MSG="${2:-}"
      [[ -n "$COMMIT_MSG" ]] || { echo "ERROR: --commit requires a message" >&2; exit 1; }
      shift 2 ;;
    --push)
      PUSH=1; shift ;;
    -h|--help)
      sed -n '2,22p' "$0"; exit 0 ;;
    *)
      echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ "$PUSH" -eq 1 && -z "$COMMIT_MSG" ]]; then
  echo "ERROR: --push requires --commit \"msg\" (nothing to push without a commit)" >&2
  exit 1
fi

log() { printf "\033[1;34m[deploy]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[deploy]\033[0m %s\n" "$*" >&2; }

[[ -d "$FRONTEND_DIR" ]] || { err "Frontend dir missing: $FRONTEND_DIR"; exit 1; }
[[ -d "$DOCS_DIR"     ]] || { err "Docs dir missing: $DOCS_DIR"; exit 1; }

# config.js must exist before we start — snapshot hash to verify it's untouched after
if [[ ! -f "$CONFIG_FILE" ]]; then
  err "$CONFIG_FILE not found — refusing to deploy without runtime config."
  exit 1
fi
CONFIG_HASH_BEFORE=$(shasum -a 256 "$CONFIG_FILE" | awk '{print $1}')

# 1. Build
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  log "Building Vite app..."
  (cd "$FRONTEND_DIR" && npm run build)
else
  log "Skipping build (--skip-build)"
fi

# 2. Verify dist/ looks healthy
[[ -d "$DIST_DIR" ]]            || { err "Build output missing: $DIST_DIR"; exit 1; }
[[ -f "$DIST_DIR/index.html" ]] || { err "Missing dist/index.html"; exit 1; }
[[ -d "$DIST_DIR/assets" ]]     || { err "Missing dist/assets/"; exit 1; }
ASSET_COUNT=$(find "$DIST_DIR/assets" -type f | wc -l | tr -d ' ')
[[ "$ASSET_COUNT" -ge 2 ]] || { err "dist/assets has only $ASSET_COUNT files — build looks broken"; exit 1; }
log "Build verified ($ASSET_COUNT asset files)"

# 3. Replace docs/assets, copy index.html
log "Replacing docs/assets..."
rm -rf "$DOCS_DIR/assets"
cp -R "$DIST_DIR/assets" "$DOCS_DIR/assets"
cp "$DIST_DIR/index.html" "$DOCS_DIR/index.html"

# 3a. Strip source maps — vite emits .map into dist/ ('hidden' sourcemaps) but
#     they must NEVER be served publicly. Belt-and-braces: remove from docs/.
MAP_COUNT=$(find "$DOCS_DIR/assets" -name '*.map' -type f | wc -l | tr -d ' ')
if [[ "$MAP_COUNT" -gt 0 ]]; then
  find "$DOCS_DIR/assets" -name '*.map' -type f -delete
  log "Stripped $MAP_COUNT source map(s) from docs/assets"
fi

# 3b. Resync the SPA fallback. docs/404.html MUST be byte-for-byte identical to
#     docs/index.html — GitHub Pages serves it on every deep-link refresh (e.g.
#     refreshing /economy); a stale hash here = blank page on refresh.
cp "$DOCS_DIR/index.html" "$DOCS_DIR/404.html"
if diff -q "$DOCS_DIR/index.html" "$DOCS_DIR/404.html" >/dev/null; then
  log "docs/404.html resynced (identical to index.html)"
else
  err "FATAL: docs/404.html does not match index.html after resync."
  exit 1
fi

# 4. Verify config.js was not touched
CONFIG_HASH_AFTER=$(shasum -a 256 "$CONFIG_FILE" | awk '{print $1}')
if [[ "$CONFIG_HASH_BEFORE" != "$CONFIG_HASH_AFTER" ]]; then
  err "FATAL: docs/config.js was modified. Restore it from git before pushing."
  exit 1
fi
log "docs/config.js preserved (unchanged)"

# 5. Optional commit (+ optional push)
if [[ -n "$COMMIT_MSG" ]]; then
  log "Staging files..."
  (
    cd "$REPO_ROOT"
    git add docs/assets docs/index.html docs/404.html global-perspectives-starter/frontend/src/
    [[ -f CHANGES.md ]] && git add CHANGES.md
    if git diff --cached --quiet; then
      log "Nothing to commit"
    else
      git commit -m "$COMMIT_MSG"
      if [[ "$PUSH" -eq 1 ]]; then
        log "Pushing to origin..."
        git push
        log "Pushed. GitHub Pages will rebuild in ~1-2 min."
      else
        log "Committed. Run 'git push' when ready (or re-run with --push)."
      fi
    fi
  )
fi

log "Done."
