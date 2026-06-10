# Notification Settings Menu — Plan

**Date:** 2026-06-10 · **Status:** BACKEND DEPLOYED + curl-verified · FRONTEND built + staged in `docs/` · **pending a signed-in browser click-through before commit/push.** Function URL: `https://snkxw6dllquntzyyur2cb4eu6u0cnzqr.lambda-url.ap-northeast-1.on.aws/` (wired into `docs/config.js`).
**Scope decided (user):** Account → "Notifications" tab with **two independent toggles — Breaking news alerts + Weekly digest** — both **default OFF**, plus an "unsubscribe from all." Backend reads/writes per-user prefs via Firebase JWT.
**Why this shape:** matches the researched standard (breaking ≠ digest; opt-in default per GDPR) — see `NOTIFICATION_GAP_ANALYSIS.md` Part B.

This is the foundation the breaking-alert sender (`BREAKING_ALERTS_PLAN.md`) and the future digest both read to know *who* to send to.

---

## 1. UX — Account → "Notifications" tab

Add a third tab next to Profile / Saved in `Account.jsx` (it already uses `?tab=` URL state). Tab contents:

- **Breaking news alerts** — toggle (default OFF).
  Sub-text: "An email the moment a major story breaks, with our analysis."
- **Weekly digest** — toggle (default OFF). When ON, reveal a **cadence** selector: `Weekly` (default) / `Daily`.
  Sub-text: "A roundup of the most significant stories."
