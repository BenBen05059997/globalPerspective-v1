#!/usr/bin/env bash
# Ralph loop for Global Perspectives — see agent-kit/playbooks/AUTOMATION_LOOP.md
#
# Runs a headless Claude session per iteration against a WORKING_QUEUE, gated by
# `npm run verify`. Each iteration: pick next [ ] item → fix → verify → commit →
# mark done. A fresh session per loop keeps context small and each commit a checkpoint.
#
# GUARDRAILS (hard):
#   - NEVER deploys. ./deploy.sh stays gated to an explicit human "yes". This loop
#     only produces LOCAL commits; you push/deploy by hand afterward.
#   - Run from inside a dedicated git worktree (one line of work per worktree).
#   - --dangerously-skip-permissions is ONLY safe in a sandbox/container, never the dev box.
#
# Usage:  ./agent-kit/ralph-loop.sh <QUEUE_FILE> [MAX_ITERS]
set -euo pipefail

QUEUE="${1:?usage: ralph-loop.sh <QUEUE_FILE> [MAX_ITERS]}"
MAX_ITERS="${2:-15}"
APP_DIR="global-perspectives-starter/frontend"
DIFF_CAP=500   # net inserted lines across the loop before forced halt

for i in $(seq 1 "$MAX_ITERS"); do
  echo "=== iteration $i / $MAX_ITERS ==="

  # Queue empty? (no '[ ]' items left) → done.
  if ! grep -q '^\- \[ \]' "$QUEUE"; then echo "queue drained — stop"; break; fi

  PROMPT="Read $QUEUE. Pick the FIRST unchecked '[ ]' item and do ONLY that one.
Follow the queue's Scope rules exactly (removals only, no logic changes, do not touch
exhaustive-deps). Then: cd $APP_DIR && npm run verify. If green, commit locally with a
conventional message (chore(lint): ...), mark the item [x] in $QUEUE, and append a one-line
log entry. Do NOT push. Do NOT run ./deploy.sh. Stop after this one item."

  # headless one-shot; sandbox only.
  timeout 15m claude -p "$PROMPT" --dangerously-skip-permissions || { echo "iter $i: agent exited non-zero"; break; }

  # Gate re-check from the loop's side (belt and suspenders).
  ( cd "$APP_DIR" && npm run verify ) || { echo "iter $i: VERIFY RED — halt"; break; }

  # Diff-size guard.
  lines=$(git diff --shortstat | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
  if [ "${lines:-0}" -gt "$DIFF_CAP" ]; then echo "diff > $DIFF_CAP — halt for review"; break; fi
done

echo "=== loop ended. Review: git log --oneline. Push/deploy is a separate, gated human step. ==="
