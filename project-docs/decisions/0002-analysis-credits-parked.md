# 2. Analysis credits are parked

Status: accepted
Date: 2026-07-06

## Context
A credit-buying feature for the Analysis Studio was committed (`6a80b7e`) and verified end-to-end
in the sandbox on 2026-06-30. Production Lambdas still ran the pre-credits code.

## Decision
We will not ship analysis credits to production. The go-live checklist is parked and runs only
after a fresh operator go-live decision.

## Consequences
- The repo copy of `newsAnalyze` carries the parked credits code and differs from the deployed
  zip; never deploy the repo file over it without that decision.
- Billing and credits code or config need a fresh operator "yes" (CLAUDE.md, Authorization).
- Site copy must not promise credits.

Source: `project-docs/archive/billing/_proposed/PROD_CREDITS_NEXT_STEPS.md`; `CLAUDE.md`
