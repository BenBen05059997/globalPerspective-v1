# newsPolarBilling

Polar.sh billing on one Function URL. A POST with a `webhook-signature` header is a Polar webhook (Standard-Webhooks HMAC, 5-minute replay window): `subscription.*` sets `tier` member/free from status; `order.paid`/`order.created` tops up credits for a known credit pack (idempotent via `processedOrders`), grants member for a known subscription product, and grants nothing for an unknown product. Otherwise a Firebase-JWT action: `create_checkout` (subscription plan or credit `pack`; uid sent as `customer_external_id`) and `get_membership`. Credits are parked: `project-docs/decisions/0002-analysis-credits-parked.md`.

## Deployment
- Deployed name `newsPolarBilling` · runtime `nodejs20.x` · group `membership-studio` (scripts/functions.json)
- Trigger: Function URL (Polar webhook + frontend via `window.POLAR_BILLING_ENDPOINT`, read in `shared/hooks/useMembership.js` and `shared/api/restProxy.js`); no schedule
- Deploy: `scripts/lambda.sh newsPolarBilling diff|package|deploy` (billing code/config needs a fresh operator "yes" per CLAUDE.md). Zip does not ship node_modules; must include `lib.js`.
- Sandbox: `backend/membership-studio/_sandbox/deploy-sandbox.sh` stands up separate `-sandbox` copies against the Polar sandbox API.

## Reads / writes
- DynamoDB: `USERS_DDB_TABLE`, key `uid` (Firebase UID); writes `tier`, `subscriptionStatus`, `billingProvider`, `polarCustomerId`, `polarSubscriptionId`, `currentPeriodEnd`, `creditBalance`, `processedOrders`
- External APIs: `POLAR_API_BASE` (default `api.polar.sh`) `/v1/checkouts/`; Google securetoken x509 certs (JWT verify)
- Env names: `FIREBASE_PROJECT_ID`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_MONTHLY`, `POLAR_PRODUCT_YEARLY`, `POLAR_CREDIT_PACKS` (JSON pack key -> productId + credits; unset = no packs), `SITE_URL`, `CORS_ORIGINS`

## Gotchas
- Billing is sensitive: document only; code, env, and Polar config changes need operator authorization. Credits are parked.
- CORS: code emits `Access-Control-Allow-Origin` (allow-list from `CORS_ORIGINS` or built-in defaults), so the Function-URL CORS config must stay empty.
- Product IDs and credit amounts are server-side env; the client only names a plan or pack key.

## Tests
- `cd backend/membership-studio/newsPolarBilling/src && npm test` (`node --test ../test/lib.test.js`, offline). DynamoDB conditional writes are not covered.
