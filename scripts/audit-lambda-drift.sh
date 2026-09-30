#!/usr/bin/env bash
# Read-only audit: deployed zip vs repo source for every news Lambda (Batch 3 / phase G).
#
#   scripts/audit-lambda-drift.sh              # all news Lambdas
#   scripts/audit-lambda-drift.sh newsAnalyze  # only the named ones
#
# For each Lambda: `aws lambda get-function` -> download the zip -> `diff -r` against
# amplify/backend/function/<dir>/src (node_modules and package-lock.json excluded).
# Prints one line per Lambda: identical / identical-except-repo-only-files / DIFFERS (+ the differing files).
# It never uploads or changes anything. "DIFFERS" needs a human look: trivial (dead fallback strings,
# comments) vs real divergence (which side is newer). Never deploy a repo copy over real divergence;
# newsAnalyze is a known divergence (deployed = prompt-patched pre-credits zip, repo = parked credits).
# Excluded by design: PPA*, Polybot*, GCF*, OpenAIProxy, geminiCurrency, currencyRouter, and non-news functions.
set -euo pipefail
REGION=ap-northeast-1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCS="$ROOT/amplify/backend/function"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

repo_dir() { # deployed name -> repo dir name
  case "$1" in
    newsInvokeGemini-dev) echo newsInvokeGemini;; newsSensitiveData-dev) echo newsSensitiveData;;
    NewsProjectInvokeAgentLambda-dev) echo NewsProjectInvokeAgentLambda;; newsPostLinkedin) echo newsPostLinkedIn;;
    *) echo "$1";;
  esac
}

if [ "$#" -gt 0 ]; then NAMES=("$@"); else
  NAMES=(); while IFS= read -r n; do NAMES+=("$n"); done < <(aws lambda list-functions --region "$REGION" --query 'Functions[].FunctionName' --output text | tr '\t' '\n' \
    | grep -E '^(news|NewsProject)' | sort)
fi

printf '%-36s %-14s %s\n' LAMBDA CLASS DETAIL
for f in "${NAMES[@]}"; do
  d="$(repo_dir "$f")"; src="$FUNCS/$d/src"
  if [ ! -d "$src" ]; then printf '%-36s %-14s %s\n' "$f" "no-repo-src" "(no $d/src; sandbox or external)"; continue; fi
  url="$(aws lambda get-function --region "$REGION" --function-name "$f" --query Code.Location --output text)"
  mkdir -p "$TMP/$f"; curl -s -o "$TMP/$f.zip" "$url"; unzip -q -o "$TMP/$f.zip" -d "$TMP/$f"
  out="$(diff -rq -x node_modules -x package-lock.json "$TMP/$f" "$src" 2>&1 | sed "s#$TMP/$f#deployed#; s#$src#repo#" || true)"
  if [ -z "$out" ]; then printf '%-36s %-14s\n' "$f" "identical"
  elif ! echo "$out" | grep -qv '^Only in repo'; then printf '%-36s %-14s %s\n' "$f" "repo-only-files" "$(echo "$out" | sed 's/^Only in repo//' | tr '\n' ' ')"
  else printf '%-36s %-14s %s\n' "$f" "DIFFERS" "$(echo "$out" | grep -v '^Only in repo' | sed 's/^Files //; s/ differ$//' | tr '\n' ';')"; fi
done
