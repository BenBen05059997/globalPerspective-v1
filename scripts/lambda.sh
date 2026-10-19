#!/usr/bin/env bash
# One news Lambda: diff the deployed zip against the repo, package the repo, deploy, roll back.
#
#   scripts/lambda.sh <name> diff                # read-only: deployed zip vs what `package` would upload
#   scripts/lambda.sh <name> package             # build .deploy-backups/<name>/build.zip locally (no upload)
#   scripts/lambda.sh <name> deploy [--force]    # PROD MUTATION: backup deployed zip, upload build.zip, confirm sha
#   scripts/lambda.sh <name> rollback            # PROD MUTATION: re-upload the newest backup, confirm sha
#
# <name> is the deployed name or the repo folder name (scripts/functions.json maps them; e.g. newsInvokeGemini ->
# newsInvokeGemini-dev, repo dir backend/pipeline/newsInvokeGemini). deploy/rollback need the same authorization
# as any `aws lambda update-function-code` (see CLAUDE.md "Authorization"); the script never decides that for you.
#
# Package: copies <dir>/src (functions.json "dir", e.g. backend/<group>/<name>) minus node_modules and test files,
# following symlinks, so the committed src/_shared -> ../../../shared/src (backend/shared/src) link ships as real
# files (_shared/llm.js etc.). When functions.json says the deployed zip ships node_modules ("nodeModules": true),
# it installs production deps for linux/x64 (npm ci with a lockfile, else npm install); otherwise the runtime's @aws-sdk v3 is relied on, as live.
#
# Diff guard: every deployed file that differs from the package (or exists only in the deployed zip) is looked
# up in git's object store. Found = those exact bytes were committed once, so the repo is ahead (safe).
# Not found = the deployed zip carries a change the repo has never seen (a console edit, a patched zip);
# deploy refuses that unless --force. Functions with "deployBlocked" in functions.json are always refused.
set -euo pipefail
REGION=ap-northeast-1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCS_JSON="$ROOT/scripts/functions.json"

usage() { sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2; }
[ "$#" -ge 2 ] || usage
ARG_NAME="$1"; CMD="$2"; FORCE=0
[ "${3:-}" = "--force" ] && FORCE=1

# name|dir|nodeModules|deployBlocked from functions.json (accepts deployed name or repo dir)
IFS='|' read -r NAME DIR NODE_MODULES BLOCKED < <(node -e '
  const fns = require(process.argv[1]).functions, q = process.argv[2];
  const name = fns[q] ? q : Object.keys(fns).find((n) => fns[n].dir && (fns[n].dir === q || fns[n].dir.split("/").pop() === q));
  if (!name) { console.error(`unknown Lambda: ${q} (not in scripts/functions.json)`); process.exit(1); }
  const f = fns[name];
  console.log([name, f.dir || "", f.nodeModules ? 1 : 0, f.deployBlocked || ""].join("|"));
' "$FUNCS_JSON" "$ARG_NAME")
[ -n "$DIR" ] || { echo "✗ $NAME has no repo dir. ${BLOCKED}" >&2; exit 1; }
SRC="$ROOT/$DIR/src"
[ -d "$SRC" ] || { echo "✗ missing $SRC" >&2; exit 1; }
BACKUPS="$ROOT/.deploy-backups/$NAME"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

sha_b64() { openssl dgst -sha256 -binary "$1" | base64; }   # same encoding as Lambda's CodeSha256
safe() { printf '%s' "$1" | tr '/+' '_-'; }                 # CodeSha256 -> filename

# Copy src (no node_modules, no tests; symlinks followed, so _shared/ is real files) into $1; install prod deps
# when the live zip ships them. diff and package both stage through here, so diff compares what package uploads.
stage() {
  mkdir -p "$1"
  rsync -aL --exclude node_modules --exclude '*.test.js' --exclude '*.test.mjs' --exclude 'test-*' \
    --exclude 'test_*' --exclude .gitignore "$SRC/" "$1/"
  if [ "${2:-}" = deps ] && [ "$NODE_MODULES" = 1 ]; then
    local npm_flags=(--omit=dev --os=linux --cpu=x64 --force --no-audit --no-fund --loglevel=error)  # --force: linux-only optional deps (sharp) on a mac host
    if [ -f "$1/package-lock.json" ]; then (cd "$1" && npm ci "${npm_flags[@]}")
    else (cd "$1" && npm install --no-package-lock "${npm_flags[@]}"); fi
  fi
}

download_deployed() { # dest_zip -> echoes CodeSha256 after checking the download matches it
  local url sha
  read -r url sha < <(aws lambda get-function --region "$REGION" --function-name "$NAME" \
    --query '[Code.Location, Configuration.CodeSha256]' --output text)
  curl -sfS -o "$1" "$url"
  [ "$(sha_b64 "$1")" = "$sha" ] || { echo "✗ downloaded zip does not match CodeSha256 $sha" >&2; exit 1; }
  echo "$sha"
}

# Prints the classified diff; returns 0 identical, 1 repo-ahead only, 3 deployed-only changes present.
run_diff() {
  download_deployed "$TMP/deployed.zip" >/dev/null
  unzip -q "$TMP/deployed.zip" -d "$TMP/deployed"
  stage "$TMP/repo"
  local out unknown=0 rel f
  out="$(diff -rq -x node_modules "$TMP/deployed" "$TMP/repo" || true)"
  if [ -z "$out" ]; then echo "$NAME: identical to the repo package"; return 0; fi
  echo "$NAME: deployed zip vs repo package ($SRC)"
  while IFS= read -r line; do
    case "$line" in
      "Only in $TMP/repo"*) rel="${line#Only in $TMP/repo}"; rel="${rel/: //}"; echo "  repo-only     ${rel#/}"; continue ;;
      "Only in $TMP/deployed"*) rel="${line#Only in $TMP/deployed}"; rel="${rel/: //}"; rel="${rel#/}" ;;
      Files*) rel="${line#Files $TMP/deployed/}"; rel="${rel%% and *}" ;;
      *) echo "  ?             $line"; continue ;;
    esac
    f="$TMP/deployed/$rel"
    if [ -f "$f" ] && git -C "$ROOT" cat-file -e "$(git -C "$ROOT" hash-object "$f")" 2>/dev/null; then
      echo "  repo-ahead    $rel   (deployed bytes are in git history)"
    else
      echo "  DEPLOYED-ONLY $rel   (deployed bytes never committed)"; unknown=1
    fi
  done <<< "$out"
  echo; diff -ru -x node_modules "$TMP/deployed" "$TMP/repo" | sed "s#$TMP/##g" || true
  [ "$unknown" = 1 ] && return 3 || return 1
}

