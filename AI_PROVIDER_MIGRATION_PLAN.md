# AI Provider Migration Plan

**Created:** 2026-05-03
**Goal:** Reduce AI inference cost from ~$25/mo back toward ~$8/mo target by routing Lambdas to the cheapest provider that fits each workload's shape.

---

## Background

### What broke
xAI Grok credits exhausted on 2026-05-03. Entire AI pipeline failing with `429 RateLimitError: monthly spending limit reached`. All 7 Grok-dependent Lambdas dark.

### What changed (the cost cliff)
CloudWatch shows `NewsProjectInvokeAgentLambda-dev` average duration jumped from ~150s → ~280s on **2026-04-05**, an 85% compute increase. The git commit `a8c1572` (2026-04-09) labelled "two-pass predictions" is the suspected cause — predictions went from 1 Grok call per topic to 2 (research → prediction).

Other recent cost adders since "the $8/mo era":
- `newsCountryIntelligence` bumped from 10 → 20 countries (commit `67981f1`, 2026-04-26)
- `newsCountryIntelligence` schedule changed to 3×/day (cron `0 2/10`)
- Bigger output schemas added (riskScore, sentiment, keyActors) in commits `ea66067` + `fe44d8b`
- New Lambdas: `newsPairIntelligence`, `newsSystemsAnalysis`, `newsCountryFactsUpdater`, `newsMarketsData`

### Estimated current monthly cost (Grok 4 Fast at $0.20/M input, $0.50/M output)

| Lambda | Calls/mo | Est cost | % of bill |
|---|---|---|---|
| `NewsProjectInvokeAgentLambda` | ~362 invocations × 52 calls | ~$15–18 | ~65% |
| `newsCountryIntelligence` | ~96 invocations × 12 calls | ~$5 | ~20% |
| `newsInvokeGemini` | ~363 invocations × 1 call | ~$3.50 | ~14% |
| `newsThreadAnalysis` | ~31 invocations × 10 calls | ~$0.70 | ~3% |
| `newsPairIntelligence` | ~16 invocations × 10 calls | ~$0.55 | ~2% |
| `newsSystemsAnalysis` | ~10 invocations × 2 calls | ~$0.05 | <1% |
| `newsPostDevTo` (daily brief) | ~32 invocations × 1 call | ~$0.20 | <1% |
| **Total** | | **~$25/mo** | |

---

## Provider verification status (as of 2026-05-03)

| Provider | Status | Verified for |
|---|---|---|
| **Groq** Llama 3.3 70B | ✅ Key works | TPM = 12K (free) — only fits very small per-call workloads |
| **Gemini** 2.5 Flash | ✅ Key works (free tier active) | Burst test = ~6 RPM ceiling — fits low-volume batch with pacing |
| **DeepSeek** V4 Flash | ⏳ Not signed up | Verified pricing: $0.14/M input, $0.28/M output |
| **xAI Grok** 4 Fast | ❌ Credits exhausted | Pricing: $0.20/M input, $0.50/M output |

### Free tier reality check (verified)

| Provider | Model | Free TPM | Free RPM | Free RPD |
|---|---|---|---|---|
| Groq | llama-3.3-70b-versatile | 12K | 30 | 14,400 |
| Gemini | gemini-2.5-flash | very high | ~6 (measured) | ~1500 |

**Implication:** No free tier handles the bursty Lambdas (`newsInvokeGemini` 35K-token prompts, `NewsProjectInvokeAgentLambda` 52-call bursts). Free tiers only fit low-volume editorial Lambdas.

---

## Final architecture (target state)

```
┌──────────────────────────────────────────────────────────┐
│               PROVIDER ROUTING TIERS                      │
└──────────────────────────────────────────────────────────┘

Tier A — Gemini 2.5 Flash (FREE)
├── newsThreadAnalysis      [Phase 1]
└── newsPairIntelligence    [Phase 2]

Tier B — DeepSeek V4 Flash (CHEAP, ~$10/mo total)
├── newsInvokeGemini        [Phase 3 — needs DeepSeek key]
├── newsCountryIntelligence [Phase 3 — needs DeepSeek key]
└── NewsProjectInvokeAgentLambda [Phase 3 — needs DeepSeek key]

Tier C — Grok 4 Fast (PREMIUM, citation-critical)
└── newsSystemsAnalysis     [Phase 4 — needs Grok credit top-up]

Tier D — No LLM (already free)
├── newsMarketsData (uses Frankfurter, FRED, Stooq)
├── newsCountryFactsUpdater (uses Wikidata, ACLED)
├── newsPostLinkedin (uses cached AI from DDB)
└── newsSavedItems (no LLM)
```

### Projected monthly cost in target state

