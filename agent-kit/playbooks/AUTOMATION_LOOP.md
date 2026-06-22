# Automation Playbook — running the agent autonomously

> How to run a coding agent for hours/overnight without burning money or shipping broken code.

## When automation works (and when it doesn't)

**Use the loop for:** bugs already identified with concrete fix recipes; repetitive sweeps
(find every X, fix every Y); verification-driven work where `<VERIFY_CMD>` grades pass/fail;
performance work where a **number** is the target (LCP < 2.5s, bundle < 200kB, p95 < 300ms).

**Don't use the loop for:** newly-discovered bugs with unknown root cause; UI/visual bugs needing
eye judgment; anything needing product judgment ("should it work this way?"); vague fixes
("refactor X", "make it snappier").

Mental model:
- **Human-with-agent (interactive):** find new bugs, understand root causes, design the fix.
- **Loop (autonomous):** execute already-understood fixes in bulk.

## The Ralph loop pattern

1. Read the task queue (a `WORKING_QUEUE.md` of `[ ]` items) — pick the next undone item.
2. Implement the fix.
3. Run `<VERIFY_CMD>` (the fast pass/fail gate).
4. If green → commit; if the diff is ≥ ~100 net lines → spawn an independent agent audit.
5. Update the queue file (mark item done, append notes).
6. Exit. An outer `while` loop relaunches a fresh session.

**Why relaunch each iteration:** keeps the context window small, prevents drift, makes each
commit a clean checkpoint.

## Budget & kill switches (the expensive lesson)

People have left agents running overnight with no caps and burned thousands of dollars. Always set:

| Guard | How |
|---|---|
| Wall-clock kill | `timeout 4h` wrapping the loop |
| Max iterations | a counter in the outer loop (e.g. 30) |
| Token / $ cap | the agent's task-budget feature, if available |
| Diff-size guard | `git diff --shortstat` > N lines → halt |
| Verify regression | 2 consecutive verify fails → halt |

Skeleton wrapper:

```bash
#!/usr/bin/env bash
set -euo pipefail
MAX_ITERS=30
for i in $(seq 1 $MAX_ITERS); do
  timeout 15m claude -p "$(cat .claude/loop-prompt.md)" --dangerously-skip-permissions || break
  <VERIFY_CMD> || { echo "verify failed at iter $i"; break; }
  lines=$(git diff --cached --shortstat | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
  [ "${lines:-0}" -gt 500 ] && { echo "diff too big"; break; }
done
```

> `--dangerously-skip-permissions` ONLY inside a sandboxed runner / container — never on the dev box.

## Headless mode

`claude -p "<prompt>"` runs one-shot, no TTY, exits when done. Slot into GitHub Actions `schedule:`
cron, plain cron on a VPS/Mac, or pre-merge CI. Good candidates: nightly `<VERIFY_FULL_CMD>` + auto-
file an issue on failure; weekly doc/code-drift sweep; daily data-freshness check.

## Performance loops — always need a number first

Every perf loop needs a numeric threshold up front ("LCP < 2.5s", "First Load JS < 200kB",
"p95 API < 300ms"). Without a number the loop can't decide when a fix shipped — it guesses and
reverts good work. Define the threshold, then start.

## Halt rules (canonical)

The loop **STOPS** on any of:
1. Two consecutive verify failures on unrelated items.
2. Queue empty (no `[ ]` items left).
3. Diff exceeds the size cap without a checkpoint.
4. An item flagged `BLOCKED:` in the queue.
5. Wall-clock or iteration cap hit.
6. Cross-workstream conflict (a fix in area A starts touching area B) → escalate to human.

## Working-queue conventions

- Write the queue file **first** so the user can see the plan; update it at each commit boundary.
- One queue file per topic/chain (`{TOPIC}_QUEUE.md`); don't reuse an existing one for new work.
- Each iteration appends a one-line log (date · item · verify result · diff size).
