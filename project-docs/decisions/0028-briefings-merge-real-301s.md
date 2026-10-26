# 0028. One Briefings page; old addresses get real 301s

Status: accepted (supersedes the client-only redirect part of 0017)
Date: 2026-10-19

## Context
The same brief lived at three addresses (`/daily`, `/weekly-brief`, `/briefings`). Decision 0017 retired
`/weekly-markets` and `/breaking` through client-side redirects only (`app/LegacyRedirects.jsx`), so crawlers and
link previews saw a 200 page, not a move. The linking plan (decision 2 there) was approved by the operator after
an Opus debate and judge.

## Decision
We will merge `/daily`, `/weekly-brief` and `/briefings` into one Briefings page with read, weekly and present
modes. Old addresses keep working through real 301 redirects in the Cloudflare Worker (`/daily/:date` →
`/briefings?date=`, `/weekly-brief` → `/briefings?mode=weekly`, plus the routes retired in 0017). The client
redirects stay as a fallback.

## Consequences
- 0017's other rulings (tours removed, footer set, `/breaking` targets) stand.
- The Worker upload carrying the 301s is a release step and needs a fresh operator yes.
- The weekly email button, saved "daily" items, the sitemap and the Worker's page directory point at the new address.

Source: `project-docs/plans/PLAN_2026-10-19_linking_and_pages.md` (deleted 2026-10-26; in git history) (Decisions 2; checklist P B1–B3).
