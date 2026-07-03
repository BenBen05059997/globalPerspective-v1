# Email Sender — one Lambda for Weekly Brief + Breaking Alerts

**Date:** 2026-07-03 · **Branch:** `email-sender` · **Status:** DEPLOYED in DRY-RUN mode (real send-to-self verified) — awaiting operator domain-verification to go live

## Deployed state (2026-07-03)
- **`newsEmailSender`** created (nodejs20, 256MB/120s), reusing role `newsprojectLambdaRolefcb19312-dev` (has `AmazonDynamoDBFullAccess` — no new IAM). Env: `EMAIL_SEND_DRY_RUN=true`, `EMAIL_FROM=onboarding@resend.dev`, `TEST_RECIPIENT=benlai310@gmail.com`, `RESEND_API_KEY` (merged from newsBreakingAlert), `UNSUB_BASE_URL`=newsRecommend func URL, table names.
- **`newsRecommend`** redeployed with the public `unsubscribe` action (GetItem-by-uid; needs no new IAM). Verified live: 1 ACAO header (CORS intact), `list_alerts` still serves, unsubscribe GET → HTML 200.
- **EventBridge:** `TriggerWeeklyEmailSend` `cron(0 14 ? * SUN *)` **ENABLED**; `TriggerBreakingEmailSend` `rate(15 minutes)` **DISABLED** (enable at go-live).
- **Verified:** 28/28 unit tests; live dry-run of both modes; **one real weekly email sent to `benlai310@gmail.com`** via the test domain (`sent:1, errors:[]`). Restored to DRY_RUN=true after.

## GO-LIVE (operator, ~4 steps)
1. Verify `globalperspective.net` in Resend (DKIM/SPF/DMARC DNS) — the only real blocker.
2. `aws lambda update-function-configuration newsEmailSender` (merge env): set `EMAIL_FROM=brief@globalperspective.net`, `EMAIL_SEND_DRY_RUN=false`, and clear/remove `TEST_RECIPIENT` (else all mail goes only to you).
3. `aws events enable-rule --name TriggerBreakingEmailSend`.
4. Promote the opt-in (surface on `/weekly-brief`) so real subscribers accumulate in `GlobalPerspectiveUserPrefs`.

---

## Original plan (below)

## Why
Both email products have content flowing but **nothing sends**: `newsWeeklyBrief` generates + auto-publishes a brief every Sunday; `newsBreakingAlert` detects + a human confirms alerts (visible in the bell/`/breaking`). The Resend *send seam* (`sendEmail.js`) exists but is orphaned — only a manual CLI test uses it, and it reaches only the operator via the `onboarding@resend.dev` test domain. `BREAKING_ALERTS_PLAN.md:94` names the missing piece: "build the sender that picks up confirmed rows + emails subscribers." Subscriber capture already works (signed-in users opt in at Account → Notifications → `set_prefs` → `GlobalPerspectiveUserPrefs`, with consent timestamp + `unsubToken`).

**One sender, two modes** (per operator: "single build instead of two") off the shared `sendEmail.js` + `GlobalPerspectiveUserPrefs`.

## Architecture

### New Lambda: `newsEmailSender` (dedicated — [[feedback_clean_architecture]])
`event.mode` dispatch:

- **`weekly`** — load the latest **published** `WEEKLY_BRIEF` (paginated scan, newest `weekOf`) → scan `GlobalPerspectiveUserPrefs` for `digestOptIn === true` (and `digestVerified !== false`, `email` present) → render → send one personalized email each (own unsub link) → write an idempotency marker `EMAILLOG#weekly#<weekOf>` in `SummarizeAndPredict`. Re-invoke for the same `weekOf` is a no-op unless `{force:true}`.
- **`breaking`** — scan `GlobalPerspectiveBreakingAlerts` for `status:'confirmed'` **AND `emailedAt` unset AND fresh (≤48h)** (the freshness gate prevents back-blasting the ~50 historical alerts) → scan prefs for `breakingOptIn === true` → send each alert to each breaking subscriber → set `emailedAt` on the alert (idempotency; status unchanged so the feed is untouched).

