# Phase 1b tag-emission recon (read-only)

Date: 2026-09-11. Scope: four facts required before drafting prompt/schema diffs for
`EVENT_REGISTRY_PLAN.md`'s Phase 1b (additive `iso3[]`/`actors[]`/`event_type` tag emission on
`newsInvokeGemini` topics + `newsSituationIngest` classifier). No repo edits, no AWS mutations,
no Lambda invokes were performed anywhere in this recon.

## FACT 1 — topic field plumbing (does iso3/actors/event_type survive the pipeline?)

**Verdict: DROPPED at two independent whitelist sites; the rest of the pipeline is pass-through.**

- **Staging DDB item** (`newsInvokeGemini`, `writeCache`, `amplify/backend/function/newsInvokeGemini/src/index.js:418-461`, item field `topics`): **DROPPED at `index.js:738-758`** — the `normalized` map that builds each topic before write is a strict whitelist. New fields aren't in the LLM instruction schema (`index.js:638-650`, current 11 required + 1 optional = 12 fields: title, category, search_keywords, regions, sources[], x_trending, significance, urgency, urgencyReason, primaryCountry, mentionedCountries, +optional continues_topic) nor in the `normalized` whitelist, so they'd be silently discarded even if the LLM emitted them today.
- **Active/latest DDB item**: **PASS-THROUGH** — `swapStagingToActive` (`NewsProjectInvokeAgentLambda/src/index.js:807-834`) does `{ ...stagingItem, id: ACTIVE_ITEM_ID, status: 'active', activatedAt }`, a full spread. Whatever survives into staging survives here unchanged.
- **`archive#YYYY-MM-DD` items**: **DROPPED at two sites.**
  1. `buildTopic()` (`NewsProjectInvokeAgentLambda/src/index.js:269-294`) — whitelist (`id, topicId, title, description, categories, regions, primary_location, location_context, sources, search_keywords, continues_topic`) applied when staging topics are loaded for AI-generation/threading; feeds `buildAndWriteArchive`.
  2. `buildArchiveEntry()` (`NewsProjectInvokeAgentLambda/src/index.js:910-924`) — second whitelist (`topicId, threadId, title, category, regions, search_keywords, sources, archivedAt, generationId, ai, continues_topic`) that builds the actual archive entry.
  Both need the three new fields added or archive entries will silently lack them even after `latest`/`active` carries them.
- **`newsSensitiveData` "topics" action** (primary frontend/proxy read path, `action==='topics'` at `index.js:256-269` → `readTopicsCache()` at `index.js:1426-1483`): **PASS-THROUGH** — returns `data: Item` (whole active DDB item, unmodified).
  - Secondary, non-critical-path responses in the same file DO whitelist and would also need edits if those specific responses should carry the new fields: the recent/date-range digest (`index.js:1688-1697`) and the RSS-feed fallback (`index.js:2081-2090`), both `t => ({ topicId, title, category, regions, sources, ... })`. `readNarrativeThread`'s "today" branch (`index.js:1844`, `{ ...t, date, source }`) is pass-through.
- **Frontend**: no schema/type-stripping layer. Plain property access (e.g. `Home.jsx:435`, `WorldMapV2.jsx:572`, `composeTopicsLede.js:91` read `topic.primaryCountry`). New fields pass through untouched; only explicit consumers need to be written to use `iso3`/`actors`/`event_type`.

**Concrete edit list for Fact 1 (main path: LLM → staging → active → frontend):**
1. `newsInvokeGemini/src/index.js:638-650` — add `iso3`, `actors`, `event_type` to the LLM instruction/schema.
2. `newsInvokeGemini/src/index.js:738-758` — add the same three fields to the `normalized` whitelist (staging-write map).
3. `NewsProjectInvokeAgentLambda/src/index.js:807-819` — no change (already spreads through).
4. For archive parity: `NewsProjectInvokeAgentLambda/src/index.js:269-294` (`buildTopic`) and `:910-924` (`buildArchiveEntry`) both need the three fields added.
5. Optional (only if those two secondary `newsSensitiveData` responses should also carry the fields): `index.js:1690-1697` and `index.js:2082-2089`.

## FACT 2 — token headroom in newsInvokeGemini

