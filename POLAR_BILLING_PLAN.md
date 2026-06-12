# Polar Billing — Plan & Open Decisions

**Status:** DISCUSSION / not started. Created 2026-06-10.
**Goal:** Reintroduce paid subscriptions using **Polar.sh** (Merchant of Record), reversing the 2026-05-26 billing deprecation.

> ⚠️ This reverses a deliberate teardown. Subscriptions/tier-gating were removed on 2026-05-26 (site went fully public). The old `newsStripeWebhook` (Paddle) source still exists in-repo for reference, but the proxy tier-gates and `resolveUserTier()` were deleted. This is a **rebuild**, not a reconnect. See [[project-billing-deprecated]] in memory.

---

## Why Polar (decided)

- Plain Stripe / Paddle didn't work for us (payment availability in our country).
- Polar is a **Merchant of Record**: *Polar* charges the customer, so Stripe Payments availability in our country is irrelevant. We only need to be in a **Stripe Connect Express payout country** (~120 countries) to get paid out.
- Polar also assumes **international sales-tax / VAT liability** — it collects & remits consumption tax from customers, not us.
- Clean REST API + webhooks (`subscription.created/updated/canceled`, `order.created`) + hosted checkout + hosted customer portal → maps onto the old Paddle-webhook architecture.
- **Fees (verified 2026-06-10):** Starter (free) 5% + 50¢; Pro $20/mo → 3.8% + 40¢; Growth $100/mo → 3.6%; Scale $400/mo → 3.4%. +1.5% international cards, $15/chargeback. (Orgs created before 2026-05-27 keep a 4%+40¢ "Early Member" rate unless they upgrade.)

---

## Polar account — resources & IDs (live; update as we go)

**Account (set during onboarding 2026-06-12):** type **Individual** (sole proprietor); payout country **Japan** (payout currency JPY); default **charge** currency **USD**. Org slug: `global-perspective-net` *(confirm final)*.

