# 17. /breaking and /weekly-markets retire to redirects; guided tours are removed

Status: accepted
Date: 2026-10-01

## Context
The dark-site release (one token set, one frame) reviewed pages kept from before the redesign. The
operator ruled "Follow the master plan" where a recommendation contradicted it.

## Decision
We will:
- redirect `/weekly-markets` to `/briefings` (economy stays parked);
- redirect `/breaking` to `/`, and `/breaking/:id` to the alert's story when it resolves to one,
  else `/`; the map's alert stack replaces the feed;
- remove the guided tours ("Walk me through today", the welcome/site/page tours and their
  popovers); the one-line orientation banner replaces them;
- keep the footer to exactly About, Membership, Privacy, Disclosures, Contact.

## Consequences
- Redirects live in `app/LegacyRedirects.jsx`; page guards check the redirects and the footer set.

Source: `git show 120de90:project-docs/archive/redesign-ux/_active/TASK_2026-10-01_dark_site_shared_tokens.md` (deleted 2026-10-19)
(Decisions 1, 2, 13, 14); `git show a5c0de8:project-docs/plans/REDESIGN_MASTER_PLAN.md` (deleted 2026-10-19) (§3.1, §3.2)
