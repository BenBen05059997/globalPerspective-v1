# Paddle Setup — Global Perspectives

**Status:** ❌ OBSOLETE — Paddle was fully removed 2026-06-01. We are moving to **Polar.sh**.
**Last updated:** 2026-04-11 · **Banner added 2026-06-10**

> 🛑 **OBSOLETE — do not follow these steps.** The entire Paddle stack (`newsStripeWebhook` Lambda + Function URL + IAM role, the `portal_session`/`user_profile` proxy actions, and the frontend billing UI) was **deleted by 2026-06-01**. Paddle is not the payment provider going forward. The replacement is **Polar.sh** (Merchant of Record) — see the live spec **[`POLAR_BILLING_PLAN.md`](./POLAR_BILLING_PLAN.md)**. This file is kept only as a record of the previous integration's shape.

---

## Why Paddle

Stripe rejected/ignored the Global Perspectives account application. Paddle was chosen as the replacement because:
- Acts as Merchant of Record — handles VAT, JCT (Japan Consumption Tax), and all tax compliance globally
- Supports individual sellers based in Japan
- Pays out in USD (convert via Wise)
- Same fee structure as Stripe (~5% + $0.50)
- No merchant account setup or tax registration required

---

## Registration Form — Answers Submitted

| Field | Answer |
|---|---|
| Product type | Productivity Software |
| How product is delivered | Web app / Online service (accessed via browser) |
| Product description | See below |
| Expected annual revenue | $100 |
| Age of business | (submitted — pre-launch) |
| Product page | https://globalperspective.net/ |
| Pricing page | https://globalperspective.net/pricing |
| Policy pages — T&Cs | https://globalperspective.net/privacy |
| Policy pages — Refund Policy | https://globalperspective.net/disclosures |
| Policy pages — Privacy | https://globalperspective.net/privacy |

### Product Description (submitted)

> Global Perspectives is a web-based SaaS platform that delivers AI-powered global news intelligence through a subscription model. The platform aggregates news from hundreds of RSS feeds and web sources, then uses large language models (xAI Grok) to generate structured analysis including topic summaries, narrative thread tracking, story arc predictions, root-cause analysis, and country-level risk briefings.
>
> Users access the platform at globalperspective.net. The Free tier provides today's top global topics and an interactive world map. The Member tier ($15/month) unlocks 7-day narrative archives, thread intelligence, country briefings, and weekly map playback. An Enterprise tier is available for teams requiring 30-day archive depth and priority access.
>
> The platform serves analysts, researchers, journalists, business professionals, and policy-focused individuals who need to track how global stories evolve over time. All content is AI-generated and provided for informational purposes only. Payments are processed by Paddle as Merchant of Record.

---

## Setup Checklist — Status (2026-04-11)

- [x] Create **Member** product in Paddle dashboard ($15/month recurring)
- [x] Create **Enterprise** product (custom price, contact-based)
- [x] Get checkout URL for Member product
- [x] Set `window.PADDLE_CHECKOUT_URL` in `docs/config.js`
- [x] Add Paddle webhook endpoint → Lambda API Gateway URL for `newsStripeWebhook`
- [x] Set `PADDLE_WEBHOOK_SECRET` env var on `newsStripeWebhook` Lambda
- [x] Set `PADDLE_API_KEY` env var on `newsSensitiveData` Lambda
- [x] Set `USERS_DDB_TABLE` env var on `newsSensitiveData` Lambda
- [x] Set `FIREBASE_PROJECT_ID` env var on `newsSensitiveData` Lambda
- [x] Test checkout flow end-to-end (sign in → upgrade → webhook → tier update)
- [x] Test Customer Portal link from `/account`

> **Note:** The `/pricing` route has been removed from the frontend during early access. `Pricing.jsx` remains in the codebase but is not rendered. Billing will be reactivated by adding back the route and removing early-access overrides.

---

## Code Changes Already Made (Paddle Migration)

### `amplify/backend/function/newsStripeWebhook/src/index.js`
Rewritten for Paddle. Handles:
- `subscription.created` — writes tier + paddleCustomerId + paddleSubscriptionId to USERS_TABLE
- `subscription.updated` — updates tier on plan change
- `subscription.canceled` — downgrades to free tier

Signature verification: HMAC-SHA256 of `${ts}:${rawBody}` using `PADDLE_WEBHOOK_SECRET` env var.
Reads `uid` from `data.custom_data.uid` (passed via checkout URL params).

### `amplify/backend/function/newsStripeWebhook/src/package.json`
Removed `stripe` dependency (uses Node built-in `crypto`).

### `global-perspectives-starter/frontend/src/components/Pricing.jsx`
`buildCheckoutUrl()` reads `window.PADDLE_CHECKOUT_URL` and appends:
- `checkout[custom][uid]={uid}`
- `customer[email]={email}`

### `amplify/backend/function/newsSensitiveData/src/index.js`
- `portal_session` action: Firebase JWT → get `paddleCustomerId` from DDB → call Paddle auth-token API → return portal URL
- `user_profile` action: Firebase JWT → DDB lookup → return tier/status/trial info
- Firebase JWT verification: Node `crypto` + Google public key fetch (no firebase-admin)
- New env vars needed: `USERS_DDB_TABLE`, `FIREBASE_PROJECT_ID`, `PADDLE_API_KEY`

---

## Disclosures Page Updates (2026-03-21)

Updated `Disclosures.jsx` to reflect Paddle:
- Free trial: 14 days, no credit card required
- Enterprise: "Contact us for pricing" (no fixed price listed)
- Payment Processing: Paddle as MoR, handles VAT/taxes globally
- Cancellation: generic "Customer Portal" (not Stripe-specific)
