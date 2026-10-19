# 10. The country view is split by job

Status: accepted
Date: 2026-09-25

## Context
The country page mixed quick status with expensive on-view AI analysis. Reader research
(CrisisWatch, sovereign ratings, ACLED, travel advisories) shows professionals lead with state +
direction + why, dated.

## Decision
We will split the country view (operator: "that looks really good"): a country card on the map
(quick, public, stored data, no AI run on view; card v2, canvas board C1); deep analysis in the
Analysis Studio on demand (deep-dive, country web, bilateral); and `/weekly/country/:name` kept as
a simple public page with the card content for search engines and old links. C1–C6 accepted as
recommended; C7/C8 later.

## Consequences
- The card shows only stored, dated data; AI runs happen in the Studio.

Source: `git show 120de90:project-docs/archive/redesign-ux/_active/COUNTRY_VIEW_DISCUSSION.md` (deleted 2026-10-19)
