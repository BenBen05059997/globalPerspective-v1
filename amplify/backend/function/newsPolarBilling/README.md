# newsPolarBilling — deploy & configure

Single Lambda (Function URL) that runs the Polar.sh billing integration. Plan: [`../../../../POLAR_BILLING_PLAN.md`](../../../../POLAR_BILLING_PLAN.md).

Three jobs on one Function URL:
1. **Polar webhook** (POST, Standard-Webhooks signature) → grants/revokes `tier=member` in `USERS_TABLE`.
2. **`create_checkout`** (Firebase JWT) → creates a Polar Checkout Session for the signed-in user, returns `{ url }`.
3. **`get_membership`** (Firebase JWT) → returns `{ tier, status, currentPeriodEnd }`.

> ⚠️ **Do NOT enable live selling / flip the Polar product to live until the public-content gating is built** — today all content is public, so a subscriber would pay for what's free. This Lambda is the plumbing; gating `newsSensitiveData` is the deliberate next step.

## Env vars

| Var | Value | Notes |
|-----|-------|-------|
| `USERS_DDB_TABLE` | the Users table name | PK `uid` (Firebase UID). Re-used from the dormant billing era. |
| `FIREBASE_PROJECT_ID` | your Firebase project id | JWT verification (same value the other Lambdas use). |
| `POLAR_ACCESS_TOKEN` | `polar_oat_…` | **secret.** Org access token (Polar → Settings → Developers). `checkouts:write` scope. |
| `POLAR_WEBHOOK_SECRET` | `whsec_…` | **secret.** From the webhook endpoint you create in Polar (below). |
| `POLAR_PRODUCT_MONTHLY` | `e53eeb9a-4e2e-4b33-9c18-f0e779c07677` | Membership monthly ($15). |
| `POLAR_PRODUCT_YEARLY` | `cd375325-0fd2-4223-8b10-8e02d50798fd` | Membership yearly ($150). |
| `POLAR_API_BASE` | `https://api.polar.sh` | Use `https://sandbox-api.polar.sh` to test against Sandbox. |
| `SITE_URL` | `https://globalperspective.net` | success redirect base. |
| `CORS_ORIGINS` | (optional) | Comma list; sensible site defaults baked in. |

Secrets go in plaintext Lambda env vars (the project's chosen secret store — see `feedback-no-secrets-manager`). Never commit them.

## Create the Lambda (AWS CLI sketch)

```bash
cd amplify/backend/function/newsPolarBilling/src
npm install            # bundles @aws-sdk v3 (or rely on the nodejs20.x runtime's built-in)
zip -r ../deploy.zip . >/dev/null

aws lambda create-function \
  --function-name newsPolarBilling \
  --runtime nodejs20.x --handler index.handler --timeout 15 --memory-size 256 \
  --role <an-exec-role-with-the-policy-below> \
  --zip-file fileb://../deploy.zip --region ap-northeast-1

# Public Function URL (Polar posts here unauthenticated; we verify the signature in code)
aws lambda create-function-url-config --function-name newsPolarBilling \
  --auth-type NONE --region ap-northeast-1 \
  --cors '{"AllowOrigins":["https://globalperspective.net","https://www.globalperspective.net","https://benben05059997.github.io","http://localhost:5173"],"AllowMethods":["POST"],"AllowHeaders":["content-type","authorization","webhook-id","webhook-timestamp","webhook-signature"]}'
aws lambda add-permission --function-name newsPolarBilling \
  --action lambda:InvokeFunctionUrl --principal '*' \
  --function-url-auth-type NONE --statement-id fnurl --region ap-northeast-1
```

Set env vars with `aws lambda update-function-configuration --environment '{"Variables":{...}}'` (pass secrets via a temp file, never inline on the command line).

### IAM policy (minimal)
`dynamodb:GetItem` + `dynamodb:UpdateItem` on the `USERS_DDB_TABLE` ARN. (No table create needed — the Users table already exists from the billing era.)

## Wire it into Polar
1. **Webhook:** Polar → Settings → Webhooks → **Add endpoint** = the Function URL. Format **Raw**. Subscribe to: `subscription.created`, `subscription.updated`, `subscription.active`, `subscription.canceled`, `subscription.revoked`, `order.paid`. Copy the **signing secret** → `POLAR_WEBHOOK_SECRET`.
2. **Access token:** Polar → Settings → Developers → new Organization Access Token → `POLAR_ACCESS_TOKEN`.

## Wire it into the frontend
Set `window.POLAR_BILLING_ENDPOINT = '<Function URL>'` in `docs/config.js` (same place as the other endpoints). The frontend `services/polar.js` reads it; the Membership UI stays hidden until it's set.

## Test (Sandbox first)
- Point `POLAR_API_BASE` at `https://sandbox-api.polar.sh`, create matching Sandbox products, use Polar test cards.
- Polar's onboarding "test with a 100% discount code" satisfies the product-verification step: create a 100%-off code, run the full unpaid → checkout → `subscription.created` webhook → `tier=member` flow.