| Lambda | Provider | Cost/mo |
|---|---|---|
| `newsThreadAnalysis` | Gemini free | $0 |
| `newsPairIntelligence` | Gemini free | $0 |
| `newsInvokeGemini` | DeepSeek V4 | ~$2.50 |
| `newsCountryIntelligence` | DeepSeek V4 | ~$3 |
| `NewsProjectInvokeAgentLambda` | DeepSeek V4 | ~$5 |
| `newsSystemsAnalysis` | Grok | ~$0.05 |
| **Total** | | **~$10.55/mo** |

vs $25/mo current. ~58% reduction. Same features. Diversified across 3 providers.

To get under $8: also revert the two-pass research step in `NewsProjectInvokeAgentLambda` (cuts prediction cost ~50%). Optional, deferred until after Phase 3.

---

## Phase 1: `newsThreadAnalysis` → Gemini 2.5 Flash

**Why first:**
- Lowest blast radius (10 calls/day, fails gracefully via existing per-thread try/catch)
- Tests OpenAI-compat endpoint shape on a real workload
- Catches Gemini prose quality issues early

**Steps:**
1. Read existing env vars on `newsThreadAnalysis` (preserve all)
2. Edit `src/index.js` to add pacing — `await sleep(10_000)` between thread calls
   - Math: 10 calls × 10s = 100s total, well under 15-min Lambda timeout
   - Stays within Gemini free tier ~6 RPM ceiling
3. Update Lambda env vars:
   - `XAI_API_KEY` = `<Gemini key>`
   - `GROK_API_URL` = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
   - `GROK_MODEL` = `gemini-2.5-flash`
   - Save original Grok key as `XAI_API_KEY_BACKUP`
4. Build deploy zip, push via `aws lambda update-function-code`
5. Test invoke with `{}` payload
6. Tail CloudWatch logs — verify all 10 threads complete without 429s
7. Verify in DDB: `THREAD#{threadId}` rows have `generatedAt` ≈ now
8. Spot-check one `storyArc` and one `trajectory` output for prose quality

**Quality gate:**
- One bad output → roll back, no further migrations
- All look good → proceed to Phase 2

**Rollback:** Single AWS CLI call, restore `XAI_API_KEY` from `XAI_API_KEY_BACKUP`, revert `GROK_API_URL` + `GROK_MODEL` to xAI defaults. ~60 seconds.

**Estimated time:** 30 minutes

---

## Phase 2: `newsPairIntelligence` → Gemini 2.5 Flash

**Why second:**
- Same migration pattern, validated by Phase 1
- Even smaller blast radius (manual invocations only, ~16/month)

**Steps:**
1. Same env-var update pattern as Phase 1
2. Add pacing if it processes pairs in tight burst (10 pairs default)
3. Test invoke with `{}` (default 10 pairs)
4. Verify DDB `PAIR#{slug}` rows updated
5. Spot-check one pair output

**Rollback:** Same as Phase 1.

**Estimated time:** 15 minutes

---

## Phase 3: Decision point + DeepSeek migrations

After Phase 1 & 2 land, choose path:

### Option 3A: Get DeepSeek key, migrate the heavy Lambdas

**Steps:**
1. Sign up at https://platform.deepseek.com/sign_up
2. Create API key at https://platform.deepseek.com/api_keys
3. Test key with curl against `https://api.deepseek.com/chat/completions`
4. Migrate Lambdas in this order (smallest blast radius first):
   - `newsCountryIntelligence` — daily batch with try/catch per country
   - `newsInvokeGemini` — every-2h fetch+cluster, biggest single prompt (35K tokens)
   - `NewsProjectInvokeAgentLambda` — biggest cost win, most calls per run
5. For each: env-var update, test invoke, verify DDB writes, monitor for 1 cycle

**Final state:** ~$10.55/mo total

**Estimated time:** 1 hour

### Option 3B: Top up Grok, leave heavy Lambdas on Grok
**Steps:**
1. Buy credits at https://console.x.ai
2. Heavy Lambdas resume on next cron tick

**Final state:** ~$15/mo total (Gemini saves $1.25 vs Grok-only)

**Estimated time:** 5 minutes

### Option 3C: Defer decision
Heavy Lambdas remain broken; only thread + pair analyses update. Site shows stale topic clusters until decision.

---

## Phase 4: `newsSystemsAnalysis` decision

**Recommendation:** Keep on Grok regardless of Phase 3 choice. Citation discipline + anti-hallucination are known Grok strengths and the cost is trivial (~$0.05/mo at 2 countries currently).

Required: Grok credit top-up (sized just for this Lambda — minimum credit purchase).

**Alternative:** Move to Claude Sonnet via OpenRouter for similar quality. ~$0.50/mo at current scale. Defer this decision until Phase 1-3 are stable.

---

## Open decisions

