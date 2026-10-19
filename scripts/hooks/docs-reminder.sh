#!/usr/bin/env bash
# Claude Code Stop hook: remind about ARCHITECTURE.md / INDEX.md only when the uncommitted diff
# changes the architecture — a Lambda added/removed, a route added/removed, a feature folder
# added/removed — and neither doc is changed. Routine code edits need no doc update.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
st=$(git status --porcelain 2>/dev/null)
printf '%s\n' "$st" | grep -qE 'project-docs/architecture/ARCHITECTURE\.md|project-docs/INDEX\.md' && exit 0
why=""
# Lambda dir added or removed (new/deleted src/index.js).
printf '%s\n' "$st" | grep -qE '^(\?\?|A |D | D) amplify/backend/function/[^/]+/(src/index\.js|src/?$|$)' && why="a Lambda was added or removed"
# Feature folder added or removed.
printf '%s\n' "$st" | grep -qE '^(\?\?|A |D | D) global-perspectives-starter/frontend/src/features/[^/]+/?$' && why="${why:+$why; }a feature folder was added or removed"
# Route lines added or removed in App.jsx.
git diff HEAD -U0 -- global-perspectives-starter/frontend/src/app/App.jsx 2>/dev/null | grep -qE '^[+-][^+-].*<Route' && why="${why:+$why; }routes changed in App.jsx"
[ -z "$why" ] && exit 0
printf '{"systemMessage":"📐 Architecture changed (%s): update project-docs/architecture/ARCHITECTURE.md (and INDEX.md if a doc was added) in the same commit."}' "$why"
exit 0
