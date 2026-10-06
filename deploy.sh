#!/usr/bin/env bash
# Frontend release entrypoint. Build is the default; uploads require an explicit target.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/global-perspectives-starter/frontend"
TARGET="build"

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh                         Verify, build, and package locally (default)
  ./deploy.sh --target candidate      Build, package, remote-check, then upload candidate
  ./deploy.sh --target production     Build, package, then upload production
  ./deploy.sh --target legacy-pages   Run the preserved GitHub Pages release flow
  ./deploy.sh --target stage-pages --artifact HASH
  ./deploy.sh --target mark-verified --artifact HASH --version-id ID

Cloudflare uploads use the repository's local Wrangler binary. Candidate uploads
require the Wrangler OAuth session (or CLOUDFLARE_API_TOKEN) plus account/zone IDs
for a fail-closed remote domain/route check. Nothing commits, pushes, or changes DNS.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ "${1:-}" == "--target" ]]; then
  TARGET="${2:-}"
  [[ -n "$TARGET" ]] || { echo "ERROR: --target requires a value" >&2; exit 2; }
  shift 2
fi

case "$TARGET" in
  legacy-pages)
    exec "$SCRIPT_DIR/scripts/deploy-pages-legacy.sh" "$@"
    ;;
  mark-verified)
    exec node "$SCRIPT_DIR/scripts/release-site.mjs" mark-verified "$@"
    ;;
  stage-pages)
    exec node "$SCRIPT_DIR/scripts/release-site.mjs" stage-pages "$@"
    ;;
  build|candidate|production)
    [[ $# -eq 0 ]] || { echo "ERROR: unexpected arguments for target $TARGET" >&2; exit 2; }
    ;;
  *)
    echo "ERROR: unknown target: $TARGET" >&2
    usage >&2
    exit 2
    ;;
esac

[[ -d "$FRONTEND_DIR" ]] || { echo "ERROR: frontend directory missing: $FRONTEND_DIR" >&2; exit 1; }

echo "[deploy] Running frontend verification..."
(cd "$FRONTEND_DIR" && npm run verify)
echo "[deploy] Running hosting verification..."
(cd "$FRONTEND_DIR" && npm run test:hosting)
echo "[deploy] Building frontend..."
(cd "$FRONTEND_DIR" && npm run build)
echo "[deploy] Packaging deterministic site assets..."
PACKAGE_OUTPUT="$(node "$SCRIPT_DIR/scripts/prepare-site-assets.mjs")"
printf '%s\n' "$PACKAGE_OUTPUT"
ARTIFACT_HASH="$(printf '%s\n' "$PACKAGE_OUTPUT" | sed -n 's/^Artifact: //p')"
[[ "$ARTIFACT_HASH" =~ ^[a-f0-9]{64}$ ]] || { echo "ERROR: packaging did not return an artifact hash" >&2; exit 1; }

case "$TARGET" in
  build)
    echo "[deploy] Build-only complete. No upload performed."
    ;;
  candidate|production)
    node "$SCRIPT_DIR/scripts/release-site.mjs" "$TARGET" "$ARTIFACT_HASH"
    ;;
esac
