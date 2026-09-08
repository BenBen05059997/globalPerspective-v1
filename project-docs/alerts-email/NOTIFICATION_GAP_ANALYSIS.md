# Notification System — Gap Analysis & Roadmap

**Date:** 2026-06-10
**Purpose:** Before building the user-facing notification **settings menu**, understand (a) how the best news/notification products decide *what to send and why*, and (b) what a modern *preference center* must offer — then map both against what we have and what we lack. Grounded in competitive research (sources at the end) + an audit of our own code.

**TL;DR — the two highest-value gaps:**
1. **Send logic:** our significance score is *magnitude-heavy with no novelty signal* — it can't distinguish a brand-new event from the 20th update to an ongoing thread. This is the #1 cause of alert fatigue in clustered-news systems. **Fix: add novelty/continuation + velocity (we already have `continues_topic` + thread `entryCount`).** ← implemented 2026-06-10.
2. **Preference center:** we have *no* notification settings UI and *no* per-user opt-in. **Fix: an Account → "Notifications" tab + a JWT prefs endpoint, opt-in (default off), with a separate Breaking vs Digest toggle.** ← the settings-menu build.

---

## Part A — What to send, and why (the send-decision logic)

### How the best products decide significance
Every serious alerting system answers, in order: **(1) Is the *event* significant?** → **(2) Is it relevant to *this user*?** → **(3) Should we send it *now*, given everything else we've sent?** ([NYT push team / Digiday](https://digiday.com/media/inside-new-york-times-new-push-notifications-team/), [Apple News guidelines](https://support.apple.com/guide/news-publisher/apple-news-notification-guidelines-apd2e6e6d98f/icloud)).

The significance signals they use:

