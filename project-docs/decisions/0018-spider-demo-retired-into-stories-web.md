# 18. /spider-demo retires into the Stories WEB view

Status: accepted
Date: 2026-10-02

## Context
The unlisted `/spider-demo` prototype showed the causal web. The master plan merges it into the
Stories board; on 2026-10-01 the operator ruled it stays until the WEB view exists, then retires.

## Decision
We will retire `/spider-demo` once the Stories WEB view exists: it redirects to
`/weekly?view=web` and `features/spider-demo/` is deleted when nothing imports it.

## Consequences
- The WEB view follows 0012 (news-based links, "judged to feed into").

Source: `git show 120de90:project-docs/archive/redesign-ux/_active/TASK_2026-10-02_stories_board_web.md` (deleted 2026-10-19) (P7b);
`git show 120de90:project-docs/archive/redesign-ux/_active/TASK_2026-10-01_dark_site_shared_tokens.md` (deleted 2026-10-19) (Decision 3)
