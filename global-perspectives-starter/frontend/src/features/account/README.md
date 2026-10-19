# account

Sign-in (Firebase magic link, Google, guest), the signed-in account desk, the membership page,
and the save / follow / subscribe controls other pages embed.

## Routes
- `/signin` -> `SignIn`; `/auth/callback` -> `AuthCallback`; `/account` -> `Account`; `/membership` -> `MembershipPage`

## Entry files
- `SignIn.jsx` - magic link, Google, guest; stores `?returnTo=` in localStorage `gp_return_to` (default `/weekly`)
- `AuthCallback.jsx` - finishes the magic link, then navigates to `gp_return_to` or `/weekly`
- `Account.jsx` - five rail sections (desk, alerts, studio, plan, profile) chosen by `?tab=`
- `MembershipPage.jsx` - plans, benefits, subscribe and credit-pack checkout
- `components/DeskPanel.jsx` (+ `DeskSinceLastVisit`, `DeskFollowing`, `SavedPanel`) - the Desk section
- `components/SaveButton.jsx`, `FollowButton.jsx`, `SubscribeCard.jsx` - controls embedded elsewhere; `lib/desk.js`, `deskMap.js`, `accountClaims.js`

## Data
- `useSavedItems` -> `window.SAVED_ITEMS_ENDPOINT` (newsSavedItems): `save_item`, `unsave_item`, `get_saved_items`
- `usePreferences` -> `window.USER_PREFS_ENDPOINT` (newsRecommend): `get_prefs`, `set_prefs`, `follow_country`, `unfollow_country`
- `useMembership` -> `window.POLAR_BILLING_ENDPOINT` (newsPolarBilling): `get_membership`; `createCheckout`/`createCreditCheckout` -> `create_checkout`
- `useDeskChanges` -> restProxy `country_history` per followed country (members only, 3 at a time)
- Desk and Alerts also read `useDailyBrief` (paused-since) and `useWeeklyBrief`; `creditPacks()` reads `window.POLAR_CREDIT_PACKS`

## Shared blocks used
- `@/shared/ui/boot/BootLoader`, `@/shared/ui/StoryLink`

## Imports from other features
- `@/features/analysis-studio/lib/byok`, `lib/llm`, `components/ProviderModal` -> Studio key panel
- `@/features/daily/hooks/useDailyBrief`, `@/features/weekly-brief/hooks/useWeeklyBrief` -> paused / edition notes
- `@/features/map/lib/landGeometry.js` -> coastlines for the Desk map
- `@/features/threads/WeeklyPage.css` -> error styling in `AuthCallback`

## Gotchas
- `/account` signed out (or anonymous) shows `SignedOutDesk`, not a redirect. Old `?tab=` values map via `TAB_TO_SECTION`; unknown -> `desk`.
- `BREAKING_CRON_LIVE` and `DRIFT_CRON_LIVE` are hard-coded `false` in `Account.jsx`: those channels show paused, toggles disabled.
- Plan prices are hard-coded in `MembershipPage.jsx` `PLANS`; changing them is a business decision.
- Without `POLAR_BILLING_ENDPOINT`, `available` is false (billing UI shows not-available); member-only `FollowButton` renders nothing without the prefs or billing endpoint.
- `ACCOUNT_CLAIMS` is shared by SignIn and the signed-out desk: list only features that work today.

Last verified: 2026-10-19
