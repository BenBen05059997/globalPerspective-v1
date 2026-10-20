# static

Hand-written content pages: About, Contact, Disclosures, Privacy & Terms and the White Paper. Readers use
them to learn what the site does, how to reach the operator, and the legal and AI-content terms. Copy lives
in each JSX file; layout comes from the `StaticPage` shell and `StaticPage.css`. Only the About page fetches
data, to say whether analysis is paused.

Timeline: writes none; reads the daily brief only; not a timeline view. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

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
  economy is parked), accuracy and bias, access and pricing, affiliate links; `PrivacyTerms.jsx` - privacy and terms
- `WhitepaperPage.jsx` - white paper Parts I-VI; uses the `sp-*` classes without the outer shell (local helpers)
- Public API: no `index.js`; only `app/App.jsx` (and `app/__tests__/routes.test.jsx`) import the pages by path.
- Imports from other features: none. Shared: `ui/Card`, `ui/SectionHeader`, `ui/Button`, `hooks/useDailyBrief`,
  `lib/freshness`, `lib/links.js` (`ROUTE`, used by Disclosures).
- About wording must not claim fixed rates ("every hour"); it says "when the pipeline runs". `__tests__/aboutContact.test.jsx` locks this.

## Backend
- Generated row: [reference/features.md#static](../../../../../project-docs/reference/features.md#static); no Lambda lists this feature.
- About reads the daily brief written by `newsPostDevTo` (scheduler `InvokeDev`, see the runbook below), served by
  `newsSensitiveData-dev` ([read-api guide](../../../../../backend/read-api/README.md)).

## Data
- `AboutContact` only: `useDailyBrief()` -> restProxy `latest_daily_brief`, fed to `pausedSince()` with
  `lookbackDays: MAX_LOOKBACK_DAYS` to render "analysis paused since <date>". Public, no sign-in; the hook caches in
  localStorage `gp_daily_brief_v1`.
- The other pages make no requests.

## Pipeline
1. `app/App.jsx` lazy-loads the page chunk for the route on first visit.
2. Four pages are plain JSX: the copy is the content, wrapped by `StaticPage` and styled by `StaticPage.css`.
3. About also runs `useDailyBrief`: `restProxy.js` posts `latest_daily_brief` to the proxy.
4. `newsSensitiveData-dev` batch-reads the newest `DAILY_BRIEF#<date>` row from `SummarizeAndPredict` (written daily by `newsPostDevTo`).
5. `pausedSince` (`shared/lib/freshness.js`) gets the brief's `generatedAt`: null when it is under 36 hours old, else "analysis paused since <date>"; with no brief found after a finished search, "no analysis in the last 30 days" (`MAX_LOOKBACK_DAYS`).
6. `AboutContact` renders that text as the paused note.

## Docs
- Legal notes: `internal-docs/LEGAL_NOTES.md` (operator-owned; copy changes need the operator).
- Runbook for the brief behind the paused note: [daily-brief.md](../../../../../project-docs/runbooks/daily-brief.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/static src/app/__tests__/routes.test.jsx`
- Pages served: `for p in about contact disclosures privacy whitepaper; do curl -s -o /dev/null -w "$p %{http_code}\n" https://globalperspective.net/$p; done`
- Paused-note input (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"latest_daily_brief","payload":{"lookbackDays":30}}' | head -c 300`

Last verified: 2026-10-20