Files (`amplify/backend/function/newsEmailSender/src/`):
- `index.js` — dispatch, loaders, subscriber scan, send loop, idempotency, `DRY_RUN` gate.
- `sendEmail.js` — copy of the Resend seam, **extended with a `headers` param** (for `List-Unsubscribe` / `List-Unsubscribe-Post`).
- `renderWeeklyEmail.js` — signals brief → `{subject,text,html}` + unsub footer.
- `renderBreakingEmail.js` — one alert → `{subject,text,html}` + unsub footer.
- `package.json` — no deps bundled (nodejs20 runtime provides `@aws-sdk`; `fetch` is global), matching `newsWeeklyBrief`.

### Unsubscribe (public, one-click) — added to `newsRecommend`
Co-located with prefs. New **public** `unsubscribe` path (no auth — the token *is* the auth):
- `GET  <funcurl>?action=unsubscribe&token=<unsubToken>&kind=<digest|breaking|all>` → find the user by `unsubToken` (paginated scan), flip the flag(s) off, return a small HTML confirmation page.
- `POST` with the same query (RFC 8058 one-click) → flip + `200`.
- Emails carry `List-Unsubscribe: <that GET url>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` for inbox "unsubscribe" buttons + deliverability.

### Idempotency
- Weekly: `EMAILLOG#weekly#<weekOf>` marker row (skip if present). Coarse (per-week, not per-subscriber) — fine at this list size; documented.
- Breaking: per-alert `emailedAt`. New subscribers don't receive past alerts (breaking is point-in-time) — intended.

## Go-live gating (safe until the operator acts)
- `EMAIL_SEND_DRY_RUN` env — **default ON**: logs recipients + the full would-be email, sends nothing.
- `EMAIL_FROM` env — `onboarding@resend.dev` (owner-only) until `globalperspective.net` is verified in Resend, then `brief@globalperspective.net`.
- `TEST_RECIPIENT` env — optional override to send only to one address (send-to-self smoke test).
- `RESEND_API_KEY` env (plaintext, project convention — [[feedback_no_secrets_manager]]).

**The one operator-only blocker:** verify `globalperspective.net` in Resend (DKIM/SPF/DMARC DNS). Until then real subscribers can't be reached; everything else is testable via `DRY_RUN` + `TEST_RECIPIENT`.

## Deploy (follow-up, gated — NOT in this worktree build)
1. `create-function newsEmailSender` (nodejs20) + IAM role: read `SummarizeAndPredict`, read `GlobalPerspectiveUserPrefs`, read/write `GlobalPerspectiveBreakingAlerts`, write the `EMAILLOG#` marker. Env via temp `file://` json (never inline the key — classifier blocks it).
2. Redeploy `newsRecommend` (unsubscribe action) — dual-CORS check (it owns CORS in code → empty Function-URL CORS).
3. EventBridge: `TriggerWeeklyEmailSend` `cron(0 14 ? * SUN *)` (a few h after the 06:00 brief gen) → `{mode:'weekly'}`; `TriggerBreakingEmailSend` `rate(15 minutes)` → `{mode:'breaking'}`.
4. Smoke test with `DRY_RUN=true` (logs only) → `TEST_RECIPIENT=<you>` real send-to-self → verify domain → flip `EMAIL_SEND_DRY_RUN=false` + real `EMAIL_FROM`.

## Verification (this worktree)
- `node --check` all new/edited files.
- Local dry-run invoke of the handler (both modes) against real DDB read paths (NODE_PATH → an existing function's `@aws-sdk`), `DRY_RUN=true` → prints the would-be recipient list + rendered emails, sends nothing.

## Out of scope (later)
Anonymous (no-login) capture form + double-opt-in confirmation; forecast-scorecard section in the weekly (needs the resolution loop run first — see the subscription strategy); personalized digest.