**Verdict: thin/marginal headroom today; raise `max_tokens` (hardcoded, not env) as part of this change.**

- Note in passing: despite the function name, `newsInvokeGemini` calls **xAI/Grok** (`GROK_API_URL`), not Gemini.
- `max_tokens = 8192`, **hardcoded** at `index.js:683`. No env override exists for completion length.
- Current topic schema = 12 fields/topic (listed above under Fact 1).
- `TOPICS_LIMIT`: code default `15` (`index.js:25`), hard-capped at `Math.min(20, ...)` (`index.js:531-532`). **Live prod override present and currently set to 13** (env var `TOPICS_LIMIT` exists on `newsInvokeGemini-dev`; other live env var names: `TOPICS_DDB_TABLE, XAI_API_KEY_BACKUP, WORLD_BUCKET, GROK_API_URL, BRAVE_SEARCH_API_KEY, GROK_MODEL, OPENAI_API_KEY, XAI_API_KEY, ENV, BRAVE_CONCURRENCY, REGION` — no value printed for any secret-shaped var).
- **Truncation evidence: FOUND.** Salvage path logs `extractJson: salvaged N topics from truncated output` (code at `index.js:202-261`). Across ~19 scheduled runs (2026-09-08 to 09-11): one run (`2026-09-10T04:00:47Z`) hit the cap exactly (`finish_reason: length`, `completion_tokens: 8192`) and needed salvage (20 topics recovered from truncated output). The other 18 finished `stop` with completion_tokens 4066-7741 (mean ≈5677, ~69% of cap); several runs (7478, 7741) already sit within 5-9% of the ceiling.
- **Token math**: iso3 (1-3 codes) + actors (1-3 short strings) + event_type (1 enum word) ≈ **~20 tokens/topic** (assumption stated by the sub-agent, JSON overhead included). At live `TOPICS_LIMIT=13` → **+~260 tokens** per run; at code default 15 → **+~300**; at hard cap 20 → **+~400**.
- **Conclusion**: adding the fields would push the heaviest already-observed run (7741) to ~8000 — within ~2% of the current ceiling — on top of an existing ~5% truncation rate in this small sample. **Recommend raising `max_tokens` at `index.js:683` from 8192 to ~10000-12000** as part of the Phase 1b change. This is a code-constant edit, not an env var (none exists for it today).

## FACT 3 — map-side (`newsSituationIngest`) actor quality at corpus scale

**Verdict: existing data is NOT sufficient; the classifier prompt needs an explicit actor-quality nudge.**

- Corpus: `t3c-measure/corpus/**/*.jsonl`, 62 files / 24,515 raw lines → deduped by `url` (21,241 dupes from repeated hourly RSS snapshots) → **3,274 unique classified articles**, all carrying `entities[]`. (Aggregated `stories/*.json` / `phase0*` story-state files were deliberately excluded as derived/deduped unions of the same underlying extractions, to avoid double-counting.)
- Country set: all 141 `ISO3_NAME` values from `situationLabels.js` + ~25 manual variants.
- **9,780 total entity values across 3,274 articles:**
  - Country-name entity values: **2,119 / 9,780 = 21.7%**
  - Non-country entity values: **7,661 / 9,780 = 78.3%**
  - Articles with ≥1 non-country entity: **3,239 / 3,274 = 98.9%**
- Manual spot-check of 80 "non-country" samples: **~38% genuine named actor** (person/org/group: Celine Dion, Ruslan Kravchenko, FBI, Arm Holdings, Houthis, Hezbollah, AfD, BRICS, Real Madrid), **~22% non-country place** (London, Hong Kong, Strait of Hormuz), **~3% actually-missed countries** (hand-built list gap, e.g. Burundi), **~35% generic/abstract junk with no named referent** ("tariffs," "AI," "protests," "diplomats," "military build-up").
- **Reasoning**: even after subtracting country-name contamination (21.7%), only roughly a third of the remainder is a genuine specific named person/org — the rest is non-country places or abstract nouns, neither of which anchors a two-subject fingerprint any better than a country name does. This matches and extends the Phase 0c hand-labeled 21-pair finding (every fingerprint-driving "shared actor" there was a bare country) to full-corpus scale.
- **Conclusion**: `newsSituationIngest`'s classifier prompt (`amplify/backend/function/newsSituationIngest/src/classifier-core.js`) should be tightened beyond "not a country" to explicitly require a **specific named person, organization, or group** — not a place, event, or abstract noun-phrase — as part of Phase 1b, not deferred.

