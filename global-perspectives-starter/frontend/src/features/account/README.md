# account

Sign-in (Firebase magic link, Google, guest), the signed-in account desk, the membership page and
the Studio key panel. The Save / Follow / Subscribe controls other pages embed live in `@/shared/ui`.

## Status
- Live. Polar membership is live; analysis credits are parked (decision 0002) and no page mentions
  credits (removed 2026-10-19; `verify_pages.sh` guards it).
- `BREAKING_CRON_LIVE` and `DRIFT_CRON_LIVE` are hard-coded `false` in `Account.jsx`: those alert channels
  show paused with toggles disabled (both send rules are DISABLED live). Plan prices are hard-coded in
  `MembershipPage.jsx` `PLANS`; changing them is a business decision.

## Routes
- `/signin` -> `SignIn`; `/auth/callback` -> `AuthCallback`; `/account` -> `Account` (`?tab=`); `/membership` -> `MembershipPage`

## Frontend
- `SignIn.jsx` - magic link, Google, guest; stores `?returnTo=` in localStorage `gp_return_to` (default `/weekly`)
- `AuthCallback.jsx` - finishes the magic link, then navigates to `gp_return_to` or `/weekly`
- `Account.jsx` - five rail sections (desk, alerts, studio, plan, profile); old `?tab=` values map via
  `TAB_TO_SECTION`, unknown -> `desk`. Signed out or anonymous shows `SignedOutDesk`, not a redirect.
- `MembershipPage.jsx` - plans, benefits, subscribe
- `components/DeskPanel.jsx` (+ `DeskSinceLastVisit`, `DeskFollowing`, `SavedPanel`); `hooks/useDeskChanges.js`;
  `lib/desk.js`, `deskMap.js`, `accountClaims.js` (`ACCOUNT_CLAIMS`: list only features that work today)
- Links: saved items, followed countries and desk rows build addresses with `@/shared/lib/links.js`
  (`storyHref`, `countryHref`, `briefingHref`, `ROUTE`) or `<EntityLink>`; a saved or followed name that is not
  a country renders as plain text.
- CSS: `Account.css`, `MembershipPage.css`, `SignIn.css` (also AuthCallback), `components/Desk.css`, `SavedPanel.css`
- Public API: none (no `index.js`; nothing outside imports this folder).
- Imports from other features: `@/features/analysis-studio` -> `loadByok`, `clearByok`, `getProvider`, `ProviderModal`;
  `@/features/briefings` -> `useWeeklyBrief`. Shared hooks: `useMembership`, `useSavedItems`, `usePreferences`, `useDailyBrief`.

## Backend
- Generated row: [reference/features.md#account](../../../../../project-docs/reference/features.md#account)
- `newsSavedItems` (saved items), `newsRecommend` (prefs, follows, alert feed), `newsPolarBilling` (membership,
  checkout) — each a Function URL; `newsSensitiveData-dev` serves `country_history`. `newsEmailSender` sends the
  weekly email (drift/breaking modes disabled); `newsDriftCorrector` writes the drift notes the desk shows.

## Data
- `useSavedItems` -> `window.SAVED_ITEMS_ENDPOINT`: `save_item`, `unsave_item`, `get_saved_items` (Firebase token)
- `usePreferences` -> `window.USER_PREFS_ENDPOINT`: `get_prefs`, `set_prefs`, `follow_country`, `unfollow_country`
- `useMembership` -> `window.POLAR_BILLING_ENDPOINT`: `get_membership`; `createCheckout`
  -> `create_checkout`. Without the endpoint `available` is false and billing UI is hidden.
- `useDeskChanges` -> restProxy `country_history` per followed country, 3 at a time, members only (`DeskPanel`).
- Desk and Alerts also read `useDailyBrief` (paused-since) and `useWeeklyBrief` (edition notes).

## Docs
- Decisions: [0002](../../../../../project-docs/decisions/0002-analysis-credits-parked.md) (credits parked),
  [0003](../../../../../project-docs/decisions/0003-storage-s3-world-dynamodb-user.md) (user data in DynamoDB)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/rules/DATA_STRATEGY.md)
- Runbooks: [drift-email.md](../../../../../project-docs/runbooks/drift-email.md) (turning drift email on),
  [weekly-email.md](../../../../../project-docs/runbooks/weekly-email.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/account`
- Function URLs present: `aws lambda get-function-url-config --function-name newsSavedItems --region ap-northeast-1 --query AuthType`
  (same for `newsRecommend`, `newsPolarBilling`)
- Saved-items traffic: `aws logs tail /aws/lambda/newsSavedItems --since 7d --region ap-northeast-1 --format short`
- Drift email still off: `aws events describe-rule --name TriggerDriftEmailSend --region ap-northeast-1 --query State`

Last verified: 2026-10-19
