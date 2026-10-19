# account

Sign-in (Firebase magic link, Google, guest), the signed-in account desk, the membership page,
and the Studio key panel. The save / follow / subscribe controls other pages embed live in `@/shared/ui`.

## Routes
- `/signin` -> `SignIn`; `/auth/callback` -> `AuthCallback`; `/account` -> `Account`; `/membership` -> `MembershipPage`

## Entry files
- `SignIn.jsx` - magic link, Google, guest; stores `?returnTo=` in localStorage `gp_return_to` (default `/weekly`)
- `AuthCallback.jsx` - finishes the magic link, then navigates to `gp_return_to` or `/weekly`
- `Account.jsx` - five rail sections (desk, alerts, studio, plan, profile) chosen by `?tab=`
- `MembershipPage.jsx` - plans, benefits and subscribe checkout
- `components/DeskPanel.jsx` (+ `DeskSinceLastVisit`, `DeskFollowing`, `SavedPanel`) - the Desk section
- `lib/desk.js`, `deskMap.js`, `accountClaims.js`. The Save / Follow / Subscribe controls and their hooks live in `@/shared/ui` and `@/shared/hooks`

## Data
- `useSavedItems` -> `window.SAVED_ITEMS_ENDPOINT` (newsSavedItems): `save_item`, `unsave_item`, `get_saved_items`
- `usePreferences` -> `window.USER_PREFS_ENDPOINT` (newsRecommend): `get_prefs`, `set_prefs`, `follow_country`, `unfollow_country`
- `useMembership` -> `window.POLAR_BILLING_ENDPOINT` (newsPolarBilling): `get_membership`; `createCheckout` -> `create_checkout`
- `useDeskChanges` -> restProxy `country_history` per followed country (members only, 3 at a time)
- Desk and Alerts also read `useDailyBrief` (paused-since) and `useWeeklyBrief`

## Shared blocks used
- `@/shared/ui/boot/BootLoader`, `@/shared/ui/StoryLink`

## Public API (`index.js`)
- None: no `index.js`; nothing outside this folder imports it (route pages load lazily by path from `app/App.jsx`).

## Imports from other features
- `@/features/analysis-studio` -> `loadByok`, `clearByok`, `getProvider`, `ProviderModal` (Studio key panel)
- `@/features/weekly-brief` -> `useWeeklyBrief` (edition notes)
- From shared (moved out of this folder in wave 3): `@/shared/ui/SaveButton`, `FollowButton`, `SubscribeCard`;
  `@/shared/hooks/useMembership`, `useSavedItems`, `usePreferences`, `useDailyBrief`; `@/shared/map/landGeometry.js` (Desk map coastlines)

## Gotchas
- `/account` signed out (or anonymous) shows `SignedOutDesk`, not a redirect. Old `?tab=` values map via `TAB_TO_SECTION`; unknown -> `desk`.
- `BREAKING_CRON_LIVE` and `DRIFT_CRON_LIVE` are hard-coded `false` in `Account.jsx`: those channels show paused, toggles disabled.
- Plan prices are hard-coded in `MembershipPage.jsx` `PLANS`; changing them is a business decision.
- Without `POLAR_BILLING_ENDPOINT`, `available` is false (billing UI shows not-available); member-only `FollowButton` renders nothing without the prefs or billing endpoint.
- `ACCOUNT_CLAIMS` is shared by SignIn and the signed-out desk: list only features that work today.

Last verified: 2026-10-19
