# Ops: the health view and the operator page (plan, 2026-11-04)

Status (2026-11-06 JST): all four phases are deployed. `newsHealth` has run hourly since 2026-11-04 (rule `TriggerHealth`); the `ops` action is in the deployed `newsReadApi` (`OPS_OPERATOR_UIDS` set); the `/ops` page is released, and the served bundle is `index-CMWPIc99` (release 8, 2026-11-06 00:06 JST, commit ff224194; it carries the Quality panel and draws the `recovered` status). Readers (phase 2) are live: the Cloudflare token is set and the pull reads `ok`; Cloudflare Web Analytics was switched to automatic setup on 2026-11-05 about 22:05 JST because the snippet-mode site had dropped every beacon with a 404, so reader data starts on 2026-11-05. Quality (phase 3) was deployed on 2026-11-05 about 23:00 JST, and the `newsHealth` role holds its two extra grants. Self-healing (phase 4) is deployed with `HEAL=dry` since 2026-11-06 about 00:00 JST: the new Lambda `newsRecover` exists (role `newsRecover-role`, no schedule), the role policy is applied, and the pass computes and reports in `now.heal` but writes and invokes nothing. It is switched to `on` after the operator has read a dry tick (planned 2026-11-06, not done). The `/ops` glyph for the `recovered` status (commit `6135f744`) shipped in release 8. Alert emails were cut back by the operator on 2026-11-06 because this page now shows what they said: `TriggerErrorDigest` is DISABLED (the Quality panel's client-errors check covers it), `newsSourceAudit` lost its `SNS_TOPIC_ARN` (it still logs the `[audit]` lines this page reads), and `TriggerFreshnessMonitor` is still ENABLED but is to be disabled once `HEAL=on` (planned, not done). The one email kept is `newsModelGuard`'s DeepSeek balance check on topic `GlobalPerspectiveAlerts`. This page adds no alarms. Operator decisions 2026-11-04: build money + pipeline first, readers second; keep
Google Analytics and Cloudflare Web Analytics; add Google Search Console; PostHog later, for member events only; no alarms
(the operator removed them 2026-11-02 and does not want them back). This page is where the operator looks, and what the
coordinating session reads when asked "how is it now".

## Phase 4 as built (self-healing)
Why in `newsHealth`: it already holds the day's facts (entries line count, run file), ticks hourly, has no model and no user-facing send. The two parts that do not fit its 120 s and read-mostly role are a separate Lambda: **`newsRecover`** (new, group `record`, 15 min, 3 GB, not scheduled) holds the recovery from public records, so `newsHealth` can never write the raw-article inbox and a recovery bug cannot stop the health view. Code `newsHealth/src/heal.js`, settings `HEAL` in `src/config.js`, README of both Lambdas.
- **What "archive missing" means.** `record/inbox/entries/D.jsonl` has no line (no file or empty) for UTC day D. Normal is 25-47 lines; under 20 is `thin` and is **not** healed (the agent ran; a second run would not fix its volume; the row stays `thin`). A file the healer cannot read is skipped, never taken for missing.
- **Schedule facts it rests on** (live 2026-11-05): ingest `InvokeGoogleGemini` and agent `InvokeNewsAgent` at 04:15/04:25, 12:15/12:25, 20:15/20:25 UTC (a run takes about a minute; ingest 20-55 s); nightly record run 23:45 UTC; record refresh :35 of 04/12/20; `TriggerHealth` `rate(1 hour)` ticks at :34. 06:00 JST is 21:00 UTC: the 20:25 run (05:25 JST) is the last one of UTC day D.
- **Step 1, the agent re-run, once per day.** Only in `[21:00, 23:00)` UTC of day D itself, so it is over long before 23:45 and cannot touch the next day (the agent writes the day it runs on). Condition: D has no entry line. The staging item (`NewsCache` `id=staging`, read only) is fresh when it was generated on D and `agentProcessedAt` is not set; then `newsAgent` is invoked with `{}`, the same payload the schedule sends (no `force`: it would skip the draw cadence and the processed guard, never freshness). If staging is **not** fresh, the agent's freshness guard would refuse (`stale-staging`, `generation-prior-day`) or skip (`already processed`), so `newsIngest` is invoked first (`{}`, as its schedule) and the agent follows on the next tick (60 min later, inside the window); if that ingest leaves no fresh staging the agent step is `skipped` and nothing runs on stale topics. The re-run costs what a scheduled run costs (DeepSeek, and Brave for the ingest). Both are asynchronous invokes; the next tick looks at the entries file.
- **Step 2, recovery, from D+1 00:30 UTC (GDELT's last quarter-hour file of D is out), only if D is still empty.** `newsRecover {day}` (decision 0040 rule 2, code moved out of the laptop CLI `backend/record/cli/recover-day.mjs`, which now re-exports it): GDELT GKG 2.1 raw files of the day (primary, static downloads, no rate limit) plus Wayback snapshots of our own feeds (backstop, time-boxed), deduped by `rawId`, appended to `record/inbox/articles/D.jsonl`, every line with `recoveredAt` and `recoveredFrom`; no model, nothing generated. It writes its outcome to `monitoring/heal/recover/D.json` (status ok / partial / failed, counts, failures). If at least `minArticles` (300; a recovered day measured 1,624 lines, a live day 760) are in the day file, `newsStoryRecord {recovery:true, date:D}` builds the record's day (articles as `article` facts, Run with `notes:"recovery"`, `inputs.recovered:true`; it refuses `forecast_drawn` on such a day). A failed recovery is retried on later ticks, at most 3 invokes; a record run is invoked at most twice. It gives up 48 h after the day closed.
- **Never inside a scheduled run.** Nothing is started from :10 to :55 of 04, 12 and 20 UTC or from 23:40 to 00:10 (the 23:45 record run; `newsStoryRecord` has reserved concurrency 1). A step blocked by that waits for the next tick.
- **At most once, recorded in S3.** One ledger file per day, `monitoring/heal/D.json`: `ingest`, `agent`, `recovery.attempts[]`, `record`, `outcome`, `why`, `events[]`. It is written **before** each invoke: a failed write means no invoke; a refused invoke still uses the day's attempt. A day with an `outcome` (`healed`, `recovered`, `unhealed`) is never touched again. Only today and the two days before it are looked at.
- **Marking.** The agent row of `health.json` gets status `recovered` (new; glyph `↺` on `/ops`) for a recovered day, with `facts.heal` (outcome, re-run times, attempts, articles) and the note "Recovered from public records: N raw articles ...; the model did not run for this day, so there are no story entries and no forecasts." A day the agent re-run healed is `ok` with a note; an empty day whose healing is running is "day in progress" or `missing` with the ledger's state in the note; a day that could not be healed stays `missing` with `outcome: unhealed` and the reason. `health.json now.heal` lists what this tick did (`mode`, `actions`, `skipped`, `errors`). Recovered days are unscored and carry no forecasts (decision 0040 rule 4).
- **Never.** Invent data (a recovered day is only what GDELT and Wayback returned; if neither read, the day stays missing); heal a thin day or a day older than two days; send an alert or an email; draw a forecast for a recovered day; run the agent twice for a day; run `force`.
- **Switch.** Env `HEAL` on `newsHealth`: `on` acts, `dry` computes and reports (`now.heal.actions` with `dry:true`, nothing written or invoked), anything else (the default) is off. A test event `{"heal":"dry"}` or `{"dry":true}` can only lower the mode.
- **Does not heal:** a thin day; downstream stages of a missing day other than the record run (the daily brief, country notes); a GDELT outage longer than 3 hourly attempts (the day stays `missing`, visible, and `recover-day.mjs` stays the manual path).
- **IAM** (applied 2026-11-06): the `newsHealth` role policy is `newsHealth/iam/policy.json` (phases 1-4 in one file: phase 3 added `s3:GetObject` on `situations/merges/*` and `dynamodb:Scan` on `GlobalPerspectiveClientErrors`; phase 4 added `lambda:InvokeFunction` on `newsAgent`, `newsIngest`, `newsStoryRecord`, `newsRecover`, `dynamodb:GetItem` on `NewsCache` with leading key `staging`, and `s3:GetObject` and `PutObject` on `monitoring/heal/*`). `newsRecover` has its own role `newsRecover-role` (`backend/record/newsRecover/iam/`: Get and Put on `record/inbox/articles/*`, Put on `monitoring/heal/recover/*`, ListBucket, its logs). `newsRecover` runs on `nodejs22.x`, 900 s, 3008 MB: 1 GB ran out of memory on a real day (the GKG files are unzipped in memory), and a dry run of 2026-10-22 with `noWayback` read 96 of 96 GKG files and found 1,213 lines in about 14 s.
- **Tested offline** with injected ports (`newsHealth/test/heal.test.js`, `newsRecover/test/recover.test.js`): a forced-missing day healed by the agent re-run, by ingest then agent, and by recovery; a day that cannot heal (no loop); the once-per-day guards; the schedule windows; dry and off. Also dry-run against live S3 and DynamoDB (read-only) with the clock set to the October outage.

## Phase 3 as built (quality)
- `ops.json` has a `quality` section, built by `newsHealth` on the first run of each UTC day for the last CLOSED UTC day (`quality.day`; the open day has no complete entries, verdicts or run file yet). A check that could not read its source is read again hourly, alone; the others are kept as built. Each check carries its `source` and its `day`; a source that does not exist is `{status: 'not_available', why}` and names what is missing; a read that failed is `{status: 'error', source, error}`. Nothing is estimated. Code `src/quality.js`, settings `QUALITY` in `src/config.js`.
- Duplicates: open situations (`state` not closed) of `world/latest.json` with the same normalised title (`verb_label`, lowercase, collapsed spaces) and the same `iso3_affected` set; a snapshot as of the file's `generated_at`. Merged: the tracker's own merge files `situations/merges/YYYY/MM/DD/HH/HHMM.json` for the day, counted by rule (the tracker writes them only while `NEWS_GROUPING` is on).
- Summaries that describe their sources: one regex (`QUALITY.selfReference`: "the snippet(s)", "the sources", "the headline", "the provided/given/available sources|snippets", "according to the articles|sources|snippets") over `ai.summary` of the day's `record/inbox/entries/DAY.jsonl`: count, phrases, up to 5 examples (title and matched phrase). First measured 2026-11-05: 16 of 32 entries of 2026-11-04. "the report" and a bare "the articles" are not matched (ordinary news words).
- Pins outside their country: **not available**. `newsSituationIngest` (`classifier-core.js` `storyCentroid`) silently moves a centroid that is outside all the story's countries onto the first country's centre and logs nothing; the result line and `stories/index.json` carry no count. Missing: one counter in the ingest result line. The panel says this.
- Forecast voids: the day's `record/inbox/verdicts/DAY.jsonl` (revision 1 = the settlement), voids by `voidReason`, record gap first, with the gap days those voids name; no file for the day reads as "nothing was settled". Coverage gaps: `record/runs/DAY.json` for the 14 closed days under the resolver's own rule (status ok or partial and `inputs.archiveDay` present; `thin:N` and a missing run are gaps).
- Source audit: `newsSourceAudit` does **not** look for dead outlets: it checks cached summaries against their source articles (drift) and writes only CloudWatch log lines, no file, and since 2026-11-06 sends no email (its `SNS_TOPIC_ARN` was removed); an article it cannot fetch is skipped without a log line. The check reads the last run's `[audit]` lines from its log group by Logs Insights (7 days; the run is Mon/Wed/Fri): checked, drifted (titles), errors, single-source. `deadOutlets` is `not_available`, naming the missing per-outlet fetch result.
- Client errors: `GlobalPerspectiveClientErrors` (written by `newsClientErrors`), a Scan projecting `day`, `count`, `sampleUrl` only (no message, stack, user agent). Grouped by the page family of the sample URL (the same table as the readers panel), the day against the median of the 14 days before it (zeros count). This check replaced the `newsErrorDigest` email (its rule is DISABLED since 2026-11-06). A row's page is the URL of the first hit of that error that day; its count is all hits, so the page split is approximate and the panel says so. The table keeps 30 days (TTL).
- IAM beyond phase 2, applied 2026-11-06 with phase 4 (now in `backend/monitoring/newsHealth/iam/policy.json`): `s3:GetObject` on `situations/merges/*` and `dynamodb:Scan` on `GlobalPerspectiveClientErrors`. `ListBucket` and `logs:StartQuery` on `/aws/lambda/news*` already covered the merge listing and the audit log. A check whose read is refused reads as `error` with the AccessDenied text; until the grant, the client-errors check did, and it is read again on the next hourly run.
- The `/ops` Quality panel (`features/ops/components/QualityPanel.jsx`) shows each check with its day, source, the numbers and the examples; `lib/quality.js` shapes them.

## Phase 2 as built (readers)
- `ops.json` has a `readers` section, built by `newsHealth` on the first run of each UTC day (and hourly again while Cloudflare is not `ok`, which costs no call when there is no token): `cloudflare` (`not_connected` | `error` | `ok`), `own` (counts only), `attention`, `note`.
- Cloudflare: GraphQL `rumPageloadEventsAdaptiveGroups` (Web Analytics page loads) for the account, filtered to `requestHost` `globalperspective.net` (the account also holds other sites; the Web Analytics site-list endpoint is not used), grouped by date and request path, by referrer host and by country, 14 days. Token `CF_ANALYTICS_TOKEN` (secret, Account Analytics: Read, set by the operator on the Lambda). No token: `{status: 'not_connected'}`; any API failure: `{status: 'error', error}`; no number is ever invented.
- Page families come from one table, `src/pageFamilies.json` (map, stories, countries, briefings, track record, board, ops left out of totals, other). Top 10 stories (titles from `record/views/index/all.json`), top 10 country pages, visitor countries, referrers, views per family per day.
- Own data, no token: accounts by `createdAt` day (`GlobalPerspectiveUserTable`), boards and saved items by `savedKey` prefix (`GlobalPerspectiveSavedItems`), shares (`GlobalPerspectiveShares`). `dynamodb:Scan` with a one-attribute projection; no uid or email is read.
- Attention vs effort: per family, views next to the DeepSeek spend of the Lambdas whose `scripts/functions.json` `features` include the family's features, a Lambda's spend split evenly over its features. `config.js` `lambdaFeatures` is a copy of that file (a test fails when they differ). AWS cost is not in it.
- Own traffic: Cloudflare RUM has no user identity, so the counts include our own testing and nothing in our data measures that honestly; the panel says so and shows no "test sessions" figure.
- Not built here: Google Analytics, Search Console, PostHog, email opens, social posts.

## Phase 1 as built (changes from the plan; the Lambda's own facts are in its README)
- `newsHealth` code, `src/prices.json` (in `src/` so the zip carries it; real list rates read 2026-11-04: Flash $0.15/$0.60, Pro $0.66/$1.98 per million, cache hit $0.003/$0.022, peak hours double), role policy `backend/monitoring/newsHealth/iam/`, deploy commands in its README. Peak (01-04, 06-10 UTC Mon-Fri) is priced hourly, so the usage query bins by hour.
- `health.json`: `days[].rows[]` with `status` ok/thin/missing/failed/nodata, each row with facts, source, time. A day is judged only after the next day's 01:00 UTC. Resolver and situations are snapshots: a closed day keeps the row the previous file held, so they start empty after deploy. Errors thin from 1, failed from 5 a day; a compare DIFFER is thin.
- `ops.json` keeps 62 days so month to date survives the 14-day query; AWS cost is pulled on the first run of each UTC day (not exactly 00:15). Weekly review spend is per ISO week.
- The role also needs `s3:GetObject` on `monitoring/ops.json` and `s3:ListBucket`; `newsReadApi`'s shared role needs `GetObject` on `monitoring/ops.json` (`iam/read-api-ops-read.json`).
- The DeepSeek balance endpoint is not read (needs a secret copy; `newsModelGuard` already reads it).
- Route constant `OPS_ROUTE` lives in `features/ops`, not `shared/lib/links.js` (that core is mirrored into the Lambdas).

## Why
Every watcher we have looks at one stage from the outside (the freshness monitor probes the topics file; the resolver logs one
line a night; the record run writes a status file nobody reads). The two failures of October passed every one of them: the
agent wrote nothing for four nights (21–24 Oct) while ingest ran, and the resolver settled nothing for five weeks while running
every night. Both were failures of volume, not of liveness. And nothing shows what the machine costs, who reads what, or
whether the output is any good.

## Shape
Two files, one Lambda, one page.

| Piece | What | Who reads it |
|---|---|---|
| `record/views/health.json` | Public. The pipeline panel only: one row per stage, last 14 days, no money, no reader data. Served by the front Worker like every view. | The `/ops` page, the map's status line later, the coordinator |
| `monitoring/ops.json` | Private (not under `record/views/`, not served by the Worker). Money, readers, quality. | `newsReadApi` action `ops`, operator uid only |
| `newsHealth` Lambda | Hourly (`TriggerHealth`, `rate(1 hour)`), group `monitoring`, Node 24, no model. Writes both files. Daily pulls (cost APIs) run on the 00:15 UTC tick only. | |
| `/ops` route, `features/ops` | One screen, four panels, a 14-day strip per row; a row with no data says "no run", never a placeholder. Visible only when signed in as the operator; the link sits in the account area like the board link. | The operator |

## Panels and their sources (facts only; every number names its source and time)

**1. Money**
- DeepSeek, estimated: the `[usage]` log lines every model call writes (`fn`, `model`, prompt/completion/cache-hit tokens),
  summed per day per Lambda per model by one CloudWatch Logs Insights query over the `/aws/lambda/news*` groups, priced with
  `backend/monitoring/newsHealth/prices.json` (operator-owned: model, price per million in/out/cache-hit, valid-from date;
  list rates and peak hours are in `src/prices.json`, read 2026-11-04).
  Shown: yesterday, month to date, by Lambda, trend.
- DeepSeek, actual: not read (it would need a secret copy of the key in the Lambda's env; `newsModelGuard` already reads the balance).
- AWS: Cost Explorer `GetCostAndUsage`, daily by service, pulled once a day ($0.01 a call). Needs `ce:GetCostAndUsage` on the
  role (IAM, operator yes).
- Unit costs: model spend per story entry, per forecast question, per country briefing, per weekly review, per daily brief,
  from the same usage lines divided by the day's fact counts (`record/runs/DAY.json`).

**2. Pipeline** (one row each; normal ranges measured from `record/runs/` and the inbox files, not guessed)
- ingest ran: raw day present (run file `inputs.rawDay`)
- agent wrote the archive: entries in `record/inbox/entries/DAY.jsonl`; normal 25–47 a day; under 20 thin; 0 missing
- record run: `record/runs/DAY.json` status ok, facts counts; failures listed
- views refreshed: `record/views/manifest.json` builtAt
- resolver: the `status` action (read-only invoke): sampled due / checked / settled / void by reason / backlog, and the night's
  `watch` numbers
- situations: `world/latest.json` age, `stale`, `newsDegraded`, `gdacsDegraded`, open count, merges today
- briefs: daily brief note for the day; weekly brief on Sunday
- Lambda errors: CloudWatch `Errors` per `news*` function, 14 days (`GetMetricData`)
- compare switches: every `[*-compare]` DIFFER count per Lambda (while step 5 runs)

**3. Readers** (phase 2)
- Cloudflare Web Analytics (already on the site): page views and visitors per path, countries, referrers, 14 days, through the
  GraphQL analytics API; needs an API token with Analytics:Read (operator creates it; secret, yes).
- Google Analytics 4: keep; check first in the GA console that data arrives at all (a Chrome check on 2026-11-04 saw the
  collect hits answered 503). Pulling it into the page is optional and later (service account).
- Google Search Console: operator verifies the domain (DNS TXT in Cloudflare); queries and pages Google sends people to. Linked
  from the page; pulled in only if the operator opens it daily.
- Our own tables, no new events: sign-ins (users table), boards and pins (board rows), saved items, shares (`newsSharedAnalysis`),
  weekly email sent/opened (the sender's log rows), social posts (`NewsProject-linkedin-posts`).
- Attention vs effort: model spend per page family (map, stories, countries, briefs, track record, board) next to reads per family.
- PostHog (later, member events only: board actions, forks, saves, sign-in funnel; free tier).

**4. Quality** (phase 3; as built: see "Phase 3 as built", two of the six checks have no source today)
- duplicate open situations (same title, same countries), situations merged today
- summaries that describe their sources (one regex over the day's entries, the stories session's finding)
- pins outside their country (count from the situation ingest log)
- forecast voids by reason (record gap first), coverage gaps per day
- source audit result (`newsSourceAudit`, Mon/Wed/Fri): dead outlets
- client errors by page from the error sink table, today vs the 14-day median

## Phases
1. **Money + pipeline.** `newsHealth`, both files, prices.json, the `ops` read action, the `/ops` page with panels 1–2.
   Done when: the page shows yesterday's DeepSeek estimate per Lambda and the AWS daily cost, and the 14-day pipeline strip
   shows the October gaps as holes when run against the history.
2. **Readers.** Cloudflare analytics pull, own-table counts, attention-vs-effort. Done when: top-10 pages and the per-family
   reads/spend table are on the page.
3. **Quality.** The six checks above. Done when: each check names its source and the day.
4. **Self-healing.** If the archive is missing by 06:00 JST, re-run the agent once; if the day is still missing, run the
   recovery from public records (decision 0040) and mark the day "recovered". Done when: a forced-missing day heals without a hand.
   Built and deployed, off until `HEAL=on`: see "Phase 4 as built".
Later: PostHog; AI-search citation tracking; a public status line on the map from `health.json`.

## Needs the operator (fresh yes each)
Done: the `newsHealth` role grants, the `newsHealth` env (`WORLD_BUCKET`, `CF_ANALYTICS_TOKEN`, `HEAL=dry`), the operator uid for the `ops` action, `newsRecover` (role, function, no schedule), the phase-4 policy, the `newsHealth` deploy, and the `/ops` route in a frontend release.
Open:
- Set `HEAL=on` on `newsHealth` once a dry tick's `now.heal` has been read and looks right (fetch the env, merge, write the full map; steps in the `newsHealth` README).
- A frontend release that carries the `recovered` glyph on `/ops` (commit `6135f744`).
- Google Search Console: done; the domain property `sc-domain:globalperspective.net` is verified (seen 2026-11-05: sitemap read 31 Oct, 31 pages indexed). Pulling it into the panel is not built.

## Cost of the monitor itself
About 720 invocations a month, Logs Insights over a few MB a day (cents), Cost Explorer $0.30 a month. Well under $1.

What the site costs and why, with the checking recipe: [COSTS.md](COSTS.md).
