# Matcher build spec — Phase 1 "the bridge" (URL-exact ∪ R3 fingerprint → threads/story-map.json)

Status: REVIEWED 2026-09-11 — accepted with TWO orchestrator corrections (binding, they override the
sections they touch):

**Correction 1 — tracker stamping must LATCH, not mirror (anti-flicker).** §5's proposed
`threadId: opts.threadId || null` would make links FLICKER: topics turn over every ~4h cycle
(only ~13 survive), so a story whose matching topic ages out of `latest` loses its map entry the
next cycle and its pin's "Full analysis →" link would blink off — even though the thread (90-day
TTL) is still alive and still correct. A URL-proven link does not stop being true when the topic
rotates out. Binding rule: `threadId: opts.threadId || (prev && prev.threadId) || null` — the live
map wins when present, otherwise the previously-proven link is retained for the situation's
lifetime (situations close within days ≪ the 90-day thread TTL, so a latched link cannot outlive
its page). Rollback nuance this creates: emptying `threads/story-map.json` stops NEW links
immediately but latched ones persist until each situation closes (hours-to-days); a hard-kill of
existing links = also set `CORROBORATION-style env off`? No — simplest hard-kill is a one-off
state sweep; document as accepted, links are removed-by-closure.

**Correction 2 — the "missing editorial trigger" blocker is resolved.** §13's unresolved item
exists because the recon checked only classic `events list-rules`; this fleet ALSO uses EventBridge
**Scheduler** (BACKEND_AUDIT_2026-09-10: both mechanisms live). The editorial cycle is
Scheduler-driven: `InvokeGoogleGemini` (cron 0 */4, → `newsInvokeGemini-dev`) and the agent runs on
its own Scheduler entry (`InvokeNewsAgent`). Cadence/staleness claims in §5/§6 hold as written. Read-only recon, no repo/AWS writes performed while drafting
this. Ship-gate reminder (unchanged from plan): R3 must re-confirm 0 false positives on REAL
production-tagged data (~1wk of Phase 1b tags, target re-measure ~2026-09-13/14) before the R3 tier
goes live; the URL-exact tier alone has no such gate (Phase 0 already proved 0 FP on real data) and
could ship independently/earlier if the operator wants to decouple the two tiers.

## 0. One-paragraph design recap (from EVENT_REGISTRY_PLAN.md §2/§3/§3.5, PHASE1C_RESULTS.md)

Two tiers, both null-on-ambiguity: **Tier 1** = exact URL overlap between a topic's
`sources[].url` (DDB `NewsCache`) and a story's article URLs (S3 `stories/`), normalized the same
way Phase 0 measured it. **Tier 2 (R3)** = ≥2 shared normalized ISO3 country codes AND ≥1 shared
normalized named actor (never a bare country name), no `event_type` gate — the only rule that hit
0 hand-labeled FP in both Phase 0c and Phase 1c. Output is a single S3 object
`threads/story-map.json` (storyId → {threadId, tier, matched_at, evidence}), written by exactly one
Lambda, read every tracker sweep to stamp `situation.threadId`. Frontend is unchanged — it already
renders "Full analysis →" when `threadId` is present (`SituationHome.jsx`) and has a graceful
empty state when a thread doesn't resolve (`ThreadPage.jsx`).

## 1. Placement recommendation: **inside `NewsProjectInvokeAgentLambda`, same non-fatal block that
already assigns `threadId`**

### Comparison

