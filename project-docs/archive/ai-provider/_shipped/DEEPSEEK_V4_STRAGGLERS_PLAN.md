# DeepSeek V4 — straggler cleanup + hardening (2026-07-27)

Closes the last gaps left by the 2026-07-26 fleet migration (`project_ai_provider_migration`,
main `8f6c82f`). Three DeepSeek consumers were never migrated; two defensive fixes ride along.

## Why now — the alias is not a fix

`deepseek-chat` was hard-retired 2026-07-24 (API 400, ~36h silent fleet outage). As of
2026-07-27 it **answers again**, but as an alias: the response body echoes
`"model": "deepseek-v4-flash"`. So the stragglers work **by DeepSeek's grace, not by design**.

Two independent reasons to finish the job:

1. **The alias can be withdrawn again with no warning.** It already was once, and the failure
   mode is silent — these functions catch LLM errors and exit 200, so CloudWatch `Errors`
   stays `0.0`. Detection would again fall to the freshness monitor (which only watches
   `topics`, not `/daily` or dossiers).
2. **They run V4 with thinking ON.** No `thinking:{type:'disabled'}` in either deployed zip,
   so invisible `reasoning_content` burns their `max_tokens` budget (800 / 2000). This is the
   exact mechanism that truncated clustering to 1 topic on 07-26.

## Scope

| # | Target | Change | Deploy? |
|---|---|---|---|
| 1 | `newsSensitiveData-dev` | `thinking:disabled` + code default → `deepseek-v4-flash`; env flip | **yes** |
| 2 | `newsPostDevTo` | `thinking:disabled`; env flip | **yes** |
| 3 | `newsInvokeGemini-dev` | `BRAVE_CONCURRENCY=1` | env only |
| 4 | `newsPolarBilling` | webhook allow-list guard (parked credits code) | **no — repo only** |
| 5 | repo root | `.gitignore` for stray zips | **no** |

Out of scope: `newsAnalyze-sandbox` (off every request path; `deploy-sandbox.sh` rebuilds it).

## Packaging — verified before touching anything

`repo src/index.js === deployed index.js` byte-for-byte for **both** targets, so there is no
drift trap here (unlike `newsAnalyze`, whose repo file still carries the parked credits code —
see `PROD_CREDITS_NEXT_STEPS.md`). Their zips differ in shape, so both use the
**patched-deployed-zip** method: extract the live zip, overwrite `index.js` with the patched
repo file, re-zip. Everything else stays byte-identical to what is running.

| Function | Deployed zip shape |
|---|---|
| `newsSensitiveData-dev` | 5 files, **no** `node_modules` (`index.js`, `dossier.js`, `lib.js`, `package*.json`) — `dossier.js`/`lib.js`/`package.json` verified identical to repo |
| `newsPostDevTo` | 4511 files, **bundles** `node_modules` (8.3 MB) + `buildDailySummary.js` — must NOT be zipped from repo src |

## Order is load-bearing

**Code first, env second.** A plain env flip was tried 2026-06-12 on 9 Lambdas and *regressed*
them (V4 IDs default to thinking → `reasoning_content` breaks JSON parsing;
`newsEconomicImpact` went `0 failed` → `5 failed`). Patch, deploy, verify, *then* flip.

Env writes are **merge-don't-clobber**: `update-function-configuration` replaces the whole
Variables map — fetch current, change one key, write back via a temp file.

## Steps

1. Patch `newsSensitiveData/src/index.js`: add `thinking: { type: 'disabled' }` to the
   `analyzeDossierWithLLM` body, and change `DOSSIER_LLM_MODEL`'s fallback from
   `'deepseek-chat'` → `'deepseek-v4-flash'` (it is double-exposed: env *and* code default).
2. Patch `newsPostDevTo/src/index.js`: same one-liner in `callGrok`'s body.
3. Build both zips via patched-deployed-zip; `update-function-code`.
4. Flip `GROK_MODEL` → `deepseek-v4-flash` on both (merged).
5. Set `BRAVE_CONCURRENCY=1` on `newsInvokeGemini-dev` (merged).
6. Repo-only: `newsPolarBilling` webhook guard + `.gitignore`.
7. Verify (below), then commit + push.

## Verification

- `dossier_analysis` — POST via the public proxy with a **real graph node** (`systems_analysis`
  → `nodes[0].threadId`; an arbitrary topic threadId returns "Focal thread not found in this
  graph", which is a data mismatch, not an LLM failure). Expect a multi-paragraph analyst read.
- `newsPostDevTo` — direct `lambda invoke`; expect `[DAILY_BRIEF] Stored for <date>: "<headline>"`.
- Deployed-bytes recheck: both zips contain the `thinking` line; `GROK_MODEL` reads
  `deepseek-v4-flash`.
- Brave: next `newsInvokeGemini-dev` cycle should show fewer `failed: 429` and more than the
  current 10 Brave articles (baseline 2026-07-27: 18×429, `153 RSS + 10 Brave`).

## Not deployed by this plan

`newsPolarBilling`'s guard is written into the repo file **only**. That file also carries the
parked credits code, which must not reach prod until `PROD_CREDITS_NEXT_STEPS.md` runs (env
`POLAR_CREDIT_PACKS` **before** code, or a credit-pack order is mis-granted as a membership).
The guard makes that ordering non-fatal rather than replacing it: an unrecognized product id
now logs loudly and grants nothing, instead of falling through to `tier:'member'`.

No frontend source changes → **no `./deploy.sh`, no `docs/` rebuild** in this plan.
