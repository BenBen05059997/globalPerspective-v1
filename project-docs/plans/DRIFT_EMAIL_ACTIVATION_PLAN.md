# Drift Email Activation Plan — test ladder + flip procedure

**Status: READY TO EXECUTE (Layers 0–1 anytime; Layers 2–4 gated on the first real follower).**
**Written 2026-07-08.** Self-contained runbook for an executing agent — no prior session context assumed.
**Parents:** `EMAIL_SENDER_PLAN.md` (the sender), `MEMBER_GATING_PLAN.md` P5 (follow-country + drift audience). Architecture: `ARCHITECTURE.md` Lambda #29.

---

## 1. Context — what exists and what's off

The drift-alert email is the **last dark corner of the member-gating ship**: fully built, deployed, never sent. A daily cron should email members the "what changed" drift notes for countries they follow.

Live state (verified 2026-07-08 via AWS CLI — re-verify before executing, do not trust this table blindly):

| Piece | State |
|---|---|
| Send code — `newsEmailSender` `mode:'drift_alert'` (`runDrift` + `renderDriftEmail.js`) | ✅ deployed |
| Sender live-capable | ✅ `EMAIL_SEND_DRY_RUN=false` (weekly + breaking already send real mail; from `brief@globalperspective.net`, Resend domain verified) |
| Cron rule `TriggerDriftEmailSend` — `cron(40 7 * * ? *)` → payload `{mode:'drift_alert'}` | ❌ **DISABLED** (deliberate) |
| Drift subscribers (`GlobalPerspectiveUserPrefs` with `driftOptIn=true` + `followedCountries`) | **0** |

**Why 07:40 UTC:** 20 min after `TriggerDriftCorrector` (07:20) writes the day's `COUNTRY#/DRIFT#` notes. Do not change the time without preserving that ordering.

**Activation gate (operator decision 2026-07-08):** DISABLED is the *correct* state while there are 0 subscribers — enabling now wakes a Lambda daily to send nothing. Full flip (Layers 3–4) happens when the **first member follows a country** (or the operator opts to be that first follower to force the test).

## 2. How `runDrift` works (read before touching)

Source: `amplify/backend/function/newsEmailSender/src/index.js` (`runDrift`, ~line 242).

1. Scans `SUMMARY_TABLE` for **fresh** country drift notes: `begins_with(PK,'COUNTRY#') AND begins_with(SK,'DRIFT#') AND attribute_not_exists(emailedAt) AND generatedAt >= cutoff`.
2. Groups notes by country → **one email per country** batching that country's changes.
3. Audience per country = prefs rows with `driftOptIn=true AND email AND followedCountries` whose follow-set contains that country.
4. `TEST_RECIPIENT` env var, if set, **replaces the audience** for every country (send-to-self).
5. Real sends (`DRY_RUN=false`, `sent>0`) stamp each note `emailedAt` — **idempotency: a note is only ever emailed once.**

## 3. The test ladder (run in order; stop at any failure)

### Layer 0 — hermetic tests (no AWS, zero risk)
```bash
cd amplify/backend/function/newsEmailSender/src && node test-sender.js
```
Expect: all tests pass (28 at last count). Failure → stop, report.

### Layer 1 — live invoke as-is (zero side effects, runnable TODAY)
```bash
aws lambda invoke --function-name newsEmailSender \
  --payload '{"mode":"drift_alert"}' --cli-binary-format raw-in-base64-out /tmp/drift-out.json
cat /tmp/drift-out.json
```
With 0 subscribers this is **guaranteed side-effect-free**: every country resolves 0 followers → `sent:0` → the `emailedAt` stamp never fires (stamps only when `sent>0`).
Expect: `{ok:true, mode:'drift_alert', countries:N, subscribers:0, sent:0, perCountry:[{country, notes, followers:0, sent:0}...], dryRun:false}`.
This proves the scan/group/audience pipeline against live data. `countries:0` is also a PASS if no fresh drift exists today (honest-empty).