**(a) Inline in `NewsProjectInvokeAgentLambda`, in the existing threadId-assignment block —
RECOMMENDED.**
- File: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js:124-142`. This block
  already loops `stagingItem.topics` (raw, pre-`buildTopic()` — still has `continues_topic`), computes
  `id = buildStableTopicId(raw, idx)`, calls `assignThreadId(raw, pastEntries)`, and is wrapped in a
  `try { ... } catch (threadErr) { console.warn(...) }` that **never rethrows** — this is the exact
  failure-isolation pattern the matcher needs, already proven in production for a very similar
  additive-metadata computation.
- Data already in scope, zero extra fetches: `raw.sources[].url` (Tier 1), `raw.iso3`/`raw.actors`
  (Tier 2), and `raw.threadId` (just computed on the line above). No second DDB read of `NewsCache`
  is needed — this Lambda already has `DynamoDBFullAccess` attached (verified via
  `aws iam list-attached-role-policies --role-name newsprojectLambdaRole1fd679db-dev`).
- IAM delta needed: **none for DynamoDB. New S3 permissions required** — this Lambda currently has
  **zero S3 access** (verified: `aws iam get-role-policy --role-name newsprojectLambdaRole1fd679db-dev
  --policy-name lambda-execution-policy` returns only a `logs:*` statement scoped to its own log
  group; the two attached managed policies are `AmazonDynamoDBFullAccess` and
  `AmazonBedrockFullAccess` — no S3). Needs: `s3:GetObject`+`s3:ListBucket` on
  `stories/state/*` (read, see §2) and `s3:PutObject` on `threads/story-map.json` (write) in bucket
  `globalperspective-world-280362093938` (see §5 for exact policy JSON).
- Failure isolation: wrap the whole matcher call in its own `try/catch` (same pattern, separate from
  the threadId `try/catch` so a matcher bug can't take down threadId assignment either) —
  `console.warn` and continue; **never** let it affect `swapStagingToActive` or `buildAndWriteArchive`,
  which run unconditionally after this block today.
- Cadence fit: runs once per generation cycle (topics ~4-hourly per plan). Reads `stories/state/*`
  which `newsSituationIngest` refreshes hourly — worst case the story data is ~1h stale relative to
  ingest and up to ~4h stale relative to the last generation cycle, which is exactly the staleness
  Phase 0's ±36h window already tolerates (measured rate was against this same staleness profile).
- Cost: `stories/state/*.json` currently holds **792 objects** (Phase 0 count, unbounded growth over
  time — `newsSituationIngest/src/index.js:197` writes/overwrites per-storyId keys every hourly run,
  no delete/prune) — this is a `ListObjectsV2` (paginated, ~1 page at 1000-key default) + N parallel
  `GetObject` calls, all read-only, once per 4h cycle. Cheap and already the pattern Phase 0 used to
  measure; **do not** use `stories/index.json` alone (only the current ~80 open stories) — Phase 0's
  measured 31.7%/32.9% rates were against `stories/state/*` specifically (confirmed in
  `EVENT_REGISTRY_PHASE0_RESULTS.md`: "Phase 0 used `stories/state/` per the plan"), and
  `stories/index.json`'s 80-story cap would silently shrink coverage below the measured number.

**(b) Inline in `newsSituationTracker`'s sweep — rejected as primary, kept as a note.**
- Tracker already has S3 read/write on `stories/*` (role `newsSituationTracker-role`, policy
  `newsSituationTracker-pol`, verified via `aws iam get-role-policy`) — would need only a small IAM
  addition (`threads/*` read) if it read `story-map.json`, which it does anyway as the *reader* side
  regardless of who writes it (see §4).
- But the tracker has **zero DynamoDB permissions today** (its policy is S3 + CloudWatch + logs only)
  — matching needs `NewsCache` topic data, so this placement would need a *new* IAM capability class
  (`dynamodb:GetItem` on `NewsCache`) that the tracker has never needed, widening its blast radius.
- Worse failure-isolation story: the tracker's core write (`world/latest.json`, the whole situation
  bundle) is on the critical path every 30 min; bolting matching logic into `exports.handler` risks a
  bug there delaying/breaking the one write every consumer depends on. The existing `try/catch`
  boundaries in `index.js` are coarser than `NewsProjectInvokeAgentLambda`'s per-block isolation.
- Cadence mismatch: running the topic↔story join every 30 min when topics only regenerate every ~4h
  is 8x wasted work for no coverage gain (the join result can't change between topic-generation
  cycles).
- **Rejected.**

**(c) New tiny Lambda on its own schedule — rejected as unnecessary, not as unsafe.**
- Cleanest isolation in principle (a crash there truly cannot touch either pipeline), but costs a new
  Lambda + role + EventBridge rule for a job that already has a perfectly isolated home in (a)'s
  existing try/catch pattern, and it would need to duplicate the exact same two reads
  (`NewsCache:latest`/staging topics, `stories/state/*`) that (a) already has in memory for free.
  Only reconsider this if (a)'s matcher block turns out to meaningfully slow down the generation
  Lambda's own timeout budget (not expected — read-only S3 fetches, no LLM calls).
- **Rejected as YAGNI; not needed given (a) satisfies every recon requirement.**

**Recommendation: (a).** It reuses a proven failure-isolation pattern in the same file, needs the
smallest IAM delta (S3 add-only, no new DynamoDB grant anywhere), needs zero new infrastructure, and
runs at exactly the cadence the join is meaningful at.

## 2. Thread-ID / topic-fingerprint source (recon Q2)

Exact read: `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js:130-142` — the
in-memory `stagingItem.topics` array (raw shape from DDB `NewsCache` item id=`staging`, read earlier
in `loadTopics()` at line ~254-266, before `buildTopic()` transforms it). Each raw topic entry
carries, at this point: `title`, `sources[]` (each `{url, ...}`), `iso3[]`, `actors[]`, `event_type`,
`continues_topic`, `search_keywords[]`. This is the SAME object the plan's Phase 1b tag emission
(§"Exact change set" item 2, `buildTopic()`/`buildArchiveEntry()`) already carries through to `latest`
and `archive#` — so the matcher and the threadId assignment read one common source, no divergence
risk. `threadId` itself is computed one line above (`assignThreadId(raw, pastEntries)`) and is
already in scope in the same loop iteration — no restructuring needed, just add fields to the same
per-topic computation.

## 3. URL normalization (recon Q3)

Lift verbatim from Phase 0's `match.py` (scratchpad `../phase0/match.py:7-32`, reproduced here since
that scratchpad is another agent's/this session's throwaway dir, not shippable code):

```js
const TRACKING_PREFIXES = ['utm_', 'at_', 'cmpid', 'icid', 'ito', 'smid', 'ncid'];
const TRACKING_EXACT = new Set(['fbclid', 'gclid', 'ocid', 'spm', 'ref', 'cmp', 'src', 'mc_cid',
  'mc_eid', 'guccounter', 'guce_referrer', 'guce_referrer_sig', 'taid', 'campaign_id', 'partner',
  'cid', 'sfnsn']);
function isTrackingParam(k) {
  const kl = k.toLowerCase();
  if (TRACKING_EXACT.has(kl)) return true;
  return TRACKING_PREFIXES.some(p => kl.startsWith(p));
}
function normalizeUrl(url) {
  if (!url) return null;
  let u;
  try { u = new URL(url.trim()); } catch { return url.trim().toLowerCase(); }
  let host = u.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  const path = u.pathname.replace(/\/$/, '');
  const kept = [...u.searchParams.entries()].filter(([k]) => !isTrackingParam(k));
  kept.sort(([a], [b]) => a.localeCompare(b));
  const query = kept.map(([k, v]) => `${k}=${v}`).join('&');
  return `${host}${path}` + (query ? `?${query}` : '');
}
```

This is a faithful JS port of the Python used to measure the 31.7%/32.9% baseline — using anything
else (even a "more correct" normalizer) would ship a bridge that no longer matches the measured/gated
number. Phase 0b already confirmed Google-News URL-wrapping is negligible (0%/1.7%), so no additional
un-wrapping logic is needed or should be added.

**Where it lives:** a new small module `amplify/backend/function/NewsProjectInvokeAgentLambda/src/url-normalize.js`
(pure, no AWS deps) exporting `normalizeUrl`. Not shared with any other Lambda today (Phase 0's script
was throwaway), so no byte-identical-copy discipline applies here — this is the one new canonical
copy. If a future consumer needs the same normalizer, copy it forward with the same header discipline
described in §4 below, not the other way around.

## 4. Actor normalization for R3 (recon Q4)

Reuse `normalizeEntity` (+ its supporting `ACTOR_ALIASES`, `ENTITY_ORG_SUFFIX`,
`ENTITY_TITLE_PREFIX`) verbatim from
`amplify/backend/function/newsSituationIngest/src/classifier-core.js:85-121` (exported at line 168).
This is the canonical actor-folding logic (e.g. "Donald Trump" → "trump", strips "the ... government"
suffixes and "President ..." prefixes) and is exactly what the story side's `entities[]` needs to be
run through before comparing — `clusterStories()` (`classifier-core.js:123-166`) only normalizes
`entities[0]` (the storyId key ingredient, line 130); the other up-to-5 entities in `entities[]`
(line 156, `[...new Set(items.flatMap(i.entities))].slice(0,6)`) are **raw, unnormalized** classifier
output — the matcher MUST normalize every element of both sides' actor arrays itself, not assume the
story side already did it.

**Sharing mechanism:** `NewsProjectInvokeAgentLambda` is a different Lambda/deploy unit from
`newsSituationIngest`, so this can't be a `require()` across function boundaries — copy the function
byte-for-byte into a new file `amplify/backend/function/NewsProjectInvokeAgentLambda/src/entity-normalize.js`,
with the same discipline the repo already uses for `situations-core.js`
(`amplify/backend/function/newsSituationTracker/src/situations-core.js:1`: `"⚠️ SHARED MODULE — keep
byte-identical with newsGdacsIngest/src/situations-core.js."`). Header for the new file:

```js
// ⚠️ COPIED LOGIC — keep byte-identical with
// amplify/backend/function/newsSituationIngest/src/classifier-core.js:85-121 (normalizeEntity +
// ACTOR_ALIASES + ENTITY_ORG_SUFFIX/ENTITY_TITLE_PREFIX). If that file's actor-folding rules change,
// port the change here too — the R3 fingerprint match depends on both sides normalizing identically.
```

Export only `normalizeEntity` (and the two regexes/alias table it needs internally) — do not pull in
the rest of `classifier-core.js` (clustering, classification prompts) which is irrelevant here and
would bloat the deploy zip for no reason.

**Topic-side actors:** `topic.actors[]` (Phase 1b emission, already validated at staging-write time
per `EVENT_REGISTRY_PLAN.md` §"Exact change set" item 1b: "actors → strings ≤60 chars, max 3, drop any
that equal a country name") — still run each through the same `normalizeEntity` before comparing, so
"Donald Trump" (topic side) matches "Trump" (story side) etc.

## 5. Map file schema + lifecycle (recon Q5)

`threads/story-map.json` (S3, `globalperspective-world-280362093938`), sole writer =
`NewsProjectInvokeAgentLambda`(-dev):

```json
{
  "updated_at": "2026-09-14T08:00:00.000Z",
  "pairs": {
    "conflict#YEM#houthis": {
      "threadId": "thread-houthis-seize-strategic-red-sea-port-a1b2c3",
      "tier": 1,
      "matched_at": "2026-09-14T08:00:00.000Z",
      "topic_id": "t-abc123",
      "evidence": { "shared_url": "bbc.co.uk/news/articles/c4g7vr0lngwo" }
    },
    "war#GBR-NOR-RUS#nato": {
      "threadId": "thread-nato-allies-foil-russian-subsea-c-9f8e7d",
      "tier": 2,
      "matched_at": "2026-09-14T08:00:00.000Z",
      "topic_id": "t-def456",
      "evidence": { "shared_iso3": ["GBR", "NOR", "RUS"], "shared_actor": "nato" }
    }
  }
}
```

- Keyed by `storyId` (the tracker's join key — `situationId = "news#" + storyId`, so lookup is
  `pairs[storyId]`, O(1), no scan needed on the read side).
- `tier` (1|2) and `evidence` are kept for the week-long spot-check verification (recon Q7) and for
  the eventual "confirm on real tags" re-measurement — do not drop them to save bytes; the file is
  small (≤~80 open stories × ~300 bytes ≈ 24KB, trivial for S3/Lambda memory).
- **Expiry / size bound:** on every write, drop any pair whose `storyId` is no longer present in the
  current `stories/state/*` read (the story is gone/closed) — this is a natural consequence of only
  ever writing pairs computed from the current matching pass (the file is fully REPLACED each write,
  not merged/appended — simplest correct lifecycle, and matches the "sole writer, full snapshot"
  pattern `stories/index.json` itself already uses at
  `newsSituationIngest/src/index.js:198`). No separate TTL field is needed on the map file itself
  because it is never accumulated — each 4-hourly write is a fresh, complete recomputation from
  live `stories/state/*` + live `NewsCache` topics, so a pair simply stops being written once its
  story closes. This also naturally satisfies "drop pairs whose story is gone/closed" without extra
  code — closure = absence from the next `stories/state/*` read = absence from the next write.
- **Misinformation guard vs. thread TTL** (recon Q6 detail): `threadId` records in DDB
  `SummarizeAndPredict` (written by `newsThreadAnalysis/src/index.js:298`, `THREAD_TTL_DAYS = 90` at
  line 25) live for 90 days — far longer than any story stays open (stories close within days per the
  tracker's `CLOSE_AFTER_COOL_CHECKS`/`CLOSED_KEEP_HOURS` logic), so **the map file's own
  full-replace-every-cycle lifecycle already retires a pair long before the underlying thread record
  could expire** — no additional expiry guard is needed on top of "don't write pairs for stories that
  are gone." If this assumption ever breaks (e.g. a story stays open >90 days), the failure mode is
  already handled gracefully at the frontend: `ThreadPage.jsx:283` renders "Story arc not found" for a
  threadId whose DDB record is gone — not a wrong page, an honest empty state. This satisfies the
  hard misinformation requirement (never a WRONG link) even in that edge case; it is not the map
  writer's job to duplicate that guard.

## 6. Tracker-side edit point (recon Q5/Q6 continued)

Minimal-touch edits in `amplify/backend/function/newsSituationTracker/src/`:

1. `index.js:249` — add a third parallel read: `readStoryMap()` (new function, same lazy-`s3()`/
   `getJson()` helpers already in the file) → `getJson('threads/story-map.json')`. On any error or
   missing object, return `{ pairs: {} }` (fail open to "no links this sweep" — matches the plan's
   explicit rule "missing map file → tracker proceeds with nulls (never blocks)"). This is a read-only
   addition parallel to `readObservations()`/`readStories()`/`loadPriorStates()` — no change to their
   error handling.
2. `index.js:257-261` (the `for (const st of stories)` loop that calls `buildStorySituation`) — look
   up `const mapEntry = (storyMap.pairs || {})[st.storyId] || null;` and pass
   `mapEntry ? mapEntry.threadId : null` into `buildStorySituation` as a new 5th arg (or via the
   existing `storyOpts` object, e.g. `{ ...storyOpts, threadId: mapEntry && mapEntry.threadId }` —
   whichever keeps `situations-core.js`'s signature cleanest; `storyOpts` is already a catch-all
   options bag passed through, so extending it is the smaller diff).
3. `situations-core.js:276` — the ONE line to change:
   `threadId: (prev && prev.threadId) || null,` becomes
   `threadId: opts.threadId || null,` (dropping the `prev.threadId` carry-forward). **This is a
   deliberate behavior change, not a typo**: today `threadId` on news situations is dead code (nothing
   ever sets it, so it always folds to `null` anyway — confirmed by `grep -n "\.threadId\s*="` finding
   no news-side writer other than this line's own inheritance). Recomputing fresh from the map every
   sweep (rather than latching once-set) is required by the honesty rule in recon Q6: if a pair drops
   out of the map (story closed, or a later cycle produces a different/no match), the situation must
   stop claiming a link, not keep serving a stale one. `buildSituation` (GDACS, line 148) is
   UNTOUCHED — GDACS situations stay threadless by design (plan §4).
4. No IAM permission change needed for the *read* itself beyond adding the new prefix: tracker's
   policy `newsSituationTracker-pol` currently grants `s3:GetObject`/`PutObject`/`DeleteObject` +
   `ListBucket` scoped to `situations/*`, `world/*`, `shadow/*`, `stories/*` (verified via
   `aws iam get-role-policy --role-name newsSituationTracker-role --policy-name
   newsSituationTracker-pol`) — **`threads/*` is not in that list**, so add
   `arn:aws:s3:::globalperspective-world-280362093938/threads/*` to the `ReadWriteState` statement's
   `Resource` array (read-only is sufficient — `s3:GetObject` only; the tracker never writes
   `threads/*`) and to the `ListBucketScoped` statement's `s3:prefix` condition list (`"threads/*"`).
   Tracker does not need `PutObject`/`DeleteObject` on `threads/*` — it is a read-only consumer.

## 7. IAM deltas — exact commands (read-only recon only; NOT run)

**`NewsProjectInvokeAgentLambda-dev` role (`newsprojectLambdaRole1fd679db-dev`) — add S3, new policy
statement.** Current inline policy `lambda-execution-policy` is logs-only; do not touch the two
attached managed policies (`AmazonDynamoDBFullAccess`, `AmazonBedrockFullAccess`). Add a NEW inline
policy (do not overwrite `lambda-execution-policy` — merge-don't-clobber applies to policies too, add
a sibling):

```
aws iam put-role-policy --role-name newsprojectLambdaRole1fd679db-dev --policy-name matcher-s3-access --policy-document file:///path/to/matcher-s3-policy.json --region ap-northeast-1
```

`matcher-s3-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "ReadStoryState", "Effect": "Allow", "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::globalperspective-world-280362093938/stories/state/*" },
    { "Sid": "ListStoryState", "Effect": "Allow", "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::globalperspective-world-280362093938",
      "Condition": { "StringLike": { "s3:prefix": ["stories/state/*"] } } },
    { "Sid": "WriteStoryMap", "Effect": "Allow", "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::globalperspective-world-280362093938/threads/story-map.json" }
  ]
}
```

**`newsSituationTracker-role` — widen existing `ReadWriteState`/`ListBucketScoped` statements to add
`threads/*` read.** This IS an edit to the existing policy (merge-don't-clobber: fetch current
document, add the one prefix, put back the whole document) — bare command:

```
aws iam put-role-policy --role-name newsSituationTracker-role --policy-name newsSituationTracker-pol --policy-document file:///path/to/tracker-updated-policy.json --region ap-northeast-1
```

where `tracker-updated-policy.json` is the CURRENT document (fetched via `aws iam get-role-policy
--role-name newsSituationTracker-role --policy-name newsSituationTracker-pol`, §recon above) with
`"arn:aws:s3:::globalperspective-world-280362093938/threads/*"` appended to the `ReadWriteState`
statement's `Resource` array — **note this grants `GetObject`+`PutObject`+`DeleteObject` on
`threads/*`, wider than the tracker needs (read-only)**. Two options: (i) accept the slightly wider
grant for a smaller diff (reuse the existing statement, matching every other prefix's pattern in this
same policy), or (ii) add a dedicated read-only `Sid` for `threads/*` only. **Recommend (ii)** — least
privilege, and it's a 6-line addition, not a modification of the existing statement:

```json
{ "Sid": "ReadStoryMap", "Effect": "Allow", "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::globalperspective-world-280362093938/threads/story-map.json" },
{ "Sid": "ListStoryMapPrefix", "Effect": "Allow", "Action": ["s3:ListBucket"],
  "Resource": "arn:aws:s3:::globalperspective-world-280362093938",
  "Condition": { "StringLike": { "s3:prefix": ["threads/*"] } } }
```
appended as new statements to the same policy document (append to the `Statement` array; do not
touch `ReadWriteState`, `ListBucketScoped`, `Logs`, or `Metrics`).

## 8. Deploy method per Lambda (recon Q1 cadence note + known repo≠deployed drifts)

- **`NewsProjectInvokeAgentLambda-dev`**: per `EVENT_REGISTRY_PLAN.md` Phase 1b's own deploy note and
  prior S7/G6 precedent, this function has a history of repo≠deployed drift (deployed env carries a
  `GROK_MODEL`/`GROK_API_URL` pointing at DeepSeek, not xAI — confirmed live via
  `aws lambda get-function-configuration` during this recon, consistent with
  `feedback_misleading_grok_naming` in project memory). **Deploy as a small src-only zip**
  (`index.js` + `lib.js` + the two new files `url-normalize.js`/`entity-normalize.js` +
  `package.json`, NO `node_modules` — this Lambda's deployed zip pattern per the plan's Phase 1b
  section is "small src zip... no node_modules, G6-deploy pattern"). **Zip-diff the currently
  deployed code first** (`aws lambda get-function --function-name NewsProjectInvokeAgentLambda-dev
  --query Code.Location` → download → diff against repo `index.js`) before assuming repo state is
  what's live — this function has drifted before and the plan explicitly calls this out as a standing
  risk ("zip-diff `NewsProjectInvokeAgentLambda-dev` — repo≠deployed history!").
- **`newsSituationTracker`**: verified clean baseline pattern elsewhere in this plan (Phase 1b deployed
  it as "clean baseline... byte-identical to repo, verified") — straight zip of `index.js` +
  `situations-core.js` + `package.json`, no drift expected, but re-verify byte-identity before this
  deploy too (cheap: `aws lambda get-function` → diff) since time has passed since the last
  confirmation.
- Both deploys are independent and can ship in either order or separately: the writer
  (`NewsProjectInvokeAgentLambda`) shipping alone is a no-op until the reader (`newsSituationTracker`)
  also ships (map file exists but nothing reads it — harmless); the reader shipping alone before the
  writer is also harmless (reads a missing map file → `pairs: {}` → all nulls, current behavior
  unchanged). **No ordering constraint, unlike the Phase 1b env-var-before-code-deploy gotcha
  elsewhere in this codebase** — this is a purely additive read/write pair with a safe default on
  both sides.

## 9. Verification plan (recon Q7)

1. After both deploys, force one `NewsProjectInvokeAgentLambda-dev` generation cycle (invoke with
   `readOnly:false` per its existing action contract) and confirm `threads/story-map.json` exists in
   S3 with a plausible pair count (expect roughly Phase 0/1c's ~32-35% of that cycle's topic count,
   i.e. a handful of pairs per ~13 topics/cycle — do not expect all topics to have a pair, that's
   by design).
2. Confirm one `newsSituationTracker` sweep (next scheduled `rate(30 minutes)` run, or manual invoke)
   picks up the map: spot-check that a `news#<storyId>` situation whose `storyId` is a key in
   `story-map.json` now has `threadId` set in `world/latest.json`, and that opening
   `/weekly/thread/<that threadId>` on the live site shows the correct, same-event thread (manual
   click-through — the exact kind of check `feedback_test_ui_in_browser` calls for, since this reaches
   the frontend even though no frontend code changed).
3. Run this spot-check daily for the plan's stated "for a week" window; count links/day (read
   `story-map.json`'s pair count over several days) to see coverage stabilize near the measured
   ~32%(Tier1)/~35%(Tier1∪R3) rate — a large deviation either direction is a signal something's off
   (e.g. IAM silently failing and falling back to empty pairs → 0 links/day for days, should trip the
   existing CloudWatch/log monitoring since the matcher's `catch` block should log a warning every
   cycle it fails).
4. **Ship-gate for the R3 (Tier 2) half specifically**: do NOT enable R3 in the matcher's rule set
   until the operator/agent re-runs the Phase 0c/1c measurement protocol against ~1 week of REAL
   Phase 1b production tags (not the Sonnet backfill proxy) and confirms 0 hand-labeled false
   positives, per `EVENT_REGISTRY_PLAN.md` Phase 1c §9(c). **Recommend shipping Tier 1 (URL-exact)
   alone first** — it has no such pending gate (Phase 0 already measured it on 100% real data, 0 FP)
   — and adding the R3 rule as a follow-up, config-flagged addition once the real-tag re-measurement
   passes. This decouples "ship the bridge" from "ship the fingerprint tier," which the plan's own
   phase numbering (0/0b/0c vs 1b/1c) already treats as separate gates; the build should honor that
   separation with a simple `ENABLE_R3_TIER` env flag (default `false`) on
   `NewsProjectInvokeAgentLambda-dev` rather than hard-coding both tiers live from day one.

## 10. Rollback

Confirmed true from the tracker's read design (§6): deleting or emptying `threads/story-map.json`
(`{"updated_at": ..., "pairs": {}}`) makes every `mapEntry` lookup miss on the very next sweep →
`threadId: opts.threadId || null` evaluates to `null` for every news situation → identical to today's
(pre-matcher) behavior. No situation state needs to be touched, no DDB rows need to change, no
frontend redeploy — this is a true one-file rollback, matching the plan's own claim ("rollback = stop
writing the map file (tracker falls back to null threadId)"). To roll back the *writer* instead
(stop `NewsProjectInvokeAgentLambda-dev` from computing/writing pairs at all), redeploy its prior zip
— the matcher code is entirely additive and isolated in its own `try/catch`, so even leaving the old
matcher code in place but simply deleting the S3 object achieves the same effect with less deploy
risk. **Recommended rollback path: delete/empty the S3 object, not a code redeploy** — faster, lower
risk, and sufficient per the design.

## 11. Answers to recon questions 1-7 (concise)

1. **Placement**: inline in `NewsProjectInvokeAgentLambda`, in the existing threadId-assignment
   try/catch block (`index.js:124-142`). Rejected tracker-inline (needs new DynamoDB IAM class, worse
   isolation, cadence mismatch) and a new Lambda (unnecessary — (a) already isolated, zero new infra).
2. **ThreadId source**: `stagingItem.topics` (raw, in-memory, from `NewsCache` id=`staging`), read at
   `index.js`'s `loadTopics()` and iterated at `index.js:132-137`; `sources[].url`/`iso3`/`actors`/
   `event_type` all present on the same raw objects (Phase 1b carry-through).
3. **URL normalization**: verbatim JS port of Phase 0's `match.py` `normalize_url()` (host lowercase,
   strip `www.`, strip trailing slash, drop a fixed tracking-param list, sort remaining query params)
   — new module `NewsProjectInvokeAgentLambda/src/url-normalize.js`, not shared elsewhere (Phase 0's
   script was throwaway).
4. **Actor normalization**: reuse `normalizeEntity`/`ACTOR_ALIASES`/the two regexes from
   `newsSituationIngest/src/classifier-core.js:85-121`, copied byte-identical into a new
   `NewsProjectInvokeAgentLambda/src/entity-normalize.js` with the same "keep byte-identical" header
   convention already used for `situations-core.js`. Story-side `entities[]` (beyond `entities[0]`,
   which alone is normalized inside `clusterStories`) is otherwise raw and must be normalized by the
   matcher itself.
5. **Map schema/lifecycle**: `threads/story-map.json`, keyed by `storyId`, full-replace every write
   (no merge/append, no separate expiry field needed — closure = absence from the next
   `stories/state/*` read = absence from the next write). Tracker edit point:
   `situations-core.js:276`, changing `threadId: (prev && prev.threadId) || null` to
   `threadId: opts.threadId || null` (stop latching, always reflect the current map).
6. **Failure modes**: missing/unreadable map file → tracker proceeds with `pairs: {}` → all null,
   never blocks (matches plan's stated rule). Ambiguous match → null (both tiers already null on
   ties by construction). Thread TTL (90 days, `newsThreadAnalysis/src/index.js:25`) can't realistically
   outlive the map's own every-cycle-refresh lifecycle since stories close in days, not months; the
   frontend's existing "Story arc not found" empty state (`ThreadPage.jsx:283`) is the backstop even
   in an edge case — no additional expiry guard needed beyond the full-replace write pattern.
7. **Verification/rollback**: manual invoke → S3 object check → tracker sweep → click-through
   verify on the live thread page → daily spot-check + count links/day for a week. Rollback = delete
   or empty `threads/story-map.json` (confirmed sufficient from the tracker's null-fallback read
   design) — no code redeploy required, though reverting the writer's zip is also safe if preferred.

## 12. Ship-gate restated

**Tier 1 (URL-exact)**: no pending gate — Phase 0 already measured 0 FP on 100% real production data.
Safe to ship as soon as the writer/reader deploys above land and are verified.

**Tier 2 (R3 fingerprint)**: gate is UNCHANGED from the plan — do not enable until R3 is re-confirmed
at 0 hand-labeled false positives on ~1 week of REAL Phase 1b production tags (not the Sonnet-backfill
proxy that produced the PASS-but-not-certain verdict in `EVENT_REGISTRY_PHASE1C_RESULTS.md`). Ship it
behind a config flag (`ENABLE_R3_TIER`, default off) so Tier 1 is not held hostage to that
re-measurement.

## 13. Open items / could not fully resolve

- Could not find the EventBridge rule (or other trigger — API Gateway/orchestrator invoke) that fires
  `NewsProjectInvokeAgentLambda`'s generation cycle on the plan's stated "4-hourly" cadence — checked
  `aws events list-rules` broadly and found only `TriggerSituationIngest` (rate 1h) and
  `TriggerSituationTracker` (rate 30min) for this subsystem; the editorial generation trigger is
  presumably `newsInvokeGemini`'s own schedule invoking this Lambda downstream, or an external
  cron/orchestrator not visible as an EventBridge rule in this account/region. Does not block the
  spec (the matcher runs inside the existing handler regardless of what triggers it) but the
  orchestrator should confirm actual cadence before finalizing the "runs every ~4h" cost/staleness
  claims in §1.
- Did not verify the exact deployed byte-state of either target Lambda beyond what
  `get-function-configuration`/`get-role-policy` show (env vars + IAM) — a full zip diff (per §8's own
  instruction) was intentionally NOT performed as part of this read-only recon since that would need
  downloading and diffing deployment packages, which is closer to a pre-deploy step than a spec-writing
  step; flagging this as the first action for whoever executes this spec, not a gap in the spec itself.
- `stories/state/*` has no observed prune/lifecycle policy (verified only that
  `newsSituationIngest/src/index.js` overwrites per-storyId keys, never deletes) — its unbounded
  slow growth over calendar time is a pre-existing characteristic of the map pipeline, not something
  this matcher introduces, but it does mean the `ListObjectsV2` cost on the matcher's read side will
  grow slowly over months; not a blocker at today's ~800-object scale, worth a note for whoever later
  revisits Phase 2 (shared ingest) since that phase touches this exact prefix.