- **Unsubscribe from everything** — a single action that flips both off (the global escape hatch).
- **Honesty banner** (while email isn't live): a small note — *"Email delivery is being set up — your preferences are saved and will apply as soon as it's live."* No fake "you're subscribed!" confirmation ([[feedback-no-misinformation-fallback]]).
- Save behavior: optimistic toggle → POST → on error, revert + show an inline error (no silent failure).

Anonymous/guest users: the tab prompts sign-in (prefs are per-uid), consistent with how `Account` already redirects non-users to `/signin`.

Styling: reuse the existing `Account.css` section/toggle look; brand tokens (rust accent). No new design system.

---

## 2. Data model — `GlobalPerspectiveUserPrefs` (existing table, additive)

**PK:** `uid` (Firebase UID). Add fields (all written by `set_prefs`):

| Attr | Type | Default | Purpose |
|------|------|---------|---------|
| `breakingOptIn` | BOOL | `false` | master switch for breaking alerts |
| `digestOptIn` | BOOL | `false` | master switch for the digest |
| `digestCadence` | S | `weekly` | `weekly` \| `daily` (only meaningful when `digestOptIn`) |
| `email` | S | from JWT | captured at first `set_prefs` (the send address) |
| `breakingVerified` | BOOL | `false` | double opt-in gate — **no breaking email sent until true** |
| `digestVerified` | BOOL | `false` | double opt-in gate for digest |
| `unsubToken` | S | random | powers one-click `List-Unsubscribe` (generated on first opt-in) |
| `consentAt` | S | ISO | when the user opted in (GDPR consent record) |
| `updatedAt` | S | ISO | last change |

Note: `interestProfile` already lives here (written by `newsRecommend` as a cache) — untouched. The two concerns coexist on the same per-user row.

`*Verified` + `unsubToken` are written now but **only enforced when email goes live** (the sender checks `breakingOptIn && breakingVerified`). For the dry-run sender they're inert.

---

## 3. Backend — `get_prefs` / `set_prefs` on `newsRecommend`

**Home: `newsRecommend`** — it already owns `GlobalPerspectiveUserPrefs` (writes `interestProfile`) and already has the Firebase-JWT verify helper. Aligns with the recs plan and [[feedback-clean-architecture]]. (Alternative considered: fold into `newsSavedItems` to reuse its live Function URL — rejected: mixes concerns, and `newsRecommend` needs to be browser-reachable anyway for the recommendations rail.)

Two new actions, both **require a Firebase JWT** (`uid = payload.sub`), mirroring `newsSavedItems`:

```
POST { action: "get_prefs" }
  → { ok, prefs: { breakingOptIn, digestOptIn, digestCadence } }   // safe subset; defaults when no row

POST { action: "set_prefs", payload: { breakingOptIn?, digestOptIn?, digestCadence? } }
  → { ok, prefs: {...} }
  // validates: booleans coerced; cadence ∈ {weekly,daily}; email taken from JWT;
  // stamps consentAt on first opt-in; generates unsubToken if absent (crypto.randomUUID).
  // UpdateCommand with SET on only the provided fields (never clobbers interestProfile).
```

Validation/safety: ignore unknown fields; never trust client `email`/`uid` (use JWT); `set_prefs` is idempotent.

**Infra to stand up (one-time):**
- A **Lambda Function URL** on `newsRecommend` (AuthType NONE — auth is the Firebase JWT in-body, same as `newsSavedItems`), with **CORS** allowing the site origins (`globalperspective.net`, `www.`, `benben05059997.github.io`, `localhost:5173`).
- IAM: `newsRecommend` already needs `dynamodb:GetItem`/`UpdateItem` on `GlobalPerspectiveUserPrefs` (it does `UpdateCommand` for `cacheProfile`); confirm `GetItem` is allowed, add if not.
- Env: `USER_PREFS_TABLE` already referenced by the Lambda — confirm it's set in the deployed config.

---

## 4. Frontend wiring

- **`services/restProxy.js`** — add a `prefsRequest(action, payload)` mirroring `savedItemsRequest` (POST to `window.USER_PREFS_ENDPOINT`, `Authorization: Bearer <token>` via the existing `getAuthToken`), plus `fetchPrefs()` / `savePrefs(patch)` exports.
- **`hooks/usePreferences.js`** (new) — `{ prefs, loading, error, save(patch) }`; loads on mount when signed in; optimistic update + revert-on-error. Mirrors `useSavedItems`.
- **`components/Account.jsx`** — add the "Notifications" tab + a `NotificationsPanel` component (toggles + cadence + unsubscribe-all + honesty banner). Reuse `Account.css`.
- **`docs/config.js`** — **the user adds one line** (I never overwrite config.js):
  `window.USER_PREFS_ENDPOINT = '<newsRecommend Function URL>';`
  Until it's set, the tab shows the honesty banner and the toggles are disabled (no crash, no fake state).

---

## 5. Deploy steps (when approved + built)

**Backend:**
1. Update `newsRecommend` source (add the two actions), zip, `aws lambda update-function-code`.
2. Create the Function URL + CORS (`aws lambda create-function-url-config` + `update-function-url-config`), confirm IAM has Get/Update on the prefs table.
3. Grab the Function URL → give to the user for `docs/config.js`.
4. Smoke-test with a real Firebase JWT via `curl` (get_prefs returns defaults; set_prefs persists; re-get reflects it).

**Frontend (per `CLAUDE.md`):**
5. `npm run build` → copy `dist/` to `docs/` → `rm docs/assets/*.map` → **resync `docs/404.html`** byte-identical → never touch `docs/config.js`.
6. **Browser click-through** ([[feedback-test-ui-in-browser]]): toggle each control, reload, confirm persistence; signed-out state; error path. Only then commit.

---

## 6. Compliance — deferred to "email goes live" (not this build)
Double opt-in confirmation flow, one-click `List-Unsubscribe` (RFC 8058) endpoint, SPF/DKIM/DMARC on `globalperspective.net` (Resend domain verify), physical postal address in footer. The data model above already reserves the fields (`*Verified`, `unsubToken`) so the menu and the sender are ready when we wire delivery. See `NOTIFICATION_GAP_ANALYSIS.md` Part B.

## 7. Out of scope for v1
Per-region/per-category filters (the personalization path — add when there's demand), quiet hours (no push channel), channel selection (email only).

## 8. Verification checklist before commit
- [ ] `get_prefs`/`set_prefs` unit-or-curl tested against the deployed Lambda
- [ ] Function URL CORS verified from the site origin
- [ ] Toggles persist across reload (browser)
- [ ] Signed-out + error states are honest (no fake "subscribed")
- [ ] `docs/404.html` resynced; `docs/config.js` untouched
- [ ] CHANGES.md + ARCHITECTURE.md updated
