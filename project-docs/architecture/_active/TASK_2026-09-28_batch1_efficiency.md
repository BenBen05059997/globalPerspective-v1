## Batch 1: stop the waste and get off DeepSeek's peak window (R1–R4, D5, P4) — 2026-09-28 — active (PLAN ONLY; nothing executed, nothing changed)

**Goal:** make every scheduled DeepSeek job do only the work that is needed, and run it outside DeepSeek's peak window, so a top-up lasts several times longer. Concretely:
- **R2** regenerate a story only when it is new or its articles changed;
- **R3** pick topics every 8 h instead of 4 h;
- **D5** move the peak-window DeepSeek jobs to off-peak;
- **P4** source audit → flash, 3 × a week;
- **R1** country briefings weekly + early refresh on events (≤ 1 a day);
- **R4** drift after country briefings; country facts weekly.

**Source:** `BACKEND_PLAN_2026-09-27.md` (items R1–R4, D5, P4; work order step 2–3). Format and evidence standard copied from `TASK_2026-09-27_parking.md`. Operator approved the direction 2026-09-27; this file is the exact plan. **Every step below needs the operator's "go" before it runs** (nothing here has been executed; this phase was read-only: AWS reads, downloads of deployed zips, unit-test baselines).

**Reads / references:**
- `CLAUDE.md`, `BACKEND_PLAN_2026-09-27.md`, `AI_PROVIDER_PRICES_2026-09-27.md` (peak = 01:00–04:00 and 06:00–10:00 UTC, **Mon–Fri only**; weekends are all off-peak), `TASK_2026-09-27_parking.md`, `playbooks/TASK_TEMPLATE.md`.
- `architecture/ARCHITECTURE.md` (Lambda sections 1, 2, 4, 9, 11, 18, 24, 26; schedule table ~L1132–1174), `DATA_STRATEGY.md` (world store, `world/latest.json` contract).
- Deployed zips downloaded read-only to `/private/tmp/claude-501/-Users-benlai-Downloads-globalPerspective-v1/923a878d-8755-4b54-8ac8-114b13c73db2/scratchpad/batch1/` (session scratchpad; **re-download before any deploy**, the S3 link expires in minutes).

---

## 0. Live state read 2026-09-29 (all read-only)

| Schedule (type) | Expression / timezone | Target | Notes |
|---|---|---|---|
| `InvokeGoogleGemini` (Scheduler) | `cron(0 */4 * * ? *)`, UTC, window OFF | `newsInvokeGemini-dev` | fires 00/04/08/12/16/20 :00. **08:00 is in peak** |
| `InvokeNewsAgent` (Scheduler) | `cron(5 */4 * * ? *)`, UTC, window OFF | `NewsProjectInvokeAgentLambda-dev` | :05 after Gemini. **08:05 in peak** |
| `InvokeDev` (Scheduler) | `cron(0 23 * * ? *)`, **Asia/Tokyo**, flexible 5 min | `newsPostDevTo` | = **14:00–14:05 UTC**. Resolves the "23:00 vs ~14:01" puzzle: the schedule is in JST. Unchanged by this batch |
| `countryIntelliegence` (Scheduler) | `cron(0 7 * * ? *)`, UTC, OFF | `newsCountryIntelligence` | 07:00, **in peak** |
| `Fact` (Scheduler) | `cron(0 5 * * ? *)`, **Asia/Tokyo**, flexible 10 min | `newsCountryFactsUpdater` | = 20:00 UTC previous day; off-peak; **no LLM** (Wikidata + ACLED) |
| `InvokeLinkedIn` (Scheduler) | `cron(20 */3 * * ? *)`, Asia/Tokyo | `newsPostLinkedin` | no LLM; reads `latest`; untouched |
| `TriggerDailyAnalysis` (Rule) | `cron(30 6 * * ? *)` | `newsThreadAnalysis` | 06:30, in peak. **Model today = Gemini 2.5 Flash (free), not DeepSeek**; becomes DeepSeek at D2b |
| `TriggerNewsSystemsAnalysis` (Rule) | `cron(15 7 * * ? *)` | `newsSystemsAnalysis` | v4-pro, in peak |
| `TriggerDriftCorrector` (Rule) | `cron(20 7 * * ? *)` | `newsDriftCorrector` | flash; only calls the LLM when a country's read moved |
| `newsSourceAuditDaily` (Rule) | `cron(30 8 ? * * *)` | `newsSourceAudit` | `AUDIT_MODEL=deepseek-v4-pro`, in peak |
| `TriggerFreshnessMonitor` (Rule) | `cron(30 0/2 * * ? *)` | `newsFreshnessMonitor` | live `STALE_HOURS=9` (repo default 5) |
| `TriggerBreakingAlert` (Rule) | `cron(15 */4 * * ? *)` | `newsBreakingAlert` | no LLM; reads `latest` (see dependencies) |
| `TriggerDriftEmailSend` (Rule) | `cron(40 7 * * ? *)` | drift email | **DISABLED**; must stay after drift if ever enabled |
| `TriggerWeeklyBrief` (Rule) | `cron(0 6 ? * SUN *)` | `newsWeeklyBrief` | Sunday, off-peak; reads `THREAD_ANALYSIS` + `COUNTRY_INTELLIGENCE` |