### Layer 2 — send-to-self (real email; gated: needs operator "go" in-message)
1. **Merge-don't-clobber env** (⚠️ `update-function-configuration` REPLACES the whole Variables map — `ARCHITECTURE.md` Common Mistakes / [[feedback_lambda_function_url_cors]] discipline): fetch current env with `aws lambda get-function-configuration --function-name newsEmailSender`, add `TEST_RECIPIENT=<operator email>` to the fetched map, write the merged map back via a temp JSON file (never inline secrets).
2. Invoke as in Layer 1. Expect one real email **per drifted country** to the operator inbox. Verify: subject, country name, drift-note content, site links, unsubscribe footer renders (token-less in test mode is expected — `TEST_RECIPIENT` recipients carry `token:null`).
3. **REMOVE `TEST_RECIPIENT` immediately** (same merge dance, delete the key).

⚠️ Hazards, both time-boxed by doing this in one sitting:
- **The env is shared with weekly/breaking modes.** The breaking cron fires every 15 min — while `TEST_RECIPIENT` is set, a real breaking alert would redirect to the operator instead of subscribers. Set → test → remove within minutes.
- **Real sends stamp `emailedAt`** — the tested notes are burned for future subscriber sends. Harmless at 0 subscribers; do NOT run Layer 2 on a day a real subscriber is waiting on that day's note.

### Layer 3 — real path end-to-end (needs a real follower)
1. Operator (or first member) signs in as member → 🔔 Follow on a country with a **recent** "What changed" band (fresh drift note not yet emailed) → Account page shows it under "Country change-alerts".
2. No `TEST_RECIPIENT`. Invoke as in Layer 1.
3. Expect email only for the followed country, with a working per-user unsubscribe link (kind=`drift` on `newsRecommend`). Click-test unsubscribe → `driftOptIn` flips false → re-opt-in afterwards if continuing.

### Layer 4 — flip the switch
```bash
aws events enable-rule --name TriggerDriftEmailSend
aws events describe-rule --name TriggerDriftEmailSend --query State   # → "ENABLED"
```
Next morning (07:40 UTC) check CloudWatch logs `/aws/lambda/newsEmailSender` for the `[email:drift]` line: note count, subscriber count, `DRY_RUN=false`, `sent` matches expectation, no errors.

**Rollback (any point, instant, no deploy):**
```bash
aws events disable-rule --name TriggerDriftEmailSend
```

## 4. Execution rules for the agent

- Every AWS mutation = a **bare single `aws` command** (no `for` loops / command chaining around mutations — loops defeat the permission allowlist; [[feedback_prod_aws_deploy_classifier]]).
- Layers 0–1: standing authorization, run freely. Layers 2–4: each needs a fresh explicit operator "yes" in the current conversation (real mail / env mutation / cron enable).
- Never touch `EMAIL_SEND_DRY_RUN` as a test mechanism — flipping it globally silences the LIVE weekly/breaking products. `TEST_RECIPIENT` is the sanctioned test lever.
- Report honest-empty honestly: `countries:0` (no fresh drift) or `sent:0` (no followers) are correct outcomes, not failures to paper over.
- After Layer 4, update: `MEMBER_GATING_PLAN.md` (P5 ⚠️-disabled note), `ARCHITECTURE.md` (banner ⚠️ + Lambda #29 + EventBridge table `TriggerDriftEmailSend` DISABLED→ENABLED), `CHANGES.md`, memory `project_member_gating` + `project_email_sender`. Grep-sweep `DISABLED` mentions of this rule so no stale doc survives.

## 5. Success criteria

- [ ] Layer 0: hermetic suite green
- [ ] Layer 1: live invoke returns `ok:true`, `sent:0`, sane `perCountry` (or honest `countries:0`)
- [ ] Layer 2: operator received correctly-rendered email(s); `TEST_RECIPIENT` removed (verify with `get-function-configuration`)
- [ ] Layer 3: follower-scoped email received; unsubscribe round-trip works
- [ ] Layer 4: rule ENABLED; first scheduled run's logs clean
- [ ] Docs + memory updated (§4 list)
