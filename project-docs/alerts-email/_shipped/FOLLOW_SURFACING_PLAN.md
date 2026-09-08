# Follow-Button Surfacing Plan — put the country-follow control where reading-intent is highest

**Status: ✅ SHIPPED + DEPLOYED 2026-07-08 (main `b455ee1`, bundle `index-ByAC31Ev.js` live-verified, 404 byte-identical).** Ledger surface done (2-file change, verify 213/213). Countries-index + ThreadPage remain DEFERRED (§3 reasons). Built by a Sonnet agent, reviewed + deployed by Opus.
**Self-contained for a hand-off agent.** Parents: `MEMBER_GATING_PLAN.md` P5 (the follow feature), `DRIFT_EMAIL_ACTIVATION_PLAN.md` (the email this unlocks), `SCORING_MODEL_V2_PLAN.md` §12 (the per-axis email it feeds).

---

## 1. Problem & finding

The member "follow a country's read → drift-alert email" control (`FollowButton`) is rendered on **exactly one page** (`CountryPage`, header, line ~648). A reader anywhere else can't follow a country without navigating to its page. That under-surfacing is almost certainly why the feature has **0 followers** — which in turn is why the drift-email cron is still (correctly) DISABLED.

**Verified 2026-07-08 (do not re-litigate — checked against code):**
- `FollowButton` is a **self-contained drop-in**: `<FollowButton country={name} />`. It internally handles all states — member → live toggle; non-member/anon → subtle locked `/membership` CTA; backend/billing not configured → renders `null` (honest, no dead control). No new props, no context needed (uses `useMembership` + `usePreferences`, app-wide hooks).
- **Management already exists** — `/account?tab=notifications` (`Account.jsx` `NotificationsPanel`) already manages both email opt-ins (breaking/digest + unsubscribe-all) AND the country change-alerts list (followed countries + Unfollow + "Pause all change-alerts"). **The operator's "make it manageable in settings" ask is already satisfied** — no work needed there beyond confirming it reads well.

## 2. Decision — surface ONE clean, high-intent location now

**Ship: the `/track-record` corrections ledger.** This is the Accountability hub — the site's "reading corrections" destination. Someone scanning the ledger of "our read on X changed" is *definitionally* the person who'd want the next change on that country emailed. Highest intent, thematically perfect, and technically clean.

Verified clean: `corrections_feed` country-scope notes carry a plain country name (`Japan`, `Iran`, `Germany`, …) that IS the follow key; in `TrackRecordPage.jsx` `CorrectionsLedger` the row's `tr-cl-top` is a flex row where the name is a `<Link>` — so a `FollowButton` sits as a **sibling** of that link (NOT nested inside an anchor → no invalid `<a>`-in-`<a>` / `<button>`-in-`<a>`, no click-bubble conflict).

## 3. Explicitly DROPPED / DEFERRED (do NOT add these — reasons load-bearing)

- **CountryWhatChanged band — DROP (redundant).** It renders only on `CountryPage`, which *already* has `FollowButton` in its header. A second identical button on the same page is clutter, not surfacing.
- **ThreadPage rail — DEFER (ambiguous).** A thread carries `thread.regions` (plural — the meta line reads "Countries X, Y +N"), and it's unconfirmed whether those strings are follow-key country names or broad region buckets. Following is strictly country-scoped; a single "Follow" on a multi-country thread has no unambiguous target. Revisit only with a proven rule (e.g. `thread.regions.length === 1 && regions[0] is a valid country name`).
- **countries-index (`CountryListPage` `CountryCard`) — DEFER (nesting + grid CSS + anon-nag).** The whole card is a `<Link>`; a `FollowButton` (which itself renders a `<Link>` for anon) can't nest inside it without invalid HTML + click conflict, and hoisting it out needs a card refactor that risks the CSS grid. Plus a Follow-Members CTA on 50+ cards is naggy for anon. Legit as a future discovery surface, but needs visual QA — not this round.

## 4. Implementation — one file (+ minimal CSS)

**`global-perspectives-starter/frontend/src/components/TrackRecordPage.jsx`:**
1. `import { FollowButton } from './FollowButton';`
2. In `CorrectionsLedger`'s row render, inside `<div className="tr-cl-top">`, after the existing `tr-cl-date` span, add — **country scope only**:
   ```jsx
   {n.scope === 'country' && (
     <span className="tr-cl-follow"><FollowButton country={n.name} /></span>
   )}
   ```
   (Thread-scope corrections get no button — following is country-only.)

**`global-perspectives-starter/frontend/src/components/TrackRecordPage.css`:**
- Add a `.tr-cl-follow` rule that right-aligns the control in the flex row (e.g. `margin-left:auto`) and keeps it from stretching the row height awkwardly. Match the file's existing token/spacing idiom. Keep it visually quiet — the ledger is a list, the button is secondary.

**Optional polish (only if trivial):** de-dupe — if the same country appears in multiple correction rows, the button repeats (harmless — all reflect the same follow state via `usePreferences`). Fine to leave; do NOT add state-tracking complexity to suppress it.

**Scope:** these two files only. Do not touch `FollowButton.jsx`, `Account.jsx`, or any other page.

## 5. Verify (pre-deploy gate)
- `cd global-perspectives-starter/frontend && npm run verify` (eslint + vitest + build) → green.
- Sanity: confirm `FollowButton` import resolves and the ledger still renders for the honest-empty case (no corrections) and for thread-scope rows (no button).
- Note: there is no automated visual test; the change is additive and `FollowButton` is already battle-tested on `CountryPage`. The reviewer (Opus) will eyeball the diff before deploy.

## 6. Deploy (AUTHORIZED this round — frontend)
Standard frontend deploy via the canonical script (`CLAUDE.md`):
```
./deploy.sh --commit "feat(follow): surface country-follow on the /track-record corrections ledger" --push
```
This builds → copies `dist/` to `docs/` → strips `docs/assets/*.map` → resyncs `docs/404.html` byte-identical → hash-guards `docs/config.js`. Verify live after: `/track-record` shows a Follow control on country-scope corrections (anon → "Follow · Members" CTA; member → toggle).

## 7. Why this matters (the causal chain)
`FollowButton` invisible → 0 followers → drift-email cron stays disabled. Surfacing it at the corrections moment is the **missing first domino**: better surfacing → first real follower → that's the trigger to run `DRIFT_EMAIL_ACTIVATION_PLAN.md` L3–L4 and flip the cron on, lighting up the per-axis email (`SCORING_MODEL_V2_PLAN.md` §12) we just shipped. One small, safe surface closes the highest-intent gap and unblocks the whole pipeline.

## 8. Non-negotiables
- Two files only (`TrackRecordPage.{jsx,css}`).
- `FollowButton` used as-is — no edits to its gating (it already does member/anon/honest-null correctly).
- Honest-empty + thread-scope behavior preserved (no button where following doesn't apply).
- Deploy = `./deploy.sh` (never hand-copy; it handles the 404 resync + map strip).
