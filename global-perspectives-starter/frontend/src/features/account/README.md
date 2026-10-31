# account

Sign-in (Firebase magic link, Google, guest), the signed-in account desk, the membership page. A reader signs in here, sees what changed since their last visit for the countries they
follow, manages saved items and alert settings, and subscribes to the paid membership. The Save, Follow and
Subscribe controls that other pages embed live in `@/shared/ui`, not here.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the account desk. Timeline: reads country history and prefs from raw tables; target: board and record views. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live. Polar membership is live; analysis credits are parked (decision 0002) and no page mentions credits
  (`verify_pages.sh` guards it).
- `BREAKING_CRON_LIVE` and `DRIFT_CRON_LIVE` are hard-coded `false` in `Account.jsx`: those alert channels show
  paused with toggles disabled. Live: `TriggerBreakingEmailSend` and `TriggerDriftEmailSend` are DISABLED,
  `TriggerWeeklyEmailSend` is ENABLED (Sundays 14:00 UTC).
- Plan prices are hard-coded in `MembershipPage.jsx` `PLANS`; changing them is a business decision.

## Routes
- `/signin` -> `SignIn`; `/auth/callback` -> `AuthCallback`; `/account` -> `Account` (`?tab=`); `/membership` -> `MembershipPage`

## Frontend
- `SignIn.jsx` - magic link, Google, guest; stores `?returnTo=` in localStorage `gp_return_to` (default `/weekly`)
- `AuthCallback.jsx` - finishes the magic link, then navigates to `gp_return_to` or `/weekly`
- `Account.jsx` - four rail sections (desk, alerts, plan, profile); old `?tab=` values map via `TAB_TO_SECTION`,
  unknown (including the retired `studio` and `analysis`) -> `desk`. Signed out or anonymous shows `SignedOutDesk`, not a redirect.
- `MembershipPage.jsx` - plans, benefits, subscribe
- `components/DeskPanel.jsx` (+ `DeskSinceLastVisit`, `DeskFollowing`, `SavedPanel`); `hooks/useDeskChanges.js`;
  `lib/desk.js`, `deskMap.js`, `accountClaims.js` (`ACCOUNT_CLAIMS`: list only features that work today);
  `deskMap.js` finds a followed country's outline through `shared/lib/countries.js` (`resolveCountry`) and `shared/map/countryGeo.js` (`ISO3_TO_NUM`, generated from the bundle), with no name table or by-name fallback of its own
- Links: saved items, followed countries and desk rows build addresses with `@/shared/lib/links.js` or `<EntityLink>`;
  a saved or followed name that is not a country renders as plain text.
- CSS: `Account.css`, `MembershipPage.css`, `SignIn.css` (also AuthCallback), `components/Desk.css`, `SavedPanel.css`
- Public API: none (no `index.js`); `app/App.jsx` lazy-loads the four pages by path.
- Other features: `@/features/briefings` -> `useWeeklyBrief`. Shared: hooks `useMembership`, `useSavedItems`,
  `usePreferences`, `useDailyBrief`; context `useAuth`.

## Backend
- Guides: [read-api](../../../../../backend/read-api/README.md) (`newsSavedItems`, `newsRecommend`, `newsSensitiveData-dev`),
  [membership-studio](../../../../../backend/membership-studio/README.md) (`newsPolarBilling`),
  [distribution](../../../../../backend/distribution/README.md) (`newsEmailSender`)
- `newsSavedItems` (saved items), `newsRecommend` (prefs, follows, alert feed), `newsPolarBilling` (membership,
  checkout, Polar webhook): each a Function URL with auth NONE, the Firebase token checked in code. `newsSensitiveData-dev`
  serves `country_history`. `newsEmailSender` sends the weekly email; `newsDriftCorrector` writes the drift notes the desk shows.

## Data
- `useSavedItems` -> `window.SAVED_ITEMS_ENDPOINT`: `save_item`, `unsave_item`, `get_saved_items` (Firebase token required)
- `usePreferences` -> `window.USER_PREFS_ENDPOINT`: `get_prefs`, `set_prefs`, `follow_country`, `unfollow_country` (token required)
- `useMembership` -> `window.POLAR_BILLING_ENDPOINT`: `get_membership` (token; anonymous users skipped); `createCheckout`
  -> `create_checkout`. Without the endpoint `available` is false and billing UI is hidden.
- `useDeskChanges` -> restProxy `country_history` per followed country, 3 at a time, members only (`DeskPanel`).
- Desk and Alerts also read `useDailyBrief` (paused-since) and `useWeeklyBrief` (edition notes): the record's brief views first, the actions for
  what is newer (decision 0048; see `features/briefings`).

## Pipeline
1. The reader opens `/signin`; `AuthContext` (`sendSignInLink`, `signInWithGoogle` or `signInAsGuest`) talks to Firebase Auth.
2. The magic link returns to `/auth/callback`; `completeSignIn` finishes it and the reader goes back to `gp_return_to`.
3. `AuthBridge` in `app/App.jsx` hands `getIdToken` to `restProxy.js`, so every gated call carries the Firebase token.
4. `/account`: `useSavedItems`, `usePreferences` and `useMembership` POST to their own Function URLs (`newsSavedItems`, `newsRecommend`, `newsPolarBilling`).
5. Those Lambdas read and write DynamoDB: saved items, user prefs, and `GlobalPerspectiveUserTable` for membership.
6. Subscribe: `createCheckout` returns a Polar URL, the page redirects, and Polar's webhook sets the member tier in the user table.
7. Desk: for a member, `useDeskChanges` fetches `country_history` for each followed country through the proxy.
8. `buildDeskRows` (`lib/desk.js`) makes the "since your last visit" rows; `DeskSinceLastVisit` and `DeskFollowing` (map from `lib/deskMap.js`) render them with `EntityLink`.

## Docs
- Decisions: [0002](../../../../../project-docs/decisions/0002-analysis-credits-parked.md) (credits parked),
  [0003](../../../../../project-docs/decisions/0003-storage-s3-world-dynamodb-user.md) (user data in DynamoDB)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/architecture/DATA_STRATEGY.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/account`
- Function URLs exist: `aws lambda get-function-url-config --function-name newsSavedItems --region ap-northeast-1 --query AuthType` (same for `newsRecommend`, `newsPolarBilling`)
- Saved-items traffic: `aws logs tail /aws/lambda/newsSavedItems --since 7d --region ap-northeast-1 --format short`
- Drift email still off: `aws events describe-rule --name TriggerDriftEmailSend --region ap-northeast-1 --query State`

Last verified: 2026-10-31