Observed run times (CloudWatch `Duration` max, 25 Aug – 12 Sep, healthy): agent 108 s, Gemini 45 s, thread analysis 373 s (Gemini's 13 s spacing × 10 threads), systems 242 s, country 181 s, drift 11 s, source audit 22 s.

**Deployed code hashes at plan time** (for rollback proof): agent `aXtqVyLeb0d/IYqzGW31R49sCY5oejiIeh427d7N/uo=`, country `SoZc5GnzEp5AHQDQYoOgNtnOv4b/Ln5oSnXs+YlyRKU=`, drift `iBAAoJiz054UkfcRlLkyKPdeh3ERkVQr1pY+i+jRIgA=`, source audit `YGkB1IdrxNuFhbPu1RKLsVMKor/ykg85H4wkmUD4zMQ=`.

### Finding that changes R2's premise (evidence: agent logs 22–29 Sep)
`Starting generation for 17 topics (generationId: gen-1789257646696)` appears **every 4 h with the same `generationId`** (a 13 Sep staging item; `staging` and `latest` are both still `gen-1789257646696`, `updatedAt` 2026-09-13T00:00:46Z). So when Gemini fails, the agent re-processes the same staging six times a day (17 topics × up to 4 LLM calls each). That is the real, guaranteed waste. In a healthy pipeline each staging is processed once, and Gemini's prompt already asks for topics *not* covered in the last 24 h (`seen-today`, `newsInvokeGemini/src/index.js` ~L60, L556–566), so the same topic id rarely returns (0 shared topic ids between consecutive daily archives 6–12 Sep; overlap **within** a day could not be measured: logs keep 7 days, the archive merges by id). Therefore R2 has two layers:
1. **Run guard (certain win):** skip the whole run when this staging was already fully processed.
2. **Topic fingerprint (win = only for recurring stories; unmeasured):** to be measured after the top-up from the new `reused` counts.

The bigger day-to-day saving comes from R3 (6 → 3 Gemini + agent runs a day) and R1 (countries), not R2.

---

## 1. Target schedule (all UTC; peak = Mon–Fri 01:00–04:00, 06:00–10:00; margins ≥ 10 min)

| Job | Now | Proposed | Why this time |
|---|---|---|---|
| Topic selection (`InvokeGoogleGemini`) | 00, 04, 08, 12, 16, 20 :00 | **04:15, 12:15, 20:15** (`cron(15 4/8 * * ? *)`) | 8-hourly (R3), all off-peak; 12:15 lands 1 h 45 m before the 14:00 daily brief |
| Story agent (`InvokeNewsAgent`) | :05 every 4 h | **04:25, 12:25, 20:25** (`cron(25 4/8 * * ? *)`) | 10 min after Gemini (was 5): Gemini max 45 s today; D3 (v4-pro topic selection) will slow it, 10 min keeps the order safe |
| Thread analysis (`TriggerDailyAnalysis`) | 06:30 | **04:40** (`cron(40 4 * * ? *)`) | after the 04:25 agent (max 108 s) wrote the archive; finishes ≤ 04:47 (373 s observed) |
| Systems (`TriggerNewsSystemsAnalysis`) | 07:15 | **05:00** (`cron(0 5 * * ? *)`) | after thread analysis (reads `THREAD_ANALYSIS`); ≥ 13 min slack; finishes ≤ 05:05 |
| Country briefings (`countryIntelliegence`) | 07:00 | **05:15** (`cron(15 5 * * ? *)`) | after thread analysis (reads it); finishes ≤ 05:20 even on the heaviest day; before 06:00 peak |
| Drift (`TriggerDriftCorrector`) | 07:20 | **05:30** (`cron(30 5 * * ? *)`) | ≥ 10 min after country briefings (R4 by offset, **no IAM change**) |
| Source audit (`newsSourceAuditDaily`) | 08:30 daily | **11:30 Mon/Wed/Fri** (`cron(30 11 ? * MON,WED,FRI *)`) | off-peak, 3 × a week (P4) |
| Country facts (`Fact`) | 05:00 JST daily (20:00 UTC) | **Monday 05:00 JST** (= Sun 20:00 UTC) (`cron(0 5 ? * MON *)`, Asia/Tokyo) | weekly (R4); no LLM; weekend |
| Daily brief (`InvokeDev`) | 14:00–14:05 | **unchanged** | reads `today-archive` (fresh from the 12:25 agent) + thread/country analyses from 05:xx |
| Weekly brief | Sun 06:00 | unchanged | Sunday = off-peak. Bonus: it now sees the same day's analyses (chain finishes 05:30; before, the chain ran 06:30–07:20, *after* it) |

Dependency order (found in code): `newsInvokeGemini` (writes `staging`) → agent (reads `staging`, writes `TOPIC#`, `latest`, `today-archive`, `archive#day`) → `newsThreadAnalysis` (reads archive; writes `THREAD#`) → `newsSystemsAnalysis` (reads archive + `THREAD_ANALYSIS`; writes `SYSTEMS#`) and `newsCountryIntelligence` (reads archive + `THREAD_ANALYSIS` + `DRIFT#` + `FACTS#`; writes `COUNTRY#` + `HISTORY#`) → `newsDriftCorrector` (reads `HISTORY#` + archive; writes `DRIFT#`) → daily brief (reads `today-archive`, `THREAD_ANALYSIS`, `COUNTRY_INTELLIGENCE`) and `newsWeeklyBrief` / `newsSignals` / `newsBreakingAlert` (read `COUNTRY_INTELLIGENCE`).

Other timing couplings (checked, **no change needed unless stated**):
- `newsFreshnessMonitor` (`STALE_HOURS=9`, probes `asOf` = staging `updatedAt` every 2 h at :30). With 8-hourly topics the oldest `asOf` before a refresh is ≈ 8 h 0 m (probe at 10:30 = 6.25 h, next at 12:30 = fresh). A missed run alerts at 14:30 (10.25 h). **Keep 9.** 
- **Proxy staleness flag (needs a decision, Q3):** `newsSensitiveData-dev` marks `stale:true` when topics are older than `TOPICS_CACHE_MAX_AGE_SECONDS` (env not set → default 9000 s = 2.5 h). At 4-hourly it was stale 1.5 h in 4; at 8-hourly it is stale 5.5 h in 8. The only consumer is the old Home's "Topics refreshing — showing latest available" banner (`useGeminiTopics.js` L47, `Home.jsx` L385); the old home is replaced at the S6 swap and the map home uses its own freshness ramp. Fix = set the env to 32400 (9 h) on the proxy (its own bare command; the proxy is the site's spine, so it needs an explicit yes), or accept the banner until S6.
- `newsBreakingAlert` (`cron(15 */4)`) reads `latest`; with 8-hourly topics it would look at the same topics twice. Harmless (dedupe), not in scope; optional retime to `cron(35 4/8 * * ? *)` (Q9).
- `TriggerDriftEmailSend` (disabled, 07:40): if ever enabled it must move to ≥ 05:45.
- `TriggerSituationIngest` (hourly, flash) has 7 of 24 hours in peak on weekdays; cannot be moved without changing its cadence. Not in this batch (Q10).

---

## 2. Items

### P4 — source audit → flash, 3 × a week
**Goal:** the audit stops using the priciest model and runs 3 × a week off-peak.
**Resources:**
- Lambda `newsSourceAudit` (`amplify/backend/function/newsSourceAudit/src/index.js`; model read at L27 `AUDIT_MODEL`; calls DeepSeek per top-6 topic, `max_tokens` 400).
- Env `AUDIT_MODEL=deepseek-v4-pro` (live). Other env: `AUDIT_N=6`, `DRIFT_ALERT_THRESHOLD=2`, `GROK_API_URL=https://api.deepseek.com/chat/completions`, `XAI_API_KEY` (redacted), `PROXY_ENDPOINT`, `SNS_TOPIC_ARN`.
- EventBridge rule `newsSourceAuditDaily`, `cron(30 8 ? * * *)`, ENABLED, description "Daily source-truth audit (summarizer dead-man's-switch)". Role `newsSourceAudit-role`.

**Deployed-vs-repo:** downloaded and diffed: **identical** (no code change needed; `diff -rq` empty). Code default stays `deepseek-v4-pro` (env overrides it); optionally change the default in a later hygiene commit, no deploy.

**Change (env, then schedule; bare single commands):**
1. Fetch → merge → write the full map, secret via temp file: `aws lambda get-function-configuration --function-name newsSourceAudit --query Environment --output json > $S/env_audit.json` → set `Variables.AUDIT_MODEL` to `deepseek-flash` (every other key byte-identical) → `aws lambda update-function-configuration --function-name newsSourceAudit --environment file://$S/env_audit.json` → **delete the temp file**. Verify: `get-function-configuration` → `AUDIT_MODEL`, other keys' hashes unchanged, `LastUpdateStatus=Successful`.
2. `aws events put-rule --name newsSourceAuditDaily --schedule-expression "cron(30 11 ? * MON,WED,FRI *)" --state ENABLED --description "Source-truth audit Mon/Wed/Fri (summarizer dead-man's-switch); rule name kept (renaming needs a new rule + lambda add-permission)"`. The rule keeps its (now misleading) name on purpose: a new rule would need `lambda add-permission`, which is not in the standing authorization. Targets survive `put-rule`. Verify with `describe-rule` + `list-targets-by-rule`.

