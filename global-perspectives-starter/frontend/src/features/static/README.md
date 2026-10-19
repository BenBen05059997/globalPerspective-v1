# static

Mostly hand-written content pages: About, Contact, Disclosures, Privacy & Terms and the White Paper.
Copy lives inline in each JSX file with inline styles. Only the About page fetches data, to say
whether analysis is paused.

## Routes
- `/about` -> `AboutContact`
- `/contact` -> `Contact`
- `/disclosures` -> `Disclosures`
- `/privacy` -> `PrivacyTerms`
- `/whitepaper` -> `WhitepaperPage`

## Entry files
- `AboutContact.jsx` - what the site does, how it works, source outlet list, contact email
- `Contact.jsx` - contact cards (general, account/data, partnerships), all mailto links
- `Disclosures.jsx` - AI-content disclaimer, liability, sources, economy analysis, access & pricing
- `PrivacyTerms.jsx` - data collection, storage, third parties, account deletion, liability
- `WhitepaperPage.jsx` - product white paper, Parts I-VI (local `Section`/`SubSection` helpers)

## Data
- `AboutContact` only: `useDailyBrief()` (latest brief, restProxy `latest_daily_brief`) feeds
  `pausedSince()` from `@/shared/lib/freshness` to render a computed "paused since" sentence.
- Other pages make no requests.

## Shared blocks used
- None (`@/shared/lib/freshness` is the only shared import).

## Public API (`index.js`)
- None: no `index.js`; nothing outside this folder imports it (route pages load lazily by path from `app/App.jsx`).

## Imports from other features
- None. From shared: `@/shared/hooks/useDailyBrief` -> `useDailyBrief`, `MAX_LOOKBACK_DAYS` (AboutContact)

## Gotchas
- About wording must not claim fixed rates ("every hour", "hundreds of articles daily"); it says
  "when the pipeline runs" (F4, review R2). `__tests__/aboutContact.test.jsx` locks this.
- All pages are lazy-loaded route chunks (`lazy()` in src/app/App.jsx).
- Policy and disclosure copy is legal text: changes are an operator decision.

Last verified: 2026-10-19
