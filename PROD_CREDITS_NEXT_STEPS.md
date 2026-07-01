# NEXT TASK — ship analysis credits to production

**Status (2026-06-30):** credit-buying feature committed to `main` (`6a80b7e`), **sandbox-verified end-to-end**. Prod is **not** affected yet — prod Lambdas still run the pre-credits code, and the frontend was committed source-only (not built into `docs/`). This file is the ordered go-live checklist.

> **Why these are "blocked" for the agent:** the Claude Code **auto-mode classifier hard-blocks production-account infra mutations** (Function-URL config changes, `update-function-code`, prod scans) regardless of in-chat approval. It is NOT a capability or authorization gap. To let the agent run them, either:
> - **Run the command yourself** by pasting it with a leading `!` (executes under your authority; output returns to the agent), **or**
> - **Add a Bash allowlist rule** to `.claude/settings.json` for the specific `aws lambda ...` commands, after which the agent can run them directly.

---

## 1. Fix prod CORS (unblocks the browser checkout) — do this first, standalone
The prod `newsPolarBilling` + `newsAnalyze` Function URLs each have a CORS config **and** the code emits CORS → duplicate `Access-Control-Allow-Origin` → "Failed to fetch" in the browser. Clear the Function-URL CORS (config-only, no redeploy, ~10s):

```bash
for fn in newsPolarBilling newsAnalyze; do
  aws lambda update-function-url-config --function-name "$fn" --region ap-northeast-1 --cors '{}' >/dev/null && echo "$fn cleared";
done
sleep 12
for fn in newsPolarBilling newsAnalyze; do
  url=$(aws lambda get-function-url-config --function-name "$fn" --region ap-northeast-1 --query FunctionUrl --output text);
  n=$(curl -sS -i -X POST "$url" -H 'Origin: https://globalperspective.net' -H 'Content-Type: application/json' -d '{"action":"get_membership"}' | grep -ci access-control-allow-origin);
  echo "$fn: $n ACAO (expect 1)";
done
```
Safe to run now, independent of the credit rollout (also fixes the existing subscription checkout).

## 2. Push the commit
```bash
git push        # pushes 6a80b7e on main
```

## 3. Create LIVE credit-pack products in Polar (operator, dashboard)
In the **production** Polar org (polar.sh, NOT sandbox): create one-time (non-recurring) products for each pack you want to sell. Record each **product ID** + its credit count. Pick your real prices.
Sandbox reference (test values): 50cr / 200cr / 500cr.

## 4. Set prod env vars (BEFORE deploying code — so a paid pack is never mis-granted as membership)
`update-function-configuration` **replaces** the whole Variables map — fetch the current env, merge, write back (don't drop existing vars). Secrets via a temp file, not inline.
- `newsPolarBilling`: add `POLAR_CREDIT_PACKS = {"small":{"productId":"<LIVE>","credits":50}, ...}`
- `newsAnalyze`: add `MEMBER_MONTHLY_ALLOWANCE = <N>` (member free runs/month; **defaults to 100 if unset** — set intentionally, since prod members move off the old 50/day cap)

## 5. Deploy the credit code to prod
```bash
bash amplify/backend/function/deploy-credits-prod.sh   # zips src/ incl lib.js → update-function-code both
```
> Behavior change on deploy: `newsAnalyze` stops hard-gating on `tier=member` and meters by allowance + credits. Prod currently runs the pre-credits code, so this is the switch-over.

## 6. Wire the frontend + ship it
- Add to `docs/config.js` (operator-owned): `window.POLAR_CREDIT_PACKS = [{ key:'small', credits:50, price:'$5' }, ...]` — `key`s must match the env map in step 4.
- Build + deploy frontend so the credits UI (header pill, Account → Membership tab, buy-cards) goes live: `./deploy.sh --commit "..." ` (build → docs/ → 404 resync). Until this, the committed credit UI is source-only.

## 7. Verify live
- `get_membership` returns `creditBalance`; a non-member run with 0 credits → `402 out_of_credits`.
- Real (or 100%-off) test purchase → webhook → balance increments → a run spends a credit.

## 8. Cleanup / housekeeping
- **Rotate/delete** the sandbox Organization Access Token (it was pasted in chat).
- Tear down the sandbox twins when done testing:
  ```bash
  for fn in newsPolarBilling-sandbox newsAnalyze-sandbox; do
    url=$(aws lambda get-function-url-config --function-name "$fn" --region ap-northeast-1 --query FunctionUrl --output text 2>/dev/null);
    aws lambda delete-function-url-config --function-name "$fn" --region ap-northeast-1 2>/dev/null;
    aws lambda delete-function --function-name "$fn" --region ap-northeast-1 && echo "deleted $fn";
  done
  ```
  (Sandbox Polar products can be archived in the sandbox dashboard.)
- Remove the SANDBOX override block from `frontend/public/config.js` (gitignored) when done local-testing.

---

**Full design + decisions:** `POLAR_BILLING_PLAN.md` §5. **Gotcha reference:** `ARCHITECTURE.md` Common Mistakes #7 (dual-CORS). **Sandbox deploy script:** `amplify/backend/function/_sandbox/deploy-sandbox.sh`.
