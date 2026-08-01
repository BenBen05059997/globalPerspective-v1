# Signal API — v1 Plan & Schema

**Status:** Step 1 BUILT (2026-06-23) — `newsSignals` Lambda (adapter + build + serve), 45 passing unit tests, NOT deployed. This doc is the contract to agree on and the artifact to hand a design partner.

**Related:** `ARCHITECTURE.md` (system overview), `BREAKING_ALERTS_PLAN.md` (the free newsletter funnel), prediction-calibration pipeline (`/track-record`).

---

## 1. What we're doing (in plain terms)

We already run a machine that, every few hours, reads the world's news and writes down — in a structured way — **what happened, why it matters, who's affected, what's likely next, and how confident we are.** Today that structured output only gets turned into web pages for humans to read.

The pivot: **sell the structured output itself.** Keep the website and a free email newsletter for normal people (that's how people discover us and learn to trust us), but expose the underlying data as a clean, paid **API** that other software can plug into — trading desks, risk teams, and other apps that want to know "is something important happening in the world right now, and how sure are you?"

In one sentence: **free for humans to read, paid for machines to consume.**

## 2. Our best point (the one thing to lead with)

**We tell you how often we're right.**

Everyone else gives you either a firehose (Bloomberg, Reuters) or noise (Twitter/X). Nobody publishes a track record. We already do: every prediction we make is logged with a **dated, falsifiable trigger** ("X will happen by date Y"), and when the deadline passes we score it fired / not-fired and publish a running accuracy number (a Brier score) at `/track-record`.

That means our signals come with a **calibration stamp** — a buyer can see our historical hit-rate before trusting an alert. That is the moat. It's the thing a hedge fund or risk team actually needs and can't get anywhere else, and it's the answer to "why should I pay for news signals?"

Second-best point: **provenance.** Every signal traces back to the real source articles and is checked daily for fabrication/drift (`newsSourceAudit`). Machines can trust it because it's auditable.

## 3. What a "signal" is

A **signal** = one important world event, packaged with our analysis and a confidence stamp. It's assembled from records we already produce. We are NOT generating anything new — we repackage existing DynamoDB records into one stable, normalized envelope.

---

## 4. The v1 envelope (the stable contract)

This is the one shape every consumer integrates against. Internal records slot into it; the envelope never breaks compatibility within v1 (additive changes only). Implemented in `amplify/backend/function/newsSignals/src/signalAdapter.js`.

```jsonc
{
  "signal_id": "sig_2026-06-23_economic_impact_thread-oil-a1",  // deterministic dedupe key
  "version": "1",
  "type": "geopolitical_risk" | "economic_impact" | "forecast" | "breaking",
  "emitted_at": "2026-06-23T09:00:00Z",   // when WE published this signal
  "event_time": "2026-06-23T08:00:00Z",   // when the underlying record was generated
  "thread_id": "thread-oil-a1",           // links signals about the same story over time

  "headline": "string",
  "summary": "string — 1-3 sentence machine-readable abstract",

  "entities": {                            // Gap #2 (normalized)
    "countries": [{ "name": "Iran", "iso": "IRN" }],   // ISO-3166 alpha-3, null if unknown
    "regions": ["Middle East"],
    "actors": [{ "name": "IRGC", "role": "military" }],
    "instruments": [{ "id": "BRENT", "kind": "commodity" }],
    "categories": ["economy"]
  },

  "severity": 0-100,        // Gap #3 — single 0-100 scale (from severityScore/riskScore/score)
  "severity_band": "low" | "moderate" | "elevated" | "high",
  "confidence": 0.0-1.0,    // single 0-1 scale (from confidence enums / probability); null if N/A
  "direction": "escalating" | "stable" | "de-escalating" | null,

  "analysis": { /* type-specific block, §5 */ },

  "provenance": {                          // the differentiator, machine-readable
    "sources": [{ "title": "...", "url": "...", "outlet": "reuters.com" }],
    "source_robustness": "verified" | "single_source_unverified" | null,
    "cited_topic_ids": ["topic-..."],
    "calibration": {                       // present on forecast signals
      "model_brier_score": 0.18, "sample_size": 142,
      "track_record_url": "https://globalperspective.net/track-record"
    }
  }
}
```

**Key choices:** `signal_id` dedupes (deterministic from type+scope+date → idempotent re-builds); `thread_id` follows one story over time; `severity` and `confidence` are each ONE number so machines never special-case; `provenance.calibration` ships the selling point as data.

---

## 5. Type-specific `analysis` blocks (mapped to real records, in `signalAdapter.js`)

- **`economic_impact`** ← `ECON#THREAD#{id}/ECONOMIC_IMPACT` → `instruments[]` (id/direction/magnitude/rationale/cited), `winners`/`losers`, `mechanism`, `horizon`, `historical_analog`, `market_snapshot` (real prices), `watch_signals`, `quality_flags`. Tombstones (`hasImpact:false`) are skipped.
- **`forecast`** ← `GlobalPerspectivePredictionLog` → `scenarios[]` (label/probability/horizon/rationale/`triggers[]` with status+verdict_confidence+citation), `winners`/`losers`. Carries the global `calibration` stamp.
- **`geopolitical_risk`** ← `COUNTRY#{name}/COUNTRY_INTELLIGENCE` → `bluf`, `risk_level`+`risk_score`, `trajectory`(+detail), `key_developments`, `risk_signals`, `key_actors`, `cross_thread_insight`.
- **`breaking`** ← `GlobalPerspectiveBreakingAlerts` (confirmed/sent only) → `significance_score`, `signal_breakdown`, `reasons`, `status`, `editor_note`.

---

## 6. The four gaps and how v1 closes them

| Gap | v1 resolution (implemented) |
|---|---|
| No common envelope | `makeEnvelope()` in `signalAdapter.js`; records map in, raw never exposed |
| Loose entity resolution | `entities` block; `COUNTRY_ISO` map → ISO-3166 alpha-3, **unknown → null (honest, not a guess)**; instruments via allowlist `kind` |
| Confidence expressed 5 ways | `normConfidence()` → 0-1 (enum low/med/high→0.3/0.6/0.9, probability passthrough); `severity` → one 0-100 scale + `severityBand()` |
| Short TTLs / no history | dedicated `GlobalPerspectiveSignals` table written at build time (120-day TTL), NOT the short-TTL caches; clean queryable history without touching the pipeline |

---

## 7. Endpoint shape (v1) — implemented in `newsSignals/src/index.js`

A **new, separate** surface, NOT bolted onto `newsSensitiveData` (different auth/SLA posture).

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /v1/signals?since=&type=&country=&min_severity=&limit=` | API key | page of signals (newest first) |
| `GET /v1/signals/{signal_id}` | API key | one signal |
| `GET /v1/track-record` | API key | calibration summary (Brier, sample size) — the proof |

- **Auth:** `Authorization: Bearer gpsk_…` (or `x-api-key`). Keys stored as sha256 hash only (`apiKeys.js`), looked up O(1). Tiers `free`/`paid`.
- **Rate limit:** fixed-window per key/minute, fail-open (`GlobalPerspectiveApiKeys` doubles as the counter store with TTL).
- **Free vs paid:** free tier sees signals delayed `FREE_DELAY_HOURS` (default 24h) + low rate limit; paid = real-time + higher limit. Webhooks + history depth are a later step.

## 8. Build order (thin slice first)

1. **`GlobalPerspectiveSignals` table + adapter** — ✅ BUILT. `signalAdapter.js` (pure, 45 tests) + `index.js` build mode upserts envelopes. *Table + deploy still pending operator (see §10).*
2. **`GET /v1/signals` + `/v1/track-record`** behind API-key auth + rate limiting — ✅ BUILT (serve mode). *Deploy pending.*
3. **Turn the breaking-alert newsletter live** (`newsBreakingAlert` email path) — the free funnel. *Not started.*
4. **One-page developer landing page** leading with the Brier score + a live sample signal. *Not started.*
5. Webhooks + paid tiers once someone's integrating. *Not started.*

Steps 1–2 reuse data we already produce. No pipeline changes, no re-architecture.

---

## 9. Open decisions (need a human call)
- **Entity normalization depth** — v1 ships countries (ISO map) + our instrument allowlist only; company/ticker-level deferred.
- **Free-tier delay** — 24h delay on free `/v1/signals` is the lever that makes real-time worth paying for (env `FREE_DELAY_HOURS`). Confirm the number.
- **Pricing** — deferred until a design partner; this doc is the contract, not the price.

---

## 10. Infra & deploy (operator — NOT yet run)

Backend deploys are manual (no CI; see project conventions). Nothing below has been executed.

**Two new DynamoDB tables** (region `ap-northeast-1`, PAY_PER_REQUEST):

```bash
# Signals store (read by the API, written by build mode). TTL on `ttl`.
aws dynamodb create-table --table-name GlobalPerspectiveSignals \
  --attribute-definitions AttributeName=signal_id,AttributeType=S \
  --key-schema AttributeName=signal_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region ap-northeast-1
aws dynamodb update-time-to-live --table-name GlobalPerspectiveSignals \
  --time-to-live-specification "Enabled=true, AttributeName=ttl" --region ap-northeast-1

# API keys + rate-limit counters (same table; counter rows are keyHash='RL#…' with TTL).
aws dynamodb create-table --table-name GlobalPerspectiveApiKeys \
  --attribute-definitions AttributeName=keyHash,AttributeType=S \
  --key-schema AttributeName=keyHash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region ap-northeast-1
aws dynamodb update-time-to-live --table-name GlobalPerspectiveApiKeys \
  --time-to-live-specification "Enabled=true, AttributeName=ttl" --region ap-northeast-1
```

**Lambda `newsSignals`** — Node 22, `npm install` in `src/`, zip + create. Env vars:
`SUMMARIZE_PREDICT_TABLE`, `PREDICTION_LOG_TABLE`, `BREAKING_ALERTS_TABLE`, `SIGNALS_TABLE`, `API_KEYS_TABLE`, `SITE_URL`, `SIGNAL_TTL_DAYS`, `FREE_DELAY_HOURS`.
**IAM:** read on SummarizeAndPredict + PredictionLog + BreakingAlerts; read/write on Signals + ApiKeys.

**Build trigger:** EventBridge after the daily analysis (e.g. `cron(0 10 * * ? *)`, post-economic-quality) → invoke `{ "action": "build" }`. Backfill once by invoking build manually.

**Serve:** a Function URL (AuthType NONE — auth is our API key, not IAM) or an API Gateway `/v1/*` route.

**Issue a key:** `node amplify/backend/function/newsSignals/mint-key.mjs "Acme" paid 120` → prints the raw key (once) + the `put-item` to activate it.

## 11. What's NOT done / risks
- Not deployed; tables not created; build never run against live data → field mappings verified against code + unit fixtures, not yet against real records. Worth one manual build + spot-check before exposing.
- List endpoint scans + filters in-Lambda (fine at current volume); a GSI on `(type, emitted_at)` is the scale step.
- Rate limiter is best-effort fixed-window (fail-open). Fine for v1; not a hard quota.
