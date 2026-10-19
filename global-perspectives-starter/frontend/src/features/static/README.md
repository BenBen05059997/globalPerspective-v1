# static

Hand-written content pages: About, Contact, Disclosures, Privacy & Terms and the White Paper. Copy
lives in each JSX file; layout comes from the `StaticPage` shell and `StaticPage.css` (no inline
styles). Only the About page fetches data, to say whether analysis is paused.

## Status
- Live, public. No feature flag. Policy and disclosure copy is legal text: changes are an operator decision.

## Routes
- `/about` -> `AboutContact` · `/contact` -> `Contact` · `/disclosures` -> `Disclosures`
- `/privacy` -> `PrivacyTerms` · `/whitepaper` -> `WhitepaperPage` (all lazy in `src/app/App.jsx`)

## Frontend
- `StaticPage.jsx` - the one shell: `StaticPage` (centred `Card` with title, optional lede; `width` `md`|`lg`) and
  `StaticSection` (prose block); styles in `StaticPage.css` (`sp-*` classes)
- `AboutContact.jsx` - what the site does, how it works, source outlets, contact email, computed "paused since" note
- `Contact.jsx` - contact cards (general, account/data, partnerships), all mailto links
- `Disclosures.jsx` - AI content, liability, data sources, economic disruption analysis (still shown although
  economy is parked), accuracy & bias, access & pricing, affiliate links; `PrivacyTerms.jsx` - privacy and terms
- `WhitepaperPage.jsx` - white paper Parts I-VI; uses the `sp-*` classes without the outer shell (local `Section`,
  `SubSection`, `Step`, `Capability` helpers)
- Public API: no `index.js`; only `app/App.jsx` (and `app/__tests__/routes.test.jsx`) import the pages by path.
- Imports from other features: none. Shared: `@/shared/ui/Card`, `SectionHeader`, `Button`;
  `@/shared/hooks/useDailyBrief`; `@/shared/lib/freshness`.
- About wording must not claim fixed rates ("every hour"); it says "when the pipeline runs". The test locks this.

## Backend
- Generated row: [reference/features.md#static](../../../../../project-docs/reference/features.md#static) — no Lambda
  lists this feature. About reads the daily brief that `newsPostDevTo` writes (see `features/daily`).

## Data
- `AboutContact` only: `useDailyBrief()` -> restProxy `latest_daily_brief`, fed to `pausedSince()` with
  `lookbackDays: MAX_LOOKBACK_DAYS` to render "analysis paused since <date>". Cache as in `features/daily`.
- The other pages make no requests.

## Docs
- Legal notes: `internal-docs/LEGAL_NOTES.md` (operator-owned; copy changes need the operator).
- Runbook for the brief behind the paused note: [daily-brief.md](../../../../../project-docs/runbooks/daily-brief.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/static src/app/__tests__/routes.test.jsx`
- Pages served: `for p in about contact disclosures privacy whitepaper; do curl -s -o /dev/null -w "$p %{http_code}\n" https://globalperspective.net/$p; done`
- Paused-note input (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"latest_daily_brief","payload":{"lookbackDays":30}}' | head -c 300`

Last verified: 2026-10-19