package() {
  stage "$TMP/build" deps
  mkdir -p "$BACKUPS"; rm -f "$BACKUPS/build.zip"
  (cd "$TMP/build" && zip -qrX "$BACKUPS/build.zip" .)
  echo "$BACKUPS/build.zip  $(du -h "$BACKUPS/build.zip" | cut -f1)  sha256(b64)=$(sha_b64 "$BACKUPS/build.zip")"
}

upload() { # zip -> uploads and confirms the live CodeSha256 equals the zip's
  local want got
  want="$(sha_b64 "$1")"
  aws lambda update-function-code --region "$REGION" --function-name "$NAME" --zip-file "fileb://$1" \
    --query CodeSha256 --output text >/dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$NAME"
  got="$(aws lambda get-function-configuration --region "$REGION" --function-name "$NAME" --query CodeSha256 --output text)"
  [ "$got" = "$want" ] || { echo "✗ live CodeSha256 $got != uploaded $want" >&2; exit 1; }
  echo "✓ $NAME live CodeSha256 $got"
}

case "$CMD" in
  diff) run_diff || rc=$?; exit "${rc:-0}" ;;
  package) package ;;
  deploy)
    [ -z "$BLOCKED" ] || { echo "✗ $NAME deploy blocked: $BLOCKED" >&2; exit 1; }
    rc=0; run_diff >"$TMP/diff.txt" || rc=$?
    if [ "$rc" = 3 ] && [ "$FORCE" = 0 ]; then
      cat "$TMP/diff.txt"; echo "✗ refusing: the deployed zip has changes the repo has never seen (re-run with --force to overwrite them)" >&2; exit 1
    fi
    [ "$rc" = 0 ] && { echo "$NAME: repo package identical to deployed; nothing to deploy"; exit 0; }
    mkdir -p "$BACKUPS"
    sha="$(download_deployed "$TMP/current.zip")"
    cp "$TMP/current.zip" "$BACKUPS/$(safe "$sha").zip"
    echo "backup: $BACKUPS/$(safe "$sha").zip"
    package
    upload "$BACKUPS/build.zip"
    ;;
  rollback)
    [ -z "$BLOCKED" ] || { echo "✗ $NAME rollback blocked: $BLOCKED" >&2; exit 1; }
    latest="$(ls -t "$BACKUPS"/*.zip 2>/dev/null | grep -v '/build\.zip$' | head -1 || true)"
    [ -n "$latest" ] || { echo "✗ no backup in $BACKUPS" >&2; exit 1; }
    echo "rolling back $NAME to $latest"
    upload "$latest"
    ;;
  *) usage ;;
esac