## FACT 4 — deployed vs. repo source for newsInvokeGemini and newsSituationIngest

**Verdict: newsInvokeGemini is DRIFTED (1 file, 1 known line); newsSituationIngest is CLEAN.**

### newsInvokeGemini-dev
- Zip **has** `node_modules/` (full zip-with-deps deploy method — index.js, event.json, outlet_metadata.js, package.json, package-lock.json, source_enrichment.js, node_modules/).
- Only `index.js` differs from repo (excluding node_modules/package-lock.json/event.json/.DS_Store/test_enrichment.js, which are non-source or repo-only extras):
```
--- extracted/index.js (deployed)
+++ repo src/index.js
@@ -21,7 +21,7 @@
   }
 }

-const MODEL_NAME = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
+const MODEL_NAME = process.env.GROK_MODEL || 'deepseek-v4-flash'; // grok-4-1 fallback was dead; set to live model (verified 2026-09-08)
 const DEFAULT_LIMIT = 15;
```
- This is exactly the expected known diff (MODEL_NAME env-var fallback default). **Implication for Phase 1b: whatever prompt/schema edits land in `newsInvokeGemini/src/index.js` for tag emission must be deployed as a fresh zip that also carries this MODEL_NAME line correctly (repo's `deepseek-v4-flash` fallback, unless the live `GROK_MODEL` env var already overrides it — recon didn't check that value, only that the env var name exists) — don't hand-patch just the new fields onto the currently-deployed (stale) zip.**

### newsSituationIngest
- Exact function name: `newsSituationIngest` (no `-dev` suffix).
- Zip does **not** have `node_modules/` (code-only deploy: classifier-core.js, index.js, package.json — deps via layer/runtime).
- No content diffs: `index.js`, `classifier-core.js`, `package.json` byte-identical to repo. Only difference is `classifier-core.test.mjs` present in repo but correctly omitted from the deploy zip.
- **CLEAN** — confirms the 2026-09-10 redeploy is intact.

## GO / NO-GO / CAVEATS

**GO**, with the following load-bearing caveats before writing the prompt diffs:

1. **Fact 1 mandates 2 (main path) + 2 (archive path) edits, not just a prompt change.** Adding `iso3`/`actors`/`event_type` to the LLM instructions alone does nothing — they'll be silently dropped at `newsInvokeGemini/src/index.js:738-758` before the staging item is even written. Must also touch `NewsProjectInvokeAgentLambda/src/index.js:269-294` and `:910-924` for archive parity, or the map-side backfill signal for old/archived topics will be permanently thin even after the live pipeline is fixed forward.
2. **max_tokens should rise** from 8192 to ~10000-12000 at `newsInvokeGemini/src/index.js:683` (hardcoded constant) in the same change — current headroom is thin (~5% truncation already observed in a 4-day sample) and 3 new fields × TOPICS_LIMIT will erode it further.
3. **The map-side classifier prompt (`newsSituationIngest/src/classifier-core.js`) needs its own actor-quality tightening**, not just a passive "already emits most of it" — corpus-scale measurement (3,274 articles) shows only ~38% of non-country entities are genuine named actors; the rest is places/abstractions. Without a "must be a specific named person/org/group, never a place, event, country, or abstract noun-phrase" instruction, the story-side actor field for the future fingerprint tier will remain mostly noise.
4. **Deploy discipline**: `newsInvokeGemini-dev` is currently drifted from repo by the known MODEL_NAME line; the next deploy must ship the full corrected `index.js` (repo version, `deepseek-v4-flash` fallback + comment) together with the new tag-emission code — not a hand-patch layered onto the stale deployed zip. `newsSituationIngest` is clean and safe to diff/deploy normally.
5. Both `newsSensitiveData` secondary whitelists (`index.js:1690-1697`, `:2082-2089`) are optional edits — only needed if the recent-digest or RSS-fallback responses should also carry the new fields; the primary frontend "topics" read path already passes them through once staging/active carry them.

No blockers found that would make Phase 1b unsafe to build; the four facts above should go directly into the prompt/schema diff plan.