| Signal | How measured | We have it? |
|--------|--------------|-------------|
| **Coverage volume** | # independent outlets in the cluster ([Google News](https://support.google.com/googlenews/answer/9005749), [Techmeme](https://news.techmeme.com/250912/20-years)) | ✅ `sources.length` |
| **Breadth** | story hitting many angles at once | ✅ topics-per-thread |
| **Magnitude / impact** | market move, casualties, deal size ([Bloomberg](https://www.bloomberg.com/professional/insights/data/using-bloomberg-automated-news-stories-to-predict-market-events/)) | ✅ country `riskScore` + econ `magnitude` |
| **Velocity / burst** | *rate of change* of coverage, not the level (Kleinberg burst detection) | ❌ → **added 2026-06-10** |
| **Novelty (First Story Detection)** | is this a *new* event or a continuation? (Petrović et al. — nearest-neighbor distance to prior stories) | ❌ → **added 2026-06-10** |
| **Source authority** | weight outlets by prominence ([Google](https://support.google.com/googlenews/answer/9005749)) | ⚠️ all sources equal |
| **Independent corroboration as a *gate*** | require ≥2 independent/authoritative sources before sending ("better to be right than first" — [Apple](https://support.apple.com/guide/news-publisher/apple-news-notification-guidelines-apd2e6e6d98f/icloud)) | ⚠️ partial (LLM verify planned, but not a corroboration count gate) |

### Where we stood
Our deterministic scorer (`significance.js`) blended four **level** signals: popularity, breadth, country risk, economic magnitude. All four are *"how loud is this right now"* — none is *"is this new / is it accelerating."* So an ongoing war or a long-running economic story would keep clearing the bar every cycle. Our only defense was a 5-day dedupe (same thread can't re-alert) — but that's binary and time-based, not significance-based: a genuinely escalating story and a quietly-continuing one were treated identically.

### What we added (2026-06-10) — the #1 fix
- **Velocity term** — new topics this cycle vs the thread's prior size (`entryCount` from `THREAD_ANALYSIS`). A story going 2→8 angles in a cycle scores far above one sitting flat. ([burst detection](https://logort.com/analytics/understanding-kleinbergs-burst-detection-algorithm/))
- **Continuation-aware threshold** — a story that's a *continuation* (has `continues_topic`, or its thread already existed) must clear a **higher bar** (`SIGNIFICANCE_THRESHOLD × 1.8`). A continuation only re-alerts on genuine **escalation** (the velocity/magnitude delta carries it over the raised bar) — exactly the "suppress unless the delta clears a higher bar" rule from First Story Detection ([Petrović et al.](https://www.semanticscholar.org/paper/Streaming-First-Story-Detection-with-application-to-Petrovic-Osborne/4995fbc1375cd608ebecf982eabe7aeb3ec913c5)). We already carry `continues_topic` and `entryCount`, so this is deterministic, no LLM, no new pipeline.

### Still to add (ranked)
1. **Source-authority weighting + a corroboration gate** — weight outlets by prominence and require ≥2 *independent* authoritative sources before a story reaches the human queue. Cheaper and harder to fool than the LLM verify, and it runs *first*. ([Apple](https://support.apple.com/guide/news-publisher/apple-news-notification-guidelines-apd2e6e6d98f/icloud), [Reuters standards](https://mediabiasfactcheck.com/reuters/))
2. **LLM "is it true?" verify** (already planned — Phase 3, Gemini judges the DeepSeek analysis).
3. **Send discipline** — per-recipient frequency cap (NYT/Apple run **0–5/day**, hard cap), thread-keyed dedupe per recipient, time-zone-aware send + quiet hours (~9pm–8am local; breaking is the documented exception). ([Apple caps](https://support.apple.com/guide/news-publisher/apple-news-notification-guidelines-apd2e6e6d98f/icloud), [Courier quiet hours](https://www.courier.com/blog/quiet-hours-delivery-windows))
4. **Fatigue dashboard** — track open rate + unsubscribe rate per send; keep unsubscribe <1%/send; if opens fall while volume rises, we're over-sending. ([CleverTap benchmarks](https://clevertap.com/blog/push-notification-metrics-ctr-open-rate/))
5. **Personalization** (followed countries/topics) — *the* better fatigue lever per NYT, but it needs per-user preference + history infra. **Start with declared opt-in by category/country (cheap) before any ML relevance** — and the settings menu below is the foundation for it.

---

## Part B — The preference center (the settings menu)

### The emerging standard (what users now expect)
From Substack, NYT, Bloomberg, Axios, Morning Brew, Google Alerts, Apple News, Ground News, the minimum viable set is:
1. A **preference center reachable from every email footer** (not just a bare unsubscribe link).
2. **Per-stream opt-in/out** — keep some emails, drop others, without losing the account. (Implemented everywhere as "one toggle per stream.")
3. A **frequency/cadence choice** where content can be batched (instant / daily / weekly) — the single most "modern" expectation. ([Substack](https://reworkwork.substack.com/p/managing-your-subscriptions-and-notifications), [Google Alerts](https://visualping.io/blog/how-to-set-up-google-alerts))
4. A **global "unsubscribe from everything"** escape hatch.
5. **Breaking (instant) treated separately from Digest** — keep breaking, mute the roundup. ([Apple](https://support.apple.com/guide/iphone/get-news-notifications-and-newsletters-iphe9661f86c/ios), NYT)
6. *(Push-only)* quiet hours + channel choice — **N/A for us** (email only, no push).

**Default at signup: opt-in per stream, never pre-checked** (GDPR/ePrivacy require affirmative action). ([igdpr.eu](https://www.igdpr.eu/en/gdpr-email-marketing-consent/))

### What we have
- **Nothing.** `Account.jsx` has only **Profile** + **Saved** tabs. No notification settings, no per-user opt-in. `GlobalPerspectiveUserPrefs` exists (written by `newsRecommend` as an interest-profile *cache*) but has no `breakingOptIn`/`digestOptIn` fields and no read/write-prefs endpoint. The breaking-alert Lambda is broadcast-with-no-audience.

### v1 settings-menu spec (recommended)
A new **Account → "Notifications"** tab with:
- **Breaking news alerts** — toggle, **default OFF**. "Get an email the moment a major story breaks, with our analysis." (Surprise breaking email is a top complaint driver — must be explicit opt-in.)
- **Weekly digest** — toggle, **default OFF** + a **daily/weekly cadence** selector when on.
- **Unsubscribe from all** — one action.
- Honest copy that email isn't live yet if it isn't (no fake "subscribed!" — [[feedback-no-misinformation-fallback]]).

Backend: `get_prefs` / `set_prefs` actions (Firebase-JWT, `uid`-scoped) on **`newsRecommend`** (the `GlobalPerspectiveUserPrefs` owner), writing `breakingOptIn`, `digestOptIn`, `digestCadence`, `digestVerified`/`breakingVerified` (double opt-in), `unsubToken`, `consentAt`. Mirrors the `newsSavedItems` JWT Function-URL pattern.

**Defer** (research-backed, low payoff at our scale): quiet hours (no push), channel selection (one channel), a fine-grained per-country/per-category matrix (start with 2–3 streams; split when demand shows).

### Compliance must-haves (when email goes live)
- **Double opt-in** (confirm link sets `*Verified` before any send) — GDPR consent evidence + protects spam-complaint rate.
- **One-click unsubscribe** — `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), backed by `unsubToken`, POST endpoint, no login. ([RFC 8058](https://datatracker.ietf.org/doc/html/rfc8058))
- **SPF + DKIM + DMARC** on `globalperspective.net` (Resend domain verification covers this).
- **Physical postal address** + accurate From/subject (CAN-SPAM).
- **Separate** breaking-unsubscribe from transactional/account email.
- Wire **Google Postmaster Tools** to watch the spam rate (<0.1%, never 0.3%). ([Gmail sender rules](https://support.google.com/a/answer/14229414?hl=en))

---

## Part C — Prioritized roadmap

| # | Item | Status |
|---|------|--------|
| 1 | Novelty/continuation + velocity in the scorer | ✅ done 2026-06-10 |
| 2 | **Settings menu** (Account Notifications tab + `get/set_prefs` + opt-in fields) | ⏭ next |
| 3 | Deploy breaking detector dry-run → tune threshold on real cycles | pending |
| 4 | Source-authority weighting + corroboration gate | pending |
| 5 | LLM verify (Gemini) | pending (Phase 3) |
| 6 | Send infra: double opt-in + one-click unsubscribe + per-recipient cap | with first real send |
| 7 | Fatigue dashboard (open/unsub rate) | after first sends |
| 8 | Personalization by followed country/category | later |

---

## Sources
**Significance / what-to-send:** [Google News selection](https://support.google.com/googlenews/answer/9005749) · [Apple News notification guidelines](https://support.apple.com/guide/news-publisher/apple-news-notification-guidelines-apd2e6e6d98f/icloud) · [NYT push team (Digiday)](https://digiday.com/media/inside-new-york-times-new-push-notifications-team/) · [Bloomberg automated stories](https://www.bloomberg.com/professional/insights/data/using-bloomberg-automated-news-stories-to-predict-market-events/) · [Techmeme — 20 years](https://news.techmeme.com/250912/20-years) · [Petrović et al. — Streaming First Story Detection](https://www.semanticscholar.org/paper/Streaming-First-Story-Detection-with-application-to-Petrovic-Osborne/4995fbc1375cd608ebecf982eabe7aeb3ec913c5) · [Kleinberg burst detection](https://logort.com/analytics/understanding-kleinbergs-burst-detection-algorithm/) · [Particle (TechCrunch)](https://techcrunch.com/2024/11/12/particle-launches-an-ai-news-app-to-help-publishers-instead-of-just-stealing-their-work/) · [Ground News Blindspot](https://ground.news/blindspot)
**Frequency / fatigue / metrics:** [CleverTap push benchmarks](https://clevertap.com/blog/push-notification-metrics-ctr-open-rate/) · [Braze messaging metrics](https://www.braze.com/resources/articles/push-notifications-the-messaging-metrics-that-matter) · [Courier quiet hours](https://www.courier.com/blog/quiet-hours-delivery-windows) · [Batch send-time/frequency](https://doc.batch.com/guides-and-best-practices/orchestration/what-is-the-best-time-to-send-push-notifications)
**Preference centers:** [Substack](https://reworkwork.substack.com/p/managing-your-subscriptions-and-notifications) · [Bloomberg newsletter settings](https://www.bloomberg.com/help/question/how-do-i-update-my-newsletter-settings/) · [Axios preferences](https://help.axios.com/hc/en-us/articles/36222269210267-How-do-I-change-my-subscription-preferences) · [Google Alerts cadence](https://visualping.io/blog/how-to-set-up-google-alerts) · [Apple News notifications](https://support.apple.com/guide/iphone/get-news-notifications-and-newsletters-iphe9661f86c/ios)
**Compliance:** [Gmail/Yahoo sender rules](https://support.google.com/a/answer/14229414?hl=en) · [RFC 8058 one-click unsubscribe](https://datatracker.ietf.org/doc/html/rfc8058) · [FTC CAN-SPAM](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) · [GDPR email consent](https://www.igdpr.eu/en/gdpr-email-marketing-consent/) · [GDPR double opt-in](https://www.termsfeed.com/blog/gdpr-double-opt-in-email-marketing/)
