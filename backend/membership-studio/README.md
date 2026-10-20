# membership-studio

This group holds the paid side of the site: the member-only Analysis Studio run (`/analyze`) and Polar billing that
makes someone a member. It serves signed-in members. Credits are parked, so the live studio and the live billing
function run older code than the credits code in this repo.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → 4 One reader → 5 Timeline → 6 Views → **7 Delivery** → 8 Watch
This folder is stage 7: billing (Polar) and the retired Studio Lambda. Timeline: writes no events; reads none. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsAnalyze | Checks the Firebase token and the member tier, runs the user's message against DeepSeek, returns a Markdown report. | Function URL, no schedule | GlobalPerspectiveUserTable (`uid`: `tier`, daily counter); Google signing certs; DeepSeek | UserTable daily counter fields | [README](newsAnalyze/README.md) |
| newsPolarBilling | Creates Polar checkout sessions, reports membership, and applies Polar webhooks. | Function URL, no schedule | UserTable; Polar API; Google signing certs | UserTable (`tier`, `subscriptionStatus`, Polar ids, period end) | [README](newsPolarBilling/README.md) |
| newsAnalyze-sandbox, newsPolarBilling-sandbox | Test twins pointed at Polar's sandbox API; no repo source folder. | Function URL | UserTable | UserTable | none; made by `_sandbox/deploy-sandbox.sh` |

## Pipeline

1. A signed-in visitor opens `/membership` and picks a plan. The page calls newsPolarBilling `create_checkout` (`window.POLAR_BILLING_ENDPOINT`) and is sent to Polar to pay.
2. Polar posts a signed webhook to the same Function URL. newsPolarBilling verifies the signature and sets `tier` to member or free on the user's row.
3. The page calls `get_membership` to show the tier. Other Lambdas (newsSensitiveData-dev, newsRecommend) read `tier` from the same row to cap depth or allow follows.
4. A member on `/analyze` sends a run to newsAnalyze (`window.NEWS_ANALYZE_ENDPOINT`). The deployed code refuses non-members (403), applies a per-day cap, calls DeepSeek, and returns the report.
5. Sharing a finished run is a separate Lambda, newsSharedAnalysis, in the read-api group.

## Shared code

- None of these Lambdas uses `backend/shared/src`. See the [shared README](../shared/README.md) for what exists.

## Known limits

- Deploy of newsAnalyze is blocked in `scripts/functions.json`. The live zip is the prompt-patched pre-credits build, kept byte-for-byte in `newsAnalyze/deployed-snapshot/`. The repo `src/` carries parked credits code and meters by monthly allowance plus credits instead.
- Live newsAnalyze env has `ANALYZE_DAILY_CAP` set; the repo source does not read it.
- Billing code, env and Polar config change only with a fresh operator yes. The live newsPolarBilling matches the repo package.
- newsAnalyze and newsPolarBilling emit their own CORS headers, so their Function-URL CORS must stay empty; live it is.
- `deploy-credits-prod.sh` in this folder would push the credits code to production. Do not run it without a go-live decision.
- `_sandbox/` holds `deploy-sandbox.sh`, which creates the two `-sandbox` Lambdas; both exist live.

## How to check it

```
scripts/lambda.sh newsAnalyze diff
scripts/lambda.sh newsPolarBilling diff
aws lambda get-function-url-config --function-name newsAnalyze --region ap-northeast-1 --query 'Cors'
aws dynamodb describe-table --table-name GlobalPerspectiveUserTable --region ap-northeast-1 --query 'Table.[KeySchema,BillingModeSummary]'
```

Last verified: 2026-10-20 against code @14dd450d and live AWS.
