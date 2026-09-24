#!/usr/bin/env bash
# Self-test for pre-commit doc guard. Builds a throwaway git repo under the
# scratchpad, installs the hook, and exercises the five cases from the task.
# Never touches the real globalPerspective-v1 repo. Run:
#   bash scripts/test_pre_commit_hook.sh

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK_SRC="$HERE/../.githooks/pre-commit"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/precommit-test.XXXXXX")"
FAIL=0

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }

git -C "$WORK" init -q -b main
git -C "$WORK" config user.email "test@example.com"
git -C "$WORK" config user.name "Test"
mkdir -p "$WORK/.githooks"
cp "$HOOK_SRC" "$WORK/.githooks/pre-commit"
chmod +x "$WORK/.githooks/pre-commit"
git -C "$WORK" config core.hooksPath .githooks

mkdir -p "$WORK/amplify/backend/function/newsFoo/src"
mkdir -p "$WORK/global-perspectives-starter/frontend/src/components"
mkdir -p "$WORK/scripts"
mkdir -p "$WORK/project-docs/architecture/_active"
echo "seed" > "$WORK/README.md"
echo "# Changes" > "$WORK/CHANGES.md"
git -C "$WORK" add -A
git -C "$WORK" commit -q -m "seed"

# --- (a) code change without CHANGES.md -> blocked ---
echo "console.log(1)" > "$WORK/amplify/backend/function/newsFoo/src/index.js"
git -C "$WORK" add amplify/backend/function/newsFoo/src/index.js
if git -C "$WORK" commit -q -m "code only" >/tmp/precommit_test_a.log 2>&1; then
  fail "(a) code change without CHANGES.md should have been blocked"
else
  pass "(a) code change without CHANGES.md blocked"
fi
git -C "$WORK" reset -q >/dev/null 2>&1

# --- (b) code change + CHANGES.md -> passes ---
echo "console.log(2)" > "$WORK/amplify/backend/function/newsFoo/src/index.js"
echo "## 2026-09-24 entry" >> "$WORK/CHANGES.md"
git -C "$WORK" add amplify/backend/function/newsFoo/src/index.js CHANGES.md
if git -C "$WORK" commit -q -m "code + changelog" >/tmp/precommit_test_b.log 2>&1; then
  pass "(b) code change + CHANGES.md passes"
else
  fail "(b) code change + CHANGES.md should have passed: $(cat /tmp/precommit_test_b.log)"
fi

# --- (c) doc-only change -> passes ---
echo "doc update" >> "$WORK/README.md"
git -C "$WORK" add README.md
if git -C "$WORK" commit -q -m "doc only" >/tmp/precommit_test_c.log 2>&1; then
  pass "(c) doc-only change passes"
else
  fail "(c) doc-only change should have passed: $(cat /tmp/precommit_test_c.log)"
fi

# --- (d) SKIP_DOC_GUARD=1 -> passes ---
echo "console.log(3)" > "$WORK/scripts/util.sh"
git -C "$WORK" add scripts/util.sh
if SKIP_DOC_GUARD=1 git -C "$WORK" commit -q -m "bypass" >/tmp/precommit_test_d.log 2>&1; then
  pass "(d) SKIP_DOC_GUARD=1 bypass passes"
else
  fail "(d) SKIP_DOC_GUARD=1 should have passed: $(cat /tmp/precommit_test_d.log)"
fi

# --- (e) active task file: affected-docs reminder prints, does not block ---
cat > "$WORK/project-docs/architecture/_active/TASK_2026-09-24_test.md" <<'EOF'
## test task — 2026-09-24 — active
**Goal:** exercise the reminder path.
**Reads / references:** none.
**Changes (code):**
- global-perspectives-starter/frontend/src/components/Widget.jsx
**Docs to update on completion:**
- project-docs/architecture/ARCHITECTURE.md — Widget row
**Completion checklist:**
- [ ] code
EOF
git -C "$WORK" add project-docs/architecture/_active/TASK_2026-09-24_test.md
git -C "$WORK" commit -q -m "add task file"

mkdir -p "$WORK/global-perspectives-starter/frontend/src/components"
echo "export default function Widget(){}" > "$WORK/global-perspectives-starter/frontend/src/components/Widget.jsx"
echo "## 2026-09-24 widget change" >> "$WORK/CHANGES.md"
git -C "$WORK" add global-perspectives-starter/frontend/src/components/Widget.jsx CHANGES.md
OUT=$(git -C "$WORK" commit -m "widget change" 2>&1)
RC=$?
if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q "ARCHITECTURE.md"; then
  pass "(e) task-file reminder prints and does not block"
else
  fail "(e) expected exit 0 + reminder mentioning ARCHITECTURE.md; got rc=$RC out=[$OUT]"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "ALL CASES PASSED"
  exit 0
else
  echo "ONE OR MORE CASES FAILED"
  exit 1
fi
