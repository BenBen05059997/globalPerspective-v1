# 19. Frontend hosting moves to Cloudflare Workers Static Assets behind the existing Worker

Status: accepted; cut over 2026-11-14 (GitHub Pages kept as the fallback, not yet retired)
Date: 2026-10-05

## Context
Production is GitHub Pages (`docs/` on `main`) behind the `globalperspective-rss` Cloudflare Worker,
which handles RSS, bot pre-rendering, `/data/*` and the SPA fallback. A push to `docs/` publishes
production.

## Decision
We will move site hosting to a new static-assets Worker (provisionally `globalperspective-site`)
that only serves files, with `globalperspective-rss` kept on its route in front of it (revision
2026-10-05, operator yes). Releases are manual through `./deploy.sh` targets with a pinned
Wrangler. Merging the two Workers is a separate, later decision (Phase E).

## Consequences
- Until an authorized cutover, production stays on Pages behind `globalperspective-rss` (superseded: see
  Amendment 2026-11-14).
- Candidate, production and legacy-pages releases each need a fresh operator "yes"
  (`CLAUDE.md`, Authorization).

## Amendment 2026-11-14: cutover done
- Upload: `./deploy.sh --target production` created the Worker `globalperspective-site` at 06:14 UTC (version
  `6f3008b7-e02c-4757-ba97-f6d8cf3ab61e`, artifact `ebf2ec0544c77444a10d206ae325a6722deccfcaa5cbaed927213710f957d153`, built
  from commit `8d8fd084`). Same frontend source and same `config.js` (sha256 starts `42c6a03fa234535a`) as the Pages
  release built from `a44c59b4`. Since commit `0b7bcf55`, a production upload refuses uncommitted packaged source and a HEAD
  not contained in `origin/main`; `BOARD_ENDPOINT` is a required config field.
- Cutover at 07:49 UTC (operator yes): the apex record was deleted and `globalperspective.net` was attached as a Custom
  Domain of `globalperspective-site`. Cloudflare refuses to replace an existing record in one step ("Hostname ... already has
  externally managed DNS records ... Delete them first"), so there was a gap: `/` answered 530 for about 7 to 14 seconds
  (probe every 2 s, 2 failures in 167). No rollback was needed.
- Captured before the swap (rollback record): apex `globalperspective.net` CNAME `benben05059997.github.io`, Proxied, TTL
  Auto. `www` is a proxied CNAME to `benben05059997.github.io`; the `www` to apex 301 is a Cloudflare Redirect Rule ("www to
  apex", path and query kept) and does not depend on Pages. The mail records (DKIM, MX, SPF, DMARC) and the Google
  verification TXT were not touched. Zone Workers Routes: `globalperspective.net/*` and `globalperspective.net/rss*`, both to
  `globalperspective-rss`.
- The front Worker `globalperspective-rss` (version `319801d4`) and its two routes are unchanged and still in front. Its
  pass-through fetches now reach the site Worker.
- Waiver: the operator waived the `next.globalperspective.net` chained test on 2026-11-14. The browser origin does not change,
  so Firebase, API CORS and Maps allow-lists were expected to need no change. The first chain test was production itself.
- Checks after the cutover: every smoke URL kept its status code; no GitHub headers; bot pre-render on `/briefings` works; no
  `x-robots-tag` on the real hostname. The operator reported sign-in working. The map was not explicitly confirmed.
  `mark-verified` was run for that artifact and version.
- Header differences, not faults: `cache-control` on the shell, blog, sitemap, robots and `config.js` is now
  `public, max-age=0, must-revalidate` (was max-age 600 or 14400); a missing asset returns an empty 404 with `no-store`;
  `access-control-allow-origin: *` is no longer sent on those files; the previous bundle now answers 404.
- Rollback of the cutover: remove the Custom Domain from the Worker's Domains page, then add CNAME `@` to
  `benben05059997.github.io`, Proxied, TTL Auto (expect a short gap again). Rollback of a release: restore the previous
  Worker version.
- Still open: GitHub Pages is not retired and stays the fallback. The observation window (48 hours plus one verified
  release) began at the cutover. Retiring Pages needs an operator yes. `docs/` cannot be deleted yet: packaging still reads `docs/config.js`, `docs/blog`, `docs/sitemap.xml` and
  `docs/WHITEPAPER.md` (`scripts/release-site.mjs`); those files must move first. Release records and rollback archives live
  only in the git-ignored `.site-releases/`. Merging the two Workers (Phase E) is still a separate, later decision.

- Amendment 2026-11-14 (later, operator): no dual publish to Pages during the observation window. Releases go only to
  Cloudflare with `./deploy.sh --target production`; there is no `stage-pages` step and no Pages push per release. Reason: a
  bad release is rolled back by restoring the previous Worker version, which does not need GitHub. Pages is needed only if
  Cloudflare hosting itself fails, and it still holds the build released from commit `a44c59b4` (bundle `index-BB5SVPaK`),
  which is good enough as an emergency copy. Accepted cost: a fallback to Pages would serve that older build, not the newest
  release. Unchanged: Pages is not retired yet; retiring it needs an operator yes after 48 hours from the cutover
  (2026-11-14 07:49 UTC) and one verified release. `stage-pages` and `legacy-pages` stay in the code as emergency tools until
  Pages is retired. Every production upload still needs a fresh operator yes.

Source: `project-docs/plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md` (deleted 2026-10-26; in git history) (§1 and the 2026-10-05
revisions); `git show a5c0de8:project-docs/plans/TASK_2026-10-05_cloudflare_frontend_migration.md` (deleted 2026-10-19);
`.claude/skills/deploy-frontend/DEPLOYMENT_NOTES.md`; `CLAUDE.md`