**Product — "Global Perspectives Membership"** ($15/mo + $150/yr, USD, recurring). Created as a **DRAFT — do NOT enable live selling until the Phase-1 access-gating is built** (today all content is public, so a subscriber would be paying for what's free).
| Plan | Product ID |
|------|-----------|
| Monthly ($15) | `e53eeb9a-4e2e-4b33-9c18-f0e779c07677` |
| Yearly ($150) | `cd375325-0fd2-4223-8b10-8e02d50798fd` |

> ⚠️ **Confirm environment:** Polar **Sandbox** and **Production** are fully separate, with different IDs. The IDs above were created in the onboarding flow → almost certainly **Production**. We'll build/test against **Sandbox** first (create matching Sandbox products there), then swap to these Production IDs at launch.

**Still needed for the build — you generate, secrets go straight into the Lambda env vars (NOT this file):** Organization Access Token + Webhook signing secret. (Product IDs above are public checkout identifiers — safe in-repo; tokens/secrets are not.)

---

## OPEN DECISIONS (we work through these one by one)

### 1. Payout country & tax registration  ← **CURRENT**
- **Decision:** Japan (user files in both JP and CA; primary work is in Japan).
- Both CA and JP are Connect Express countries, so either works technically.
- **Open sub-items:** which JP government filings/registrations are required (see "Tax & Compliance" below); confirm with a 税理士.

### 2. Charging model  ✅ DECIDED 2026-06-10
- **Subscription → full read access.** All pre-generated intelligence (archive, thread + country intelligence, economic disruption, daily brief, systems graphs) unlimited, no meter on reading. (Credits-to-read rejected: served analysis is pre-generated & cached in DDB ≈ zero marginal cost, and metering reading kills daily-habit engagement.)
- **Credits → "analyze it yourself."** The user points our engine at **our data** and runs their **own** custom analysis (e.g. "compare JP vs KR semiconductor exposure over 30 days", "scenario tree if X happens", "turn this thread into a one-page brief"). Each run = a real LLM call over our corpus → a credit maps to actual compute cost (honest metering).
- **Deposit fits here:** subscription includes a monthly credit allowance; users can top up (buy more credit packs) to go deeper. Satisfies the "deposit + subscription" instinct.
- Turns a passive reader into an active analyst — a real differentiator.

### 3. Free-vs-paid line (gating boundary)
- What stays public (SEO + early-access habit) vs. what goes behind the wall.
- Candidate paid surfaces: archive depth, thread intelligence, country intelligence, economic disruption, daily brief, systems analysis, track record.
- Candidate always-free: today's topics, map, SEO previews (`country_preview`/`thread_preview`), RSS.
- **Status:** to decide. Note honesty constraint — keep enough public for SEO/bots.

### 4. Pricing & tiers
- How many tiers, monthly price points, currency display (JPY/USD), trial?
- **Status:** to decide.

### 5. Credit mechanics — the "Custom Analysis" feature  → now spec'd in [`ANALYSIS_STUDIO_PLAN.md`](./ANALYSIS_STUDIO_PLAN.md)
> **Resequenced 2026-06-10:** we are building the analysis feature (`/analyze`, "Analysis Studio") **FIRST, free-but-capped**, before billing — you can't sell per-run credits for a feature that isn't built/proven. Full design (both input modes + guardrails + lenses) lives in **[`ANALYSIS_STUDIO_PLAN.md`](./ANALYSIS_STUDIO_PLAN.md)**. Credits attach later: the free daily cap simply becomes a credit balance. Granularity/allowance/pricing stay parked until the feature has usage data.

The single credit-consuming action: a **user-initiated custom analysis over our data**. New backend path (working name `newsAnalyze` / "Analysis Studio").
- **Granularity (open):** flat 1 credit = 1 analysis (Claude's lean — simple/predictable) vs. scaled by depth (quick summary 1 / full report 3).
- **Allowance vs. deposit (open):** subscription includes *N* analyses/month; extras via top-up credit packs. (How many/month?)
- **Free taste (open):** give logged-in free users ~1–2 free analyses as a conversion hook? (Claude's lean: yes.)
- **Cost guardrails (non-negotiable):** cap tokens per run so one analysis can't blow the budget; price a credit **above** the LLM cost so it's never a loss; per-user rate/abuse caps; atomic credit decrement (conditional `UpdateItem` on `USERS_TABLE`).
- **Honesty (non-negotiable):** user-generated reports must cite real records from our corpus and return "insufficient data" rather than hallucinate — otherwise self-serve becomes a misinformation vector ([[feedback-no-misinformation-fallback]]).
- **Tech sketch:** `newsAnalyze` Lambda (Function URL, JWT-gated) → checks credit balance → pulls relevant DDB records (archive / thread / country / economic) for the user's query → LLM call (capped) → returns cited report → decrements credit. Mirrors existing generation Lambdas; reuses the DeepSeek/Gemini plumbing.

---

## Integration Plan (technical sketch)

1. **Polar setup** — create org; define products (subscription tier(s); optional credit packs as one-time products).
2. **`newsPolarWebhook` Lambda** (new, Function URL — the slot the deleted `newsStripeWebhook` occupied). Verifies Polar webhook signature; handles `subscription.created/updated/canceled` + `order.created`; writes `tier` (+ `creditBalance` if credits) to `USERS_TABLE` keyed by Firebase `uid`.
3. **uid ↔ Polar customer link (critical glue)** — pass Firebase `uid` as Polar `customer_external_id`/metadata at checkout so the webhook knows whose record to update.
4. **Checkout** — frontend opens Polar overlay/hosted checkout with uid attached.
5. **Re-gate `newsSensitiveData`** — reintroduce `resolveUserTier()` + per-action tier checks on the gated actions (per decision #3).
6. **Credit ledger** (only if #2 includes credits) — `creditBalance` + transactions on the user record; decrement on credit-consuming generation; webhook tops up on renewal/pack purchase.
7. **Frontend** — rebuild Account billing tab, subscribe button, credit balance (if any), upgrade prompts on gated content. Link to Polar's **hosted customer portal** (replaces old Paddle portal — less to build).

---

## Tax & Compliance notes (research 2026-06-10 — NOT tax advice; confirm with a 税理士 / CPA)

**Key MoR simplification:** Because Polar is the Merchant of Record, **Polar collects & remits consumption tax/VAT from end customers**. We do *not* register to collect sales tax from buyers. What we receive is a **payout (business income)** from Polar, which we report as income.

### Japan (chosen)
- **開業届 (kaigyō todoke)** — "Notification of Opening of a Sole Proprietorship" (個人事業の開業・廃業等届出書). File at the local tax office **within ~1 month** of starting the business. Usually filed together with the **青色申告承認申請書 (blue-return application)** to unlock the up-to-¥650,000 income deduction.
- **確定申告 (kakutei shinkoku)** — annual income tax return, **Feb 16 – Mar 15**, reporting worldwide income. Sole-proprietor filing generally required once business income exceeds the ¥480,000 basic deduction; the ¥200,000 "side income" rule applies if otherwise employed.
- **Consumption Tax (JCT)** — only mandatory once **taxable sales exceed ¥10,000,000** in the base period (≈2 fiscal years prior). Below that you're a **免税事業者** (tax-exempt) and don't deal with JCT. With Polar as MoR, customer-side consumption tax is Polar's responsibility anyway. (2026 reform mainly affects *nonresident* sellers/platforms — relevant to Polar, not to us directly.)
- **Large cross-border receipts** — banks file a 国外送金等調書 for big transfers; a separate self-report applies to very large (¥30M+) direct dealings with non-residents. Polar payouts via bank are normally below the self-report trigger, but confirm with an accountant if volume grows.

### Canada (fallback, if ever switched)
- **Business Number (BN)** via CRA Business Registration Online; register the sole proprietorship (province-dependent).
- **GST/HST small-supplier rule** — under **CAD $30,000** taxable supplies over 4 rolling quarters → *not* required to register/collect. Above → register within 29 days. With Polar as MoR, buyer-side sales tax is Polar's job regardless.
- **Income** — report self-employment income on the **T1 / T2125**.

**Sources:**
- Japan freelancer/sole-proprietor taxes: https://resources.realestate.co.jp/living/guide-to-taxes-in-japan-for-freelancers-and-sole-proprietors/ , https://mailmate.jp/blog/how-to-freelance-in-japan-as-a-foreigner
- Japan JCT threshold + 2026 reform: https://mailmate.jp/blog/japan-consumption-tax-guide , https://www.bdo.global/en-gb/insights/tax/indirect-tax/japan-2026-tax-reform-includes-jct-changes-that-affect-nonresident-sellers
- Polar supported countries: https://polar.sh/docs/merchant-of-record/supported-countries
- Polar pricing: https://polar.sh/resources/pricing
- Canada GST/HST small supplier: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html

---

## Risks / honesty flags
- Reviving a deliberately-deleted enforcement path — don't half-gate (a leaky gate is worse than none).
- Keep enough content public for SEO/bot pre-rendering (Cloudflare Worker previews) or organic discovery suffers.
- No fabricated "all clear" / fallback billing UI — honesty contract still applies ([[feedback-no-misinformation-fallback]]).
- Tax specifics above are researched, **not** professional advice — verify with a 税理士 before filing.