| # | Decision | Default if undecided |
|---|---|---|
| 1 | Approve Phase 1? | Wait for explicit approval |
| 2 | After Phase 1, manually review one storyArc/trajectory output, or trust logs? | Trust logs unless 429s seen |
| 3 | Phase 3: DeepSeek vs Grok top-up? | Wait for explicit decision |
| 4 | Two-pass research revert in `NewsProjectInvokeAgentLambda`? (saves another ~$2.50/mo) | User said "no need" — skipped |
| 5 | Long-term env-var rename `XAI_API_KEY` → `LLM_API_KEY` for clarity? | Skipped to keep scope tight |

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gemini prose quality below Grok for editorial | Medium | Spot-check after Phase 1, roll back if bad |
| Gemini free tier RPM tighter than 6 | Low | Pacing at 10s/call (well below limit) |
| Gemini OpenAI-compat layer wraps JSON in markdown fences | Low | Existing `normalizeJsonResponse()` already strips fences |
| Google revokes free tier overnight (has happened before) | Low | Env-var swap = 30s to switch back to Grok |
| `XAI_API_KEY` env-var name now misleading (holds Gemini key) | Low | `XAI_API_KEY_BACKUP` convention + comment in plan |
| DeepSeek API outage during Phase 3 | Low-Medium | Keep Grok env-vars in `_BACKUP` suffix for fast rollback |
| User data sovereignty concern with DeepSeek (China-based) | User decision | Input is public news, not user data — likely fine |

---

## What this plan deliberately does NOT include

- **In-Lambda model routing pattern** (different provider per `kind` inside `NewsProjectInvokeAgentLambda`) — saved for after DeepSeek migration validates the simpler approach
- **Reverting two-pass research step** — user opted out
- **Splitting `NewsProjectInvokeAgentLambda` into 3 separate Lambdas** — over-engineered at current scale (covered in conversation: industry standard is in-Lambda routing)
- **OpenRouter as unified router** — adds complexity, 5% markup, defer until we hit limits of direct provider integration
- **Code-level fallback** between providers — defer until we observe real outage frequencies
- **`newsPostDevTo` daily brief migration** — small cost (~$0.20/mo), low priority

---

## Approval gates

Plan execution should pause at:
- After Phase 1 → review output quality
- After Phase 2 → confirm Phase 3 path (DeepSeek or Grok top-up)
- After each Phase 3 sub-step → monitor 1 full cron cycle before next migration

---

## Verification checklist (per phase)

- [ ] Lambda env vars updated correctly (with `_BACKUP` of original)
- [ ] Code deployed (LastUpdateStatus = Successful)
- [ ] Test invoke returns 200 + non-error response body
- [ ] CloudWatch shows no 429s, no `Failed to analyze` errors
- [ ] DDB shows fresh `generatedAt` timestamps
- [ ] At least one output spot-checked for quality
- [ ] Site frontend renders new content correctly (for user-facing Lambdas)
- [ ] Plan checkbox updated below

### Migration progress

- [x] Phase 1: `newsThreadAnalysis` → Gemini 2.5 Flash (2026-05-05, 13s pacing, MAX_TOKENS=6000, trailing-comma fix)
- [ ] Phase 2: `newsPairIntelligence` → Gemini (pending)
- [x] Phase 3a: DeepSeek key obtained (2026-05-16, sk-bea913...)
- [x] Phase 3b: `newsCountryIntelligence` → DeepSeek V4 (2026-05-16, schedule 3×/day → 1×/day 07:00 UTC)
- [x] Phase 3c: `newsInvokeGemini-dev` → DeepSeek V4 (2026-05-16, every 4h)
- [x] Phase 3d: `NewsProjectInvokeAgentLambda-dev` → DeepSeek V4 (2026-05-16, every 4h at :05)
- [x] Phase 4: `newsSystemsAnalysis` → DeepSeek V4 (2026-05-16, kept daily not Grok — simpler)

### Additional migrations completed (beyond original plan)
- [x] `newsPostDevTo` → DeepSeek V4 (2026-05-16) — Daily Brief working; Dev.to publish broken (DEVTO_API_KEY 401)
- [x] Nostr removed from `newsPostLinkedin` (2026-05-16) — wrong key format, no longer needed

### Known issues (post-migration)
- ⚠️ `linkedInAutoPost` — LinkedIn OAuth token expired (EXPIRED_ACCESS_TOKEN 401). Needs fresh token.
- ⚠️ `newsPostDevTo` Dev.to publish — DEVTO_API_KEY returns 401. Key may have been rotated.
- ⚠️ OpenRouter model in `newsPostDevTo` — `deepseek/deepseek-r1:free` no longer exists on OpenRouter (404). Minor — Dev.to prose overview only, brief still works.
- ⚠️ `newsThreadAnalysis` Gemini free tier — 20 RPD limit. Fine for 1 run/day (7-10 calls), but manual test invocations exhaust quota same day.