**Tests:** none exist for this Lambda. No code change, so none added.
**Verification now (no balance):** `describe-rule`, `get-function-configuration`; nothing else can run (audit calls DeepSeek and the proxy).
**Verification after top-up:** one manual `aws lambda invoke` (operator go; writes nothing except an SNS mail if ≥ 2 drifts) and compare verdicts on the same 6 topics with `quality/analysis/source_check.mjs` run against pro. Watch the next Mon/Wed/Fri log line `Source audit: N summary-drift / M single-source of 6 checked`.
**Rollback:** same env procedure with `deepseek-v4-pro`; `aws events put-rule --name newsSourceAuditDaily --schedule-expression "cron(30 8 ? * * *)" --state ENABLED --description "Daily source-truth audit (summarizer dead-man's-switch)"`.
**Risk:** low cost risk; quality risk: flash may miss subtle hedge-stripping that pro catches (false negatives on a dead-man's-switch). Mitigation: the A/B above once, and the audit is only an alert, not a gate.

---

### R2 — regenerate a story only when it is new or its articles changed
**Goal:** (1) never re-process a staging that was already fully processed; (2) per story, skip summary / cause / forecast when the article set is unchanged; (3) forecast at most once per story per UTC day; (4) served items never expire or get pruned while still current.
**Resources:**
- Lambda `NewsProjectInvokeAgentLambda-dev`, repo `amplify/backend/function/NewsProjectInvokeAgentLambda/src/`: `index.js` (1271 lines: handler L114–~232, `generateAndStore` L520, `writeCache` L681, `logPredictionSnapshot` L830, `swapStagingToActive` L871, `pruneObsoleteEntries` L900; TTL defaults L32–33), `lib.js` (215 lines, exports at L203; **new pure functions go here**), `url-normalize.js` (existing `normalizeUrl`, reused for the fingerprint), test `../test/lib.test.js` (21 tests, all pass today).
- Scheduler `InvokeNewsAgent` (see §1 for the new time; R3 item).
- Tables: `SummarizeAndPredict` (`TOPIC#<id>` × `SUMMARY` / `TRACE_CAUSE` / `PREDICTION` / `RESEARCH_BRIEFING`), `NewsCache` (`staging`, `latest`), `GlobalPerspectivePredictionLog` (`PRED#<id>` / SK `YYYY-MM-DD`).
- Role `newsprojectLambdaRole1fd679db-dev` has `AmazonDynamoDBFullAccess`: **no IAM change**.

**Deployed-vs-repo:** downloaded `NewsProjectInvokeAgentLambda-dev` (zip = `index.js lib.js matcher.js url-normalize.js entity-normalize.js package.json`) and diffed against repo `src/`: **only** L15 (dead fallback string: deployed `'grok-4-1-fast-non-reasoning'`, repo `'deepseek-v4-flash'`, env overrides both) and a comment near L590. **Edit the repo, it is the right base.** In the same edit set the fallback to `'deepseek-flash'` (do not reintroduce the retired name).

**Findings that shape the design (all from code):**
- `pruneObsoleteEntries` (L900) deletes **every `TOPIC#` item whose `generationId` ≠ the current one**, and the swap only happens `if outputs.length > 0` (L179 / L203). A naive "skip unchanged topics" would (a) prune the skipped stories' items and (b) never swap when every topic is skipped. So a skipped story must be **re-stamped** (`generationId`, `ttl`, `lastVerifiedAt`) and counted as usable.
- `ttl` is written on every item (1 h default, L32–33) but **nothing uses it for freshness**: `summaryPredictionFresh()` is `return true` (`newsSensitiveData/src/index.js` L1620); `ttl` is only echoed as `remainingTtlSeconds` (Home.jsx L199/L255 put it in `metadata`, unused); the table's TTL feature is **disabled** (memory). It only matters if TTL is ever re-enabled, so make the default safe anyway (3 days, longer than 8 h × a few failed runs).
- `logPredictionSnapshot` does an unconditional `Put` on `PRED#<id>`/`<day>`: today the "immutable" daily snapshot is **overwritten by every run** (last of the day wins). After this change the first of the day stands. Also add `ConditionExpression: 'attribute_not_exists(PK)'` and swallow `ConditionalCheckFailedException`.
- `threadId` assignment (~L166–200), the story matcher, the swap and the archive all run from `stagingItem` after generation: keep them exactly, only change their gate from `outputs.length > 0` to `usable > 0`.
- The proxy spreads the stored item into its response, so two new fields (`sourceFingerprint`, `lastVerifiedAt`) will appear in `summary` / `prediction` responses. Harmless (extra keys).

**Exact change (sketch):**
```js
// lib.js  (pure, unit-tested; requires ./url-normalize which is already in the zip)
function sourceFingerprint(topic) {            // null => cannot fingerprint => always regenerate
  const urls = (topic.sources || []).map(s => normalizeUrl(s.url)).filter(Boolean);
  const basis = urls.length ? urls
    : (topic.sources || []).map(s => String(s.snippet || '').trim().toLowerCase()).filter(Boolean);
  if (!basis.length) return null;
  return crypto.createHash('sha1').update([...new Set(basis)].sort().join('\n')).digest('hex').slice(0, 16);
}
function decideReuse({ kind, existing, fingerprint, predictionLoggedToday, force }) {
  if (force) return { reuse: false, reason: 'force' };
  if (!existing) return { reuse: false, reason: 'new' };
  if ((kind === 'prediction' || kind === 'trace_cause') && existing.contentFormat !== 'json')
    return { reuse: false, reason: 'bad-content' };            // heals malformed stored output
  if (kind === 'prediction' && predictionLoggedToday) return { reuse: true, reason: 'once-per-day' };
  if (!fingerprint) return { reuse: false, reason: 'no-fingerprint' };
  if (existing.sourceFingerprint !== fingerprint)
    return { reuse: false, reason: existing.sourceFingerprint ? 'changed' : 'legacy-item' };
  return { reuse: true, reason: 'unchanged' };
}
// index.js
// 1. after loadTopics(): run guard
if (!force && !topicId && item?.agentProcessedAt) return http(200, { success: true, skipped: 'staging-already-processed', generationId });
// 2. generateAndStore(...) becomes ensureStored(...): read existing item (Get), for 'prediction' also Get
//    PRED#<id>/<today> from PREDICTION_LOG_TABLE; decideReuse(); if reuse -> touchItem() (UpdateCommand
//    SET generationId=:g, ttl=:t, lastVerifiedAt=:n  ConditionExpression attribute_exists(PK); also for
//    RESEARCH_BRIEFING when kind === 'prediction') and push the existing item into `reused[]`;
//    else generate as today and pass sourceFingerprint into writeCache (item.sourceFingerprint = fp).
// 3. usable = outputs.length + reused.length gates threadId assignment, swap, archive (replaces `outputs.length > 0`)
// 4. after the archive/prune: if (failed === 0 && !topicId) UpdateItem on item.id SET agentProcessedAt = :now
//    (Gemini rewrites `staging` with a full Put each run, so the marker resets itself for a new staging)
// 5. payload flags: `force` (bypass guard + reuse), `dryRun` (log decisions per topic/kind, no LLM, no writes, no swap)
// 6. defaults: SUMMARY_PREDICT_TTL_SECONDS / PREDICTION_TTL_SECONDS 3600 -> 259200
```
Log line per run: `Generation complete: G generated, R reused, F failed` (the R count is the measurement for the recurring-story question).

**Tests:** extend `NewsProjectInvokeAgentLambda/test/lib.test.js` (`cd .../src && npm test`, 21 pass today): fingerprint is order-, tracking-param-, `www.`-insensitive and changes when a URL is added / removed; `null` when no sources; `decideReuse` table (new, legacy item, changed, unchanged, bad JSON, forecast already logged today with changed sources → reuse, `force`). Handler behaviour is covered by the `dryRun` payload below (no handler test harness exists).
**Verification now (no balance):** unit tests; deploy; then `aws lambda invoke ... --payload '{"dryRun":true}'` (operator go: it reads DynamoDB only, writes nothing) → expect the 17 frozen 13-Sep topics reported as `legacy-item` (regenerate) and `staging-already-processed` is **not** yet set. Confirm the log shows zero LLM calls and zero writes.
**Verification after the top-up:** (1) first run regenerates everything (legacy items, expected) and sets `agentProcessedAt`; (2) an immediate second invoke returns `skipped: staging-already-processed` and DeepSeek usage does not move; (3) `{"force":true}`-free re-run after clearing the marker shows `R = 17, G = 0`; (4) `latest.generationId` = staging's, archive written, `TOPIC#` items still present after prune; (5) a day's `PRED#` rows: one per story per day, `generatedAt` = first run; (6) the next 3 real runs' `reused` counts tell us the true recurring-story rate.
**Rollback:** `aws lambda update-function-code --function-name NewsProjectInvokeAgentLambda-dev --zip-file fileb://<fresh re-download of the recorded zip, sha256 aXtqVyLe…/uo=>`. Items written with the extra fields are harmless to the old code. (The `agentProcessedAt` marker on `staging` is ignored by the old code.)
**Risk:** medium (the live spine of content). Failure modes designed against: pruning skipped items (re-stamp), no swap when all skipped (`usable`), stuck marker after partial failure (only set when `failed === 0`), a manual `force` for ops. Behaviour change to record: the daily forecast snapshot is now the **first** of the day.

---

### R3 — topic selection every 8 h
**Goal:** 3 selections a day instead of 6, all off-peak, aligned with the agent and the daily brief.
**Resources:**
- Scheduler `InvokeGoogleGemini` → `newsInvokeGemini-dev`, and Scheduler `InvokeNewsAgent` → `NewsProjectInvokeAgentLambda-dev` (§0 for the live values; the agent must move with it).
- Repo `amplify/backend/function/newsInvokeGemini/src/index.js` (**no code change**); `TOPICS_LIMIT=13`; `GROK_MODEL=deepseek-flash`.

**Deployed-vs-repo:** `newsInvokeGemini-dev` zip (16.8 MB, bundles `node_modules`) vs repo `src/`: only the L24-ish dead model fallback string differs (`grok-4-1-fast-non-reasoning` vs `deepseek-v4-flash`) plus `test_enrichment.js` / `.DS_Store` not deployed. **No code change, no deploy.**
**Change (two bare commands, run at HH:30 so neither fires within 10 min; agent first, then Gemini):**
```
aws scheduler update-schedule --name InvokeNewsAgent --group-name default --schedule-expression "cron(25 4/8 * * ? *)" --schedule-expression-timezone UTC --flexible-time-window Mode=OFF --action-after-completion NONE --state ENABLED --target '{"Arn":"arn:aws:lambda:ap-northeast-1:280362093938:function:NewsProjectInvokeAgentLambda-dev","RoleArn":"arn:aws:iam::280362093938:role/service-role/Amazon_EventBridge_Scheduler_LAMBDA_515d087ff9","RetryPolicy":{"MaximumEventAgeInSeconds":86400,"MaximumRetryAttempts":0}}'
aws scheduler update-schedule --name InvokeGoogleGemini --group-name default --schedule-expression "cron(15 4/8 * * ? *)" --schedule-expression-timezone UTC --flexible-time-window Mode=OFF --action-after-completion NONE --state ENABLED --target '{"Arn":"arn:aws:lambda:ap-northeast-1:280362093938:function:newsInvokeGemini-dev","RoleArn":"arn:aws:iam::280362093938:role/service-role/Amazon_EventBridge_Scheduler_LAMBDA_7bf09ef389","RetryPolicy":{"MaximumEventAgeInSeconds":86400,"MaximumRetryAttempts":0}}'
```
(`update-schedule` **replaces** the whole schedule, so every field is repeated from the live `get-schedule`.)
**Tests:** none (schedule only). **Verification now:** `get-schedule` for both → expression, tz, state ENABLED, target/role/retry byte-identical to §0; `describe-rule TriggerFreshnessMonitor` unchanged. **After top-up:** the 04:15 / 12:15 / 20:15 runs each followed by an agent run 10 min later with a *new* `generationId`; `newsFreshnessMonitor` stays quiet; the 14:00 brief lists stories from the 12:15 run.
**Rollback:** the same two commands with `cron(0 */4 * * ? *)` (Gemini) and `cron(5 */4 * * ? *)` (agent).
**Risk:** low. Content is up to 8 h old (was 4 h); `newsSensitiveData-dev` will flag `stale` for the last 5.5 h of each cycle (Q3); `newsBreakingAlert` sees fewer new stories per 4-hourly look (Q9). Brave / Gemini quota use halves.

---

### D5 — move the peak-window DeepSeek jobs
**Goal:** every scheduled DeepSeek job outside 01–04 and 06–10 UTC on weekdays.
**Resources (each row = one bare command; verify with `describe-rule` / `get-schedule` after each):**

| Job | Resource | Live now | New | Command |
|---|---|---|---|---|
| Thread analysis | Rule `TriggerDailyAnalysis` → `newsThreadAnalysis` | `cron(30 6 * * ? *)`, no description | `cron(40 4 * * ? *)` | `aws events put-rule --name TriggerDailyAnalysis --schedule-expression "cron(40 4 * * ? *)" --state ENABLED` |
| Systems | Rule `TriggerNewsSystemsAnalysis` → `newsSystemsAnalysis` | `cron(15 7 * * ? *)` | `cron(0 5 * * ? *)` | `aws events put-rule --name TriggerNewsSystemsAnalysis --schedule-expression "cron(0 5 * * ? *)" --state ENABLED --description "Daily trigger for newsSystemsAnalysis at 05:00 UTC"` |
| Country | Scheduler `countryIntelliegence` → `newsCountryIntelligence` | `cron(0 7 * * ? *)`, UTC, OFF | `cron(15 5 * * ? *)` | `aws scheduler update-schedule --name countryIntelliegence --group-name default --schedule-expression "cron(15 5 * * ? *)" --schedule-expression-timezone UTC --flexible-time-window Mode=OFF --action-after-completion NONE --state ENABLED --target '{"Arn":"arn:aws:lambda:ap-northeast-1:280362093938:function:newsCountryIntelligence","RoleArn":"arn:aws:iam::280362093938:role/service-role/Amazon_EventBridge_Scheduler_LAMBDA_8e9cecc403","RetryPolicy":{"MaximumEventAgeInSeconds":86400,"MaximumRetryAttempts":0}}'` |
| Drift | Rule `TriggerDriftCorrector` → `newsDriftCorrector` | `cron(20 7 * * ? *)` | `cron(30 5 * * ? *)` | (R4 below) |
| Source audit | Rule `newsSourceAuditDaily` | `cron(30 8 ? * * *)` | Mon/Wed/Fri 11:30 | (P4 above) |
| Gemini 08:00 run | Scheduler `InvokeGoogleGemini` | 6 × a day | 04:15 / 12:15 / 20:15 | (R3 above) |

**Deployed-vs-repo:** no code changes in this item. **Tests:** none. **Do all four chain moves in one sitting, in reverse order of the chain** (drift, country, systems, thread) at a time with no fire due in the next 20 min, so a run never sees a half-moved chain.
**Verification now:** `describe-rule` / `get-schedule` for each; a table of old vs new in the tracker. **After top-up:** on the first weekday, CloudWatch invocation timestamps for `newsThreadAnalysis` 04:40, systems 05:00, country 05:15, drift 05:30 (all before 06:00); `Duration` well inside the slack in §1; no `Task timed out`. Compare a day's DeepSeek bill / usage page for peak-hour usage = 0 from these jobs.
**Rollback:** the recorded old expressions in §0 (rules: `put-rule`; Scheduler: `update-schedule` with the old expression).
**Risk:** low. If a run overruns into 06:00 it just pays peak for the overlap. Thread analysis is on Gemini today, so this move saves nothing until D2b; it is done now so the D2b switch does not need another schedule change (then also lower `INTER_CALL_DELAY_MS`, 13 s is a Gemini free-tier spacing).

---

### R1 — country briefings weekly + early refresh
**Goal:** a country's briefing is rewritten (a) weekly as a baseline, (b) early when it has an active HIGH situation or GDACS alert, or (c) on a real coverage jump; **at most once per UTC day per country**. Schedule stays daily (it decides per country).
**Resources:**
- Lambda `newsCountryIntelligence`, repo `amplify/backend/function/newsCountryIntelligence/src/index.js`: handler L54–~101 (loop ~L74–96; today's skip rule at L83: `existing.totalArticles === country.totalArticles`), `readExisting` L230, `writeAnalysis` L525–597 (writes `COUNTRY#<name>`/`COUNTRY_INTELLIGENCE` and `HISTORY#<day>`), `MAX_COUNTRIES=20` L46, `ARCHIVE_DAYS=30`. **New file** `src/refreshPolicy.js` (pure) + **new** test dir `newsCountryIntelligence/test/` (none exists).
- Scheduler `countryIntelliegence` (D5 row). Model `deepseek-v4-pro` (`GROK_MODEL`), timeout 603 s, 512 MB. Role `newsCountryIntelligence-role-xqboqh2y` (**DynamoDB full access only, no S3**).
- Event sources (verified live): the public file `https://globalperspective.net/data/world/latest.json` (HTTP 200 from a plain GET today; same object the site reads via the Worker): `situations[]` with `tier` (`low|moderate|elevated|high`), `state` (`emerging|escalating|cooling|closed`), `source` (`gdacs` or news), `affected_names[]` and `iso3_affected[]`. GDACS Red → `high`, Orange → `elevated` (`situations-core.js` L16–21), and a situation is only opened for Orange/Red, so "GDACS alert" = `source==='gdacs'` and state `emerging|escalating`. **News-sourced situations have `affected_names: []`** (`situations-core.js` L284) so they need an ISO3 → name table (Q6).
- Current data (read live): 48 `COUNTRY#` records; the 20 most-covered were last generated 11–12 Sep (all cross 30 days on 11–12 Oct); the rest are older (Sudan 28 Apr …). The world file today has 1 situation (closed).

**Deployed-vs-repo:** downloaded `newsCountryIntelligence` (zip = `index.js package-lock.json package.json riskDimensions.js country_facts.json`) vs repo: **only** L15 fallback (`grok-4-1-fast-non-reasoning` vs `deepseek-v4-pro`) and a comment ~L615. **Edit the repo (correct base)**; set the fallback to `'deepseek-v4-pro'` (already the repo value). `riskDimensions.js` and `country_facts.json` are byte-synced copies guarded by `scripts/check-shared-sync.mjs`: do not touch them.

**Exact change (sketch):**
```js
// src/refreshPolicy.js  (pure, no AWS)
const DAY = 86400000;
function decideRefresh({ existing, country, now, hot, cfg }) {
  if (!existing) return { refresh: true, reason: 'new' };
  const last = Date.parse(existing.generatedAt);
  if (String(existing.generatedAt).slice(0, 10) === now.toISOString().slice(0, 10)) return { refresh: false, reason: 'same-day' };
  if (existing.totalArticles === country.totalArticles) return { refresh: false, reason: 'unchanged' };   // today's rule, kept
  const ageH = (now - last) / 3600000;
  if (ageH >= cfg.baselineHours) return { refresh: true, reason: 'baseline' };                            // 156 h = 6.5 d
  if (hot.has(normName(country.countryName))) return { refresh: true, reason: 'event' };
  const newSince = country.entryDates.filter(d => d > String(existing.generatedAt).slice(0, 10)).length;
  const expected = (existing.totalArticles / cfg.archiveDays) * (ageH / 24);
  if (newSince >= cfg.jumpMin && newSince >= cfg.jumpFactor * Math.max(expected, 1)) return { refresh: true, reason: 'coverage-jump' };
  return { refresh: false, reason: 'not-due' };
}
async function loadHotCountries(fetchImpl, url) {   // any failure => empty set (never blocks the baseline)
  // fetch world/latest.json; keep situations with state in {emerging, escalating} and
  // (tier === 'high' || source === 'gdacs'); names = affected_names, plus iso3_affected via the
  // ISO3 -> name table (Q6); returns Set of normalized names
}
// index.js: groupByCountry also returns `entryDates` (the entries' YYYY-MM-DD list); the loop calls
//   decideRefresh({ existing, country, now, hot, cfg }); logs `[country] <name> <reason>`; the summary line
//   becomes `generated N (baseline B, event E, jump J, new W), skipped S, failed F`.
// event.dryRun === true: same decisions + log, no LLM, no writes, returns the plan.
// env (defaults in code): COUNTRY_BASELINE_HOURS=156, COVERAGE_JUMP_MIN=8, COVERAGE_JUMP_FACTOR=2, WORLD_LATEST_URL.
```
Definitions to confirm (Q4, Q7): **coverage jump** = at least 8 new stories since the last briefing **and** at least twice that country's own 30-day average pace over the same period (the US at 268 / 30 d needs ~18 a day; Iran at 62 / 30 d needs ~13 after 3 days). **Cap stays top 20** by coverage: a disaster country outside the top 20 is not briefed (keeps the card copy "we brief the 20 most-covered countries" true; Q5).
Effect: today's cost is up to 20 v4-pro calls (max_tokens 5000) a day; the weekly baseline is ~20 a week ≈ 3 a day plus early refreshes, an estimate to be measured from the new summary line (no post-lapse data exists).

**Frontend coupling (branch `map-console`; deployed only with the operator's deploy "yes"):** with weekly readings the card must not say "older" at 8 days, and the direction rule (needs 3 readings within 5 days) can never fire.
- `src/shared/lib/freshness.js` L51–53: `freshnessState(ageDays)` bands `<1 live · <7 plain · <30 older`. **Do not change the shared ramp** (stories, situations and the map use it); add an optional argument `freshnessState(ageDays, olderAfterDays = 7)` (L52 `if (ageDays < olderAfterDays)`) and export `COUNTRY_OLDER_AFTER_DAYS = 14`.
- `src/features/countries/components/CountryCardV2.jsx`: L49 (`freshnessState(ageDays)` → pass 14), L52 comment "(<=7d) / (7-30d)"; state/labels L54, L94 unchanged.
- `src/features/map/lib/countryRiskLayer.js`: L57–58 (same call, pass 14), header comments L10 and L115 ("7-30d"); consumed by `HudCountryRiskFeed.jsx` L40 ("· older") and the map layers.
- `src/features/map/components/MapLegend.jsx` L121 and L161 ("7–30 days · faded, “older”") and `legend.js` L10: the legend is shared by stories (7 d) and countries (14 d); reword so both are true (Q8).
- `src/features/countries/lib/countryDirection.js`: header comment L10–11, doc L62, **L90** `ageDays > 7 ? 'amber' : 'full'` → `COUNTRY_OLDER_AFTER_DAYS`, and the rule itself: constants L16–19 and L92–116 (3-reading buckets, 14-day-earlier bucket).
  - **Proposed rule (Q4, recommended):** compare the latest reading (median of readings in the last 3 days if there are ≥ 2, else the single one) with the reading nearest 7 days earlier (accept 4–10 days); arrow needs |Δ| ≥ **15** on the worst-axis score (was 10 with medians of 3); axis named at own Δ ≥ 15 (unchanged); "at top of scale" when both ≥ 95 (unchanged); hidden > 30 d (unchanged).
  - **Evidence for 15** (live `HISTORY#`, 1,677 readings, 48 countries, read 2026-09-29): consecutive-day |Δ| ≥ 10 in 13 % of pairs and ≥ 15 in 6 % (that is model noise, since the real state rarely moves that fast); 7-day-apart |Δ| ≥ 10 in 26 %, ≥ 15 in 15 %; median 3. With single readings, 10 would call the same country "worse / better" about 1 week in 4, of which roughly half is noise; 15 halves that.
- **Tests to update:** `src/shared/lib/__tests__/freshness.test.js` (L69–95: add the 2-arg cases, default unchanged); `src/features/map/lib/__tests__/countryRiskLayer.test.js` L58–67 (3 d full; 10 d **not** older; 15 d older; 45 d hidden); `src/features/countries/__tests__/countryDirection.test.js` (9 cases; rewrite the fixtures of L26 gap, L43 up, L54 down, L65 unchanged, L75 axis, L87–99 freshness for the new rule; keep L16 hidden > 30, L22 no history, L32 top of scale); `src/features/map/__tests__/mapLegend.test.jsx` if it asserts the legend text. Then `cd global-perspectives-starter/frontend && npm run verify`, and a browser click-through of the country card in the map console and the country page at desktop and 390 px (the data will still be the frozen 11–12 Sep records, so also check a synthetic 10-day and 20-day age).

**Tests (Lambda):** new `newsCountryIntelligence/test/refresh.test.js` (`node --test`, add `"test"` script to `src/package.json`): new / same-day / unchanged / baseline just under and over 156 h / event hot vs not hot / coverage jump on and off / hot-set parsing (GDACS Orange + Red, news HIGH via ISO3, `cooling` and `closed` ignored, fetch failure → empty set, name case + alias).
**Verification now (no balance):** unit tests; deploy; then `aws lambda invoke ... --payload '{"dryRun":true}'` (operator go; no LLM, no writes): expect every top-20 country `baseline` (all ≥ 17 days old), the `[world]` line showing the fetch status from inside AWS. **Unknown until run:** Cloudflare could challenge a Lambda IP; the code then returns an empty hot set (baseline unaffected), and the fallback would be an S3 read that needs an IAM change (flagged in §4, not planned).
**Verification after the top-up:** first run refreshes all 20 (expected, records are stale) with `HISTORY#<day>` rows; the next day's run logs `skipped … same-day/unchanged/not-due` for all; simulate an event by dry-run with a GDACS Orange country; one week later `baseline` fires per country; card shows "Briefed <date>" without "older" until day 14. **Deadline:** must run before ~11 Oct when the current records pass 30 days (cards hide all scores).
**Rollback:** `update-function-code` with the recorded deployed zip (sha `SoZc5Gn…/RKU=`); the schedule is unchanged by this item; frontend rollback = `git revert` of the frontend commit (deploy gate).
**Risk:** medium. (1) A country name mismatch between `regions` and GDACS `affected_names` (e.g. "United States" vs "USA", there are both `COUNTRY#USA` and `COUNTRY#United States` records today): event triggers silently do not fire; dry-run prints unmatched names. (2) Weekly cadence makes `HISTORY#` sparse, so the drift corrector's 10-day lookback must widen (R4). (3) The frontend and Lambda must go live close together, otherwise cards say "older" in the weekly rhythm (honest but noisy) and the arrow shows "not enough readings".

---

### R4 — drift after country briefings; country facts weekly
**Goal:** drift always sees the day's country briefing; facts refresh weekly.
**Resources:**
- Rule `TriggerDriftCorrector` → `newsDriftCorrector` (repo `amplify/backend/function/newsDriftCorrector/src/index.js` + `lib.js`, test `../test/lib.test.js` 14 pass). Env live: `DRIFT_LOOKBACK_DAYS=10`, `DRIFT_MAX_EVENTS=25`, `DRIFT_TTL_DAYS=60`, `GROK_MODEL=deepseek-flash`; `DRIFT_COUNTRIES` unset = the 12 default countries.
- Scheduler `Fact` → `newsCountryFactsUpdater` (repo `amplify/backend/function/newsCountryFactsUpdater/src/index.js`; no LLM; writes `FACTS#<country>` incl. Wikidata leadership + ACLED 30-day counts for 12 countries; consumers: agent premise block, country briefing prompt).

**Deployed-vs-repo:** drift: `index.js` differs only in the model fallback (`'deepseek-chat'` deployed vs `'deepseek-v4-flash'` repo) and one comment; `lib.js` identical → **no code change, no deploy**. Facts: `index.js` differs by one ACLED error-log line (deployed logs status only; repo also logs the body). **Not touched** (schedule only).
**Change:**
1. Drift schedule by offset (chosen over invoke-on-completion, which would need `lambda:InvokeFunction` on the country role = IAM, not allowed without approval): `aws events put-rule --name TriggerDriftCorrector --schedule-expression "cron(30 5 * * ? *)" --state ENABLED --description "Daily living-analysis drift corrector, after newsCountryIntelligence (05:15 UTC)"`.
2. Drift env (same fetch → merge → write-whole-map, secret in a temp file, delete after): `DRIFT_LOOKBACK_DAYS` **10 → 16** and `DRIFT_MAX_EVENTS` **25 → 40**. Why: with weekly `HISTORY#` rows a 10-day window holds at most 2 snapshots, and the grounding prompt must cover a 7-day gap (`readCountryEvents(prior→current)`, `slice(-MAX_EVENTS)`). Drift stays daily: it is a deterministic no-op (no LLM) when nothing moved, and early refreshes create new snapshots on any day.
3. Facts weekly: `aws scheduler update-schedule --name Fact --group-name default --schedule-expression "cron(0 5 ? * MON *)" --schedule-expression-timezone Asia/Tokyo --flexible-time-window Mode=FLEXIBLE,MaximumWindowInMinutes=10 --action-after-completion NONE --state ENABLED --target '{"Arn":"arn:aws:lambda:ap-northeast-1:280362093938:function:newsCountryFactsUpdater","RoleArn":"arn:aws:iam::280362093938:role/service-role/Amazon_EventBridge_Scheduler_LAMBDA_5aadb48638","RetryPolicy":{"MaximumEventAgeInSeconds":86400,"MaximumRetryAttempts":0}}'` (Monday 05:00 JST = Sunday 20:00 UTC; the live description is the empty string, the command leaves it unset).
**Tests:** none new (schedule / env). **Verification now:** `describe-rule` / `get-schedule`; env diff shows only the two keys changed. **After top-up:** on a day with a new `HISTORY#` row the drift log shows it ran ≥ 10 min after the country log; a `DRIFT#<day>` note appears for a country whose read moved; the Sunday facts run writes 12 `FACTS#` rows (`lastUpdatedAt`).
**Rollback:** `put-rule ... "cron(20 7 * * ? *)"` with the old description; env back to `10` / `25`; `update-schedule --name Fact ... "cron(0 5 * * ? *)"` (rest identical).
**Risk:** low. ACLED counts in a briefing can be up to 7 days old (was 1); `leadershipChangedAt` detection is up to a week later (leaders change rarely; the agent's premise block reads the same rows).

---

## 3. Order of work (each phase = own bare commands, verified before the next; nothing spends DeepSeek balance)
1. **P4** (env + rule): cheapest, independent.
2. **R2** (agent code) + tests + deploy + `dryRun` check. Deploy **before** R3 so the run guard is live when the schedule changes.
3. **R3 + D5 + R4 schedule/env** in one sitting: agent, Gemini, then drift, country, systems, thread; then drift env. Verify all with reads.
4. **R1 Lambda** (code + tests + deploy + `dryRun`), then **R1 frontend** (tests, verify, click-through) committed on `map-console`; frontend goes out with the next gated deploy.
5. **Top-up** (operator, before 11 Oct), then the "after top-up" checks above, one item at a time, then the next-day CloudWatch timing check.
Commit rules: repo changes staged by explicit path, one coherent commit per Lambda / frontend change, `CHANGES.md` entry, docs updated in the same commit, `npm run verify` for frontend commits.

## 4. IAM changes
**None planned.** Confirmed: agent role and country role already have `AmazonDynamoDBFullAccess`; R4 uses a schedule offset (no `lambda:InvokeFunction`); R1 reads the public `globalperspective.net/data/world/latest.json` (no S3 grant). **Contingency only if Cloudflare blocks the Lambda fetch:** an `s3:GetObject` on `world/latest.json` for the country role (needs operator approval; not proposed now).

## 5. Docs to update on completion (same commits)
- `architecture/ARCHITECTURE.md`: Lambda §1 trigger (L194) and §2 trigger (L228) + the agent's run guard / fingerprint / reuse description; §4 country (L297: weekly baseline + early-refresh rules, `dryRun`); §9 systems (L448) and the ASCII chain (L69, L81); §11 facts (L489, weekly); §18 freshness note (8-hourly, `STALE_HOURS`); §24 source audit (L713: flash, Mon/Wed/Fri, misleading rule name); §26 drift (L743, 05:30, lookback 16); the cron chain paragraph (L1132) and schedule table (L1137, L1138, L1144, L1151, L1168–1170, L1174); the AI section (model per job: source audit flash); the daily brief's real time (14:00 UTC = 23:00 JST).
- `architecture/_active/BACKEND_PLAN_2026-09-27.md`: R1–R4, D5, P4 → done (with dates), AI-map rows (cadences), and a correction to Fact 5 (agent waste = re-processing a stale staging; recurring-story rate measured after top-up).
- `CHANGES.md` entry (frontend commit) and one for each Lambda deploy / live schedule change (dated, with exact old and new expressions).
- `project-docs/INDEX.md`: row for this task file.
- `redesign-ux/_active/COUNTRY_VIEW_DISCUSSION.md` L98–104 (direction rule, freshness ≤ 7 / 7–30 → 14) and `REDESIGN_MASTER_PLAN.md` L105 (card states); `MapLegend` note.
- Memory: `project_ai_providers.md` (schedule map, off-peak), `project_living_analysis.md` (drift at 05:30, weekly snapshots).

---

## ▶ 
### Operator answers (2026-09-29)
"yes those are for q5 … and the rest are good":
- **Q1** yes: 3-day TTL default; the first forecast of the UTC day is the logged one.
- **Q2** yes: topic selection 04:15 / 12:15 / 20:15 UTC.
- **Q3** yes: `TOPICS_CACHE_MAX_AGE_SECONDS=32400` on `newsSensitiveData-dev` (fetch → merge → write the full env).
- **Q4** yes: direction = the latest reading vs the one ~7 days earlier, arrow at |Δ| ≥ 15; "older" at 14 days for country cards / map shading only (stories stay at 7).
- **Q5** yes: the top 20 plus up to 5 extra countries **only while they have an alert**. A country with no alert outside the top 20 is not briefed. The top 20 keep the weekly baseline even without alerts; early refreshes only on an alert or a coverage jump.
- **Q6** yes: copy the ISO3→name table into the Lambda and extend `check-shared-sync`.
- **Q7** yes: a coverage jump = ≥ 8 new stories and ≥ 2× the country's 30-day pace.
- **Q8:** the monitor drafts the legend wording and checks it in the browser.
- **Q9** yes: `TriggerBreakingAlert` → `cron(35 4/8 * * ? *)`. **Q10:** situation ingest stays hourly.
- **Alert refinement (operator 2026-09-29, "yes"):** kept as built: an alert triggers an early refresh only if it opened or changed AFTER the last briefing; an alert already covered by the last briefing does not retrigger daily.
- **R1b (operator 2026-09-29, "yes"):** region / aggregate keys are excluded from country briefings (see the R1b tracker row).
- **Q11** yes: `aws lambda invoke` dry-runs (no LLM, no writes) are allowed for verification; the one-off P4 flash-vs-pro A/B runs after the top-up.

LIVE TRACKER
| Phase | What | Status | Evidence |
|---|---|---|---|
| 0 | Operator "go" for the plan, Q1–Q11 answered | Queued | |
| P4 | source audit env → `deepseek-flash`; rule → Mon/Wed/Fri 11:30 | Done 2026-09-29 (✅ monitor verified 2026-09-29 (read-back: AUDIT_MODEL=deepseek-flash, 7 vars, Successful; rule ENABLED cron(30 11 ? * MON,WED,FRI *), target newsSourceAudit)) | env: `update-function-configuration` (full map via chmod-600 temp file, deleted): `AUDIT_MODEL` `deepseek-v4-pro` → `deepseek-flash`; SHA-256 compare of all 7 vars: only `AUDIT_MODEL` changed; `LastUpdateStatus=Successful`, `CodeSha256` unchanged `YGkB1Id…4zMQ=`. rule: `put-rule` `cron(30 8 ? * * *)` → `cron(30 11 ? * MON,WED,FRI *)`, ENABLED, target still `newsSourceAudit`, description updated. Rollback per §P4 |
| R2 | agent: run guard + fingerprint reuse + forecast ≤ 1/day; tests; deploy; `dryRun` | Done 2026-09-29 (✅ monitor verified 2026-09-29 (28/28 tests; deployed zip byte-identical to repo src, 6 files; CodeSha256 ZC/gW3uS…WhM=; ConditionalCheckFailed on the forecast log handled as "first of the day stands")) | Repo edits `NewsProjectInvokeAgentLambda/src/{index.js,lib.js}` + `test/lib.test.js`: `npm test` 21 → **28 pass** (fingerprint x3, decideReuse table, forecast once/day, all-skipped run still swaps (`runOutcome`), prune keeps re-stamped reused items and drops obsolete/legacy (`selectPruneKeys`)). Fallback model string → `deepseek-flash`; TTL defaults 3600 → 259200; forecast log Put now `attribute_not_exists(PK)`. Deploy: pre-deploy sha matched recorded `aXtqVyLe…/uo=` (rollback zip re-downloaded to scratchpad `batch1/agent_rollback.zip`); `update-function-code` (index.js lib.js matcher.js url-normalize.js entity-normalize.js package.json) → `Successful`, new sha `ZC/gW3uS…WhM=`. `dryRun` invoke (no LLM, no writes, 1.1 s): 17 topics, tally `generate:legacy-item` x51 (17 x summary/trace_cause/prediction; frozen 13-Sep items have no fingerprint, expected). Run guard not exercised yet (staging has no `agentProcessedAt`); after top-up: run 1 generates + sets marker, run 2 returns `staging-already-processed` |
| R3 | `InvokeNewsAgent` → 04:25/12:25/20:25, `InvokeGoogleGemini` → 04:15/12:15/20:15 | Done 2026-09-29 ~02:45 UTC (✅ monitor verified 2026-09-29 (independent read-back of all 10 schedules + drift env 16/40 + proxy TOPICS_CACHE_MAX_AGE_SECONDS=32400, 25 vars; proxy topics → HTTP 200)) | `update-schedule` InvokeNewsAgent `cron(5 */4 * * ? *)` -> `cron(25 4/8 * * ? *)`; InvokeGoogleGemini `cron(0 */4 * * ? *)` -> `cron(15 4/8 * * ? *)` (UTC, window OFF, target/role/retry unchanged, ENABLED); read back |
| D5 | thread 04:40, systems 05:00, country 05:15 (drift 05:30 under R4), audit (P4), Gemini (R3) | Done 2026-09-29 ~02:45 UTC (✅ monitor verified 2026-09-29 (independent read-back of all 10 schedules + drift env 16/40 + proxy TOPICS_CACHE_MAX_AGE_SECONDS=32400, 25 vars; proxy topics → HTTP 200)) | `put-rule`: TriggerDailyAnalysis `cron(30 6 * * ? *)` -> `cron(40 4 * * ? *)`; TriggerNewsSystemsAnalysis `cron(15 7 * * ? *)` -> `cron(0 5 * * ? *)`; TriggerDriftCorrector `cron(20 7 * * ? *)` -> `cron(30 5 * * ? *)`; `update-schedule` countryIntelliegence `cron(0 7 * * ? *)` -> `cron(15 5 * * ? *)`; audit + Gemini under P4/R3. Targets unchanged, all ENABLED; read back |
| R1 | country Lambda: weekly + event + coverage-jump policy; tests; deploy; `dryRun` | Done 2026-09-29 (✅ monitor verified 2026-09-29 (npm test 12/12; check-shared-sync ALL PASS; deployed zip byte-identical to repo src, 7 files). Open to operator: (a) alert refresh only when the alert opened / changed after the last briefing (agent refinement); (b) 6 of the top 20 "countries" are regions (Europe, Asia, Middle East, Americas, Africa, Global)) | New `src/refreshPolicy.js` + `src/iso3Names.json` (138 codes, copy of frontend `ISO3_NAME`) + `index.js` (plan per country, `dryRun`); `test/refresh.test.js`: **12/12 pass** (new, already-today, unchanged, baseline 155h/156h, alert newer vs already-covered, coverage jump 8 & 2x, hot-set parsing incl. cooling/closed/non-HIGH/fetch failure, name aliases, USA + United States both refresh, top-20 + max 5 extras + extras only on alert). `scripts/check-shared-sync.mjs` now guards 5 pairs (iso3Names.json vs frontend): `ALL PASS`, `--self-test` PASS. Policy refinement: an alert retriggers only if it opened/changed after the last briefing (else a multi-day cyclone would refresh daily). Deploy: pre-deploy live sha = recorded `SoZc5Gn…/RKU=`; zip = index.js refreshPolicy.js iso3Names.json riskDimensions.js country_facts.json package.json package-lock.json; new sha `D5naoKFu…UwKo=`, `Successful`; deployed files byte-identical to repo (`cmp`, 7/7). Rollback zip: scratchpad `batch1/country_rollback.zip`. `dryRun` invoke (3.2 s, no LLM, no writes): world fetch from AWS **ok (200, 1 situation, 0 alert countries)**; 20 top-20 countries all `weekly-baseline` (16.8–110.8 d old), 0 alert extras; plan counts `refresh:weekly-baseline 20`. Key-name findings: record keys `Democratic Republic of Congo`, `DR Congo`, `Democratic Republic of the Congo` and `Palestinian Territories` vs `Palestine` are aliases of the same country (canonicalised for matching; separate records remain); `USA` is a separate legacy record (last written May) and is not in today's top 20; region-like keys (Europe, Asia, Middle East, Americas, Africa, Global) never match an alert |
| R1b | country briefings: exclude region / aggregate keys | Done 2026-09-29 (✅ monitor verified 2026-09-29 (npm test 15/15; sync ALL PASS; deployed = repo byte-identical, 8 files). Follow-ups logged: CountryListPage fetches the top 24 incl. ~6 region keys (widen / drop aggregates); daily brief / breaking alert / weekly brief / signals still read frozen region records; Scotland excluded (subnational)) | `refreshPolicy.js` `isCountryName`: a key is briefed only if its name (or its canonical alias) is in `iso3Names.json` OR in new `placeNames.json` (271 names: CLDR list of every country / territory, minus Antarctica, plus Kosovo, Hong Kong, Macau, Taiwan, Palestine, Gaza, West Bank, Greenland and the variants briefings use). `index.js` filters before ranking, so the top 20 are real countries; dry run prints `excludedKeys`. Tests `test/refresh.test.js` **15/15** (keeps 33 real names incl. Palestine, Kosovo, Taiwan, Hong Kong, Greenland, Iceland, Jamaica, Costa Rica, Burundi, Gambia, DR Congo variants, Czech Republic, Ivory Coast, Turkiye; drops 20 aggregates; top 20 all real). Deploy: pre-deploy sha = recorded `D5naoKFu…UwKo=`; new sha `1KvJt7be…gRc=`, `Successful`; 8/8 deployed files byte-identical to repo; rollback zip scratchpad `batch1/country_rollback_r1b.zip`. Dropped from the 96 distinct region strings in the 30-day archive (13): Europe, Asia, Africa, Americas, Middle East, Global, European Union, NATO, United Nations, Oceania, North America, Southeast Asia, **Scotland** (subnational; the only questionable one). Of 48 existing record keys, 7 would no longer be refreshed: European Union, Asia, Europe, Americas, Africa, Global, Middle East (records stay in DynamoDB). `dryRun` (3.6 s, no LLM/writes): 67 keys with 2+ articles -> 57 countries + 10 excluded (Europe 58, Asia 38, Middle East 36, Americas 27, Global 20, Africa 19, European Union 5, NATO 3, North America 2, Oceania 2); new top 20 = United States, Russia, China, Iran, Ukraine, Germany, United Kingdom, Israel, Yemen, Saudi Arabia, France, India, Philippines, Canada, Brazil (new), United Arab Emirates, South Africa, Nepal (new), Palestine, Lebanon; plan `refresh:weekly-baseline 18, refresh:new 2`. Live alert now: Mexico (GDACS tropical cyclone `gdacs#TC#1001325`), but Mexico has < 2 archive stories so it has no candidate row (the world fetch and matching work) |
| R1-FE | freshness 14 d for countries; direction rule; legend; tests; `npm run verify`; browser | Done on branch `map-console` 2026-09-29, not deployed (✅ monitor verified 2026-09-29 (verify 747/747; legend + Iran card screenshots checked: "Briefed within 14 days · full", "14–30 days · faded", Iran "◆ at top of scale"). Logged, pre-existing: `/weekly/country/Iran` scrollWidth 454 at 390 px; on phone `/map` the country card sheet opens over the whole map) | `freshnessState(ageDays, olderAfterDays = 7)` + `COUNTRY_OLDER_AFTER_DAYS = 14` used by `CountryCardV2.jsx` and `countryRiskLayer.js` (stories/situations keep 7); `countryDirection.js` rewritten (now = latest or median of readings within 3 d; before = reading nearest 7 d earlier, accepted 4-10 d; arrow at abs(delta) >= 15; top of scale both >= 95; amber 14-30 d; card shows `· vs <date>` on arrow/unchanged); risk-mode Key legend reworded (situations legend unchanged). Tests: `npm run verify` = eslint clean + **93 files / 747 tests pass** (was 742); new/rewritten cases in `freshness.test.js`, `countryRiskLayer.test.js`, `countryDirection.test.js`; `bash quality/verify_pages.sh` **52 pass / 0 fail**. Playwright (Chrome for Testing 1223, dev server with `VITE_WORLD_URL=https://globalperspective.net/data`) screenshots in scratchpad `p5/`: `map_card_{1440,390}.png`, `map_legend_{1440,390}.png`, `country_page_{1440,390}.png`; 0 page errors. Live Iran: `Briefed Sep 11 · older`, `RISK 95 · HIGH`, direction `◆ at top of scale` (latest 95 vs ~7 d earlier also >= 95). `/weekly/country/Iran` at 390 px overflows horizontally (scrollWidth 454, `.cpg-map-overlay-right` / `.cpg-traj-pill`): **pre-existing**, identical with my changes stashed |
| R4 | drift 05:30 + env (16 / 40); facts weekly | Done 2026-09-29 ~02:45 UTC (✅ monitor verified 2026-09-29 (independent read-back of all 10 schedules + drift env 16/40 + proxy TOPICS_CACHE_MAX_AGE_SECONDS=32400, 25 vars; proxy topics → HTTP 200)) | drift schedule as D5; drift env `DRIFT_LOOKBACK_DAYS` 10 -> 16, `DRIFT_MAX_EVENTS` 25 -> 40 (hash compare: only those 2 of 8 vars changed; sha unchanged `iBAAoJi…IgA=`); `Fact` `cron(0 5 * * ? *)` -> `cron(0 5 ? * MON *)` Asia/Tokyo, FLEXIBLE 10 min unchanged. Also Q9: TriggerBreakingAlert `cron(15 */4 * * ? *)` -> `cron(35 4/8 * * ? *)`; Q3: `newsSensitiveData-dev` `TOPICS_CACHE_MAX_AGE_SECONDS` unset -> 32400 (24 -> 25 vars, hash compare: only that key added, sha `UKSnvWs3…rik=` unchanged, Successful). Temp env files deleted |
| Post | top-up checks (per item) + next-day timing check; docs; status → done | Queued | top-up before 11 Oct |

**Completion checklist:**
- [ ] operator go + open questions answered
- [ ] P4 env + rule changed and verified
- [ ] R2 code + tests + deploy + dryRun; after top-up: second run skips, forecast once a day
- [ ] R3 both schedules changed and verified
- [ ] D5 chain moved and verified (04:40 → 05:00 → 05:15 → 05:30, all before 06:00)
- [ ] R1 Lambda + tests + deploy + dryRun; frontend changes + tests + `npm run verify` + browser click-through
- [ ] R4 drift + facts changed and verified
- [ ] first-day CloudWatch check after top-up (no timeouts, no peak-hour runs)
- [ ] docs updated in the same commits (ARCHITECTURE, BACKEND_PLAN, CHANGES, INDEX, redesign docs, memory)
- [ ] no deploy of the frontend until the operator says so ("no deploy — deferred to next gated deploy")
- [ ] status → done

## Open questions for the operator
1. **Q1 (R2):** OK that a story's stored `ttl` default becomes 3 days and skipped stories are re-stamped each run (needed only if the table TTL is ever re-enabled)? And OK that the day's forecast snapshot becomes the **first** of the day (today: the last overwrites)?
2. **Q2 (R3/D5):** the times 04:15 / 12:15 / 20:15 (Gemini) and +10 min (agent). Any reason to prefer other hours (for example a European or US morning)?
3. **Q3 (R3):** set `TOPICS_CACHE_MAX_AGE_SECONDS=32400` on the proxy `newsSensitiveData-dev` (own bare command; proxy edit needs your yes) so the old home does not show "Topics refreshing" for 5.5 h of every 8, or accept the banner until the S6 swap?
4. **Q4 (R1-FE):** direction rule for weekly data: recommended = latest reading vs the reading ~7 days earlier, arrow at |Δ| ≥ 15 (evidence above). Alternatives: keep 10 (noisier), or drop the arrow until 3+ readings exist. Also confirm the 14-day "older" for country cards and map country shading only (stories stay 7 d).
5. **Q5 (R1):** keep the cap at the top 20 by coverage (default), or also brief up to 5 extra countries that have a HIGH situation / GDACS alert (needs the card copy "we brief the 20 most-covered countries" reworded)?
6. **Q6 (R1):** news-sourced HIGH situations carry only ISO3 codes; copy the frontend's ISO3 → name table into the Lambda (`iso3Names.json`, and extend `scripts/check-shared-sync.mjs` to guard the copy)? Without it only GDACS alerts can trigger an early refresh.
7. **Q7 (R1):** coverage-jump definition: ≥ 8 new stories since the last briefing **and** ≥ 2 × the country's own 30-day pace. Change the numbers?
8. **Q8 (R1-FE):** legend wording for the two thresholds (stories 7 d, countries 14 d).
9. **Q9 (R3):** retime `TriggerBreakingAlert` to 10 min after each agent run (`cron(35 4/8 * * ? *)`; it already sends mail, this only changes when it looks) or leave it 4-hourly?
10. **Q10 (D5):** `TriggerSituationIngest` (hourly, flash) still has 7 weekday hours in peak; leave (cheap classifier) or go 2-hourly off-peak?
11. **Q11 (verification):** may I run the `dryRun` invokes (`aws lambda invoke`, DynamoDB reads / one public HTTP GET, no LLM, no writes)? `lambda invoke` is not in the standing authorization list. Also confirm the P4 flash A/B (one manual audit invoke after the top-up).
