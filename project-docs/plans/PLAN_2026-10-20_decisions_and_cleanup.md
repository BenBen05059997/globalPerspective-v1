# Decisions of 2026-10-20 and the cleanup run

Status: active (2026-10-20; operator yes to decisions 1-4, worked one item at a time by Sonnet agents)

The operator answered the open questions on 2026-10-20 ("and then yes", replying to the recommended answers):
1. Breaking alerts wait for the operator's confirmation before they show on the site.
2. The planned Studio country sheet merges into the existing country page (no separate page).
3. The lens Studio screens retire; membership stops being sold as Studio runs; the stale blog tier line is fixed.
4. The Cloudflare hosting cutover goes ahead. Live DNS steps (test hostname, Custom Domain) still come to the
   operator before they run.
Undecided: the hidden economy tab on story pages (recommended: leave it), the five test users, the topic-selection
switch after the shadow week. Each step below is one Sonnet agent, run in sequence; each line is ticked when done
and verified, with the commit.

## Done before this plan (2026-10-20)
- [x] Story-web history kept daily in S3 (`web/YYYY/MM/DD.json`), IAM write on `web/*` only (12fbb3de).
- [x] Import leaks fixed: live market hook into countries, saved-key storage + provider picker into shared,
      country coordinates into `shared/map` (9ebbf051, 0893dbab, 6af29155).
- [x] Members get full depth on country history and the corrections feed (the token was not sent) (0762cb56).
- [x] Folder guides for every backend group and frontend folder, each with a pipeline; check_docs requires it.
- [x] ARCHITECTURE context, container and flow pictures; STATUS.md; generated data-links map; AWS drift check.
- [x] Atlas rebuilt around the five pictures (claude.ai artifact, one living page).
- [x] Release: Pages build, front Worker `cc57a42f` (rollback `91ba1e98`), situation Lambdas, smoke checks,
      desktop click-through (linking plan, section R).
- [x] `/analyze?stories=<threadId>` now preselects archive stories (2abcf134); not yet released.

## Checklist (in order)
- [x] 1. Phone-width click-through of production in the browser (390 px, 12 pages). Found and fixed: the signed-in
      name overflowed the top bar on every page; weekly briefing source labels overflowed (f736a4a6, 36f2e8d3).
      Checked on the local build at 390 px with the bell present: fits, long names end in an ellipsis.
- [x] 2. Breaking alerts wait for confirmation (decision 1): the bell, strip, `/breaking/:id` and the parked signal
      feed show only `confirmed` alerts; the operator email is marked "[Unconfirmed] NOT PUBLIC YET" with the confirm
      command; `review.js` can now confirm `sent` rows (ad0474e0). Deployed newsRecommend, newsSignals,
      newsBreakingAlert; live `list_alerts` returns none (the one 9 Oct alert was never confirmed).
- [ ] 3. Membership copy and the blog tier line (decision 3): no page sells membership as Studio runs.
- [ ] 4. Country page honesty layer (decision 2): fact / judgment tags on every line, "What we don't know",
      copy as text, print view, the reader's own view box (browser only). Built from data the page already reads.
- [ ] 5. Retire the lens Studio screens (decision 3): `/analyze` points readers to country pages; shared-run
      pages keep working; libraries kept; Studio links removed from story and country pages.
- [ ] 6. Small leftovers: the deadline helper countries borrows from threads; stale CLI header comments;
      unused social-platform keys on `newsPostLinkedin`; the mis-joined forecast; the account desk map's own
      country names.
- [ ] 7. Older backlog: Lambdas on nodejs20.x to nodejs22.x; env keys no code reads; colour items C3, C4, C7.
- [ ] 8. Cloudflare cutover preparation (decision 4): read-API origin for the test host, capture of DNS/TLS/rule
      settings, the exact cutover and reversal steps written down. DNS changes go to the operator first.
- [ ] 9. Record decisions 1-4 in decision records; rewrite the Studio plan; delete the temporary Studio Decision page.
- [ ] 10. Frontend release of items 3-5 and the Studio fix (needs a fresh yes).

## Log
- 2026-10-20: Studio `?stories=` fix checked on the local build: the French-protests thread opens preselected (1/4).
