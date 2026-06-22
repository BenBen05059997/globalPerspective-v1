# Memory System — file-based persistent agent memory

> How the agent keeps durable, cross-session knowledge. One fact per file; a single index
> (`MEMORY.md`) is loaded into context each session. This is what lets an agent in a new project
> accumulate the same kind of hard-won institutional knowledge Pro-Co has.

## Layout

```
<memory-dir>/
  MEMORY.md          ← the index: one line per memory, loaded every session
  feedback_*.md      ← one fact per file
  project_*.md
  ...
```

If your agent harness provides a memory directory, use it. Otherwise pick a stable path
(e.g. `.agent-memory/`) and reference it from `CLAUDE.md`.

## File format

Each memory is one file holding **one fact**, with frontmatter:

```markdown
---
name: <short-kebab-case-slug>
description: <one-line summary — used to decide relevance during recall>
metadata:
  type: user | feedback | project | reference
---

<the fact. For feedback/project, follow with **Why:** and **How to apply:** lines.
Link related memories with [[their-name]].>
```

Link liberally with `[[name]]` — a link to a memory that doesn't exist yet is fine; it marks
something worth writing later.

## The four categories

| Type | What it holds |
|---|---|
| `user` | Who the user is — role, expertise, preferences. |
| `feedback` | Guidance on **how you should work** — corrections AND confirmed approaches. Always include the *why*. This is the most valuable category; it's where the agent's discipline lives. |
| `project` | Ongoing work, goals, constraints **not derivable from the code or git history**. Convert relative dates to absolute. |
| `reference` | Pointers to external resources (URLs, dashboards, tickets). |

## The index (`MEMORY.md`)

After writing a memory file, add a **one-line pointer** to `MEMORY.md`:

```
- [Title](file.md) — one-line hook
```

`MEMORY.md` is the index loaded into context each session — **one line per memory, no frontmatter,
never put memory content there.** Keep each index line under ~200 chars; if the index grows past
your harness's load limit, the tail gets dropped — move detail into the topic files, keep hooks tight.

## What to save (and what not to)

**Save** the non-obvious operating knowledge: a rule the user corrected you on (with why), a
constraint that isn't visible in the code, a gotcha that cost you an hour, a "we tried X, it
failed, do Y instead."

**Don't save** what the repo already records — code structure, past fixes, git history, anything in
`CLAUDE.md`. If asked to remember one of those, ask what was *non-obvious* about it and save that
instead. Don't save what only matters to the current conversation.

## Hygiene

- Before saving, check for an existing file that already covers it — **update it, don't duplicate.**
- Delete memories that turn out to be wrong.
- A recalled memory reflects what was true **when written** — if it names a file/function/flag,
  **verify it still exists** before acting on it.
- When a memory names a `canonical:` doc, trust the doc; the memory is a hint.

## Why this matters for a new project

Pro-Co's discipline didn't come from one big document — it accumulated as ~100 small `feedback_*`
memories, each capturing one burn or one confirmed approach. Seed a new project with the
`feedback` rules from `CLAUDE.template.md`, then let the agent add one memory every time it learns
something the hard way. Within weeks the new project has its own institutional memory.
